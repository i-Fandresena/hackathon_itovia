import type { z } from 'zod'
import type {
  AdminInterview,
  Interview,
  InterviewPeriod,
  MatchSuggestionStatus,
} from '../../../src/types/index.js'
import {
  INTERVIEW_DURATIONS,
  compareInterviewsForList,
  interviewInPeriod,
  interviewNeedsAction,
  isInterviewUpcoming,
} from '../../../src/lib/interview.js'
import { prisma } from './prisma.js'
import {
  interviewStore,
  isInterviewStorageError,
  toAdminInterviewView,
  toInterviewView,
  unavailable,
  type InterviewOutcome,
  type InterviewRow,
} from './interviews.js'
import type { adminInterviewQuerySchema, recruiterInterviewQuerySchema } from './validation.js'

/**
 * Listes « Entretiens » du recruteur et de l'admin (lecture seule).
 *
 * Deux requêtes au plus par liste (entretiens, puis leurs dossiers par
 * identifiant), jamais une par ligne. Chaque réponse est construite par une
 * liste blanche explicite : jamais un objet Prisma étalé, jamais l'email ni
 * le téléphone du candidat, ni rien de son CV.
 *
 * Le recruteur ne voit que les entretiens de SES offres, sur des dossiers
 * `mise_en_relation` (les seuls où il peut agir), et seulement ce que
 * « Candidats proposés » lui montre déjà : le nom du candidat et la vue
 * `toInterviewView()`.
 */

type Where = Record<string, unknown>

export type RecruiterInterviewQuery = z.infer<typeof recruiterInterviewQuerySchema>
export type AdminInterviewQuery = z.infer<typeof adminInterviewQuerySchema>

/* ------------------------------------------------------------------ */
/* Périodes en base (miroir de `isInterviewUpcoming`)                  */
/* ------------------------------------------------------------------ */

/**
 * « Pas encore terminé » : début + durée > maintenant. Les durées étant
 * fermées (30, 45, 60), la condition s'écrit exactement par durée ; une
 * durée hors liste (aucune n'est produite) retombe sur « pas commencé ».
 */
function notEndedOr(now: Date): Where[] {
  return [
    ...INTERVIEW_DURATIONS.map((minutes) => ({
      durationMinutes: minutes,
      scheduledAt: { gt: new Date(now.getTime() - minutes * 60_000) },
    })),
    { durationMinutes: { notIn: [...INTERVIEW_DURATIONS] }, scheduledAt: { gt: now } },
  ]
}

function upcomingWhere(now: Date): Where {
  return { AND: [{ status: { not: 'annule' } }, { OR: notEndedOr(now) }] }
}

function pastWhere(now: Date): Where {
  return { AND: [{ status: { not: 'annule' } }, { NOT: { OR: notEndedOr(now) } }] }
}

/** Passés ou annulés : tout ce qui n'est pas « à venir ». */
function notUpcomingWhere(now: Date): Where {
  return { NOT: upcomingWhere(now) }
}

function periodWhere(period: Exclude<InterviewPeriod, 'tous'>, now: Date): Where {
  if (period === 'a_venir') return upcomingWhere(now)
  if (period === 'passes') return pastWhere(now)
  return { status: 'annule' }
}

/**
 * « Problème d'agenda » : exactement les cas où `calendarActionLabel()`
 * (src/lib/interview.ts) propose une action — entretien à venir sans lien
 * Meet (simulé ou en attente), entretien à venir avec un échec Google, ou
 * entretien annulé dont l'événement Google n'a pas pu être supprimé.
 */
function calendarIssueWhere(now: Date): Where {
  return {
    OR: [
      { AND: [upcomingWhere(now), { meetUrl: null }] },
      { AND: [upcomingWhere(now), { provider: 'google' }, { calendarError: { not: null } }] },
      { AND: [{ status: 'annule' }, { provider: 'google' }, { calendarError: { not: null } }] },
    ],
  }
}

const and = (...parts: (Where | null | undefined | false)[]): Where => ({
  AND: parts.filter((part): part is Where => Boolean(part)),
})

const ASC: Where[] = [{ scheduledAt: 'asc' }, { id: 'asc' }]
const DESC: Where[] = [{ scheduledAt: 'desc' }, { id: 'desc' }]

/* ------------------------------------------------------------------ */
/* Recruteur                                                           */
/* ------------------------------------------------------------------ */

/** Plafond de sécurité : un recruteur a quelques dizaines d'entretiens. */
const RECRUITER_CAP = 1000

export interface RecruiterInterviewItem {
  interview: Interview
  suggestionId: string
  opportunity: { id: string; title: string }
  /** Seul élément du profil : le nom, déjà visible dans « Candidats proposés ». */
  candidate: { fullName: string | null }
}

export interface InterviewOfferSummary {
  id: string
  title: string
  total: number
  upcoming: number
  /** Empêchements signalés : à reprogrammer ou annuler. */
  toHandle: number
}

export interface RecruiterInterviewList {
  interviews: RecruiterInterviewItem[]
  /** Toutes les offres du recruteur qui ont au moins un entretien, avec
   *  leurs compteurs indépendants des filtres (en-têtes, filtre par offre). */
  offers: InterviewOfferSummary[]
  counts: { total: number; upcoming: number; toHandle: number }
  truncated: boolean
}

/**
 * Entretiens des offres du recruteur. Les compteurs (par offre et globaux)
 * portent sur tous ses entretiens ; les filtres (période, statut, offre)
 * ne s'appliquent qu'à la liste. Tri : `compareInterviewsForList`.
 */
export async function listRecruiterInterviews(
  recruiterId: string,
  query: RecruiterInterviewQuery,
  now: Date = new Date(),
): Promise<InterviewOutcome<RecruiterInterviewList>> {
  const store = interviewStore()
  if (!store) return unavailable()
  const ownDossier = { status: 'mise_en_relation' as const, opportunity: { recruiterId } }

  let rows: InterviewRow[]
  try {
    rows = await store.findMany({ where: { suggestion: ownDossier }, orderBy: ASC, take: RECRUITER_CAP })
  } catch (err) {
    if (isInterviewStorageError(err)) return unavailable()
    throw err
  }

  // Défense en profondeur : la propriété est revérifiée sur les dossiers.
  const dossiers = await prisma.matchSuggestion.findMany({
    where: { id: { in: rows.map((row) => row.suggestionId) }, status: 'mise_en_relation', opportunity: { recruiterId } },
    select: {
      id: true,
      opportunity: { select: { id: true, title: true } },
      candidate: { select: { candidateProfile: { select: { fullName: true } } } },
    },
  })
  const byId = new Map(dossiers.map((dossier) => [dossier.id, dossier]))

  const all: RecruiterInterviewItem[] = []
  for (const row of rows) {
    const dossier = byId.get(row.suggestionId)
    if (!dossier) continue
    all.push({
      interview: toInterviewView(row),
      suggestionId: dossier.id,
      opportunity: { id: dossier.opportunity.id, title: dossier.opportunity.title },
      candidate: { fullName: dossier.candidate.candidateProfile?.fullName ?? null },
    })
  }

  const offers = new Map<string, InterviewOfferSummary>()
  const counts = { total: 0, upcoming: 0, toHandle: 0 }
  for (const item of all) {
    const offer = offers.get(item.opportunity.id) ?? {
      id: item.opportunity.id,
      title: item.opportunity.title,
      total: 0,
      upcoming: 0,
      toHandle: 0,
    }
    const upcoming = isInterviewUpcoming(item.interview, now) ? 1 : 0
    const toHandle = interviewNeedsAction(item.interview) ? 1 : 0
    offer.total += 1
    offer.upcoming += upcoming
    offer.toHandle += toHandle
    offers.set(offer.id, offer)
    counts.total += 1
    counts.upcoming += upcoming
    counts.toHandle += toHandle
  }

  const interviews = all
    .filter(
      (item) =>
        (!query.opportunityId || item.opportunity.id === query.opportunityId) &&
        (!query.status || item.interview.status === query.status) &&
        interviewInPeriod(item.interview, query.period, now),
    )
    .sort((a, b) => compareInterviewsForList(a.interview, b.interview, now))

  return {
    ok: true,
    httpStatus: 200,
    body: {
      interviews,
      offers: [...offers.values()].sort((a, b) => a.title.localeCompare(b.title, 'fr') || a.id.localeCompare(b.id)),
      counts,
      truncated: rows.length >= RECRUITER_CAP,
    },
  }
}

/* ------------------------------------------------------------------ */
/* Admin                                                               */
/* ------------------------------------------------------------------ */

export interface AdminInterviewItem {
  interview: AdminInterview
  suggestionId: string
  suggestionStatus: MatchSuggestionStatus
  opportunity: { id: string; title: string; companyName: string }
  recruiter: { id: string; companyName: string }
  candidate: { id: string; fullName: string | null }
}

export interface AdminInterviewList {
  interviews: AdminInterviewItem[]
  /** Nombre total de lignes pour les filtres demandés. */
  total: number
  /** Décalage de la page suivante, `null` s'il n'y en a plus. */
  nextOffset: number | null
  /** Compteurs sur l'offre / le recruteur filtrés (sinon toute la
   *  plateforme), indépendants de la période, du statut et du filtre agenda. */
  counts: { upcoming: number; impediments: number; calendarIssues: number }
  /** Valeurs possibles des filtres : offres et recruteurs ayant au moins un entretien. */
  offers: { id: string; title: string; companyName: string; recruiterId: string }[]
  recruiters: { id: string; companyName: string }[]
}

/** Une page dans l'ordre `compareInterviewsForList` : à venir (croissant), puis le reste (décroissant). */
async function adminPage(
  store: NonNullable<ReturnType<typeof interviewStore>>,
  base: Where,
  period: InterviewPeriod,
  offset: number,
  limit: number,
  now: Date,
): Promise<{ rows: InterviewRow[]; total: number }> {
  if (period !== 'tous') {
    const where = and(base, periodWhere(period, now))
    const [rows, total] = await Promise.all([
      store.findMany({ where, orderBy: period === 'a_venir' ? ASC : DESC, skip: offset, take: limit }),
      store.count({ where }),
    ])
    return { rows, total }
  }
  const upcoming = and(base, upcomingWhere(now))
  const rest = and(base, notUpcomingWhere(now))
  const [upcomingTotal, restTotal] = await Promise.all([store.count({ where: upcoming }), store.count({ where: rest })])
  const head = offset < upcomingTotal ? await store.findMany({ where: upcoming, orderBy: ASC, skip: offset, take: limit }) : []
  const remaining = limit - head.length
  const tail =
    remaining > 0
      ? await store.findMany({ where: rest, orderBy: DESC, skip: Math.max(0, offset - upcomingTotal), take: remaining })
      : []
  return { rows: [...head, ...tail], total: upcomingTotal + restTotal }
}

export async function listAdminInterviews(
  query: AdminInterviewQuery,
  now: Date = new Date(),
): Promise<InterviewOutcome<AdminInterviewList>> {
  const store = interviewStore()
  if (!store) return unavailable()

  const dossierScope: Where = {}
  if (query.opportunityId) dossierScope.opportunityId = query.opportunityId
  if (query.recruiterId) dossierScope.opportunity = { recruiterId: query.recruiterId }
  const scope: Where | null = Object.keys(dossierScope).length > 0 ? { suggestion: dossierScope } : null
  const base = and(scope, query.status ? { status: query.status } : null, query.calendarIssue ? calendarIssueWhere(now) : null)

  let page: { rows: InterviewRow[]; total: number }
  let counts: AdminInterviewList['counts']
  try {
    const [pageResult, upcoming, impediments, calendarIssues] = await Promise.all([
      adminPage(store, base, query.period, query.offset, query.limit, now),
      store.count({ where: and(scope, upcomingWhere(now)) }),
      store.count({ where: and(scope, { status: 'empechement' }) }),
      store.count({ where: and(scope, calendarIssueWhere(now)) }),
    ])
    page = pageResult
    counts = { upcoming, impediments, calendarIssues }
  } catch (err) {
    if (isInterviewStorageError(err)) return unavailable()
    throw err
  }

  const opportunitySelect = {
    id: true,
    title: true,
    companyName: true,
    recruiterId: true,
    recruiter: { select: { recruiterProfile: { select: { companyName: true } } } },
  } as const

  const [dossiers, offerRows] = await Promise.all([
    prisma.matchSuggestion.findMany({
      where: { id: { in: page.rows.map((row) => row.suggestionId) } },
      select: {
        id: true,
        status: true,
        opportunity: { select: opportunitySelect },
        candidate: { select: { id: true, candidateProfile: { select: { fullName: true } } } },
      },
    }),
    // Valeurs des filtres : une ligne par offre ayant au moins un entretien.
    prisma.matchSuggestion.findMany({
      where: { interview: { isNot: null } },
      distinct: ['opportunityId'],
      select: { opportunity: { select: opportunitySelect } },
    }),
  ])
  const byId = new Map(dossiers.map((dossier) => [dossier.id, dossier]))
  const recruiterName = (o: { companyName: string; recruiter: { recruiterProfile: { companyName: string } | null } }) =>
    o.recruiter.recruiterProfile?.companyName || o.companyName

  const interviews: AdminInterviewItem[] = []
  for (const row of page.rows) {
    const dossier = byId.get(row.suggestionId)
    if (!dossier) continue
    const o = dossier.opportunity
    interviews.push({
      interview: toAdminInterviewView(row),
      suggestionId: dossier.id,
      suggestionStatus: dossier.status as MatchSuggestionStatus,
      opportunity: { id: o.id, title: o.title, companyName: o.companyName },
      recruiter: { id: o.recruiterId, companyName: recruiterName(o) },
      candidate: { id: dossier.candidate.id, fullName: dossier.candidate.candidateProfile?.fullName ?? null },
    })
  }

  const offers = offerRows
    .map(({ opportunity: o }) => ({ id: o.id, title: o.title, companyName: o.companyName, recruiterId: o.recruiterId }))
    .sort((a, b) => a.title.localeCompare(b.title, 'fr') || a.id.localeCompare(b.id))
  const recruiters = new Map<string, { id: string; companyName: string }>()
  for (const { opportunity: o } of offerRows) {
    if (!recruiters.has(o.recruiterId)) recruiters.set(o.recruiterId, { id: o.recruiterId, companyName: recruiterName(o) })
  }

  const loaded = query.offset + page.rows.length
  return {
    ok: true,
    httpStatus: 200,
    body: {
      interviews,
      total: page.total,
      nextOffset: page.rows.length > 0 && loaded < page.total ? loaded : null,
      counts,
      offers,
      recruiters: [...recruiters.values()].sort((a, b) => a.companyName.localeCompare(b.companyName, 'fr')),
    },
  }
}

