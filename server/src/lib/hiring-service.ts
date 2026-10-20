import type { InterviewDuration, InterviewResult, InterviewResultReason } from '../../../src/types/index.js'
import {
  ABSENCE_ALREADY_REPLIED_ERROR,
  NO_ABSENCE_ERROR,
  OUTCOME_ALREADY_RECORDED_ERROR,
  OUTCOME_RESET_BLOCKED_ERROR,
  ROUND_ALREADY_SCHEDULED_ERROR,
  absentNotice,
  checkHiringAction,
  hiringPhase,
  nextRoundNumber,
  nonRetenuNotice,
  retenuNotice,
  type HiringPhase,
} from '../../../src/lib/hiring.js'
import { prisma } from './prisma.js'
import { clip, scheduleAdminNotification, scheduleNotification } from './notify.js'
import { HIRING_SUPPORTED, HIRING_UNAVAILABLE_ERROR, hireProposalStore, roundOf } from './hiring-store.js'
import { withRounds } from './hiring-state.js'
import {
  INTERVIEW_CHANGED_ERROR,
  NOT_OWNER_ERROR,
  RoundsChangedError,
  activeRow,
  candidateName,
  createRoundInTx,
  dossierConnection,
  fail,
  interviewStore,
  isInterviewStorageError,
  isUniqueViolation,
  loadDossier,
  loadHiringContext,
  lockDossier,
  notifyCandidateNotice,
  notifyRecruiter,
  recordNewRound,
  scheduleNextRoundNotifications,
  toAdminInterviewView,
  toCandidateInterviewView,
  toRecruiterInterviewView,
  whenText,
  type AdminInterviewView,
  type CandidateInterviewView,
  type InterviewRow,
  type RecruiterInterviewView,
  type ServiceResult,
} from './interviews.js'

/**
 * « Après l'entretien » — sous-lot 3 (plan du 2026-10-16) : issue d'un tour,
 * explication d'absence du candidat et annulation d'une issue par l'admin.
 *
 * Chaque action enchaîne : chargement de l'état (`loadHiringContext`),
 * `checkHiringAction()` (src/lib/hiring.ts, juge unique), écriture
 * CONDITIONNELLE sous verrou du dossier (`lockDossier` + `updateMany` sur
 * l'état lu : un double clic ou deux onglets donnent 409, jamais deux
 * issues), `AuditLog`, puis notifications APRÈS la réponse.
 *
 * Visibilité (D3) : le candidat ne reçoit jamais l'issue brute, le motif ni
 * la note — seulement les textes neutres de src/lib/hiring.ts ; la note
 * n'est relue que par son auteur ; l'explication d'absence part aux admins,
 * jamais au recruteur. L'issue n'est jamais écrite chez Google : l'événement
 * du tour reste tel quel dans l'agenda d'OffRec.
 *
 * Aucun statut de dossier n'est ajouté : `MatchSuggestion.status` reste
 * `mise_en_relation`, la phase est dérivée (`hiringPhase`).
 *
 * Client Prisma antérieur au sous-lot 1 : 503 `HIRING_UNAVAILABLE_ERROR`.
 */

const hiringUnavailable = () => fail(503, HIRING_UNAVAILABLE_ERROR)

class OutcomeConflictError extends Error {}

/* ------------------------------------------------------------------ */
/* Recruteur : issue d'un tour                                         */
/* ------------------------------------------------------------------ */

export interface RecordOutcomeInput {
  suggestionId: string
  recruiterId: string
  interviewId: string
  result: InterviewResult
  reason: InterviewResultReason | null
  /** Note privée (relue par son seul auteur), déjà filtrée (sans coordonnées). */
  note: string | null
  /** Date du tour suivant, seulement avec `second_entretien`. */
  nextRound?: { scheduledAt: Date; durationMinutes: InterviewDuration; message: string | null }
}

export interface RecordOutcomeBody {
  interview: RecruiterInterviewView
  nextInterview: RecruiterInterviewView | null
  phase: HiringPhase | null
}

/**
 * Le recruteur propriétaire renseigne l'issue du tour actif, une fois son
 * heure de fin passée (`checkHiringAction('record_outcome')` : ni annulé, ni
 * en empêchement, 3 tours au plus pour un second entretien, accord du
 * candidat et offre non pourvue pour « retenu » et « second entretien »).
 * Le tour est fermé (`activeSuggestionId = null`) ; avec `nextRound`, le
 * tour suivant est créé dans la même transaction (un seul tour actif).
 */
export async function recordInterviewOutcome(input: RecordOutcomeInput): Promise<ServiceResult<RecordOutcomeBody>> {
  if (!HIRING_SUPPORTED) return hiringUnavailable()
  const store = interviewStore()
  if (!store) return hiringUnavailable()
  const dossier = await loadDossier(input.suggestionId)
  if (!dossier) return fail(404, 'Dossier introuvable.')
  if (dossier.opportunity.recruiterId !== input.recruiterId) return fail(403, NOT_OWNER_ERROR)
  const context = await loadHiringContext(store, dossier)
  if (!context) return hiringUnavailable()

  const now = new Date()
  const check = checkHiringAction({
    actor: 'recruiter',
    action: 'record_outcome',
    state: context.state,
    now,
    interviewId: input.interviewId,
    result: input.result,
    connection: dossierConnection(dossier),
  })
  if (!check.ok) return fail(check.httpStatus, check.error)
  const before = activeRow(context)
  if (!before) return fail(404, 'Aucun entretien en cours pour ce dossier.')
  const round = roundOf(before)
  const nextRound = input.result === 'second_entretien' ? input.nextRound : undefined

  let created: InterviewRow | null = null
  try {
    created = await prisma.$transaction(async (tx) => {
      await lockDossier(tx, dossier.id)
      const txStore = interviewStore(tx)
      if (!txStore) throw new Error('Modèle Interview indisponible dans la transaction.')
      // Le tour doit être resté actif, sans issue, au même horaire et au même
      // statut que ceux contrôlés (ni reprogrammé, ni annulé, ni en empêchement).
      const { count } = await txStore.updateMany({
        where: {
          id: before.id,
          activeSuggestionId: dossier.id,
          outcome: null,
          status: before.status,
          scheduledAt: before.scheduledAt,
        },
        data: {
          outcome: input.result,
          outcomeReason: input.reason,
          outcomeNote: input.note,
          outcomeAt: now,
          outcomeById: input.recruiterId,
          activeSuggestionId: null,
        },
      })
      if (count === 0) throw new OutcomeConflictError()
      if (!nextRound) return null
      return createRoundInTx(tx, {
        suggestionId: dossier.id,
        recruiterId: input.recruiterId,
        round: nextRoundNumber(context.state.rounds),
        scheduledAt: nextRound.scheduledAt,
        durationMinutes: nextRound.durationMinutes,
        message: nextRound.message,
        expectedRounds: context.rows.length,
      })
    })
  } catch (err) {
    if (err instanceof OutcomeConflictError) {
      const current = await store.findUnique({ where: { id: before.id } })
      return fail(409, current?.outcome ? OUTCOME_ALREADY_RECORDED_ERROR : INTERVIEW_CHANGED_ERROR)
    }
    if (err instanceof RoundsChangedError || isUniqueViolation(err)) return fail(409, ROUND_ALREADY_SCHEDULED_ERROR)
    if (isInterviewStorageError(err)) return hiringUnavailable()
    throw err
  }

  // Jamais la note dans le journal d'audit (D3) ; le motif y est en code.
  await prisma.auditLog.create({
    data: {
      userId: input.recruiterId,
      action: 'interview_outcome_recorded',
      metadata: {
        suggestionId: dossier.id,
        interviewId: before.id,
        round,
        result: input.result,
        reason: input.reason,
        nextRound: Boolean(created),
      },
    },
  })

  let next: { row: InterviewRow; failed: boolean } | null = null
  if (created) {
    next = await recordNewRound({ store, dossier, row: created, recruiterId: input.recruiterId, connected: false })
  }
  const updated = (await store.findUnique({ where: { id: before.id } })) ?? before
  const rows = context.rows.map((row) => (row.id === updated.id ? updated : row))
  if (next) rows.push(next.row)
  const phase = hiringPhase(withRounds(context.state, rows), new Date())

  // Notifications après la réponse : textes neutres au candidat (jamais le
  // motif, la note, le score ni le rang), admins in-app sans contact.
  const { companyName, title } = dossier.opportunity
  const offerLink = `/candidat/offres/${dossier.opportunityId}`
  switch (input.result) {
    case 'retenu':
      scheduleNotification('Notification « retenu » au candidat', () =>
        notifyCandidateNotice(dossier.candidateId, retenuNotice({ opportunityTitle: title }), offerLink),
      )
      break
    case 'second_entretien':
      // Sans date, le candidat n'est informé qu'au moment où le tour suivant est fixé.
      if (next) scheduleNextRoundNotifications(dossier, next.row, next.failed)
      break
    case 'non_retenu':
      scheduleNotification('Notification « non retenu » au candidat', () =>
        notifyCandidateNotice(dossier.candidateId, nonRetenuNotice({ opportunityTitle: title }), '/candidat'),
      )
      break
    case 'absent':
      scheduleNotification('Notification d’absence au candidat', () =>
        notifyCandidateNotice(
          dossier.candidateId,
          absentNotice({ opportunityTitle: title, scheduledAt: before.scheduledAt }),
          '/candidat/entretiens',
        ),
      )
      scheduleAdminNotification({
        event: 'interview_no_show',
        category: 'recruteur',
        title: 'Absence à un entretien',
        message:
          `${clip(companyName, 60)} indique que ${candidateName(dossier)} ne s’est pas présenté·e à l’entretien du ` +
          `${whenText(before)} (tour ${round}) pour « ${clip(title)} ». Le candidat peut expliquer son absence.`,
        link: '/admin/entretiens',
      })
      break
  }

  return {
    ok: true,
    httpStatus: 200,
    body: {
      interview: toRecruiterInterviewView(updated, input.recruiterId),
      nextInterview: next ? toRecruiterInterviewView(next.row, input.recruiterId) : null,
      phase,
    },
  }
}

/* ------------------------------------------------------------------ */
/* Candidat : expliquer une absence                                    */
/* ------------------------------------------------------------------ */

/**
 * Explication courte du candidat après une issue `absent` : une seule par
 * tour absent (écriture conditionnelle `absenceReply: null`), lue par les
 * admins seuls — jamais par le recruteur, jamais dans le journal d'audit ni
 * dans une notification.
 */
export async function replyToAbsence(input: {
  suggestionId: string
  candidateId: string
  interviewId: string
  reason: string
}): Promise<ServiceResult<{ interview: CandidateInterviewView }>> {
  if (!HIRING_SUPPORTED) return hiringUnavailable()
  const store = interviewStore()
  if (!store) return hiringUnavailable()
  const dossier = await loadDossier(input.suggestionId)
  // Même 404 pour « pas à vous », « inexistant » et « pas mis en relation ».
  if (!dossier || dossier.candidateId !== input.candidateId || dossier.status !== 'mise_en_relation') {
    return fail(404, NO_ABSENCE_ERROR)
  }
  const context = await loadHiringContext(store, dossier)
  if (!context) return hiringUnavailable()
  const check = checkHiringAction({
    actor: 'candidate',
    action: 'absence_reply',
    state: context.state,
    now: new Date(),
    interviewId: input.interviewId,
  })
  if (!check.ok) return fail(check.httpStatus, check.error)

  const { count } = await store.updateMany({
    where: { id: input.interviewId, suggestionId: dossier.id, outcome: 'absent', absenceReply: null },
    data: { absenceReply: input.reason, absenceReplyAt: new Date() },
  })
  if (count === 0) return fail(409, ABSENCE_ALREADY_REPLIED_ERROR)
  const row = await store.findUnique({ where: { id: input.interviewId } })
  if (!row) return fail(404, NO_ABSENCE_ERROR)

  await prisma.auditLog.create({
    data: {
      userId: input.candidateId,
      action: 'interview_absence_reply',
      metadata: { suggestionId: dossier.id, interviewId: row.id, round: roundOf(row) },
    },
  })
  const { companyName, title } = dossier.opportunity
  scheduleAdminNotification({
    event: 'interview_absence_reply',
    category: 'candidat',
    title: 'Explication d’absence déposée',
    message:
      `${candidateName(dossier)} a expliqué son absence à l’entretien du ${whenText(row)} (tour ${roundOf(row)}) ` +
      `avec ${clip(companyName, 60)} pour « ${clip(title)} ». L’explication est visible dans « Entretiens ».`,
    link: '/admin/entretiens',
  })

  return { ok: true, httpStatus: 200, body: { interview: toCandidateInterviewView(row) } }
}

/* ------------------------------------------------------------------ */
/* Admin : annuler une issue (erreur de saisie)                        */
/* ------------------------------------------------------------------ */

/**
 * Action rare : l'admin annule l'issue d'un tour (erreur de saisie) tant
 * que rien n'en découle — ni tour suivant, ni proposition, ni placement
 * (`checkHiringAction('reset_outcome')`). Le tour redevient actif, son issue,
 * son motif et sa note sont effacés ; l'explication d'absence éventuelle est
 * conservée. Le recruteur est prévenu qu'il doit la renseigner à nouveau ;
 * le candidat n'est pas notifié.
 */
export async function resetInterviewOutcome(input: {
  interviewId: string
  adminId: string
}): Promise<ServiceResult<{ interview: AdminInterviewView; phase: HiringPhase | null }>> {
  if (!HIRING_SUPPORTED) return hiringUnavailable()
  const store = interviewStore()
  if (!store) return hiringUnavailable()
  let target: InterviewRow | null
  try {
    target = await store.findUnique({ where: { id: input.interviewId } })
  } catch (err) {
    if (isInterviewStorageError(err)) return hiringUnavailable()
    throw err
  }
  if (!target) return fail(404, 'Entretien introuvable.')
  const dossier = await loadDossier(target.suggestionId)
  if (!dossier) return fail(404, 'Dossier introuvable.')
  const context = await loadHiringContext(store, dossier)
  if (!context) return hiringUnavailable()
  const check = checkHiringAction({
    actor: 'admin',
    action: 'reset_outcome',
    state: context.state,
    now: new Date(),
    interviewId: target.id,
  })
  if (!check.ok) return fail(check.httpStatus, check.error)
  const previous = target

  try {
    await prisma.$transaction(async (tx) => {
      await lockDossier(tx, dossier.id)
      const txStore = interviewStore(tx)
      if (!txStore) throw new Error('Modèle Interview indisponible dans la transaction.')
      // Rien ne doit découler de cette issue, relu sous verrou : aucun tour
      // plus récent (le tour suivant ferait aussi échouer l'unicité du tour
      // actif) et aucune proposition.
      const later = await txStore.count({ where: { suggestionId: dossier.id, round: { gt: roundOf(previous) } } })
      const proposalStore = hireProposalStore(tx)
      const proposals = proposalStore ? await proposalStore.count({ where: { suggestionId: dossier.id } }) : 0
      if (later > 0 || proposals > 0) throw new OutcomeConflictError()
      const { count } = await txStore.updateMany({
        where: { id: previous.id, outcome: previous.outcome, outcomeAt: previous.outcomeAt, activeSuggestionId: null },
        data: {
          outcome: null,
          outcomeReason: null,
          outcomeNote: null,
          outcomeAt: null,
          outcomeById: null,
          activeSuggestionId: dossier.id,
        },
      })
      if (count === 0) throw new OutcomeConflictError()
    })
  } catch (err) {
    if (err instanceof OutcomeConflictError || isUniqueViolation(err)) return fail(409, OUTCOME_RESET_BLOCKED_ERROR)
    if (isInterviewStorageError(err)) return hiringUnavailable()
    throw err
  }

  const row = (await store.findUnique({ where: { id: previous.id } })) ?? previous
  await prisma.auditLog.create({
    data: {
      userId: input.adminId,
      action: 'interview_outcome_reset',
      metadata: {
        suggestionId: dossier.id,
        interviewId: row.id,
        round: roundOf(row),
        previousResult: previous.outcome ?? null,
      },
    },
  })
  const rows = context.rows.map((r) => (r.id === row.id ? row : r))
  const phase = hiringPhase(withRounds(context.state, rows), new Date())

  scheduleNotification('Notification de l’annulation d’une issue au recruteur', () =>
    notifyRecruiter(
      dossier.opportunity.recruiterId,
      'Issue d’entretien à renseigner de nouveau',
      `OffRec a annulé l’issue enregistrée pour l’entretien du ${whenText(row)} (tour ${roundOf(row)}) avec ` +
        `${candidateName(dossier)} pour « ${dossier.opportunity.title} ». Renseignez-la de nouveau depuis « Entretiens ».`,
      '/recruteur/entretiens',
    ),
  )

  return { ok: true, httpStatus: 200, body: { interview: toAdminInterviewView(row), phase } }
}
