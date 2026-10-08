import { Prisma } from '@prisma/client'
import type { MatchSuggestion as DbMatchSuggestion, Opportunity as DbOpportunityRow } from '@prisma/client'
import type {
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
import { ADMIN_ALLOWED_TRANSITIONS, preselect } from './preselection.js'

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
/* Transition admin — unique implémentation                            */
/* ------------------------------------------------------------------ */

export const NO_CONSENT_ERROR =
  'Ce candidat n’a pas donné (ou a retiré) son accord pour que son profil soit proposé aux entreprises. Transmission impossible.'

export type AdminTransitionResult =
  | { ok: true; suggestion: DbMatchSuggestion }
  | { ok: false; httpStatus: 400 | 409; error: string }

interface AdminTransitionInput {
  suggestion: Pick<DbMatchSuggestion, 'id' | 'status' | 'candidateId' | 'opportunityId'>
  opportunity: Pick<DbOpportunityRow, 'recruiterId' | 'title' | 'companyName'>
  /** Consentement de matching en vigueur du candidat, relu en base par l'appelant. */
  hasConsent: boolean
  to: MatchSuggestionStatus
  actorId: string
  /** Colonnes mises à jour avec le statut (rang de présélection, score rafraîchi). */
  extraData?: Pick<Prisma.MatchSuggestionUncheckedUpdateInput, 'score' | 'reasons' | 'preselectionRank'>
  /** Champs ajoutés au journal d'audit. */
  auditExtra?: Record<string, string | number | boolean>
}

/**
 * Fait avancer une suggestion côté admin : contrôle de la transition
 * (`ADMIN_ALLOWED_TRANSITIONS`), du consentement pour tout passage à
 * `proposee_recruteur`, puis mise à jour, journal d'audit et notifications.
 * Utilisé par le PATCH unitaire ET par la transmission groupée de la
 * présélection : les deux appliquent exactement les mêmes règles et effets.
 */
export async function applyAdminTransition(input: AdminTransitionInput): Promise<AdminTransitionResult> {
  const { suggestion: existing, opportunity, to } = input
  const allowed = ADMIN_ALLOWED_TRANSITIONS[existing.status] ?? []
  if (!allowed.includes(to)) {
    return { ok: false, httpStatus: 400, error: `Transition ${existing.status} → ${to} non autorisée.` }
  }

  // Aucun profil ne part chez un recruteur sans le consentement en vigueur
  // du candidat — y compris pour les lignes héritées.
  if (to === 'proposee_recruteur' && !input.hasConsent) {
    return { ok: false, httpStatus: 409, error: NO_CONSENT_ERROR }
  }

  const suggestion = await prisma.matchSuggestion.update({
    where: { id: existing.id },
    data: { ...input.extraData, status: to },
  })
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
    // Seul moment où le candidat est notifié (plateforme + email) : il est
    // retenu, et c'est aussi le seul moment où il apprend le nom de l'entreprise.
    const { companyName, title } = opportunity
    await notifyUser({
      userId: existing.candidateId,
      event: 'mise_en_relation',
      title: 'Mise en relation confirmée',
      message: `OffRec vous met en relation avec ${companyName} pour « ${title} ».`,
      link: `/candidat/offres/${existing.opportunityId}`,
      email: {
        subject: 'Votre profil a été retenu — OffRec',
        body: [
          `Votre profil a été retenu par ${companyName} pour l’offre « ${title} ».`,
          'OffRec organise la mise en relation et vous recontacte pour les prochaines étapes. Vous pouvez suivre ce dossier depuis votre espace.',
        ],
        actionLabel: 'Voir le dossier',
      },
    })
    await prisma.notification.create({
      data: {
        userId: opportunity.recruiterId,
        title: 'Mise en relation confirmée',
        message: `OffRec vous met en relation avec un candidat pour « ${title} ».`,
        link: '/recruteur/candidatures',
      },
    })
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
