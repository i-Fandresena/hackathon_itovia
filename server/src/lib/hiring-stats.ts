import { createHmac } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { prisma } from './prisma.js'
import { HIRING_SUPPORTED } from './hiring-store.js'
import {
  OUTCOME_INDICATOR_GRACE_DAYS,
  OUTCOME_INDICATOR_WINDOW_DAYS,
  TEST_EMAIL_DOMAINS,
  buildDossierFacts,
  buildResearchExport,
  cohortOf,
  computeFunnel,
  countsByOpportunity,
  outcomeTimeliness,
  periodStart,
  researchExportFilename,
  type DossierFacts,
  type HiringPeriod,
  type MetricsDossier,
  type MetricsPlacement,
  type MetricsProposal,
  type MetricsRound,
  type OutcomeTimeliness,
  type TransmissionEvidence,
} from './hiring-metrics.js'

/**
 * Mesure « après l'entretien » (plan du 2026-10-16, sous-lot 7) : lecture en
 * base, en requêtes groupées (cinq au plus pour tout le périmètre, jamais une
 * par dossier), puis calcul par les règles pures de lib/hiring-metrics.ts.
 *
 * - `loadAdminHiringStats` : toute la plateforme (`GET /admin/stats/hiring`),
 *   filtrable par recruteur, par offre et sans les comptes de test.
 * - `loadRecruiterHiringStats` : les offres du recruteur connecté seulement
 *   (`GET /recruiter/stats/hiring`) — dossiers transmis uniquement, jamais
 *   `suggeree` ni rien de la présélection interne.
 * - `buildAdminResearchExport` : export CSV pseudonymisé (admin), journalisé
 *   `research_export` sans contenu.
 *
 * SQL brut : compile avec l'ancien comme avec le nouveau client Prisma ; sans
 * le schéma « après l'entretien » (client ou migration), les fonctions
 * renvoient `null` et les routes répondent 503 (`HIRING_UNAVAILABLE_ERROR`).
 */

/** Plafond de dossiers lus par calcul (au-delà : `truncated`). */
export const HIRING_STATS_DOSSIER_CAP = 20_000
/** Plafonds des listes de filtres renvoyées à l'admin. */
const RECRUITER_OPTIONS_CAP = 500
const OPPORTUNITY_OPTIONS_CAP = 1_000

export interface HiringScope {
  recruiterId?: string
  opportunityId?: string
  excludeTest?: boolean
}

const isMissingSchemaError = (err: unknown): boolean => {
  if (!err || typeof err !== 'object') return false
  const { code, meta, message } = err as { code?: unknown; meta?: { code?: unknown }; message?: unknown }
  if (code === 'P2021' || code === 'P2022' || code === 'P2010') {
    const text = typeof message === 'string' ? message : ''
    return code !== 'P2010' || /does not exist|n'existe pas|n’existe pas|42703|42P01/i.test(text)
  }
  if (meta?.code === '42703' || meta?.code === '42P01') return true
  return typeof message === 'string' && /column .* does not exist|relation .* does not exist/i.test(message)
}

/* ------------------------------------------------------------------ */
/* Preuves de transmission (journal d'audit)                           */
/* ------------------------------------------------------------------ */

interface AuditEvidenceRow {
  action: string
  userId: string | null
  createdAt: Date
  suggestionId: string
  from: string | null
  to: string | null
}

const VISIBLE_STATUSES = ['proposee_recruteur', 'interet_recruteur', 'mise_en_relation']

/**
 * Preuves de transmission / sortie des dossiers donnés, en UNE requête :
 * première transmission journalisée par un admin, sortie depuis un statut
 * visible du recruteur, et comptes qui ont décliné. Partagé avec le tableau
 * de bord recruteur (« Profils reçus »).
 */
export async function loadTransmissionEvidence(suggestionIds: readonly string[]): Promise<Map<string, TransmissionEvidence>> {
  const out = new Map<string, TransmissionEvidence>()
  if (suggestionIds.length === 0) return out
  const rows = await prisma.$queryRaw<AuditEvidenceRow[]>(Prisma.sql`
    SELECT "action", "userId", "createdAt",
           "metadata"->>'suggestionId' AS "suggestionId",
           "metadata"->>'from' AS "from",
           "metadata"->>'to' AS "to"
    FROM "AuditLog"
    WHERE "action" IN ('match_suggestion_status', 'recruiter_declined', 'candidate_declined')
      AND "metadata"->>'suggestionId' = ANY(${[...suggestionIds]}::text[])
  `)
  for (const row of rows) {
    const e = out.get(row.suggestionId) ?? { transmittedAt: null, exitedAfterTransmission: false, declinedBy: [] }
    if (row.action === 'match_suggestion_status') {
      if (row.to === 'proposee_recruteur' && (!e.transmittedAt || row.createdAt < e.transmittedAt)) {
        e.transmittedAt = row.createdAt
      }
      if (row.to === 'ecartee' && row.from && VISIBLE_STATUSES.includes(row.from)) e.exitedAfterTransmission = true
    } else if (row.action === 'recruiter_declined') {
      // Le recruteur ne peut décliner qu'un dossier transmis.
      e.exitedAfterTransmission = true
      if (row.userId) e.declinedBy.push(row.userId)
    } else if (row.action === 'candidate_declined' && row.from && VISIBLE_STATUSES.includes(row.from)) {
      // `from` n'est journalisé que depuis 2026-10-15 : un retrait plus
      // ancien d'un dossier envoyé directement par le moteur n'est pas prouvé.
      e.exitedAfterTransmission = true
    }
    out.set(row.suggestionId, e)
  }
  return out
}

/* ------------------------------------------------------------------ */
/* Chargement groupé                                                   */
/* ------------------------------------------------------------------ */

interface DossierSqlRow extends Omit<MetricsDossier, 'score' | 'preselectionRank'> {
  score: number | bigint
  preselectionRank: number | bigint | null
}

const toNumber = (value: number | bigint) => (typeof value === 'bigint' ? Number(value) : value)

async function loadDossiers(scope: HiringScope): Promise<{ dossiers: MetricsDossier[]; truncated: boolean }> {
  const domains = [...TEST_EMAIL_DOMAINS]
  const rows = await prisma.$queryRaw<DossierSqlRow[]>(Prisma.sql`
    SELECT ms."id", ms."opportunityId", o."recruiterId",
           ms."status"::text AS "status", ms."score", ms."origin"::text AS "origin",
           ms."preselectionRank", ms."createdAt", ms."updatedAt", ms."connectedAt",
           ms."closedReason"::text AS "closedReason",
           o."sector"::text AS "sector", o."level"::text AS "level",
           o."opportunityType"::text AS "opportunityType", o."filledAt",
           COALESCE(cp."cvVerificationStatus"::text = 'verifie', false) AS "cvVerified",
           (split_part(lower(cu."email"), '@', 2) = ANY(${domains}::text[])
             OR split_part(lower(ru."email"), '@', 2) = ANY(${domains}::text[])) AS "isTest"
    FROM "MatchSuggestion" ms
    JOIN "Opportunity" o ON o."id" = ms."opportunityId"
    JOIN "User" cu ON cu."id" = ms."candidateId"
    JOIN "User" ru ON ru."id" = o."recruiterId"
    LEFT JOIN "CandidateProfile" cp ON cp."userId" = ms."candidateId"
    WHERE ms."status"::text IN ('proposee_recruteur', 'interet_recruteur', 'mise_en_relation', 'ecartee')
      AND (${scope.recruiterId ?? null}::text IS NULL OR o."recruiterId" = ${scope.recruiterId ?? null}::text)
      AND (${scope.opportunityId ?? null}::text IS NULL OR o."id" = ${scope.opportunityId ?? null}::text)
      AND (${Boolean(scope.excludeTest)}::boolean = false OR NOT (
            split_part(lower(cu."email"), '@', 2) = ANY(${domains}::text[])
            OR split_part(lower(ru."email"), '@', 2) = ANY(${domains}::text[])))
    ORDER BY ms."createdAt" DESC, ms."id"
    LIMIT ${HIRING_STATS_DOSSIER_CAP + 1}
  `)
  const truncated = rows.length > HIRING_STATS_DOSSIER_CAP
  const dossiers = rows.slice(0, HIRING_STATS_DOSSIER_CAP).map((r) => ({
    ...r,
    score: toNumber(r.score),
    preselectionRank: r.preselectionRank === null ? null : toNumber(r.preselectionRank),
  }))
  return { dossiers, truncated }
}

async function loadChildren(ids: string[]) {
  if (ids.length === 0) return { rounds: [] as MetricsRound[], proposals: [] as MetricsProposal[], placements: [] as MetricsPlacement[] }
  const [rounds, proposals, placements] = await Promise.all([
    prisma.$queryRaw<MetricsRound[]>(Prisma.sql`
      SELECT "id", "suggestionId", "round", "status"::text AS "status", "scheduledAt", "durationMinutes",
             ("activeSuggestionId" IS NOT NULL) AS "active",
             "outcome"::text AS "outcome", "outcomeReason"::text AS "outcomeReason", "outcomeAt"
      FROM "Interview" WHERE "suggestionId" = ANY(${ids}::text[])
    `),
    prisma.$queryRaw<MetricsProposal[]>(Prisma.sql`
      SELECT "id", "suggestionId", "version", "status"::text AS "status", "expiresAt", "revision", "createdAt",
             "respondedAt", "declineReason"::text AS "declineReason", "contractType"::text AS "contractType",
             "withdrawReason"::text AS "withdrawReason"
      FROM "HireProposal" WHERE "suggestionId" = ANY(${ids}::text[])
    `),
    prisma.$queryRaw<MetricsPlacement[]>(Prisma.sql`
      SELECT "id", "suggestionId", "stage"::text AS "stage", "origin"::text AS "origin", "createdAt"
      FROM "Placement" WHERE "suggestionId" = ANY(${ids}::text[])
    `),
  ])
  return { rounds, proposals, placements }
}

function groupBy<T extends { suggestionId: string }>(rows: readonly T[]): Map<string, T[]> {
  const map = new Map<string, T[]>()
  for (const row of rows) {
    const list = map.get(row.suggestionId)
    if (list) list.push(row)
    else map.set(row.suggestionId, [row])
  }
  return map
}

/**
 * Faits de tous les dossiers TRANSMIS du périmètre (toutes périodes), plus
 * leurs tours (pour l'indicateur). `null` sans le schéma « après l'entretien ».
 */
export async function loadHiringFacts(
  scope: HiringScope,
  now: Date,
): Promise<{ facts: DossierFacts[]; rounds: MetricsRound[]; truncated: boolean } | null> {
  if (!HIRING_SUPPORTED) return null
  try {
    const { dossiers, truncated } = await loadDossiers(scope)
    const ids = dossiers.map((d) => d.id)
    const [evidence, children] = await Promise.all([loadTransmissionEvidence(ids), loadChildren(ids)])
    const rounds = groupBy(children.rounds)
    const proposals = groupBy(children.proposals)
    const placements = new Map(children.placements.map((p) => [p.suggestionId, p]))
    const facts: DossierFacts[] = []
    for (const dossier of dossiers) {
      const f = buildDossierFacts({
        dossier,
        evidence: evidence.get(dossier.id),
        rounds: rounds.get(dossier.id) ?? [],
        proposals: proposals.get(dossier.id) ?? [],
        placement: placements.get(dossier.id) ?? null,
        now,
      })
      if (f) facts.push(f)
    }
    return { facts, rounds: children.rounds, truncated }
  } catch (err) {
    if (isMissingSchemaError(err)) return null
    throw err
  }
}

/* ------------------------------------------------------------------ */
/* Indicateur seul (champ de GET /admin/stats)                         */
/* ------------------------------------------------------------------ */

export interface OutcomeIndicator {
  windowDays: number
  graceDays: number
  /** Fenêtre du plan §11 : fin du tour entre J-37 et J-7. */
  last30: OutcomeTimeliness
  /** Tous les tours terminés depuis au moins 7 jours. */
  allTime: OutcomeTimeliness
}

function indicatorOf(rounds: readonly MetricsRound[], now: Date): OutcomeIndicator {
  return {
    windowDays: OUTCOME_INDICATOR_WINDOW_DAYS,
    graceDays: OUTCOME_INDICATOR_GRACE_DAYS,
    last30: outcomeTimeliness(rounds, now),
    allTime: outcomeTimeliness(rounds, now, null),
  }
}

/** Indicateur global (toute la plateforme, comptes de test compris), ou `null`. */
export async function loadOutcomeIndicator(now: Date): Promise<OutcomeIndicator | null> {
  if (!HIRING_SUPPORTED) return null
  try {
    const rounds = await prisma.$queryRaw<MetricsRound[]>(Prisma.sql`
      SELECT "id", "suggestionId", "round", "status"::text AS "status", "scheduledAt", "durationMinutes",
             ("activeSuggestionId" IS NOT NULL) AS "active",
             "outcome"::text AS "outcome", "outcomeReason"::text AS "outcomeReason", "outcomeAt"
      FROM "Interview" WHERE "status"::text NOT IN ('annule', 'empechement')
    `)
    return indicatorOf(rounds, now)
  } catch (err) {
    if (isMissingSchemaError(err)) return null
    throw err
  }
}

/* ------------------------------------------------------------------ */
/* Admin                                                               */
/* ------------------------------------------------------------------ */

export async function loadAdminHiringStats(
  query: { period: HiringPeriod; recruiterId?: string; opportunityId?: string; excludeTest: boolean },
  now: Date = new Date(),
) {
  const loaded = await loadHiringFacts(query, now)
  if (!loaded) return null
  const since = periodStart(query.period, now)
  const cohort = cohortOf(loaded.facts, since)
  // Tours des dossiers du périmètre (filtres recruteur, offre, comptes de
  // test) ; l'indicateur a sa propre fenêtre, indépendante de la période.
  const scopedIds = new Set(loaded.facts.map((f) => f.dossier.id))
  const scopedRounds = loaded.rounds.filter((r) => scopedIds.has(r.suggestionId))

  const [recruiters, opportunities] = await Promise.all([
    prisma.user.findMany({
      where: { role: 'recruiter' },
      select: { id: true, recruiterProfile: { select: { companyName: true } } },
      take: RECRUITER_OPTIONS_CAP,
      orderBy: { createdAt: 'asc' },
    }),
    prisma.opportunity.findMany({
      select: { id: true, title: true, recruiterId: true, companyName: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      take: OPPORTUNITY_OPTIONS_CAP,
    }),
  ])

  return {
    computedAt: now.toISOString(),
    timezone: 'UTC+3',
    period: query.period,
    since: since ? since.toISOString() : null,
    filters: {
      recruiterId: query.recruiterId ?? null,
      opportunityId: query.opportunityId ?? null,
      excludeTest: query.excludeTest,
    },
    funnel: computeFunnel(cohort),
    outcomeIndicator: indicatorOf(scopedRounds, now),
    truncated: loaded.truncated,
    options: {
      recruiters: recruiters
        .map((r) => ({ id: r.id, companyName: r.recruiterProfile?.companyName ?? 'Recruteur' }))
        .sort((a, b) => a.companyName.localeCompare(b.companyName, 'fr')),
      opportunities: opportunities.map((o) => ({ id: o.id, title: o.title, recruiterId: o.recruiterId, companyName: o.companyName })),
    },
  }
}

/* ------------------------------------------------------------------ */
/* Recruteur                                                           */
/* ------------------------------------------------------------------ */

export const RECRUITER_OFFER_NOT_FOUND_ERROR = 'Offre introuvable.'

/**
 * Entonnoir du recruteur connecté : SES offres, dossiers transmis seulement.
 * `{ notFound: true }` pour une offre qui n'est pas à lui (même réponse
 * qu'une offre inexistante).
 */
export async function loadRecruiterHiringStats(
  recruiterId: string,
  query: { period: HiringPeriod; opportunityId?: string },
  now: Date = new Date(),
) {
  const offers = await prisma.opportunity.findMany({
    where: { recruiterId },
    select: { id: true, title: true, createdAt: true },
    orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
  })
  if (query.opportunityId && !offers.some((o) => o.id === query.opportunityId)) return { notFound: true as const }
  const loaded = await loadHiringFacts({ recruiterId, opportunityId: query.opportunityId }, now)
  if (!loaded) return null
  const since = periodStart(query.period, now)
  const cohort = cohortOf(loaded.facts, since)
  const perOffer = countsByOpportunity(cohort)
  const byOffer = offers
    .filter((o) => perOffer.has(o.id))
    .map((o) => {
      const c = perOffer.get(o.id)!
      return {
        id: o.id,
        title: o.title,
        proposed: c.proposes,
        connected: c.mis_en_relation,
        interviewed: c.entretien_passe,
        retained: c.retenus,
        offered: c.proposition,
        hired: c.embauches,
      }
    })
    .sort((a, b) => b.hired - a.hired || b.retained - a.retained || b.proposed - a.proposed || a.title.localeCompare(b.title, 'fr'))

  return {
    notFound: false as const,
    computedAt: now.toISOString(),
    timezone: 'UTC+3',
    period: query.period,
    since: since ? since.toISOString() : null,
    opportunityId: query.opportunityId ?? null,
    funnel: computeFunnel(cohort),
    byOffer,
    offers: offers.map((o) => ({ id: o.id, title: o.title })),
    truncated: loaded.truncated,
  }
}

/* ------------------------------------------------------------------ */
/* Export de recherche (admin)                                         */
/* ------------------------------------------------------------------ */

/**
 * Clé des pseudonymes : `RESEARCH_EXPORT_SECRET` si défini, sinon dérivée de
 * `JWT_SECRET` (toujours présent : le serveur refuse de démarrer sans). Les
 * pseudonymes sont stables tant que ce secret ne change pas.
 */
function researchKey(): Buffer {
  const secret = process.env.RESEARCH_EXPORT_SECRET || process.env.JWT_SECRET
  if (!secret) throw new Error('Secret serveur absent : export de recherche impossible.')
  return createHmac('sha256', secret).update('offrec:research-export:v1').digest()
}

export async function buildAdminResearchExport(adminId: string, excludeTest: boolean, now: Date = new Date()) {
  const loaded = await loadHiringFacts({ excludeTest }, now)
  if (!loaded) return null
  const result = buildResearchExport({ facts: loaded.facts, key: researchKey(), now, excludeTest, truncated: loaded.truncated })
  // Journal sans contenu : ni ligne, ni pseudonyme, seulement le volume et le filtre.
  await prisma.auditLog.create({
    data: {
      userId: adminId,
      action: 'research_export',
      metadata: { rowCount: result.rowCount, excludeTest, truncated: loaded.truncated },
    },
  })
  return {
    filename: researchExportFilename(now),
    generatedAt: now.toISOString(),
    rowCount: result.rowCount,
    testRows: result.testRows,
    excludeTest,
    truncated: loaded.truncated,
    generalization: result.generalization,
    csv: result.csv,
  }
}
