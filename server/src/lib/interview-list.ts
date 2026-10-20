import type { z } from 'zod'
import type {
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
import {
  hiringPhase,
  outcomeToRecord,
  roundMatchesOutcomeFilter,
  type HireProposalView,
  type HiringPhase,
  type InterviewOutcomeFilter,
} from '../../../src/lib/hiring.js'
import { prisma } from './prisma.js'
import {
  fail,
  interviewStore,
  isInterviewStorageError,
  loadHiringContexts,
  toAdminInterviewView,
  toRecruiterInterviewView,
  unavailable,
  type AdminInterviewView,
  type InterviewRow,
  type RecruiterInterviewView,
  type ServiceResult,
} from './interviews.js'
import { HIRING_SUPPORTED, HIRING_UNAVAILABLE_ERROR, suggestionHasInterviewWhere } from './hiring-store.js'
import { buildHiringContexts, roundStateOf } from './hiring-state.js'
import { latestProposalView, loadProposalRows } from './hire-proposals.js'
import type { adminInterviewQuerySchema, recruiterInterviewQuerySchema } from './validation.js'

/**
 * Listes « Entretiens » du recruteur et de l'admin (lecture seule).
 *
 * Quelques requêtes par liste (entretiens, leurs dossiers, puis l'état
 * « après l'entretien » de ces dossiers par lot), jamais une par ligne.
 * Chaque réponse est construite par une liste blanche explicite : jamais un
 * objet Prisma étalé, jamais l'email ni le téléphone du candidat, ni rien de
 * son CV.
 *
 * Le recruteur ne voit que les entretiens de SES offres, sur des dossiers
 * `mise_en_relation` (les seuls où il peut agir), et seulement ce que
 * « Candidats proposés » lui montre déjà : le nom du candidat, l'entretien,
 * l'issue et le motif de chaque tour (la note privée seulement s'il en est
 * l'auteur, jamais l'explication d'absence du candidat — D3), et la phase
 * dérivée du dossier (`hiringPhase`).
 *
 * L'admin voit en plus l'agenda, le motif et l'explication d'absence, jamais
 * la note privée du recruteur.
 *
 * Tours : chaque tour est une ligne de la liste (son numéro est dans
 * `interview.round`) ; les compteurs comptent des tours. Filtre « Issue »
 * (`?outcome=a_renseigner|retenu|second_entretien|non_retenu|absent`) :
 * `a_renseigner` = tour actif ni annulé ni en empêchement dont l'heure de
 * fin est passée, sur un dossier dans la phase `issue_a_renseigner`
 * (`outcomeToRecord` : ni embauché — placement lié non annulé —, ni offre
 * pourvue) ; c'est exactement ce que compte `toRecord`.
 *
 * Sous-lot 5 : chaque ligne porte aussi la dernière proposition d'embauche
 * du dossier (`proposal`, liste blanche D3 de `toHireProposalView` :
 * jamais la précision d'un refus au recruteur).
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
 * Miroir en base de `roundMatchesOutcomeFilter` avec la phase du dossier
 * (src/lib/hiring.ts, `outcomeToRecord`). Client régénéré seulement
 * (colonnes d'issue). `a_renseigner` : tour actif, sans issue, ni annulé ni
 * en empêchement, terminé, ET dossier en phase `issue_a_renseigner` —
 * `mise_en_relation`, offre non pourvue, aucun placement lié non annulé.
 */
function outcomeWhere(filter: InterviewOutcomeFilter, now: Date): Where {
  if (filter !== 'a_renseigner') return { outcome: filter }
  return {
    AND: [
      { activeSuggestionId: { not: null } },
      { outcome: null },
      { status: { in: ['planifie', 'confirme'] } },
      { NOT: { OR: notEndedOr(now) } },
      {
        suggestion: {
          status: 'mise_en_relation',
          opportunity: { filledAt: null },
          OR: [{ placement: { is: null } }, { placement: { is: { stage: 'annule' } } }],
        },
      },
    ],
  }
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
  /** Tour, avec son issue et son motif (note privée : son auteur seulement). */
  interview: RecruiterInterviewView
  suggestionId: string
  opportunity: { id: string; title: string }
  /** Seul élément du profil : le nom, déjà visible dans « Candidats proposés ». */
  candidate: { fullName: string | null }
  /** Phase dérivée du dossier ; `null` si la suite après l'entretien n'est pas activée. */
  phase: HiringPhase | null
  /** Dernière proposition d'embauche du dossier (vue recruteur), ou `null`. */
  proposal: HireProposalView | null
}

export interface InterviewOfferSummary {
  id: string
  title: string
  total: number
  upcoming: number
  /** Empêchements signalés : à reprogrammer ou annuler. */
  toHandle: number
  /** Issues à renseigner : tour terminé sans issue d'un dossier en phase `issue_a_renseigner`. */
  toRecord: number
}

export interface RecruiterInterviewList {
  interviews: RecruiterInterviewItem[]
  /** Toutes les offres du recruteur qui ont au moins un entretien, avec
   *  leurs compteurs indépendants des filtres (en-têtes, filtre par offre). */
  offers: InterviewOfferSummary[]
  counts: { total: number; upcoming: number; toHandle: number; toRecord: number }
  truncated: boolean
}

/**
 * Entretiens des offres du recruteur. Les compteurs (par offre et globaux)
 * portent sur tous ses entretiens ; les filtres (période, statut, offre,
 * issue) ne s'appliquent qu'à la liste. Tri : `compareInterviewsForList`.
 */
export async function listRecruiterInterviews(
  recruiterId: string,
  query: RecruiterInterviewQuery,
  now: Date = new Date(),
): Promise<ServiceResult<RecruiterInterviewList>> {
  const store = interviewStore()
  if (!store) return unavailable()
  if (query.outcome && !HIRING_SUPPORTED) return fail(503, HIRING_UNAVAILABLE_ERROR)
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
      status: true,
      opportunityId: true,
      opportunity: { select: { id: true, title: true } },
      candidate: { select: { candidateProfile: { select: { fullName: true } } } },
    },
  })
  const byId = new Map(dossiers.map((dossier) => [dossier.id, dossier]))
  const [contexts, proposals] = await Promise.all([
    buildHiringContexts(dossiers, rows),
    loadProposalRows(dossiers.map((dossier) => dossier.id)),
  ])

  const all: { item: RecruiterInterviewItem; row: InterviewRow }[] = []
  for (const row of rows) {
    const dossier = byId.get(row.suggestionId)
    if (!dossier) continue
    const context = contexts.get(dossier.id)
    all.push({
      row,
      item: {
        interview: toRecruiterInterviewView(row, recruiterId),
        suggestionId: dossier.id,
        opportunity: { id: dossier.opportunity.id, title: dossier.opportunity.title },
        candidate: { fullName: dossier.candidate.candidateProfile?.fullName ?? null },
        phase: HIRING_SUPPORTED && context ? hiringPhase(context.state, now) : null,
        proposal: latestProposalView(proposals.get(dossier.id), 'recruiter', recruiterId, now),
      },
    })
  }

  const offers = new Map<string, InterviewOfferSummary>()
  const counts = { total: 0, upcoming: 0, toHandle: 0, toRecord: 0 }
  for (const { item, row } of all) {
    const offer = offers.get(item.opportunity.id) ?? {
      id: item.opportunity.id,
      title: item.opportunity.title,
      total: 0,
      upcoming: 0,
      toHandle: 0,
      toRecord: 0,
    }
    const upcoming = isInterviewUpcoming(item.interview, now) ? 1 : 0
    const toHandle = interviewNeedsAction(item.interview) ? 1 : 0
    const toRecord = HIRING_SUPPORTED && outcomeToRecord(roundStateOf(row), item.phase, now) ? 1 : 0
    offer.total += 1
    offer.upcoming += upcoming
    offer.toHandle += toHandle
    offer.toRecord += toRecord
    offers.set(offer.id, offer)
    counts.total += 1
    counts.upcoming += upcoming
    counts.toHandle += toHandle
    counts.toRecord += toRecord
  }

  const interviews = all
    .filter(
      ({ item, row }) =>
        (!query.opportunityId || item.opportunity.id === query.opportunityId) &&
        (!query.status || item.interview.status === query.status) &&
        (!query.outcome || roundMatchesOutcomeFilter(roundStateOf(row), query.outcome, now, item.phase)) &&
        interviewInPeriod(item.interview, query.period, now),
    )
    .map(({ item }) => item)
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
  /** Tour, avec agenda, issue, motif et explication d'absence (jamais la note privée). */
  interview: AdminInterviewView
  suggestionId: string
  suggestionStatus: MatchSuggestionStatus
  opportunity: { id: string; title: string; companyName: string }
  recruiter: { id: string; companyName: string }
  candidate: { id: string; fullName: string | null }
  /** Phase dérivée du dossier ; `null` hors `mise_en_relation` ou suite non activée. */
  phase: HiringPhase | null
  /** Dernière proposition d'embauche du dossier (vue admin), ou `null`. */
  proposal: HireProposalView | null
}

export interface AdminInterviewList {
  interviews: AdminInterviewItem[]
  /** Nombre total de lignes pour les filtres demandés. */
  total: number
  /** Décalage de la page suivante, `null` s'il n'y en a plus. */
  nextOffset: number | null
  /** Compteurs sur l'offre / le recruteur filtrés (sinon toute la
   *  plateforme), indépendants de la période, du statut, de l'issue et du
   *  filtre agenda. `toRecord` : issues à renseigner (même définition que le
   *  filtre `a_renseigner`, dossiers en phase `issue_a_renseigner`) ;
   *  `noShows` : absences. */
  counts: { upcoming: number; impediments: number; calendarIssues: number; toRecord: number; noShows: number }
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
): Promise<ServiceResult<AdminInterviewList>> {
  const store = interviewStore()
  if (!store) return unavailable()
  if (query.outcome && !HIRING_SUPPORTED) return fail(503, HIRING_UNAVAILABLE_ERROR)

  const dossierScope: Where = {}
  if (query.opportunityId) dossierScope.opportunityId = query.opportunityId
  if (query.recruiterId) dossierScope.opportunity = { recruiterId: query.recruiterId }
  const scope: Where | null = Object.keys(dossierScope).length > 0 ? { suggestion: dossierScope } : null
  const base = and(
    scope,
    query.status ? { status: query.status } : null,
    query.calendarIssue ? calendarIssueWhere(now) : null,
    query.outcome ? outcomeWhere(query.outcome, now) : null,
  )

  let page: { rows: InterviewRow[]; total: number }
  let counts: AdminInterviewList['counts']
  try {
    const [pageResult, upcoming, impediments, calendarIssues, toRecord, noShows] = await Promise.all([
      adminPage(store, base, query.period, query.offset, query.limit, now),
      store.count({ where: and(scope, upcomingWhere(now)) }),
      store.count({ where: and(scope, { status: 'empechement' }) }),
      store.count({ where: and(scope, calendarIssueWhere(now)) }),
      HIRING_SUPPORTED ? store.count({ where: and(scope, outcomeWhere('a_renseigner', now)) }) : Promise.resolve(0),
      HIRING_SUPPORTED ? store.count({ where: and(scope, outcomeWhere('absent', now)) }) : Promise.resolve(0),
    ])
    page = pageResult
    counts = { upcoming, impediments, calendarIssues, toRecord, noShows }
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
        opportunityId: true,
        opportunity: { select: opportunitySelect },
        candidate: { select: { id: true, candidateProfile: { select: { fullName: true } } } },
      },
    }),
    // Valeurs des filtres : une ligne par offre ayant au moins un entretien.
    prisma.matchSuggestion.findMany({
      where: suggestionHasInterviewWhere(),
      distinct: ['opportunityId'],
      select: { opportunity: { select: opportunitySelect } },
    }),
  ])
  const byId = new Map(dossiers.map((dossier) => [dossier.id, dossier]))
  // Phase : tous les tours des dossiers de la page (pas seulement ceux affichés).
  const [contexts, proposals] = await Promise.all([
    loadHiringContexts(dossiers),
    loadProposalRows(dossiers.map((dossier) => dossier.id)),
  ])
  const recruiterName = (o: { companyName: string; recruiter: { recruiterProfile: { companyName: string } | null } }) =>
    o.recruiter.recruiterProfile?.companyName || o.companyName

  const interviews: AdminInterviewItem[] = []
  for (const row of page.rows) {
    const dossier = byId.get(row.suggestionId)
    if (!dossier) continue
    const o = dossier.opportunity
    const context = contexts.get(dossier.id)
    interviews.push({
      interview: toAdminInterviewView(row),
      suggestionId: dossier.id,
      suggestionStatus: dossier.status as MatchSuggestionStatus,
      opportunity: { id: o.id, title: o.title, companyName: o.companyName },
      recruiter: { id: o.recruiterId, companyName: recruiterName(o) },
      candidate: { id: dossier.candidate.id, fullName: dossier.candidate.candidateProfile?.fullName ?? null },
      phase: HIRING_SUPPORTED && context ? hiringPhase(context.state, now) : null,
      proposal: latestProposalView(proposals.get(dossier.id), 'admin', '', now),
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
