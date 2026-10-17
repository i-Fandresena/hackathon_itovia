import { Prisma } from '@prisma/client'
import type { CandidateProfile as DbCandidateProfileRow, Opportunity as DbOpportunityRow } from '@prisma/client'
import { prisma } from './prisma.js'
import { toDomainCandidateProfile, toDomainOpportunity } from './domain.js'
import { scoreOpportunity } from '../../../src/lib/recommendation.js'
import {
  ACTIVE_USER_STATUSES,
  candidateIneligibility,
  hasCommonSkill,
  opportunityClosedReason,
  startOfUtcDay,
  type CandidateIneligibility,
} from './preselection.js'
import { clip, notifyAdmins, plural } from './notify.js'

/**
 * Moteur de matching diplômés (décision produit 2026-10-08).
 *
 * Le candidat ne postule plus offre par offre : il dépose son CV, donne un
 * consentement global, et ce moteur crée les `MatchSuggestion`.
 *
 * - Le score reste celui de `scoreOpportunity()` (inchangé), calculé sur le
 *   profil CONFIRMÉ par le candidat — jamais sur les colonnes `cv*` extraites
 *   par l'IA. Le moteur fonctionne donc à l'identique sans `GEMINI_API_KEY`.
 * - Règle hybride : score ≥ `MATCH_AUTO_THRESHOLD` ET CV vérifié par un
 *   humain → `proposee_recruteur` directement ; sinon score ≥
 *   `MATCH_THRESHOLD` → `suggeree` (file de validation admin).
 * - Idempotent : seules les lignes encore `suggeree` sont rafraîchies ou
 *   promues ; une ligne `ecartee` n'est jamais réactivée automatiquement,
 *   une ligne déjà avancée n'est jamais touchée.
 * - L'éligibilité (candidat proposable, offre ouverte) est définie une seule
 *   fois, dans `lib/preselection.ts`, et partagée avec la présélection ATS.
 */

export type MatchingTrigger =
  | 'cv_upload'
  | 'profile_update'
  | 'consent_given'
  | 'cv_verified'
  | 'opportunity_created'
  | 'opportunity_updated'
  | 'admin_manual'

export interface MatchingConfig {
  /** Score minimum pour créer une suggestion. */
  threshold: number
  /** Score minimum pour l'envoi direct au recruteur (avec CV vérifié). */
  autoThreshold: number
  /** Nombre maximum de suggestions créées par exécution (les meilleures d'abord). */
  maxPerRun: number
}

function envInt(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name]
  if (raw === undefined || raw.trim() === '') return fallback
  const value = Number(raw)
  if (!Number.isInteger(value) || value < min || value > max) {
    console.warn(`[matching] ${name}="${raw}" invalide — valeur par défaut ${fallback} utilisée.`)
    return fallback
  }
  return value
}

/** Relu à chaque exécution : pas d'état de module à réinitialiser. */
export function getMatchingConfig(): MatchingConfig {
  const threshold = envInt('MATCH_THRESHOLD', 60, 0, 100)
  // L'envoi direct ne peut jamais être plus permissif que la mise en file.
  const autoThreshold = Math.max(threshold, envInt('MATCH_AUTO_THRESHOLD', 80, 0, 100))
  const maxPerRun = envInt('MATCH_MAX_PER_RUN', 10, 1, 500)
  return { threshold, autoThreshold, maxPerRun }
}

export interface MatchingRunResult {
  scope: 'candidate' | 'opportunity'
  /** `false` : rien n'a été évalué (voir `reason`). */
  eligible: boolean
  reason?: string
  /** Paires (offre, candidat) évaluées. */
  evaluated: number
  /** Créées en `suggeree` (file de validation admin). */
  queued: number
  /** Créées directement en `proposee_recruteur`. */
  sentDirect: number
  /** Lignes `suggeree` existantes promues en `proposee_recruteur`. */
  promoted: number
  /** Lignes `suggeree` existantes dont le score a été rafraîchi. */
  refreshed: number
  /** Paires sans effet : sous le seuil, sans compétence commune, déjà traitées, écartées, ou au-delà du plafond. */
  ignored: number
}

const INELIGIBILITY_REASONS: Record<CandidateIneligibility, string> = {
  compte_inactif: 'Compte candidat inactif.',
  sans_consentement: 'Consentement de matching absent.',
  sans_cv: 'Aucun CV déposé.',
}

function sameReasons(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((value, i) => value === b[i])
}

/**
 * Notification du recruteur à l'arrivée d'un profil (`proposee_recruteur`) —
 * commune à la transmission par l'admin et à l'envoi direct par le moteur.
 */
export async function notifyRecruiterOfProposal(opportunity: { recruiterId: string; title: string }): Promise<void> {
  await prisma.notification.create({
    data: {
      userId: opportunity.recruiterId,
      title: 'Nouveau candidat proposé',
      message: `OffRec vous propose un profil pour « ${opportunity.title} ».`,
      link: '/recruteur/candidatures',
    },
  })
}

interface Pair {
  profile: DbCandidateProfileRow
  opportunity: DbOpportunityRow
}

type ExistingSuggestion = { id: string; status: string; score: number; reasons: string[] }

/**
 * Applique la règle hybride à un ensemble de paires déjà filtrées sur
 * l'éligibilité (candidat consentant avec CV, offre ouverte). `existing`
 * est indexé par la clé que renvoie `keyOf`.
 */
async function processPairs(
  scope: MatchingRunResult['scope'],
  pairs: Pair[],
  existing: Map<string, ExistingSuggestion>,
  keyOf: (pair: Pair) => string,
  config: MatchingConfig,
): Promise<MatchingRunResult> {
  const result: MatchingRunResult = {
    scope,
    eligible: true,
    evaluated: pairs.length,
    queued: 0,
    sentDirect: 0,
    promoted: 0,
    refreshed: 0,
    ignored: 0,
  }

  const scored = pairs
    .map((pair) => ({
      pair,
      match: scoreOpportunity(toDomainCandidateProfile(pair.profile), toDomainOpportunity(pair.opportunity)),
      commonSkill: hasCommonSkill(pair.profile.skills, pair.opportunity.requiredSkills),
    }))
    // Les meilleures d'abord : c'est elles que le plafond par exécution retient.
    .sort((a, b) => b.match.score - a.match.score)

  for (const { pair, match, commonSkill } of scored) {
    const { profile, opportunity } = pair
    const qualifies = commonSkill && match.score >= config.threshold
    const direct = qualifies && match.score >= config.autoThreshold && profile.cvVerificationStatus === 'verifie'
    const current = existing.get(keyOf(pair))

    if (current) {
      // Écartée, héritée ou déjà avancée : jamais touchée par le moteur.
      if (current.status !== 'suggeree') {
        result.ignored += 1
        continue
      }
      if (direct) {
        // `updateMany` + filtre sur le statut : sans effet si un admin ou le
        // candidat a fait bouger la ligne entre-temps.
        const promoted = await prisma.matchSuggestion.updateMany({
          where: { id: current.id, status: 'suggeree' },
          data: { status: 'proposee_recruteur', score: match.score, reasons: match.reasons },
        })
        if (promoted.count === 1) {
          await notifyRecruiterOfProposal(opportunity)
          result.promoted += 1
        } else {
          result.ignored += 1
        }
        continue
      }
      if (current.score !== match.score || !sameReasons(current.reasons, match.reasons)) {
        const refreshed = await prisma.matchSuggestion.updateMany({
          where: { id: current.id, status: 'suggeree' },
          data: { score: match.score, reasons: match.reasons },
        })
        if (refreshed.count === 1) result.refreshed += 1
        else result.ignored += 1
        continue
      }
      result.ignored += 1
      continue
    }

    if (!qualifies || result.queued + result.sentDirect >= config.maxPerRun) {
      result.ignored += 1
      continue
    }

    try {
      await prisma.matchSuggestion.create({
        data: {
          opportunityId: opportunity.id,
          candidateId: profile.userId,
          score: match.score,
          reasons: match.reasons,
          status: direct ? 'proposee_recruteur' : 'suggeree',
          origin: 'systeme',
        },
      })
    } catch (err) {
      // Deux déclencheurs simultanés (dépôt de CV + enregistrement du profil) :
      // la contrainte unique (offre, candidat) arbitre, l'autre a déjà créé la ligne.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        result.ignored += 1
        continue
      }
      throw err
    }
    if (direct) {
      await notifyRecruiterOfProposal(opportunity)
      result.sentDirect += 1
    } else {
      result.queued += 1
    }
  }

  return result
}

function notEligible(scope: MatchingRunResult['scope'], reason: string): MatchingRunResult {
  return { scope, eligible: false, reason, evaluated: 0, queued: 0, sentDirect: 0, promoted: 0, refreshed: 0, ignored: 0 }
}

interface RunOptions {
  trigger: MatchingTrigger
  /** Admin à l'origine d'une relance manuelle — `null` pour un déclenchement système. */
  actorId?: string | null
}

/** Compteurs uniquement : ni nom, ni email, ni identifiant de candidat. */
async function logRun(result: MatchingRunResult, options: RunOptions, opportunityId?: string): Promise<void> {
  await prisma.auditLog.create({
    data: {
      userId: options.actorId ?? null,
      action: 'matching_run',
      metadata: {
        scope: result.scope,
        trigger: options.trigger,
        ...(opportunityId ? { opportunityId } : {}),
        evaluated: result.evaluated,
        queued: result.queued,
        sentDirect: result.sentDirect,
        promoted: result.promoted,
        refreshed: result.refreshed,
        ignored: result.ignored,
      },
    },
  })
}

/**
 * Récapitulatif pour les admins : UNE notification par exécution qui a
 * produit quelque chose (suggestions mises en file, profils envoyés ou promus
 * chez un recruteur) — jamais une par ligne, et rien pour une exécution qui
 * n'a fait que rafraîchir des scores ou n'a rien produit. L'admin qui a
 * relancé le moteur à la main n'est pas notifié de sa propre relance.
 */
async function notifyAdminsOfRun(
  result: MatchingRunResult,
  options: RunOptions,
  subject: { opportunityTitle: string } | { candidateName: string },
): Promise<void> {
  const queued = result.queued
  const direct = result.sentDirect + result.promoted
  if (queued === 0 && direct === 0) return

  const forOffer = 'opportunityTitle' in subject
  const parts: string[] = []
  if (queued > 0) parts.push(`${plural(queued, 'suggestion')} à valider`)
  if (direct > 0) {
    parts.push(
      forOffer
        ? `${plural(direct, 'profil')} ${direct > 1 ? 'envoyés' : 'envoyé'} directement au recruteur (CV vérifié)`
        : `envoi direct au recruteur pour ${plural(direct, 'offre')} (CV vérifié)`,
    )
  }
  const target = forOffer
    ? `offre « ${clip(subject.opportunityTitle)} »`
    : `profil de ${clip(subject.candidateName, 60)}`

  await notifyAdmins({
    event: 'matching_run_summary',
    category: 'systeme',
    title: queued > 0 && direct > 0 ? 'Résultats du matching' : queued > 0 ? 'Suggestions à valider' : 'Profils envoyés au recruteur',
    message: `Moteur de matching, ${target} : ${parts.join(' et ')}.`,
    link: '/admin/mise-en-relation',
    excludeUserId: options.actorId ?? null,
  })
}

/**
 * Pendant SQL de `opportunityClosedReason()` (même borne de date, mêmes
 * statuts actifs), pour lister les offres ouvertes sans les charger toutes.
 */
function openOpportunityWhere(): Prisma.OpportunityWhereInput {
  return {
    deadline: { gte: startOfUtcDay(new Date()) },
    recruiter: { role: 'recruiter', status: { in: [...ACTIVE_USER_STATUSES] } },
  }
}

/**
 * Évalue un candidat contre toutes les offres ouvertes. Sans effet (et sans
 * journal) si le candidat n'est pas éligible : compte inactif, consentement
 * absent ou retiré, ou aucun CV déposé.
 */
export async function runMatchingForCandidate(userId: string, options: RunOptions): Promise<MatchingRunResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, status: true, candidateProfile: true },
  })
  const profile = user?.candidateProfile
  if (!user || user.role !== 'candidate' || !profile) return notEligible('candidate', 'Candidat introuvable.')
  const ineligible = candidateIneligibility({
    accountRole: user.role,
    accountStatus: user.status,
    consentAt: profile.matchingConsentAt,
    hasCv: Boolean(profile.cvUrl),
  })
  if (ineligible) return notEligible('candidate', INELIGIBILITY_REASONS[ineligible])

  const [opportunities, existing] = await Promise.all([
    prisma.opportunity.findMany({ where: openOpportunityWhere() }),
    prisma.matchSuggestion.findMany({
      where: { candidateId: userId },
      select: { id: true, opportunityId: true, status: true, score: true, reasons: true },
    }),
  ])

  const result = await processPairs(
    'candidate',
    opportunities.map((opportunity) => ({ profile, opportunity })),
    new Map(existing.map((s) => [s.opportunityId, s])),
    (pair) => pair.opportunity.id,
    getMatchingConfig(),
  )
  await logRun(result, options)
  await notifyAdminsOfRun(result, options, { candidateName: profile.fullName })
  return result
}

/**
 * Évalue une offre contre tous les candidats éligibles (rôle candidat, compte
 * actif, consentement donné, CV déposé). Sans effet si l'offre est expirée
 * ou si le compte du recruteur est inactif.
 */
export async function runMatchingForOpportunity(opportunityId: string, options: RunOptions): Promise<MatchingRunResult> {
  const found = await prisma.opportunity.findUnique({
    where: { id: opportunityId },
    include: { recruiter: { select: { role: true, status: true } } },
  })
  if (!found || opportunityClosedReason(found, found.recruiter, new Date())) {
    return notEligible('opportunity', 'Offre introuvable, expirée, ou compte recruteur inactif.')
  }
  const { recruiter: _recruiter, ...opportunity } = found

  const [candidates, existing] = await Promise.all([
    prisma.candidateProfile.findMany({
      where: { user: { role: 'candidate' } },
      include: { user: { select: { role: true, status: true } } },
    }),
    prisma.matchSuggestion.findMany({
      where: { opportunityId },
      select: { id: true, candidateId: true, status: true, score: true, reasons: true },
    }),
  ])

  const profiles = candidates.filter(
    (p) =>
      candidateIneligibility({
        accountRole: p.user.role,
        accountStatus: p.user.status,
        consentAt: p.matchingConsentAt,
        hasCv: Boolean(p.cvUrl),
      }) === null,
  )

  const result = await processPairs(
    'opportunity',
    profiles.map((profile) => ({ profile, opportunity })),
    new Map(existing.map((s) => [s.candidateId, s])),
    (pair) => pair.profile.userId,
    getMatchingConfig(),
  )
  await logRun(result, options, opportunityId)
  await notifyAdminsOfRun(result, options, { opportunityTitle: opportunity.title })
  return result
}

/* ------------------------------------------------------------------ */
/* Déclencheurs en arrière-plan                                        */
/* ------------------------------------------------------------------ */

/**
 * À appeler APRÈS l'envoi de la réponse HTTP : le matching ne retarde ni ne
 * fait échouer la requête qui l'a déclenché (erreurs capturées, journalisées).
 */
export function scheduleCandidateMatching(userId: string, trigger: MatchingTrigger): void {
  setImmediate(() => {
    runMatchingForCandidate(userId, { trigger }).catch((err) => {
      console.error(`[matching] Échec du matching candidat (${trigger})`, err)
    })
  })
}

export function scheduleOpportunityMatching(opportunityId: string, trigger: MatchingTrigger): void {
  setImmediate(() => {
    runMatchingForOpportunity(opportunityId, { trigger }).catch((err) => {
      console.error(`[matching] Échec du matching offre (${trigger})`, err)
    })
  })
}
