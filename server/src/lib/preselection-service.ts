import { Prisma } from '@prisma/client'
import type { MatchSuggestion as DbMatchSuggestion, Opportunity as DbOpportunityRow } from '@prisma/client'
import type {
  MatchClosedReason,
  MatchSuggestionStatus,
  PreselectionFilters,
  PreselectionResult,
  PreselectionTop,
  PreselectionTransmitOutcome,
} from '../../../src/types/index.js'
import { prisma } from './prisma.js'
import { toDomainCandidateProfile, toDomainOpportunity } from './domain.js'
import { parseCvFlags } from './cv-flags.js'
import { getMatchingConfig, notifyRecruiterOfProposal } from './matching.js'
import { notifyUser } from './notify.js'
import {
  ADMIN_ALLOWED_TRANSITIONS,
  OPPORTUNITY_FILLED_REASON,
  RECRUITER_ALLOWED_TRANSITIONS,
  SYSTEM_ALLOWED_TRANSITIONS,
  preselect,
} from './preselection.js'
import { closedReasonData, connectedAtData, filledAtOf } from './hiring-store.js'

/**
 * Accès base de la présélection ATS et des transitions admin. La logique de
 * filtrage et de classement est dans `lib/preselection.ts` (pure).
 */

export interface PreselectionOptions {
  top: PreselectionTop
  filters: PreselectionFilters
}

/**
 * Présélection d'une offre : charge TOUS les comptes candidats (les
 * inéligibles sont comptés par motif, pas masqués) et l'état de leur
 * suggestion éventuelle. `null` si l'offre n'existe pas. Aucun appel IA.
 */
export async function loadPreselection(
  opportunityId: string,
  options: PreselectionOptions,
): Promise<PreselectionResult | null> {
  const opportunity = await prisma.opportunity.findUnique({
    where: { id: opportunityId },
    include: { recruiter: { select: { role: true, status: true } } },
  })
  if (!opportunity) return null

  const [profiles, suggestions] = await Promise.all([
    prisma.candidateProfile.findMany({
      where: { user: { role: 'candidate' } },
      include: { user: { select: { email: true, role: true, status: true } } },
    }),
    prisma.matchSuggestion.findMany({
      where: { opportunityId },
      select: { id: true, candidateId: true, status: true, origin: true },
    }),
  ])
  const suggestionByCandidate = new Map(suggestions.map((s) => [s.candidateId, s]))

  return preselect({
    opportunity: toDomainOpportunity(opportunity),
    recruiter: opportunity.recruiter,
    candidates: profiles.map((p) => {
      const suggestion = suggestionByCandidate.get(p.userId)
      return {
        candidateId: p.userId,
        email: p.user.email,
        profile: toDomainCandidateProfile(p, p.user.email),
        accountRole: p.user.role,
        accountStatus: p.user.status,
        consentAt: p.matchingConsentAt,
        hasCv: Boolean(p.cvUrl),
        cvVerificationStatus: p.cvVerificationStatus,
        cvFlagCount: parseCvFlags(p.cvFlags).length,
        cvSkillsSuggested: p.cvSkillsSuggested,
        sector: p.sector,
        suggestion: suggestion ? { id: suggestion.id, status: suggestion.status, origin: suggestion.origin } : null,
      }
    }),
    top: options.top,
    filters: options.filters,
    threshold: getMatchingConfig().threshold,
    now: new Date(),
  })
}

/* ------------------------------------------------------------------ */
/* Transitions du dossier — unique implémentation                      */
/* ------------------------------------------------------------------ */

export const NO_CONSENT_ERROR =
  'Ce candidat n’a pas donné (ou a retiré) son accord pour que son profil soit proposé aux entreprises. Transmission impossible.'

export const NO_CONSENT_CONNECT_ERROR =
  'Ce candidat a retiré son accord pour que son profil soit proposé aux entreprises : la mise en relation est impossible.'

export const CANDIDATE_INACTIVE_ERROR =
  'Le compte de ce candidat n’est plus actif : la mise en relation est impossible pour le moment.'

export const STALE_SUGGESTION_ERROR = 'Ce dossier a changé entre-temps. Rechargez la page.'

export type TransitionCheck = { ok: true } | { ok: false; httpStatus: 400 | 409; error: string }

const TRANSITION_TABLES = {
  admin: ADMIN_ALLOWED_TRANSITIONS,
  recruiter: RECRUITER_ALLOWED_TRANSITIONS,
  system: SYSTEM_ALLOWED_TRANSITIONS,
} as const

/**
 * Règles communes à toute transition d'un dossier, qu'elle vienne d'un
 * admin (`ADMIN_ALLOWED_TRANSITIONS`), du recruteur qui fixe un entretien
 * (`RECRUITER_ALLOWED_TRANSITIONS`, décision 2026-10-14) ou du système qui
 * clôt les dossiers d'une offre pourvue (`SYSTEM_ALLOWED_TRANSITIONS`,
 * décision D1 — écarter seulement) :
 * - la transition doit figurer dans la table de l'acteur ;
 * - aucun profil ne part chez un recruteur, ni n'est mis en relation, sans
 *   le consentement en vigueur du candidat (relu en base par l'appelant) ;
 * - pas de mise en relation avec un compte candidat suspendu ou banni.
 */
export function checkMatchTransition(input: {
  actor: 'admin' | 'recruiter' | 'system'
  from: MatchSuggestionStatus
  to: MatchSuggestionStatus
  hasConsent: boolean
  /** Compte candidat suspendu ou banni (même définition que `isAccountBlocked`). */
  candidateBlocked?: boolean
}): TransitionCheck {
  const table: Partial<Record<MatchSuggestionStatus, MatchSuggestionStatus[]>> = TRANSITION_TABLES[input.actor]
  const allowed = table[input.from] ?? []
  if (!allowed.includes(input.to)) {
    return { ok: false, httpStatus: 400, error: `Transition ${input.from} → ${input.to} non autorisée.` }
  }
  if (input.to === 'proposee_recruteur' && !input.hasConsent) {
    return { ok: false, httpStatus: 409, error: NO_CONSENT_ERROR }
  }
  if (input.to === 'mise_en_relation') return connectionCheck(input.hasConsent, input.candidateBlocked)
  return { ok: true }
}

/**
 * Conditions d'une mise en relation, y compris quand un entretien est
 * ajouté à un dossier déjà en `mise_en_relation` : compte candidat actif et
 * consentement en vigueur.
 */
export function connectionCheck(hasConsent: boolean, candidateBlocked = false): TransitionCheck {
  if (candidateBlocked) return { ok: false, httpStatus: 409, error: CANDIDATE_INACTIVE_ERROR }
  if (!hasConsent) return { ok: false, httpStatus: 409, error: NO_CONSENT_CONNECT_ERROR }
  return { ok: true }
}

type TxClient = Prisma.TransactionClient | typeof prisma

/**
 * Écrit la transition SEULEMENT si le dossier est toujours dans le statut lu
 * (`updateMany` conditionnel) : deux requêtes concurrentes (double clic,
 * deux admins) ne font jamais avancer deux fois le même dossier. `null` si
 * le dossier a changé entre-temps. Vers `mise_en_relation`, date aussi la
 * mise en relation (`connectedAt`, client Prisma régénéré ; sinon la
 * réparation au démarrage la reprend du journal d'audit). `closedReason` :
 * raison d'une clôture automatique vers `ecartee` (offre pourvue).
 */
export async function commitMatchTransition(
  client: TxClient,
  input: {
    id: string
    from: MatchSuggestionStatus
    to: MatchSuggestionStatus
    extraData?: Pick<Prisma.MatchSuggestionUncheckedUpdateInput, 'score' | 'reasons' | 'preselectionRank'>
    closedReason?: MatchClosedReason
  },
): Promise<DbMatchSuggestion | null> {
  const { count } = await client.matchSuggestion.updateMany({
    where: { id: input.id, status: input.from },
    data: {
      ...input.extraData,
      ...connectedAtData(input.to),
      ...(input.closedReason && input.to === 'ecartee' ? closedReasonData(input.closedReason) : {}),
      status: input.to,
    },
  })
  if (count === 0) return null
  return client.matchSuggestion.findUnique({ where: { id: input.id } })
}

export interface MiseEnRelationNotice {
  candidate: {
    event: string
    title: string
    message: string
    email: { subject: string; body: string[]; actionLabel: string }
  }
  recruiter: { title: string; message: string }
}

/**
 * Seul moment où le candidat est notifié (plateforme + email) : il est
 * retenu, et c'est aussi le seul moment où il apprend le nom de
 * l'entreprise. Le recruteur reçoit une notification dans la plateforme.
 * `notice` remplace le texte par défaut (entretien fixé par le recruteur,
 * lib/interviews.ts). Ne lève jamais.
 */
export async function notifyMiseEnRelation(
  suggestion: Pick<DbMatchSuggestion, 'candidateId' | 'opportunityId'>,
  opportunity: Pick<DbOpportunityRow, 'recruiterId' | 'title' | 'companyName'>,
  notice?: MiseEnRelationNotice,
): Promise<void> {
  const { companyName, title } = opportunity
  const candidate = notice?.candidate ?? {
    event: 'mise_en_relation',
    title: 'Mise en relation confirmée',
    message: `OffRec vous met en relation avec ${companyName} pour « ${title} ».`,
    email: {
      subject: 'Votre profil a été retenu — OffRec',
      body: [
        `Votre profil a été retenu par ${companyName} pour l’offre « ${title} ».`,
        'OffRec organise la mise en relation et vous recontacte pour les prochaines étapes. Vous pouvez suivre ce dossier depuis votre espace.',
      ],
      actionLabel: 'Voir le dossier',
    },
  }
  await notifyUser({
    userId: suggestion.candidateId,
    event: candidate.event,
    title: candidate.title,
    message: candidate.message,
    link: `/candidat/offres/${suggestion.opportunityId}`,
    email: candidate.email,
  })
  const recruiter = notice?.recruiter ?? {
    title: 'Mise en relation confirmée',
    message: `OffRec vous met en relation avec un candidat pour « ${title} ».`,
  }
  try {
    await prisma.notification.create({
      data: {
        userId: opportunity.recruiterId,
        title: recruiter.title,
        message: recruiter.message,
        link: '/recruteur/candidatures',
      },
    })
  } catch (err) {
    console.error('[match] Notification du recruteur impossible', err)
  }
}

export type AdminTransitionResult =
  | { ok: true; suggestion: DbMatchSuggestion }
  | { ok: false; httpStatus: 400 | 409; error: string }

interface AdminTransitionInput {
  suggestion: Pick<DbMatchSuggestion, 'id' | 'status' | 'candidateId' | 'opportunityId'>
  /** Ligne complète de préférence : `filledAt` (offre pourvue) y est relu. */
  opportunity: Pick<DbOpportunityRow, 'recruiterId' | 'title' | 'companyName'>
  /** Consentement de matching en vigueur du candidat, relu en base par l'appelant. */
  hasConsent: boolean
  /** Compte candidat suspendu ou banni, relu en base par l'appelant. */
  candidateBlocked?: boolean
  to: MatchSuggestionStatus
  actorId: string
  /** Colonnes mises à jour avec le statut (rang de présélection, score rafraîchi). */
  extraData?: Pick<Prisma.MatchSuggestionUncheckedUpdateInput, 'score' | 'reasons' | 'preselectionRank'>
  /** Champs ajoutés au journal d'audit. */
  auditExtra?: Record<string, string | number | boolean>
}

/**
 * Fait avancer une suggestion côté admin : règles communes
 * (`checkMatchTransition`), écriture conditionnelle
 * (`commitMatchTransition`), journal d'audit et notifications. Utilisé par
 * le PATCH unitaire ET par la transmission groupée de la présélection : les
 * deux appliquent exactement les mêmes règles et effets. Le recruteur qui
 * fixe un entretien passe par les mêmes briques (lib/interviews.ts).
 */
export async function applyAdminTransition(input: AdminTransitionInput): Promise<AdminTransitionResult> {
  const { suggestion: existing, opportunity, to } = input
  const check = checkMatchTransition({
    actor: 'admin',
    from: existing.status,
    to,
    hasConsent: input.hasConsent,
    candidateBlocked: input.candidateBlocked,
  })
  if (!check.ok) return check
  // Offre pourvue (D1) : plus aucun profil transmis ni mis en relation ;
  // écarter reste possible.
  if ((to === 'proposee_recruteur' || to === 'mise_en_relation') && filledAtOf(opportunity)) {
    return { ok: false, httpStatus: 409, error: OPPORTUNITY_FILLED_REASON }
  }

  const suggestion = await commitMatchTransition(prisma, {
    id: existing.id,
    from: existing.status,
    to,
    extraData: input.extraData,
  })
  if (!suggestion) return { ok: false, httpStatus: 409, error: STALE_SUGGESTION_ERROR }

  await prisma.auditLog.create({
    data: {
      userId: input.actorId,
      action: 'match_suggestion_status',
      metadata: { suggestionId: suggestion.id, from: existing.status, to, ...input.auditExtra },
    },
  })

  if (to === 'proposee_recruteur') {
    await notifyRecruiterOfProposal(opportunity)
  }
  if (to === 'mise_en_relation') {
    await notifyMiseEnRelation(existing, opportunity)
  }

  return { ok: true, suggestion }
}

/* ------------------------------------------------------------------ */
/* Transmission groupée depuis la présélection                         */
/* ------------------------------------------------------------------ */

export interface TransmitPreselectionResult {
  preselection: PreselectionResult
  outcomes: PreselectionTransmitOutcome[]
}

/**
 * Transmet au recruteur une sélection de candidats de la présélection.
 *
 * La présélection est RECALCULÉE ici avec les mêmes options que celles
 * affichées à l'admin : seul un candidat retenu (top N) et transmissible
 * part chez le recruteur, avec son rang. Un candidat éliminé — y compris
 * « déjà écarté pour cette offre » — est refusé individuellement : une ligne
 * `ecartee` n'est jamais réactivée ici. Chaque transmission passe par
 * `applyAdminTransition` (consentement, transition, notification du
 * recruteur, journal d'audit). Un refus ne fait pas échouer les autres.
 * `null` si l'offre n'existe pas.
 */
export async function transmitPreselection(
  opportunityId: string,
  candidateIds: string[],
  options: PreselectionOptions,
  actorId: string,
): Promise<TransmitPreselectionResult | null> {
  const [preselection, opportunity] = await Promise.all([
    loadPreselection(opportunityId, options),
    prisma.opportunity.findUnique({ where: { id: opportunityId } }),
  ])
  if (!preselection || !opportunity) return null

  const rankedById = new Map(preselection.ranked.map((entry) => [entry.candidateId, entry]))
  const eliminatedById = new Map(preselection.eliminated.map((entry) => [entry.candidateId, entry]))
  const outcomes: PreselectionTransmitOutcome[] = []

  for (const candidateId of candidateIds) {
    const entry = rankedById.get(candidateId)
    const refuse = (reason: string, fullName: string | null = entry?.fullName ?? null) =>
      outcomes.push({
        candidateId,
        fullName,
        transmitted: false,
        reason,
        rank: entry?.rank ?? null,
        suggestionId: entry?.suggestion?.id ?? null,
      })

    if (!entry) {
      const eliminated = eliminatedById.get(candidateId)
      if (eliminated) {
        refuse(`Hors présélection : ${eliminated.motifLabel.toLowerCase()}.`, eliminated.fullName)
      } else {
        // Qualifié mais au-delà du top N demandé, ou identifiant inconnu.
        refuse('Ce candidat ne fait pas partie des profils retenus dans la présélection affichée.')
      }
      continue
    }
    if (!entry.transmissible) {
      refuse(entry.blockedReason ?? 'Ce dossier ne peut plus être transmis.')
      continue
    }

    try {
      // Le consentement est relu en base juste avant l'envoi : il a pu être
      // retiré depuis le calcul de la présélection.
      const profile = await prisma.candidateProfile.findUnique({
        where: { userId: candidateId },
        select: { matchingConsentAt: true },
      })
      const hasConsent = Boolean(profile?.matchingConsentAt)
      if (!hasConsent) {
        refuse(NO_CONSENT_ERROR)
        continue
      }

      let existing = await prisma.matchSuggestion.findUnique({
        where: { opportunityId_candidateId: { opportunityId, candidateId } },
      })
      if (!existing) {
        existing = await prisma.matchSuggestion.create({
          data: {
            opportunityId,
            candidateId,
            score: entry.score,
            reasons: entry.reasons,
            status: 'suggeree',
            origin: 'admin',
          },
        })
        await prisma.auditLog.create({
          data: {
            userId: actorId,
            action: 'match_suggestion_created',
            metadata: { suggestionId: existing.id, opportunityId, reactivated: false, source: 'preselection' },
          },
        })
      }

      // `applyAdminTransition` refuse de lui-même une ligne écartée ou déjà
      // avancée entre-temps (transition interdite).
      const result = await applyAdminTransition({
        suggestion: existing,
        opportunity,
        hasConsent,
        to: 'proposee_recruteur',
        actorId,
        extraData: { score: entry.score, reasons: entry.reasons, preselectionRank: entry.rank },
        auditExtra: { source: 'preselection', preselectionRank: entry.rank, preselectionTop: options.top },
      })
      if (!result.ok) {
        refuse(
          existing.status === 'ecartee'
            ? 'Écarté pour cette offre entre-temps : transmission annulée.'
            : result.error,
        )
        continue
      }
      outcomes.push({
        candidateId,
        fullName: entry.fullName,
        transmitted: true,
        reason: null,
        rank: entry.rank,
        suggestionId: result.suggestion.id,
      })
    } catch (err) {
      // Deux admins transmettent le même candidat en même temps : la
      // contrainte unique (offre, candidat) arbitre.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        refuse('Ce candidat vient d’être traité par ailleurs : rechargez la présélection.')
        continue
      }
      console.error('[preselection] Transmission impossible', err)
      refuse('Erreur serveur pendant la transmission de ce candidat.')
    }
  }

  return { preselection, outcomes }
}
