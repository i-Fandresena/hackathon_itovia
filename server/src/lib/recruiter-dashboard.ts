import type { InterviewStatus, PlacementStage } from '@prisma/client'
import {
  interviewAwaitsCandidateReply,
  interviewNeedsAction,
  isInterviewUpcoming,
} from '../../../src/lib/interview.js'
import { prisma } from './prisma.js'
import { startOfUtcDay } from './preselection.js'
import { connectedAtOf, connectedAtSelect, filledOpportunityWhere } from './hiring-store.js'
import { loadTransmissionEvidence } from './hiring-stats.js'
import { dossierReceivedAt, isTransmittedDossier } from './hiring-metrics.js'
import { interviewStore, isInterviewStorageError, type InterviewRow } from './interviews.js'
import { bucketByDay, inSeries, percentOrNull, rollingWeeks, seriesDays, zeroRecord } from './day-series.js'

/**
 * Indicateurs du tableau de bord recruteur (`GET /recruiter/stats`).
 *
 * Périmètre : UNIQUEMENT les offres, dossiers, entretiens, placements,
 * abonnement, notifications et messages du recruteur connecté. La réponse
 * est construite champ par champ (liste blanche) : aucun email ni téléphone
 * de candidat, aucun identifiant de candidat, rien de la présélection ATS
 * (ni rang, ni candidats non transmis, ni suggestion `suggeree`).
 *
 * « Profils reçus » = dossiers que OffRec a transmis au recruteur : statuts
 * `proposee_recruteur`, `interet_recruteur`, `mise_en_relation`, plus les
 * dossiers `ecartee` dont on peut PROUVER qu'ils avaient été transmis avant
 * d'être écartés (voir `transmittedEvidence`). Un dossier écarté par l'admin
 * dans sa file interne, avant toute transmission, n'est jamais compté. Les
 * statuts hérités `proposee_candidat` / `interet_candidat` (avant
 * transmission) et `suggeree` ne sont jamais lus.
 *
 * Date de réception d'un dossier (série 30 jours, tendance 7 jours) : le
 * schéma n'a pas de colonne « transmis le ». On prend, dans l'ordre :
 * 1. la transmission journalisée par un admin (`AuditLog`
 *    `match_suggestion_status` vers `proposee_recruteur`) ;
 * 2. pour un dossier encore `proposee_recruteur`, sa dernière mise à jour
 *    (c'est le passage à ce statut : envoi direct ou promotion du moteur,
 *    aucune autre écriture ne touche la ligne ensuite) ;
 * 3. sinon sa création (envoi direct du moteur : création = réception ;
 *    seule approximation restante, une promotion du moteur suivie d'un
 *    changement de statut, datée alors à la création de la suggestion).
 *
 * Ces deux règles (dossier transmis, date de réception) sont celles de
 * lib/hiring-metrics.ts (`isTransmittedDossier`, `dossierReceivedAt`),
 * partagées avec l'entonnoir de recrutement (lib/hiring-stats.ts).
 *
 * Mise en relation datée par `connectedAt` (`updatedAt` seulement pour une
 * ligne sans date, ancien client) — même règle que le tableau admin.
 * Jours, fenêtres et tendances : `lib/day-series.ts` (mêmes définitions que
 * l'admin). Offre ouverte : date limite ≥ début du jour UTC, comme le moteur
 * de matching et la présélection.
 */

const VISIBLE = ['proposee_recruteur', 'interet_recruteur', 'mise_en_relation'] as const
const PLACEMENT_STAGES: PlacementStage[] = ['etape1_due', 'etape1_payee', 'etape2_due', 'etape2_payee', 'annule']
/** Plafond du classement par offre renvoyé (l'écran en montre 6). */
const OFFER_CAP = 100

interface Evidence {
  /** Décliné par CE recruteur. */
  declinedByRecruiter: boolean
}

/**
 * Preuves de transmission / sortie, lues dans le journal d'audit en UNE
 * requête pour tous les dossiers du recruteur (jamais une par dossier).
 */
async function loadEvidence(recruiterId: string, suggestionIds: string[]) {
  const evidence = await loadTransmissionEvidence(suggestionIds)
  const declined = new Map<string, Evidence>()
  for (const [id, e] of evidence) declined.set(id, { declinedByRecruiter: e.declinedBy.includes(recruiterId) })
  return { evidence, declined }
}

async function loadInterviewRows(recruiterId: string): Promise<InterviewRow[] | null> {
  const store = interviewStore()
  if (!store) return null
  try {
    // Même périmètre que l'onglet « Entretiens » (lib/interview-list.ts).
    return await store.findMany({
      where: { suggestion: { status: 'mise_en_relation', opportunity: { recruiterId } } },
      orderBy: [{ scheduledAt: 'asc' }, { id: 'asc' }],
    })
  } catch (err) {
    if (isInterviewStorageError(err)) return null
    throw err
  }
}

export async function loadRecruiterDashboard(recruiterId: string, now: Date = new Date()) {
  const { start, days } = seriesDays(now)
  const startOfToday = startOfUtcDay(now)

  const [offers, suggestions, placementsByStage, placementsLast30, subscription, notificationsUnread, messagesUnread, interviewRows] =
    await Promise.all([
      prisma.opportunity.findMany({
        where: { recruiterId },
        select: { id: true, title: true, deadline: true, createdAt: true },
      }),
      // Jamais `suggeree` ni les statuts hérités d'avant transmission.
      prisma.matchSuggestion.findMany({
        where: { status: { in: [...VISIBLE, 'ecartee'] }, opportunity: { recruiterId } },
        select: { id: true, opportunityId: true, status: true, preselectionRank: true, createdAt: true, updatedAt: true, ...connectedAtSelect() },
      }),
      prisma.placement.groupBy({ by: ['stage'], where: { recruiterId }, _count: { _all: true } }),
      prisma.placement.count({ where: { recruiterId, createdAt: { gte: start } } }),
      prisma.subscription.findUnique({
        where: { recruiterId },
        select: { startedAt: true, plan: { select: { code: true, name: true, priceAr: true, maxActiveOpportunities: true } } },
      }),
      prisma.notification.count({ where: { userId: recruiterId, read: false } }),
      prisma.message.count({
        where: {
          readAt: null,
          senderId: { not: recruiterId },
          conversation: { OR: [{ participantAId: recruiterId }, { participantBId: recruiterId }] },
        },
      }),
      loadInterviewRows(recruiterId),
    ])

  /* --- Entretiens ------------------------------------------------- */
  const upcoming = (interviewRows ?? []).filter((row) => isInterviewUpcoming(row, now))
  const nextRow = upcoming[0] ?? null

  const [{ evidence, declined }, nextDossier] = await Promise.all([
    loadEvidence(
      recruiterId,
      suggestions.map((s) => s.id),
    ),
    nextRow
      ? prisma.matchSuggestion.findFirst({
          where: { id: nextRow.suggestionId, status: 'mise_en_relation', opportunity: { recruiterId } },
          select: {
            opportunity: { select: { id: true, title: true } },
            // Le nom seulement — déjà visible dans « Entretiens ».
            candidate: { select: { candidateProfile: { select: { fullName: true } } } },
          },
        })
      : null,
  ])

  /* --- Profils reçus ---------------------------------------------- */
  const status = { proposee_recruteur: 0, interet_recruteur: 0, mise_en_relation: 0, ecartee: 0 }
  let declinedByYou = 0
  const received: { opportunityId: string; status: keyof typeof status; receivedAt: Date }[] = []
  for (const s of suggestions) {
    const e = evidence.get(s.id)
    if (!isTransmittedDossier(s, e)) continue
    if (s.status === 'ecartee' && declined.get(s.id)?.declinedByRecruiter) declinedByYou++
    const key = s.status as keyof typeof status
    status[key]++
    const receivedAt = dossierReceivedAt(s, e)
    received.push({ opportunityId: s.opportunityId, status: key, receivedAt })
  }
  const receivedTotal = received.length
  const toReview = status.proposee_recruteur + status.interet_recruteur
  const receivedDates = received.map((r) => r.receivedAt)
  const receivedWeeks = rollingWeeks(receivedDates, now)
  const byDayFor = (keys: (keyof typeof status)[]) =>
    bucketByDay(received.filter((r) => keys.includes(r.status)).map((r) => r.receivedAt), days)

  const connectedDates = suggestions.filter((s) => s.status === 'mise_en_relation').map((s) => connectedAtOf(s))
  const connectedWeeks = rollingWeeks(connectedDates, now)

  /* --- Offres ----------------------------------------------------- */
  // Offre ouverte : non pourvue (D1) et date limite non dépassée — même
  // définition que `opportunityClosedReason()` (le compte du recruteur
  // connecté est actif par construction).
  const filledIds = new Set(
    (await prisma.opportunity.findMany({ where: { recruiterId, ...filledOpportunityWhere() }, select: { id: true } })).map(
      (o) => o.id,
    ),
  )
  const openIds = new Set(offers.filter((o) => o.deadline >= startOfToday && !filledIds.has(o.id)).map((o) => o.id))
  const offerWeeks = rollingWeeks(offers.map((o) => o.createdAt), now)
  const perOffer = new Map(offers.map((o) => [o.id, { received: 0, toReview: 0, connected: 0, dismissed: 0 }]))
  for (const r of received) {
    const c = perOffer.get(r.opportunityId)
    if (!c) continue
    c.received++
    if (r.status === 'mise_en_relation') c.connected++
    else if (r.status === 'ecartee') c.dismissed++
    else c.toReview++
  }
  const byOffer = offers
    .map((o) => ({ id: o.id, title: o.title, open: openIds.has(o.id), filled: filledIds.has(o.id), deadline: o.deadline.toISOString(), createdAt: o.createdAt, ...perOffer.get(o.id)! }))
    .sort(
      (a, b) =>
        b.received - a.received ||
        b.connected - a.connected ||
        b.createdAt.getTime() - a.createdAt.getTime() ||
        a.id.localeCompare(b.id),
    )
    .slice(0, OFFER_CAP)
    .map(({ createdAt: _createdAt, ...rest }) => rest)

  /* --- Entretiens (suite) ----------------------------------------- */
  const rows = interviewRows ?? []
  const interviewCount = (pred: (row: InterviewRow) => boolean) => rows.filter(pred).length
  const interviews =
    interviewRows === null
      ? null
      : {
          total: rows.length,
          upcoming: upcoming.length,
          upcomingConfirmed: upcoming.filter((row) => row.status === 'confirme').length,
          awaitingReply: interviewCount((row) => interviewAwaitsCandidateReply(row, now)),
          toHandle: interviewCount((row) => interviewNeedsAction(row)),
          pastLast30: interviewCount(
            (row) => row.status !== 'annule' && !isInterviewUpcoming(row, now) && row.scheduledAt >= start,
          ),
          cancelled: interviewCount((row) => row.status === 'annule'),
          next:
            nextRow && nextDossier
              ? {
                  suggestionId: nextRow.suggestionId,
                  scheduledAt: nextRow.scheduledAt.toISOString(),
                  durationMinutes: nextRow.durationMinutes,
                  status: nextRow.status as InterviewStatus,
                  opportunity: { id: nextDossier.opportunity.id, title: nextDossier.opportunity.title },
                  candidateName: nextDossier.candidate.candidateProfile?.fullName ?? null,
                }
              : null,
        }

  /* --- Placements (suivi déclaratif) ------------------------------ */
  const stages = zeroRecord(PLACEMENT_STAGES)
  for (const g of placementsByStage) stages[g.stage] = g._count._all

  return {
    computedAt: now.toISOString(),
    timezone: 'UTC+3',
    seriesDays: days,
    offers: {
      total: offers.length,
      open: openIds.size,
      // Pourvues (D1) à part : `expired` ne compte que les offres non pourvues échues.
      filled: filledIds.size,
      expired: offers.length - openIds.size - filledIds.size,
      newLast7: offerWeeks.last7,
      newPrev7: offerWeeks.prev7,
    },
    profiles: {
      received: receivedTotal,
      toReview,
      transmitted: status.proposee_recruteur,
      interest: status.interet_recruteur,
      connected: status.mise_en_relation,
      dismissed: status.ecartee,
      declinedByYou,
      /** mises en relation / profils reçus, en % (une décimale) ; `null` sans profil reçu. */
      connectionRate: percentOrNull(status.mise_en_relation, receivedTotal),
      receivedSeries: bucketByDay(receivedDates, days),
      receivedSeriesByStatus: {
        toReview: byDayFor(['proposee_recruteur', 'interet_recruteur']),
        connected: byDayFor(['mise_en_relation']),
        dismissed: byDayFor(['ecartee']),
      },
      receivedLast30: inSeries(receivedDates, start, now).length,
      receivedLast7: receivedWeeks.last7,
      receivedPrev7: receivedWeeks.prev7,
      connectedSeries: bucketByDay(connectedDates, days),
      connectedLast30: inSeries(connectedDates, start, now).length,
      connectedLast7: connectedWeeks.last7,
      connectedPrev7: connectedWeeks.prev7,
    },
    byOffer,
    interviews,
    placements: {
      total: PLACEMENT_STAGES.reduce((sum, k) => sum + stages[k], 0),
      byStage: stages,
      inProgress: stages.etape1_due + stages.etape1_payee + stages.etape2_due,
      completed: stages.etape2_payee,
      cancelled: stages.annule,
      feeStepsDue: stages.etape1_due + stages.etape2_due,
      last30: placementsLast30,
    },
    subscription: subscription
      ? {
          planCode: subscription.plan.code,
          planName: subscription.plan.name,
          priceAr: subscription.plan.priceAr,
          maxActiveOpportunities: subscription.plan.maxActiveOpportunities,
          startedAt: subscription.startedAt.toISOString(),
        }
      : null,
    notifications: { unread: notificationsUnread },
    messages: { unread: messagesUnread },
  }
}
