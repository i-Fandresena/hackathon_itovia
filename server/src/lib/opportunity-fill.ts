import type { Prisma } from '@prisma/client'
import type { MatchSuggestionStatus, Opportunity } from '../../../src/types/index.js'
import {
  checkOpportunityFillAction,
  filledClosureEffect,
  filledNoticeKind,
  positionFilledNotice,
  shouldAutoFill,
} from '../../../src/lib/hiring.js'
import { prisma } from './prisma.js'
import { clip, plural, scheduleAdminNotification, scheduleNotification } from './notify.js'
import { toDomainOpportunity } from './domain.js'
import { SYSTEM_ALLOWED_TRANSITIONS } from './preselection.js'
import { checkMatchTransition, commitMatchTransition } from './preselection-service.js'
import {
  HIRING_SUPPORTED,
  HIRING_UNAVAILABLE_ERROR,
  filledAtOf,
  hireProposalStore,
  opportunityFillData,
  positionsData,
  positionsOf,
  unfilledOpportunityWhere,
} from './hiring-store.js'
import { buildHiringContexts } from './hiring-state.js'
import {
  calendarContext,
  fail,
  interviewStore,
  loadDossier,
  lockDossier,
  notifyCandidateNotice,
  notifyRecruiter,
  scheduleCalendarAlert,
  syncCalendar,
  type InterviewRow,
  type ServiceResult,
} from './interviews.js'

/**
 * Offre pourvue (décision D1 du 2026-10-16, sous-lot 5).
 *
 * Une offre a un nombre de postes (`positions`, 1 à 50). Elle passe
 * « pourvue » (`filledAt`, `filledBy = 'auto'`) quand ses placements non
 * annulés atteignent ce nombre — après l'acceptation d'une proposition
 * (lib/hire-proposals.ts), la déclaration du placement d'un talent
 * (routes/placements.routes.ts) ou une baisse du nombre de postes — ou à la
 * main (« Marquer comme pourvue », `filledBy` = le recruteur). « Rouvrir »
 * la remet ouverte avec au moins un poste libre ; les dossiers déjà clos ne
 * sont jamais réactivés (règle `ecartee`), le moteur repart pour de
 * nouveaux candidats.
 *
 * Une offre pourvue est FERMÉE : `opportunityClosedReason()` (matching,
 * présélection, transitions admin), `openOpportunityWhere()`, nouvelles
 * propositions, tour suivant, issues « retenu » / « second entretien ».
 *
 * La clôture des AUTRES dossiers se fait dans la MÊME transaction que le
 * passage à « pourvue » (`closeFilledOpportunityTx`), sous le verrou de
 * l'offre puis de chaque dossier (même ordre partout : offre, puis dossier) :
 * - dossier non mis en relation → `ecartee` + `closedReason: offre_pourvue`,
 *   par `commitMatchTransition` (acteur `system`, `SYSTEM_ALLOWED_TRANSITIONS`) ;
 * - dossier mis en relation et non terminal → tour actif à venir annulé
 *   (événement Google supprimé après la réponse) et proposition en attente
 *   retirée (`withdrawReason: poste_pourvu`) — `filledClosureEffect()`.
 * Après la réponse : agenda, message neutre « poste pourvu » à chaque
 * candidat concerné (sans nom d'entreprise s'il n'était pas mis en relation),
 * recruteur informé (clôture automatique), un seul résumé aux admins. Les
 * candidats restent dans le vivier : l'écartement ne vaut que pour l'offre.
 */

type Tx = Prisma.TransactionClient

/** Verrouille la ligne de l'offre jusqu'à la fin de la transaction (avant tout verrou de dossier). */
export async function lockOpportunity(tx: Tx, opportunityId: string): Promise<void> {
  await tx.$queryRaw`SELECT "id" FROM "Opportunity" WHERE "id" = ${opportunityId} FOR UPDATE`
}

/** Placements non annulés liés à l'offre (diplômés acceptés, déclarations, talents) — D1. */
export async function countActivePlacements(client: Tx | typeof prisma, opportunityId: string): Promise<number> {
  return client.placement.count({ where: { opportunityId, stage: { not: 'annule' } } })
}

export type FilledNoticeKind = 'mis_en_relation' | 'profil_transmis'

/** Ce que la clôture a fait, pour les effets à produire après la réponse. */
export interface FilledClosure {
  opportunityId: string
  title: string
  companyName: string
  recruiterId: string
  source: 'auto' | 'manuel'
  positions: number
  activePlacements: number
  /** Candidats à prévenir (message neutre « poste pourvu »). */
  notices: { candidateId: string; kind: FilledNoticeKind }[]
  /** Tours annulés : événement Google à supprimer après la réponse. */
  cancelledRounds: InterviewRow[]
  /** Dossiers non mis en relation écartés (`closedReason: offre_pourvue`). */
  closedDossiers: number
  /** Propositions en attente retirées (`withdrawReason: poste_pourvu`). */
  withdrawnProposals: number
}

const CLOSABLE_STATUSES = Object.keys(SYSTEM_ALLOWED_TRANSITIONS) as MatchSuggestionStatus[]

/**
 * Clôt les autres dossiers d'une offre qui vient de passer « pourvue », dans
 * la transaction qui l'a pourvue (offre déjà verrouillée). Idempotente : un
 * dossier déjà écarté, terminal ou embauché n'est pas touché. Chaque dossier
 * est verrouillé puis relu avant d'agir : une mise en relation ou une issue
 * concurrente est vue telle qu'elle a été validée.
 */
export async function closeFilledOpportunityTx(
  tx: Tx,
  opportunity: { id: string; title: string; companyName: string; recruiterId: string; positions: number },
  input: { now: Date; source: 'auto' | 'manuel'; actorId: string | null; activePlacements: number },
): Promise<FilledClosure> {
  const closure: FilledClosure = {
    opportunityId: opportunity.id,
    title: opportunity.title,
    companyName: opportunity.companyName,
    recruiterId: opportunity.recruiterId,
    source: input.source,
    positions: opportunity.positions,
    activePlacements: input.activePlacements,
    notices: [],
    cancelledRounds: [],
    closedDossiers: 0,
    withdrawnProposals: 0,
  }
  const candidates = await tx.matchSuggestion.findMany({
    where: { opportunityId: opportunity.id, status: { not: 'ecartee' } },
    select: { id: true },
    orderBy: { id: 'asc' },
  })
  const rounds = interviewStore(tx)
  const proposals = hireProposalStore(tx)

  for (const { id } of candidates) {
    await lockDossier(tx, id)
    const dossier = await tx.matchSuggestion.findUnique({
      where: { id },
      select: { id: true, status: true, candidateId: true, opportunityId: true },
    })
    if (!dossier) continue
    const from = dossier.status as MatchSuggestionStatus

    if (CLOSABLE_STATUSES.includes(from)) {
      const check = checkMatchTransition({ actor: 'system', from, to: 'ecartee', hasConsent: true })
      if (!check.ok) continue
      const moved = await commitMatchTransition(tx, { id, from, to: 'ecartee', closedReason: 'offre_pourvue' })
      if (!moved) continue
      closure.closedDossiers += 1
      await tx.auditLog.create({
        data: {
          userId: input.actorId,
          action: 'match_suggestion_status',
          metadata: { suggestionId: id, from, to: 'ecartee', source: 'offre_pourvue' },
        },
      })
      const kind = filledNoticeKind({ status: from, rounds: [], proposals: [], placement: null, filledAt: null }, input.now)
      if (kind) closure.notices.push({ candidateId: dossier.candidateId, kind })
      continue
    }
    if (from !== 'mise_en_relation' || !rounds) continue

    const rows = await rounds.findMany({ where: { suggestionId: id } })
    const context = (await buildHiringContexts([dossier], rows, tx)).get(id)
    const effect = context ? filledClosureEffect(context.state, input.now) : null
    if (!effect) continue // embauché, ou dossier déjà terminal

    if (effect.cancelRoundId) {
      const before = rows.find((row) => row.id === effect.cancelRoundId)
      const { count } = await rounds.updateMany({
        where: { id: effect.cancelRoundId, activeSuggestionId: id, status: { not: 'annule' } },
        data: { status: 'annule', cancelledAt: input.now },
      })
      const after = count > 0 ? await rounds.findUnique({ where: { id: effect.cancelRoundId } }) : null
      if (after) {
        closure.cancelledRounds.push(after)
        await tx.auditLog.create({
          data: {
            userId: input.actorId,
            action: 'interview_cancelled',
            metadata: {
              suggestionId: id,
              interviewId: after.id,
              previousStatus: before?.status ?? null,
              source: 'offre_pourvue',
            },
          },
        })
      }
    }
    if (effect.withdrawProposalId && proposals) {
      const { count } = await proposals.updateMany({
        where: { id: effect.withdrawProposalId, status: 'envoyee' },
        data: { status: 'retiree', withdrawnAt: input.now, withdrawReason: 'poste_pourvu', pendingSuggestionId: null },
      })
      if (count > 0) {
        closure.withdrawnProposals += 1
        await tx.auditLog.create({
          data: {
            userId: input.actorId,
            action: 'hire_proposal_withdrawn',
            metadata: { suggestionId: id, proposalId: effect.withdrawProposalId, reason: 'poste_pourvu' },
          },
        })
      }
    }
    closure.notices.push({ candidateId: dossier.candidateId, kind: 'mis_en_relation' })
  }
  return closure
}

/**
 * Passage automatique à « pourvue » (D1) si les placements non annulés de
 * l'offre atteignent son nombre de postes, puis clôture des autres dossiers
 * — dans la transaction qui vient de créer un placement ou de modifier le
 * nombre de postes, offre VERROUILLÉE par l'appelant (`lockOpportunity`).
 * `null` si l'offre reste ouverte (ou l'était déjà plus).
 */
export async function applyAutoFillTx(
  tx: Tx,
  opportunityId: string,
  input: { now: Date; actorId: string | null },
): Promise<FilledClosure | null> {
  if (!HIRING_SUPPORTED) return null
  const opportunity = await tx.opportunity.findUnique({ where: { id: opportunityId } })
  if (!opportunity) return null
  const activePlacements = await countActivePlacements(tx, opportunityId)
  const positions = positionsOf(opportunity)
  if (!shouldAutoFill({ positions, activePlacements, filledAt: filledAtOf(opportunity) })) return null
  const { count } = await tx.opportunity.updateMany({
    where: { id: opportunityId, ...unfilledOpportunityWhere() },
    data: opportunityFillData({ filledAt: input.now, filledBy: 'auto' }),
  })
  if (count === 0) return null
  await tx.auditLog.create({
    data: {
      userId: input.actorId,
      action: 'opportunity_filled',
      metadata: { opportunityId, source: 'auto', positions, activePlacements },
    },
  })
  return closeFilledOpportunityTx(
    tx,
    { ...opportunity, positions },
    { now: input.now, source: 'auto', actorId: input.actorId, activePlacements },
  )
}

/**
 * Effets de la clôture APRÈS la réponse : agenda Google des tours annulés
 * (alerte admin en cas d'échec), message neutre « poste pourvu » à chaque
 * candidat concerné, recruteur informé d'une clôture automatique, un seul
 * résumé aux admins. Ne lève jamais.
 */
export function scheduleFilledClosureEffects(closure: FilledClosure | null): void {
  if (!closure) return
  scheduleNotification('Effets de la clôture d’une offre pourvue', async () => {
    const store = interviewStore()
    for (const row of closure.cancelledRounds) {
      if (!store) break
      try {
        const dossier = await loadDossier(row.suggestionId)
        if (!dossier) continue
        const ctx = calendarContext(dossier)
        const synced = await syncCalendar(store, row, ctx)
        if (synced.failed) scheduleCalendarAlert(synced.row, ctx, null)
      } catch (err) {
        console.error('[hiring] Agenda d’un tour annulé (offre pourvue) impossible', err)
      }
    }
    for (const notice of closure.notices) {
      await notifyCandidateNotice(
        notice.candidateId,
        positionFilledNotice({ kind: notice.kind, opportunityTitle: closure.title, companyName: closure.companyName }),
        '/candidat',
      )
    }
    if (closure.source === 'auto') {
      await notifyRecruiter(
        closure.recruiterId,
        'Offre pourvue',
        `Votre offre « ${clip(closure.title)} » est pourvue (${Math.min(closure.activePlacements, closure.positions)}/${closure.positions}). ` +
          'OffRec a clos les autres dossiers et informé les candidats. Pour recruter de nouveau, rouvrez-la depuis « Mes offres ».',
        '/recruteur/offres',
      )
    }
  })
  const parts = [
    closure.closedDossiers > 0 && `${plural(closure.closedDossiers, 'dossier non mis en relation')} ${closure.closedDossiers > 1 ? 'écartés' : 'écarté'}`,
    closure.cancelledRounds.length > 0 &&
      `${plural(closure.cancelledRounds.length, 'entretien')} à venir ${closure.cancelledRounds.length > 1 ? 'annulés' : 'annulé'}`,
    closure.withdrawnProposals > 0 &&
      `${plural(closure.withdrawnProposals, 'proposition')} en attente ${closure.withdrawnProposals > 1 ? 'retirées' : 'retirée'}`,
  ].filter(Boolean)
  scheduleAdminNotification({
    event: 'opportunity_filled',
    category: 'systeme',
    title: 'Offre pourvue',
    message:
      `L’offre « ${clip(closure.title)} » (${clip(closure.companyName, 60)}) est pourvue ` +
      `${closure.source === 'auto' ? `automatiquement (${closure.positions} poste${closure.positions > 1 ? 's' : ''})` : 'par le recruteur'}` +
      (parts.length > 0 ? ` : ${parts.join(', ')}.` : '. Aucun autre dossier en cours.'),
    link: '/admin/mise-en-relation',
  })
}

/* ------------------------------------------------------------------ */
/* Recruteur : « Marquer comme pourvue » et « Rouvrir »                */
/* ------------------------------------------------------------------ */

const OPPORTUNITY_NOT_FOUND = 'Offre introuvable.'

class FillRefusal extends Error {
  constructor(
    readonly httpStatus: number,
    message: string,
  ) {
    super(message)
  }
}

export interface FillBody {
  opportunity: Opportunity & { activePlacements: number }
}

/**
 * « Marquer comme pourvue » (embauche faite hors OffRec) par le recruteur
 * propriétaire : `filledBy` = le recruteur, puis clôture des autres dossiers
 * dans la même transaction. 404 hors de ses offres, 409 déjà pourvue.
 * `AuditLog` `opportunity_filled { source: 'manuel' }`.
 */
export async function markOpportunityFilled(input: {
  opportunityId: string
  recruiterId: string
}): Promise<ServiceResult<FillBody>> {
  if (!HIRING_SUPPORTED) return fail(503, HIRING_UNAVAILABLE_ERROR)
  const now = new Date()
  let closure: FilledClosure
  try {
    closure = await prisma.$transaction(async (tx) => {
      await lockOpportunity(tx, input.opportunityId)
      const opportunity = await tx.opportunity.findUnique({ where: { id: input.opportunityId } })
      if (!opportunity || opportunity.recruiterId !== input.recruiterId) throw new FillRefusal(404, OPPORTUNITY_NOT_FOUND)
      const activePlacements = await countActivePlacements(tx, opportunity.id)
      const positions = positionsOf(opportunity)
      const check = checkOpportunityFillAction({
        action: 'mark_filled',
        state: { positions, activePlacements, filledAt: filledAtOf(opportunity) },
      })
      if (!check.ok) throw new FillRefusal(check.httpStatus, check.error)
      await tx.opportunity.update({
        where: { id: opportunity.id },
        data: opportunityFillData({ filledAt: now, filledBy: input.recruiterId }),
      })
      await tx.auditLog.create({
        data: {
          userId: input.recruiterId,
          action: 'opportunity_filled',
          metadata: { opportunityId: opportunity.id, source: 'manuel', positions, activePlacements },
        },
      })
      return closeFilledOpportunityTx(
        tx,
        { ...opportunity, positions },
        { now, source: 'manuel', actorId: input.recruiterId, activePlacements },
      )
    })
  } catch (err) {
    if (err instanceof FillRefusal) return fail(err.httpStatus, err.message)
    throw err
  }
  scheduleFilledClosureEffects(closure)
  const body = await fillBody(input.opportunityId)
  return body ? { ok: true, httpStatus: 200, body } : fail(404, OPPORTUNITY_NOT_FOUND)
}

/**
 * « Rouvrir » une offre pourvue (recruteur propriétaire) : `filledAt` effacé,
 * au moins un poste libre (`positions` demandé, sinon max(postes actuels,
 * placements + 1) — `checkOpportunityFillAction`). Les dossiers clos ne sont
 * pas réactivés ; le moteur de matching repart pour de nouveaux candidats
 * (l'appelant le relance après la réponse). 404 / 409 pas pourvue / 400.
 */
export async function reopenOpportunity(input: {
  opportunityId: string
  recruiterId: string
  positions?: number
}): Promise<ServiceResult<FillBody>> {
  if (!HIRING_SUPPORTED) return fail(503, HIRING_UNAVAILABLE_ERROR)
  let previous: { title: string; companyName: string; positions: number; newPositions: number }
  try {
    previous = await prisma.$transaction(async (tx) => {
      await lockOpportunity(tx, input.opportunityId)
      const opportunity = await tx.opportunity.findUnique({ where: { id: input.opportunityId } })
      if (!opportunity || opportunity.recruiterId !== input.recruiterId) throw new FillRefusal(404, OPPORTUNITY_NOT_FOUND)
      const activePlacements = await countActivePlacements(tx, opportunity.id)
      const positions = positionsOf(opportunity)
      const check = checkOpportunityFillAction({
        action: 'reopen',
        state: { positions, activePlacements, filledAt: filledAtOf(opportunity) },
        requestedPositions: input.positions,
      })
      if (!check.ok) throw new FillRefusal(check.httpStatus, check.error)
      await tx.opportunity.update({
        where: { id: opportunity.id },
        data: { ...opportunityFillData(null), ...positionsData(check.positions) },
      })
      await tx.auditLog.create({
        data: {
          userId: input.recruiterId,
          action: 'opportunity_reopened',
          metadata: { opportunityId: opportunity.id, previousPositions: positions, positions: check.positions, activePlacements },
        },
      })
      return {
        title: opportunity.title,
        companyName: opportunity.companyName,
        positions,
        newPositions: check.positions,
      }
    })
  } catch (err) {
    if (err instanceof FillRefusal) return fail(err.httpStatus, err.message)
    throw err
  }
  scheduleAdminNotification({
    event: 'opportunity_reopened',
    category: 'recruteur',
    title: 'Offre rouverte',
    message:
      `${clip(previous.companyName, 60)} a rouvert l’offre « ${clip(previous.title)} » ` +
      `(${plural(previous.newPositions, 'poste')} au total). Les dossiers clos ne sont pas réactivés.`,
    link: '/admin/mise-en-relation',
  })
  const body = await fillBody(input.opportunityId)
  return body ? { ok: true, httpStatus: 200, body } : fail(404, OPPORTUNITY_NOT_FOUND)
}

/** Offre renvoyée au recruteur après « Marquer comme pourvue » / « Rouvrir » (jamais `filledBy`). */
async function fillBody(opportunityId: string): Promise<FillBody | null> {
  const opportunity = await prisma.opportunity.findUnique({ where: { id: opportunityId } })
  if (!opportunity) return null
  return {
    opportunity: { ...toDomainOpportunity(opportunity), activePlacements: await countActivePlacements(prisma, opportunityId) },
  }
}
