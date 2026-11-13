import type { MatchSuggestionStatus } from '../../../src/types/index.js'
import { candidateWithdrawalEffect } from '../../../src/lib/hiring.js'
import { prisma } from './prisma.js'
import { clip, plural, scheduleAdminNotification, scheduleNotification } from './notify.js'
import { HIRING_SUPPORTED, HIRING_UNAVAILABLE_ERROR, hireProposalStore } from './hiring-store.js'
import { CANDIDATE_WITHDREW_ACTION, buildHiringContexts } from './hiring-state.js'
import { commitMatchTransition } from './preselection-service.js'
import { activeCandidatePlacementWhere } from './candidate-placement.js'
import {
  calendarContext,
  candidateName,
  fail,
  interviewStore,
  isInterviewStorageError,
  loadDossier,
  lockDossier,
  notifyRecruiter,
  scheduleCalendarAlert,
  syncCalendar,
  type Dossier,
  type InterviewRow,
  type ServiceResult,
} from './interviews.js'

/**
 * « Me retirer de mes autres dossiers » (décision 2026-11-12) : le candidat
 * embauché via OffRec choisit, après « Félicitations ! » ou plus tard depuis
 * son tableau de bord, de quitter TOUS ses autres dossiers encore ouverts —
 * hors les offres où il a un placement actif. « Les garder » ne fait rien.
 *
 * Par dossier, une transaction sous le verrou du dossier (`lockDossier`,
 * jamais deux verrous de dossier à la fois : pas d'interblocage avec la
 * clôture d'une offre pourvue), état relu sous verrou, écritures
 * conditionnelles, `AuditLog` dans la transaction :
 * - avant la mise en relation (`suggeree`, `proposee_recruteur`,
 *   `interet_recruteur`, statuts hérités) → `ecartee` par
 *   `commitMatchTransition` (même chemin que `/decline`), journal
 *   `candidate_declined` avec `from` et `source: withdraw_others`.
 *   `closedReason` reste vide : l'enum `MatchClosedReason` n'a que
 *   `offre_pourvue` et en ajouter une valeur demanderait une migration (le
 *   retrait unitaire `/decline` ne le renseigne pas non plus) ;
 * - mis en relation (`candidateWithdrawalEffect`, src/lib/hiring.ts) → tour
 *   actif sans issue annulé (événement Google supprimé après la réponse),
 *   proposition en attente déclinée avec la catégorie neutre `autre` (pas
 *   `autre_offre_acceptee` : le recruteur lit la catégorie, D3, et ne doit
 *   pas apprendre l'embauche ailleurs), puis trace `candidate_withdrew_dossier`
 *   qui clôt le dossier (phase `retrait_candidat`) ; le statut reste
 *   `mise_en_relation` (invariant « après l'entretien »).
 * Un dossier embauché, terminal ou déjà retiré n'est pas touché.
 *
 * Après la réponse : chaque recruteur qui voyait le dossier reçoit un
 * message neutre (« … a retiré son dossier »), sans mention d'une embauche
 * ailleurs ; un résumé aux admins ; rien de plus au candidat.
 */

export const NOT_PLACED_ERROR =
  'Cette action est réservée aux candidats en poste via OffRec. Vous pouvez vous retirer d’un dossier depuis sa page.'

const VISIBLE_TO_RECRUITER: readonly MatchSuggestionStatus[] = ['proposee_recruteur', 'interet_recruteur', 'mise_en_relation']
/** Statuts que le candidat voit dans « Mes dossiers » (comme `/mine`). */
const VISIBLE_TO_CANDIDATE: readonly MatchSuggestionStatus[] = [
  'proposee_candidat',
  'interet_candidat',
  'proposee_recruteur',
  'interet_recruteur',
  'mise_en_relation',
]

interface OpenDossier {
  id: string
  status: MatchSuggestionStatus
  opportunityId: string
}

/** Offres où le candidat a un placement actif (offre supprimée : ignorée). */
async function placedOpportunityIds(candidateId: string): Promise<{ placed: boolean; ids: Set<string> }> {
  const rows = await prisma.placement.findMany({
    where: activeCandidatePlacementWhere(candidateId),
    select: { opportunityId: true },
  })
  return { placed: rows.length > 0, ids: new Set(rows.flatMap((row) => (row.opportunityId ? [row.opportunityId] : []))) }
}

/** Autres dossiers encore ouverts du candidat (hors offres où il est en poste). */
async function loadOpenDossiers(candidateId: string, placedIds: Set<string>, now: Date): Promise<OpenDossier[]> {
  const rows = await prisma.matchSuggestion.findMany({
    where: { candidateId, status: { not: 'ecartee' } },
    select: { id: true, status: true, opportunityId: true },
    orderBy: { id: 'asc' },
  })
  const candidates = rows.filter((row) => !placedIds.has(row.opportunityId))
  const connected = candidates.filter((row) => row.status === 'mise_en_relation')
  const rounds = interviewStore()
  const roundRows = rounds && connected.length > 0 ? await rounds.findMany({ where: { suggestionId: { in: connected.map((row) => row.id) } } }) : []
  const contexts = await buildHiringContexts(connected, roundRows)
  return candidates
    .filter((row) => {
      if (row.status !== 'mise_en_relation') return true
      const context = contexts.get(row.id)
      return Boolean(context && candidateWithdrawalEffect(context.state, now))
    })
    .map((row) => ({ id: row.id, status: row.status as MatchSuggestionStatus, opportunityId: row.opportunityId }))
}

export interface OtherDossiersSummary {
  /** Au moins un placement actif (seul cas où « Me retirer » est proposé). */
  placed: boolean
  /** Autres dossiers ouverts que le candidat voit dans « Mes dossiers ». */
  openDossiers: number
}

/** Ce que l'interface propose au candidat (après « Félicitations ! », tableau de bord). */
export async function otherDossiersSummary(candidateId: string, now: Date = new Date()): Promise<OtherDossiersSummary> {
  const { placed, ids } = await placedOpportunityIds(candidateId)
  if (!placed) return { placed: false, openDossiers: 0 }
  const open = await loadOpenDossiers(candidateId, ids, now)
  return { placed: true, openDossiers: open.filter((row) => VISIBLE_TO_CANDIDATE.includes(row.status)).length }
}

type Withdrawn =
  | { kind: 'avant_mise_en_relation'; dossier: Dossier; from: MatchSuggestionStatus }
  | { kind: 'mis_en_relation'; dossier: Dossier; cancelledRound: InterviewRow | null; upcoming: boolean; declined: boolean }

async function withdrawOne(candidateId: string, id: string, now: Date): Promise<Withdrawn | null> {
  return prisma.$transaction(async (tx) => {
    await lockDossier(tx, id)
    const fresh = await loadDossier(id, tx)
    if (!fresh || fresh.candidateId !== candidateId || fresh.status === 'ecartee') return null
    // Embauché entre-temps sur l'offre de ce dossier : on n'y touche pas.
    const hiredHere = await tx.placement.count({
      where: { ...activeCandidatePlacementWhere(candidateId), opportunityId: fresh.opportunityId },
    })
    if (hiredHere > 0) return null
    const from = fresh.status as MatchSuggestionStatus

    if (from !== 'mise_en_relation') {
      const moved = await commitMatchTransition(tx, { id, from, to: 'ecartee' })
      if (!moved) return null
      await tx.auditLog.create({
        data: {
          userId: candidateId,
          action: 'candidate_declined',
          // `from` : comme `/decline` (le tableau de bord recruteur et la
          // mesure comptent un retrait qui suit une transmission).
          metadata: { opportunityTitle: fresh.opportunity.title, suggestionId: id, from, source: 'withdraw_others' },
        },
      })
      return { kind: 'avant_mise_en_relation', dossier: fresh, from }
    }

    const rounds = interviewStore(tx)
    const rows = rounds ? await rounds.findMany({ where: { suggestionId: id } }) : []
    const context = (await buildHiringContexts([fresh], rows, tx)).get(id)
    const effect = context ? candidateWithdrawalEffect(context.state, now) : null
    if (!effect) return null

    let cancelledRound: InterviewRow | null = null
    if (effect.cancelRoundId && rounds) {
      const before = rows.find((row) => row.id === effect.cancelRoundId)
      const { count } = await rounds.updateMany({
        where: { id: effect.cancelRoundId, activeSuggestionId: id, outcome: null, status: { not: 'annule' } },
        data: { status: 'annule', cancelledAt: now },
      })
      cancelledRound = count > 0 ? await rounds.findUnique({ where: { id: effect.cancelRoundId } }) : null
      if (cancelledRound) {
        await tx.auditLog.create({
          data: {
            userId: candidateId,
            action: 'interview_cancelled',
            metadata: { suggestionId: id, interviewId: cancelledRound.id, previousStatus: before?.status ?? null, source: 'retrait_candidat' },
          },
        })
      }
    }
    let declined = false
    const proposals = hireProposalStore(tx)
    if (effect.declineProposalId && proposals) {
      const { count } = await proposals.updateMany({
        where: { id: effect.declineProposalId, status: 'envoyee', expiresAt: { gt: now } },
        data: { status: 'refusee', respondedAt: now, declineReason: 'autre', declineNote: null, pendingSuggestionId: null },
      })
      declined = count > 0
      if (declined) {
        await tx.auditLog.create({
          data: {
            userId: candidateId,
            action: 'hire_proposal_declined',
            metadata: { suggestionId: id, proposalId: effect.declineProposalId, reason: 'autre', source: 'withdraw_others' },
          },
        })
      }
    }
    await tx.auditLog.create({
      data: {
        userId: candidateId,
        action: CANDIDATE_WITHDREW_ACTION,
        metadata: {
          suggestionId: id,
          opportunityId: fresh.opportunityId,
          cancelledInterviewId: cancelledRound?.id ?? null,
          declinedProposalId: declined ? effect.declineProposalId : null,
          source: 'withdraw_others',
        },
      },
    })
    return { kind: 'mis_en_relation', dossier: fresh, cancelledRound, upcoming: effect.cancelRoundUpcoming, declined }
  })
}

export interface WithdrawOthersBody {
  /** Dossiers effectivement retirés par cet appel. */
  withdrawn: number
}

/** `POST /match-suggestions/withdraw-others` (candidat). 409 s'il n'est pas en poste. */
export async function withdrawFromOtherDossiers(candidateId: string): Promise<ServiceResult<WithdrawOthersBody>> {
  if (!HIRING_SUPPORTED) return fail(503, HIRING_UNAVAILABLE_ERROR)
  const now = new Date()
  const { placed, ids } = await placedOpportunityIds(candidateId)
  if (!placed) return fail(409, NOT_PLACED_ERROR)

  const done: Withdrawn[] = []
  try {
    for (const dossier of await loadOpenDossiers(candidateId, ids, now)) {
      const result = await withdrawOne(candidateId, dossier.id, now)
      if (result) done.push(result)
    }
  } catch (err) {
    if (isInterviewStorageError(err)) return fail(503, HIRING_UNAVAILABLE_ERROR)
    throw err
  }

  scheduleWithdrawalEffects(done)
  return { ok: true, httpStatus: 200, body: { withdrawn: done.length } }
}

/** Après la réponse : agenda, recruteurs (message neutre), résumé aux admins. Ne lève jamais. */
function scheduleWithdrawalEffects(done: readonly Withdrawn[]): void {
  if (done.length === 0) return
  scheduleNotification('Effets du retrait des autres dossiers', async () => {
    const store = interviewStore()
    for (const item of done) {
      if (item.kind !== 'mis_en_relation' || !item.cancelledRound || !store) continue
      try {
        const ctx = calendarContext(item.dossier)
        const synced = await syncCalendar(store, item.cancelledRound, ctx)
        if (synced.failed) scheduleCalendarAlert(synced.row, ctx, null)
      } catch (err) {
        console.error('[withdraw-others] Agenda d’un tour annulé impossible', err)
      }
    }
    for (const item of done) {
      const status = item.kind === 'mis_en_relation' ? 'mise_en_relation' : item.from
      if (!VISIBLE_TO_RECRUITER.includes(status)) continue
      // Neutre : jamais d'embauche ailleurs, de motif ni de coordonnées.
      await notifyRecruiter(
        item.dossier.opportunity.recruiterId,
        'Candidat retiré',
        `Le candidat ${candidateName(item.dossier)} a retiré son dossier pour « ${clip(item.dossier.opportunity.title)} ».` +
          (item.kind === 'mis_en_relation' && item.cancelledRound && item.upcoming ? ' L’entretien prévu est annulé.' : ''),
      )
    }
  })
  const first = done[0].dossier
  const before = done.filter((item) => item.kind === 'avant_mise_en_relation').length
  const connected = done.filter((item): item is Extract<Withdrawn, { kind: 'mis_en_relation' }> => item.kind === 'mis_en_relation')
  const rounds = connected.filter((item) => item.cancelledRound).length
  const declined = connected.filter((item) => item.declined).length
  const details = [
    before > 0 && `${plural(before, 'dossier')} avant mise en relation`,
    connected.length > 0 && `${plural(connected.length, 'dossier')} mis en relation`,
    rounds > 0 && `${plural(rounds, 'entretien')} ${rounds > 1 ? 'annulés' : 'annulé'}`,
    declined > 0 && `${plural(declined, 'proposition')} ${declined > 1 ? 'déclinées' : 'déclinée'}`,
  ].filter(Boolean)
  scheduleAdminNotification({
    event: 'candidate_withdrew_other_dossiers',
    category: 'candidat',
    title: 'Candidat embauché retiré de ses autres dossiers',
    message:
      `${candidateName(first)}, en poste via OffRec, s’est retiré de ${plural(done.length, 'autre dossier', 'autres dossiers')}` +
      ` : ${details.join(', ')}. Les recruteurs ont reçu un message neutre.`,
    link: '/admin/mise-en-relation',
  })
}
