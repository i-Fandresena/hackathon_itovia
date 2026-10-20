import type { MatchSuggestion as DbMatchSuggestion, Prisma } from '@prisma/client'
import type {
  AdminInterview,
  Interview,
  InterviewDuration,
  InterviewMeetStatus,
  InterviewProvider,
  InterviewResultReason,
  InterviewStatus,
  MatchSuggestionStatus,
} from '../../../src/types/index.js'
import {
  formatMadagascarDateTime,
  interviewEnd,
} from '../../../src/lib/interview.js'
import {
  NO_ACTIVE_ROUND_ERROR,
  NO_INTERVIEW_ERROR,
  OPPORTUNITY_FILLED_ERROR,
  ROUND_ALREADY_SCHEDULED_ERROR,
  activeRoundOf,
  checkHiringAction,
  nextRoundNumber,
  secondRoundNotice,
  toRoundOutcomeView,
  type CandidateNotice,
  type RoundOutcomeSource,
  type RoundOutcomeView,
} from '../../../src/lib/hiring.js'
import { prisma } from './prisma.js'
import { clip, notifyUser, scheduleAdminNotification, scheduleNotification } from './notify.js'
import {
  STALE_SUGGESTION_ERROR,
  checkMatchTransition,
  commitMatchTransition,
  connectionCheck,
  notifyMiseEnRelation,
  type MiseEnRelationNotice,
} from './preselection-service.js'
import { RECRUITER_ALLOWED_TRANSITIONS } from './preselection.js'
import {
  HIRING_SUPPORTED,
  activeInterviewWhere,
  filledAtOf,
  interviewRoundData,
  roundOf,
  type InterviewRoundFields,
} from './hiring-store.js'
import { buildHiringContexts, type DossierRef, type HiringContext } from './hiring-state.js'
import {
  createCalendarEvent,
  deleteCalendarEvent,
  isGoogleCalendarConfigured,
  updateCalendarEvent,
  type CalendarEventInput,
} from './google-calendar.js'

/**
 * Entretiens fixés par le recruteur (décision produit 2026-10-14).
 *
 * « Ce profil m'intéresse » + une date = mise en relation immédiate : la
 * transition passe par les mêmes briques que celle de l'admin
 * (`checkMatchTransition` / `commitMatchTransition` / `notifyMiseEnRelation`,
 * lib/preselection-service.ts), avec la table `RECRUITER_ALLOWED_TRANSITIONS`.
 *
 * Tours (plan du 2026-10-16) : chaque ligne `Interview` est un tour
 * (`round`) ; un seul tour ACTIF par dossier (`activeSuggestionId` unique),
 * reprogrammé ou annulé en place. Toutes les actions ci-dessous visent le
 * tour actif. Juge unique des actions d'entretien (planifier un tour,
 * reprogrammer, annuler, confirmer, signaler un empêchement) :
 * `checkHiringAction()` de src/lib/hiring.ts, sur l'état relu en base
 * (`loadHiringContext`) ; chaque écriture est ensuite conditionnelle (le
 * `where` relit le tour actif contrôlé). Après une issue `second_entretien`
 * ou `absent`, `POST /:id/interview` crée le tour suivant (3 au plus, D5) ;
 * l'issue elle-même relève de lib/hiring-service.ts. Le candidat confirme ou
 * signale un empêchement ; il ne propose jamais de date.
 *
 * L'agenda Google est un effet secondaire : s'il échoue, la mise en relation
 * et l'entretien restent enregistrés (« lien Meet en attente ») et les
 * admins sont prévenus pour régulariser (`resyncInterviewCalendar`). Un
 * événement par tour ; l'issue n'est jamais écrite chez Google.
 *
 * Accès au modèle Prisma `Interview` : via `interviewStore()`, typé ici, pour
 * que le serveur démarre et compile encore avec un client Prisma généré
 * AVANT l'ajout du modèle — les routes répondent alors 503 avec la marche à
 * suivre, et les listes de dossiers s'affichent sans entretien.
 */

/* ------------------------------------------------------------------ */
/* Accès au modèle                                                     */
/* ------------------------------------------------------------------ */

/** Champs de tour et d'issue absents avec un client Prisma antérieur au
 *  sous-lot 1 (voir lib/hiring-store.ts). */
export interface InterviewRow extends InterviewRoundFields {
  id: string
  suggestionId: string
  scheduledAt: Date
  durationMinutes: number
  message: string | null
  status: InterviewStatus
  provider: InterviewProvider
  meetStatus: InterviewMeetStatus
  meetUrl: string | null
  googleEventId: string | null
  calendarError: string | null
  declineReason: string | null
  respondedAt: Date | null
  cancelledAt: Date | null
  rescheduleCount: number
  createdById: string
  createdAt: Date
  updatedAt: Date
  outcomeReason?: InterviewResultReason | null
  /** Note privée du recruteur auteur : jamais renvoyée qu'à lui (D3). */
  outcomeNote?: string | null
  outcomeAt?: Date | null
  outcomeById?: string | null
  outcomeReminderAt?: Date | null
  /** Explication d'absence du candidat : admins et candidat seulement. */
  absenceReply?: string | null
  absenceReplyAt?: Date | null
}

export type InterviewData = Partial<Omit<InterviewRow, 'id' | 'createdAt' | 'updatedAt' | 'rescheduleCount'>> & {
  rescheduleCount?: number | { increment: number }
}

type InterviewCreateData = Pick<
  InterviewRow,
  'suggestionId' | 'scheduledAt' | 'durationMinutes' | 'message' | 'provider' | 'meetStatus' | 'createdById'
>

type Where = Record<string, unknown>

export interface InterviewDelegate {
  findUnique(args: { where: { id: string } }): Promise<InterviewRow | null>
  findFirst(args: { where: Where; orderBy?: Where[] }): Promise<InterviewRow | null>
  findMany(args: { where?: Where; orderBy?: Where[]; skip?: number; take?: number }): Promise<InterviewRow[]>
  count(args: { where?: Where }): Promise<number>
  create(args: { data: InterviewCreateData }): Promise<InterviewRow>
  updateMany(args: { where: Where; data: InterviewData }): Promise<{ count: number }>
  update(args: { where: { id: string }; data: InterviewData }): Promise<InterviewRow>
}

export const INTERVIEWS_UNAVAILABLE_ERROR =
  'Les entretiens ne sont pas encore activés sur ce serveur : arrêtez le backend, lancez « npm run prisma:generate » puis « npm run prisma:deploy » dans server/, puis redémarrez-le.'

/** `null` si le client Prisma a été généré avant l'ajout du modèle `Interview`. */
export function interviewStore(client: unknown = prisma): InterviewDelegate | null {
  const delegate = (client as { interview?: InterviewDelegate } | null)?.interview
  return delegate && typeof delegate.findUnique === 'function' ? delegate : null
}

/** Table absente (migration non appliquée) ou colonne inconnue. */
export function isInterviewStorageError(err: unknown): boolean {
  const code = err && typeof err === 'object' ? (err as { code?: unknown }).code : undefined
  return code === 'P2021' || code === 'P2022'
}

let warnedUnavailable = false
function warnUnavailable(reason: string): void {
  if (warnedUnavailable) return
  warnedUnavailable = true
  console.warn(`[interviews] Entretiens indisponibles (${reason}) : ${INTERVIEWS_UNAVAILABLE_ERROR}`)
}

/**
 * Tours (tous, triés) et état « après l'entretien » de chacun des dossiers
 * donnés, en quelques requêtes pour tout le lot. Ne lève pas si le modèle
 * n'est pas encore disponible : les dossiers s'affichent alors sans tour.
 */
export async function loadHiringContexts(dossiers: readonly DossierRef[]): Promise<Map<string, HiringContext>> {
  const store = interviewStore()
  let rows: InterviewRow[] = []
  if (!store) {
    if (dossiers.length > 0) warnUnavailable('client Prisma non régénéré')
  } else if (dossiers.length > 0) {
    try {
      rows = await store.findMany({ where: { suggestionId: { in: dossiers.map((dossier) => dossier.id) } } })
    } catch (err) {
      if (!isInterviewStorageError(err)) throw err
      warnUnavailable('migration non appliquée')
    }
  }
  return buildHiringContexts(dossiers, rows)
}

/** Tours et état d'un dossier ; `undefined` si le stockage manque (→ 503). */
export async function loadHiringContext(store: InterviewDelegate, dossier: DossierRef): Promise<HiringContext | undefined> {
  try {
    const rows = await store.findMany({ where: { suggestionId: dossier.id } })
    return (await buildHiringContexts([dossier], rows)).get(dossier.id)
  } catch (err) {
    if (isInterviewStorageError(err)) {
      warnUnavailable('migration non appliquée')
      return undefined
    }
    throw err
  }
}

/** Ligne du tour actif d'un dossier (règle `activeRoundOf`), ou `undefined`. */
export function activeRow(context: HiringContext): InterviewRow | undefined {
  const active = activeRoundOf(context.state.rounds)
  return active ? context.rows.find((row) => row.id === active.id) : undefined
}

/* ------------------------------------------------------------------ */
/* Vues                                                                */
/* ------------------------------------------------------------------ */

/** Vue commune : liste blanche, jamais l'événement Google, l'auteur ni l'issue. */
export function toInterviewView(row: InterviewRow): Interview {
  return {
    id: row.id,
    suggestionId: row.suggestionId,
    // Jamais l'issue, son motif ni la note : vue partagée avec le candidat.
    round: roundOf(row),
    scheduledAt: row.scheduledAt.toISOString(),
    durationMinutes: row.durationMinutes,
    message: row.message,
    status: row.status,
    provider: row.provider,
    meetStatus: row.meetStatus,
    meetUrl: row.status === 'annule' ? null : row.meetUrl,
    declineReason: row.declineReason,
    respondedAt: row.respondedAt?.toISOString() ?? null,
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
    rescheduleCount: row.rescheduleCount,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

function outcomeSource(row: InterviewRow): RoundOutcomeSource {
  return {
    outcome: row.outcome ?? null,
    outcomeReason: row.outcomeReason ?? null,
    outcomeNote: row.outcomeNote ?? null,
    outcomeAt: row.outcomeAt ?? null,
    outcomeById: row.outcomeById ?? null,
    absenceReply: row.absenceReply ?? null,
    absenceReplyAt: row.absenceReplyAt ?? null,
  }
}

/** Tour vu par le recruteur PROPRIÉTAIRE de l'offre : + issue et motif ; la
 *  note privée seulement s'il en est l'auteur ; jamais l'explication d'absence. */
export type RecruiterInterviewView = Interview & RoundOutcomeView

export function toRecruiterInterviewView(row: InterviewRow, recruiterId: string): RecruiterInterviewView {
  const base = toInterviewView(row)
  if (!HIRING_SUPPORTED) return base
  return { ...base, ...toRoundOutcomeView(outcomeSource(row), { audience: 'recruiter', userId: recruiterId }) }
}

/** Tour vu par le candidat : jamais l'issue, le motif ni la note ; son
 *  explication d'absence et la possibilité d'en déposer une. */
export type CandidateInterviewView = Interview & RoundOutcomeView

export function toCandidateInterviewView(row: InterviewRow): CandidateInterviewView {
  const base = toInterviewView(row)
  if (!HIRING_SUPPORTED) return base
  return { ...base, ...toRoundOutcomeView(outcomeSource(row), { audience: 'candidate', userId: '' }) }
}

/** Tour vu par l'admin : + agenda, issue, motif et explication d'absence ;
 *  jamais la note privée du recruteur (D3). */
export type AdminInterviewView = AdminInterview & RoundOutcomeView

export function toAdminInterviewView(row: InterviewRow): AdminInterviewView {
  const base: AdminInterview = {
    ...toInterviewView(row),
    calendarError: row.calendarError,
    hasGoogleEvent: Boolean(row.googleEventId),
  }
  if (!HIRING_SUPPORTED) return base
  // `userId` vide : l'admin n'est jamais l'auteur d'une note.
  return { ...base, ...toRoundOutcomeView(outcomeSource(row), { audience: 'admin', userId: '' }) }
}

/** Colonnes du dossier renvoyées au recruteur : rien du compte ni du profil candidat. */
function suggestionView(row: DbMatchSuggestion) {
  return {
    id: row.id,
    opportunityId: row.opportunityId,
    candidateId: row.candidateId,
    score: row.score,
    reasons: row.reasons,
    status: row.status,
    // Pas d'`origin` : renvoyé au recruteur, qui ne reçoit jamais l'origine
    // de la suggestion (même liste blanche que `GET /received`).
    preselectionRank: row.preselectionRank,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

/* ------------------------------------------------------------------ */
/* Dossier et contexte                                                 */
/* ------------------------------------------------------------------ */

/** Dossier avec l'offre et le compte candidat ; `client` : celui d'une transaction pour relire sous verrou. */
export async function loadDossier(suggestionId: string, client: Prisma.TransactionClient | typeof prisma = prisma) {
  return client.matchSuggestion.findUnique({
    where: { id: suggestionId },
    include: {
      opportunity: { select: { id: true, title: true, companyName: true, recruiterId: true } },
      candidate: {
        select: { status: true, candidateProfile: { select: { fullName: true, matchingConsentAt: true } } },
      },
    },
  })
}

export type Dossier = NonNullable<Awaited<ReturnType<typeof loadDossier>>>

/** Compte suspendu ou banni (même définition que `isAccountBlocked`). */
export const isBlocked = (status: string) => status === 'suspended' || status === 'banned'

/** Accord de matching en vigueur et compte candidat actif (`connectionCheck`). */
export function dossierConnection(dossier: Dossier) {
  return connectionCheck(Boolean(dossier.candidate.candidateProfile?.matchingConsentAt), isBlocked(dossier.candidate.status))
}

export function candidateName(dossier: Dossier): string {
  return clip(dossier.candidate.candidateProfile?.fullName, 60) || 'le candidat'
}

/** Résultat d'un service : corps à renvoyer, ou erreur HTTP en français.
 *  (Ancien nom : `InterviewOutcome<T>`, renommé pour ne pas le confondre
 *  avec l'issue d'un entretien, enum Prisma `InterviewResult`.) */
export type ServiceResult<T> = { ok: true; httpStatus: 200 | 201; body: T } | { ok: false; httpStatus: number; error: string }

export const fail = (httpStatus: number, error: string): { ok: false; httpStatus: number; error: string } => ({
  ok: false,
  httpStatus,
  error,
})

export const unavailable = () => fail(503, INTERVIEWS_UNAVAILABLE_ERROR)

/** Verrouille la ligne du dossier jusqu'à la fin de la transaction : les
 *  écritures concurrentes sur ses tours (double clic, deux onglets) passent
 *  l'une après l'autre, et la seconde relit l'effet de la première. */
export async function lockDossier(tx: Prisma.TransactionClient, suggestionId: string): Promise<void> {
  await tx.$queryRaw`SELECT "id" FROM "MatchSuggestion" WHERE "id" = ${suggestionId} FOR UPDATE`
}

export const isUniqueViolation = (err: unknown) =>
  Boolean(err && typeof err === 'object' && (err as { code?: unknown }).code === 'P2002')

/* ------------------------------------------------------------------ */
/* Agenda Google                                                       */
/* ------------------------------------------------------------------ */

export interface CalendarContext {
  suggestionId: string
  title: string
  companyName: string
  candidateName: string
}

export function calendarContext(dossier: Dossier): CalendarContext {
  return {
    suggestionId: dossier.id,
    title: dossier.opportunity.title,
    companyName: dossier.opportunity.companyName,
    candidateName: candidateName(dossier),
  }
}

/**
 * Titre et description de l'événement : jamais d'email ni de téléphone,
 * jamais l'issue. Un événement par tour : à partir du tour 2, le titre porte
 * « (tour n) » et la référence privée `{dossier}#r{n}` ; le tour 1 garde la
 * forme d'avant les tours (événements existants inchangés).
 */
function calendarEvent(row: InterviewRow, ctx: CalendarContext): CalendarEventInput {
  const round = roundOf(row)
  return {
    summary: `Entretien OffRec — ${clip(ctx.title, 80)}${round > 1 ? ` (tour ${round})` : ''}`,
    description: [
      `Entretien organisé par OffRec pour l’offre « ${clip(ctx.title, 120)} » (${clip(ctx.companyName, 80)}).`,
      `Candidat : ${ctx.candidateName}.`,
      ...(round > 1 ? [`Tour d’entretien : ${round}.`] : []),
      `Durée : ${row.durationMinutes} minutes.`,
      'OffRec transmet lui-même le lien au candidat et au recruteur : aucun invité n’est ajouté à cet événement.',
      `Référence du dossier : ${ctx.suggestionId}`,
    ].join('\n'),
    start: row.scheduledAt,
    end: interviewEnd(row.scheduledAt, row.durationMinutes),
    reference: round > 1 ? `${ctx.suggestionId}#r${round}` : ctx.suggestionId,
  }
}

/**
 * Aligne l'agenda Google sur la ligne en base (création, mise à jour ou
 * suppression selon l'état) et enregistre le résultat. Ne lève jamais pour
 * une erreur Google : `calendarError` est renseigné et `failed` vaut `true`.
 */
export async function syncCalendar(
  store: InterviewDelegate,
  row: InterviewRow,
  ctx: CalendarContext,
): Promise<{ row: InterviewRow; failed: boolean }> {
  let data: InterviewData
  let failed = false

  if (!isGoogleCalendarConfigured()) {
    // Mode simulé : aucun événement, aucun lien — jamais de faux lien Meet.
    data = { provider: 'simule', meetStatus: 'simule', meetUrl: null, calendarError: null }
  } else if (row.status === 'annule') {
    if (!row.googleEventId) {
      data = { calendarError: null }
    } else {
      const deleted = await deleteCalendarEvent(row.googleEventId)
      if (deleted.ok) {
        data = { googleEventId: null, meetUrl: null, calendarError: null }
      } else {
        failed = true
        data = { calendarError: deleted.error }
      }
    }
  } else {
    const event = calendarEvent(row, ctx)
    let result = row.googleEventId ? await updateCalendarEvent(row.googleEventId, event, !row.meetUrl) : null
    // Événement supprimé à la main dans l'agenda : on en recrée un.
    if (!result || (!result.ok && (result.status === 404 || result.status === 410))) {
      result = await createCalendarEvent(event)
    }
    if (result.ok) {
      const meetUrl = result.value.meetUrl ?? row.meetUrl
      failed = !meetUrl
      data = {
        provider: 'google',
        googleEventId: result.value.eventId,
        meetUrl,
        meetStatus: meetUrl ? 'disponible' : 'en_attente',
        calendarError: meetUrl ? null : 'Google n’a pas fourni de lien Meet pour cet événement.',
      }
    } else {
      failed = true
      // Un lien déjà obtenu reste valable même si l'horaire n'a pas pu être mis à jour.
      data = {
        provider: 'google',
        meetStatus: row.meetUrl ? 'disponible' : 'en_attente',
        calendarError: result.error,
      }
    }
  }

  try {
    const updated = await store.update({ where: { id: row.id }, data })
    return { row: updated, failed }
  } catch (err) {
    console.error('[interviews] Enregistrement de la synchronisation impossible', err)
    return { row, failed: true }
  }
}

/** Admins prévenus qu'un lien ou un horaire est à régulariser dans l'agenda. */
export function scheduleCalendarAlert(row: InterviewRow, ctx: CalendarContext, actorId: string | null): void {
  scheduleAdminNotification({
    event: 'interview_calendar_failed',
    category: 'systeme',
    title: 'Agenda Google à régulariser',
    message:
      `L’agenda Google n’a pas pu être mis à jour pour l’entretien « ${clip(ctx.title)} » (${clip(ctx.companyName, 60)}). ` +
      (row.status === 'annule'
        ? 'L’annulation est enregistrée : supprimez l’événement ou relancez la synchronisation.'
        : 'La mise en relation et l’entretien sont enregistrés : relancez la synchronisation depuis « Mise en relation ».'),
    link: '/admin/mise-en-relation',
    excludeUserId: actorId,
  })
}

/* ------------------------------------------------------------------ */
/* Textes des notifications                                            */
/* ------------------------------------------------------------------ */

export function whenText(row: Pick<InterviewRow, 'scheduledAt' | 'durationMinutes'>): string {
  return `${formatMadagascarDateTime(row.scheduledAt)} (heure de Madagascar)`
}

export function linkSentence(row: InterviewRow): string {
  if (row.meetStatus === 'disponible' && row.meetUrl) return `Lien de l’entretien (Google Meet) : ${row.meetUrl}`
  if (row.meetStatus === 'en_attente') {
    return 'Le lien de visioconférence n’a pas encore pu être créé : OffRec vous le communique dès que possible.'
  }
  return 'Lien de visioconférence non disponible (agenda Google non configuré, mode simulé) : OffRec vous communiquera les modalités.'
}

function scheduledNotice(row: InterviewRow, dossier: Dossier): MiseEnRelationNotice {
  const { companyName, title } = dossier.opportunity
  return {
    candidate: {
      event: 'interview_scheduled',
      title: 'Entretien proposé : mise en relation confirmée',
      message:
        `${companyName} a retenu votre profil pour « ${title} » et vous propose un entretien le ${whenText(row)}, ` +
        `durée ${row.durationMinutes} minutes. Confirmez votre présence ou signalez un empêchement.`,
      email: {
        subject: `Entretien proposé pour « ${clip(title, 60)} » — OffRec`,
        body: [
          `Bonne nouvelle : ${companyName} a retenu votre profil pour l’offre « ${title} ». OffRec vous met en relation et vous propose un entretien en visioconférence.`,
          `Date : ${whenText(row)}. Durée : ${row.durationMinutes} minutes.`,
          linkSentence(row),
          ...(row.message ? [`Message du recruteur : « ${row.message} »`] : []),
          'Merci de confirmer votre présence, ou de signaler un empêchement, depuis votre espace OffRec.',
        ],
        actionLabel: 'Confirmer ou signaler un empêchement',
      },
    },
    recruiter: {
      title: 'Entretien fixé : mise en relation confirmée',
      message:
        `Entretien fixé avec ${candidateName(dossier)} le ${whenText(row)} pour « ${title} ». ` +
        'Le candidat est notifié et peut confirmer ou signaler un empêchement.',
    },
  }
}

export async function notifyRecruiter(recruiterId: string, title: string, message: string, link = '/recruteur/candidatures'): Promise<void> {
  try {
    await prisma.notification.create({
      data: { userId: recruiterId, title, message, link },
    })
  } catch (err) {
    console.error('[interviews] Notification du recruteur impossible', err)
  }
}

/**
 * Texte neutre de src/lib/hiring.ts envoyé au candidat « par OffRec » :
 * in-app toujours, email quand le texte en prévoit un (`notifyUser` lit
 * l'adresse en base). `extraEmailBody` : paragraphes ajoutés à l'email
 * seulement (message du recruteur). Ne lève jamais.
 */
export async function notifyCandidateNotice(
  candidateId: string,
  notice: CandidateNotice,
  link: string,
  extraEmailBody: string[] = [],
): Promise<void> {
  await notifyUser({
    userId: candidateId,
    event: notice.event,
    title: notice.title,
    message: notice.message,
    link,
    email: notice.email
      ? { subject: notice.email.subject, body: [...notice.email.body, ...extraEmailBody], actionLabel: notice.email.actionLabel }
      : undefined,
  })
}

/* ------------------------------------------------------------------ */
/* Recruteur : fixer un entretien (= mise en relation) ou le tour suivant */
/* ------------------------------------------------------------------ */

export interface ScheduleInput {
  suggestionId: string
  recruiterId: string
  scheduledAt: Date
  durationMinutes: InterviewDuration
  message: string | null
}

class StaleDossierError extends Error {}
/** L'offre a été pourvue entre le contrôle et l'écriture (D1). */
class OpportunityFilledError extends Error {}
/** Les tours du dossier ont changé entre la lecture et l'écriture. */
export class RoundsChangedError extends Error {}

const ALREADY_SCHEDULED_ERROR = ROUND_ALREADY_SCHEDULED_ERROR
/** Ancien client Prisma seulement (aucun tour suivant possible). */
const ROUND_CLOSED_ERROR =
  'L’entretien de ce dossier a déjà une issue : un nouveau tour ne peut pas encore être planifié.'
const NO_ACTIVE_INTERVIEW_ERROR = NO_ACTIVE_ROUND_ERROR
export const NOT_OWNER_ERROR = 'Ce dossier ne concerne pas l’une de vos offres.'
export const INTERVIEW_CHANGED_ERROR = 'Cet entretien a changé entre-temps. Rechargez la page.'

export interface NewRoundInput {
  suggestionId: string
  recruiterId: string
  round: number
  scheduledAt: Date
  durationMinutes: InterviewDuration
  message: string | null
  /** Nombre de tours lus avant la transaction : rien ne doit avoir changé. */
  expectedRounds: number
}

/**
 * Dans une transaction où le dossier est verrouillé (`lockDossier`) : crée
 * le tour `round`, ACTIF, si le dossier a toujours `expectedRounds` tours et
 * aucun tour actif ; sinon `RoundsChangedError`. L'unicité
 * (`activeSuggestionId`, `(suggestionId, round)`) reste le dernier rempart
 * (P2002).
 */
export async function createRoundInTx(tx: Prisma.TransactionClient, input: NewRoundInput): Promise<InterviewRow> {
  const txStore = interviewStore(tx)
  if (!txStore) throw new Error('Modèle Interview indisponible dans la transaction.')
  const count = await txStore.count({ where: { suggestionId: input.suggestionId } })
  const active = count > 0 ? await txStore.findFirst({ where: activeInterviewWhere(input.suggestionId) }) : null
  if (count !== input.expectedRounds || active) throw new RoundsChangedError()
  const configured = isGoogleCalendarConfigured()
  return txStore.create({
    data: {
      ...interviewRoundData(input.suggestionId, input.round),
      suggestionId: input.suggestionId,
      scheduledAt: input.scheduledAt,
      durationMinutes: input.durationMinutes,
      message: input.message,
      provider: configured ? 'google' : 'simule',
      meetStatus: configured ? 'en_attente' : 'simule',
      createdById: input.recruiterId,
    },
  })
}

/** Après la création d'un tour : journal d'audit, puis agenda Google. */
export async function recordNewRound(input: {
  store: InterviewDelegate
  dossier: Dossier
  row: InterviewRow
  recruiterId: string
  connected: boolean
}): Promise<{ row: InterviewRow; failed: boolean }> {
  const { row } = input
  await prisma.auditLog.create({
    data: {
      userId: input.recruiterId,
      action: 'interview_created',
      metadata: {
        suggestionId: input.dossier.id,
        interviewId: row.id,
        scheduledAt: row.scheduledAt.toISOString(),
        durationMinutes: row.durationMinutes,
        provider: row.provider,
        round: roundOf(row),
        connected: input.connected,
      },
    },
  })
  return syncCalendar(input.store, row, calendarContext(input.dossier))
}

/**
 * Tour suivant fixé (second entretien, ou nouvelle chance après une
 * absence) : le candidat reçoit le texte neutre « Second entretien proposé »
 * (plateforme + email, avec le lien ou la mention « à venir »), les admins
 * sont informés. Après la réponse HTTP ; ne lève jamais.
 */
export function scheduleNextRoundNotifications(dossier: Dossier, row: InterviewRow, calendarFailed: boolean): void {
  const { companyName, title } = dossier.opportunity
  const round = roundOf(row)
  const notice = secondRoundNotice({
    companyName,
    opportunityTitle: title,
    scheduledAt: row.scheduledAt,
    durationMinutes: row.durationMinutes,
    round,
    linkSentence: linkSentence(row),
  })
  scheduleNotification('Notification du tour suivant au candidat', () =>
    notifyCandidateNotice(
      dossier.candidateId,
      notice,
      `/candidat/offres/${dossier.opportunityId}`,
      row.message ? [`Message du recruteur : « ${row.message} »`] : [],
    ),
  )
  scheduleAdminNotification({
    event: 'interview_next_round',
    category: 'recruteur',
    title: 'Nouveau tour d’entretien',
    message:
      `${clip(companyName, 60)} a fixé le tour ${round} de l’entretien avec ${candidateName(dossier)} ` +
      `pour « ${clip(title)} » le ${whenText(row)}.`,
    link: '/admin/entretiens',
  })
  if (calendarFailed) scheduleCalendarAlert(row, calendarContext(dossier), null)
}

/**
 * Le recruteur propriétaire de l'offre fixe un entretien :
 * - depuis `proposee_recruteur` ou `interet_recruteur`, le dossier passe en
 *   `mise_en_relation` dans la même transaction que la création du tour 1 ;
 * - sur un dossier déjà `mise_en_relation` sans entretien (confirmé par un
 *   admin), le tour 1 est seulement ajouté ;
 * - après une issue `second_entretien` ou `absent`, le tour suivant est créé
 *   (3 tours au plus, accord du candidat en vigueur, offre non pourvue —
 *   `checkHiringAction('schedule_round')`).
 */
export async function scheduleInterview(
  input: ScheduleInput,
): Promise<ServiceResult<{ suggestion: ReturnType<typeof suggestionView>; interview: Interview }>> {
  const store = interviewStore()
  if (!store) return unavailable()
  const dossier = await loadDossier(input.suggestionId)
  if (!dossier) return fail(404, 'Dossier introuvable.')
  if (dossier.opportunity.recruiterId !== input.recruiterId) return fail(403, NOT_OWNER_ERROR)

  const context = await loadHiringContext(store, dossier)
  if (!context) return unavailable()
  const rounds = context.state.rounds

  const from = dossier.status as MatchSuggestionStatus
  const needsTransition = (RECRUITER_ALLOWED_TRANSITIONS[from] ?? []).includes('mise_en_relation')
  if (!needsTransition && from !== 'mise_en_relation') {
    return fail(400, 'Ce dossier ne peut plus recevoir d’entretien.')
  }
  const hasConsent = Boolean(dossier.candidate.candidateProfile?.matchingConsentAt)
  const candidateBlocked = isBlocked(dossier.candidate.status)
  if ((needsTransition || !HIRING_SUPPORTED) && rounds.length > 0) {
    return fail(409, activeRoundOf(rounds) ? ALREADY_SCHEDULED_ERROR : ROUND_CLOSED_ERROR)
  }
  const check = needsTransition
    ? checkMatchTransition({ actor: 'recruiter', from, to: 'mise_en_relation', hasConsent, candidateBlocked })
    : checkHiringAction({
        actor: 'recruiter',
        action: 'schedule_round',
        state: context.state,
        now: new Date(),
        connection: connectionCheck(hasConsent, candidateBlocked),
      })
  if (!check.ok) return fail(check.httpStatus, check.error)
  const round = nextRoundNumber(rounds)

  let suggestion: DbMatchSuggestion
  let created: InterviewRow
  try {
    const result = await prisma.$transaction(async (tx) => {
      // Sérialise les créations concurrentes sur ce dossier (double clic,
      // deux onglets, issue « second entretien » avec date) : la seconde
      // attend la première, puis voit son tour (`RoundsChangedError`).
      await lockDossier(tx, dossier.id)
      // Offre pourvue entre-temps (D1) : relue sous le verrou du dossier,
      // que la clôture des autres dossiers prend aussi.
      if (HIRING_SUPPORTED) {
        const offer = await tx.opportunity.findUnique({ where: { id: dossier.opportunityId } })
        if (offer && filledAtOf(offer)) throw new OpportunityFilledError()
      }
      let current: DbMatchSuggestion = dossier
      if (needsTransition) {
        const moved = await commitMatchTransition(tx, { id: dossier.id, from, to: 'mise_en_relation' })
        if (!moved) throw new StaleDossierError()
        current = moved
      }
      const interview = await createRoundInTx(tx, {
        suggestionId: dossier.id,
        recruiterId: input.recruiterId,
        round,
        scheduledAt: input.scheduledAt,
        durationMinutes: input.durationMinutes,
        message: input.message,
        expectedRounds: rounds.length,
      })
      return { current, interview }
    })
    suggestion = result.current
    created = result.interview
  } catch (err) {
    if (err instanceof StaleDossierError) return fail(409, STALE_SUGGESTION_ERROR)
    if (err instanceof OpportunityFilledError) return fail(409, OPPORTUNITY_FILLED_ERROR)
    if (err instanceof RoundsChangedError || isUniqueViolation(err)) return fail(409, ALREADY_SCHEDULED_ERROR)
    if (isInterviewStorageError(err)) return unavailable()
    throw err
  }

  if (needsTransition) {
    await prisma.auditLog.create({
      data: {
        userId: input.recruiterId,
        action: 'match_suggestion_status',
        metadata: { suggestionId: dossier.id, from, to: 'mise_en_relation', source: 'recruiter_interview' },
      },
    })
  }
  const synced = await recordNewRound({ store, dossier, row: created, recruiterId: input.recruiterId, connected: needsTransition })
  const row = synced.row

  if (round > 1) {
    scheduleNextRoundNotifications(dossier, row, synced.failed)
  } else {
    const ctx = calendarContext(dossier)
    await notifyMiseEnRelation(dossier, dossier.opportunity, scheduledNotice(row, dossier))
    scheduleAdminNotification({
      event: 'interview_scheduled',
      category: 'recruteur',
      title: needsTransition ? 'Mise en relation par entretien' : 'Entretien fixé',
      message:
        `${clip(dossier.opportunity.companyName, 60)} a fixé un entretien avec ${candidateName(dossier)} ` +
        `pour « ${clip(dossier.opportunity.title)} » le ${whenText(row)}` +
        (needsTransition ? ' : la mise en relation est faite.' : '.'),
      link: '/admin/mise-en-relation',
    })
    if (synced.failed) scheduleCalendarAlert(row, ctx, null)
  }

  return { ok: true, httpStatus: 201, body: { suggestion: suggestionView(suggestion), interview: toInterviewView(row) } }
}

/* ------------------------------------------------------------------ */
/* Recruteur : reprogrammer, annuler                                   */
/* ------------------------------------------------------------------ */

/**
 * Tour actif d'un dossier du recruteur, après le contrôle de
 * `checkHiringAction` (reprogrammer : accord du candidat et compte actif ;
 * annuler : tour pas déjà annulé).
 */
async function loadRecruiterInterview(
  suggestionId: string,
  recruiterId: string,
  action: 'reschedule_round' | 'cancel_round',
) {
  const store = interviewStore()
  if (!store) return unavailable()
  const dossier = await loadDossier(suggestionId)
  if (!dossier) return fail(404, 'Dossier introuvable.')
  if (dossier.opportunity.recruiterId !== recruiterId) return fail(403, NOT_OWNER_ERROR)
  const context = await loadHiringContext(store, dossier)
  if (!context) return unavailable()
  if (dossier.status !== 'mise_en_relation') {
    return fail(404, context.rows.length > 0 ? NO_ACTIVE_INTERVIEW_ERROR : NO_INTERVIEW_ERROR)
  }
  const check = checkHiringAction({
    actor: 'recruiter',
    action,
    state: context.state,
    now: new Date(),
    connection: action === 'reschedule_round' ? dossierConnection(dossier) : undefined,
  })
  if (!check.ok) return fail(check.httpStatus, check.error)
  const interview = activeRow(context)
  if (!interview) return fail(404, NO_ACTIVE_INTERVIEW_ERROR)
  return { ok: true as const, store, dossier, interview }
}

export interface RescheduleInput {
  suggestionId: string
  recruiterId: string
  scheduledAt: Date
  durationMinutes: InterviewDuration
  /** `undefined` : message conservé ; `null` ou vide : effacé. */
  message?: string | null
}

/**
 * Nouvelle date (après un empêchement, une annulation, ou simplement pour
 * changer) : l'entretien repart à `planifie`, l'événement Google est mis à
 * jour (ou recréé) et le candidat est de nouveau notifié.
 */
export async function rescheduleInterview(input: RescheduleInput): Promise<ServiceResult<{ interview: Interview }>> {
  const loaded = await loadRecruiterInterview(input.suggestionId, input.recruiterId, 'reschedule_round')
  if (!loaded.ok) return loaded
  const { store, dossier, interview: before } = loaded

  // Écriture conditionnelle : le tour doit être resté actif et inchangé
  // (une issue posée entre-temps le ferme).
  const write: { where: Where; data: InterviewData } = {
    where: { id: before.id, updatedAt: before.updatedAt, ...activeInterviewWhere(dossier.id) },
    data: {
      scheduledAt: input.scheduledAt,
      durationMinutes: input.durationMinutes,
      ...(input.message !== undefined ? { message: input.message ? input.message : null } : {}),
      status: 'planifie',
      declineReason: null,
      respondedAt: null,
      cancelledAt: null,
      rescheduleCount: { increment: 1 },
    },
  }
  let count: number
  try {
    count = HIRING_SUPPORTED
      ? await prisma.$transaction(async (tx) => {
          // Offre pourvue entre-temps (D1, `checkHiringAction`) : relue sous
          // le verrou du dossier, que la clôture « offre pourvue » prend
          // aussi — même règle que `scheduleInterview`.
          await lockDossier(tx, dossier.id)
          const offer = await tx.opportunity.findUnique({ where: { id: dossier.opportunityId } })
          if (offer && filledAtOf(offer)) throw new OpportunityFilledError()
          return (await (interviewStore(tx) ?? store).updateMany(write)).count
        })
      : (await store.updateMany(write)).count
  } catch (err) {
    if (err instanceof OpportunityFilledError) return fail(409, OPPORTUNITY_FILLED_ERROR)
    throw err
  }
  if (count === 0) return fail(409, INTERVIEW_CHANGED_ERROR)
  const updated = await store.findUnique({ where: { id: before.id } })
  if (!updated) return fail(404, NO_INTERVIEW_ERROR)

  await prisma.auditLog.create({
    data: {
      userId: input.recruiterId,
      action: 'interview_rescheduled',
      metadata: {
        suggestionId: dossier.id,
        interviewId: before.id,
        previousStatus: before.status,
        from: before.scheduledAt.toISOString(),
        to: updated.scheduledAt.toISOString(),
        durationMinutes: updated.durationMinutes,
      },
    },
  })

  const ctx = calendarContext(dossier)
  const synced = await syncCalendar(store, updated, ctx)
  const row = synced.row
  const { companyName, title } = dossier.opportunity

  await notifyUser({
    userId: dossier.candidateId,
    event: 'interview_rescheduled',
    title: 'Entretien reprogrammé',
    message:
      `${companyName} vous propose une nouvelle date d’entretien pour « ${title} » : le ${whenText(row)}, ` +
      `durée ${row.durationMinutes} minutes. Confirmez votre présence ou signalez un empêchement.`,
    link: `/candidat/offres/${dossier.opportunityId}`,
    email: {
      subject: `Nouvelle date d’entretien pour « ${clip(title, 60)} » — OffRec`,
      body: [
        `${companyName} vous propose une nouvelle date pour l’entretien de l’offre « ${title} ».`,
        `Date : ${whenText(row)}. Durée : ${row.durationMinutes} minutes.`,
        linkSentence(row),
        ...(row.message ? [`Message du recruteur : « ${row.message} »`] : []),
        'Merci de confirmer votre présence, ou de signaler un empêchement, depuis votre espace OffRec.',
      ],
      actionLabel: 'Confirmer ou signaler un empêchement',
    },
  })
  scheduleAdminNotification({
    event: 'interview_rescheduled',
    category: 'recruteur',
    title: 'Entretien reprogrammé',
    message:
      `${clip(companyName, 60)} a reprogrammé l’entretien avec ${candidateName(dossier)} ` +
      `pour « ${clip(title)} » au ${whenText(row)}.`,
    link: '/admin/mise-en-relation',
  })
  if (synced.failed) scheduleCalendarAlert(row, ctx, null)

  return { ok: true, httpStatus: 200, body: { interview: toInterviewView(row) } }
}

/** Annulation par le recruteur : la mise en relation reste acquise. */
export async function cancelInterview(input: {
  suggestionId: string
  recruiterId: string
}): Promise<ServiceResult<{ interview: Interview }>> {
  const loaded = await loadRecruiterInterview(input.suggestionId, input.recruiterId, 'cancel_round')
  if (!loaded.ok) return loaded
  const { store, dossier, interview: before } = loaded

  const { count } = await store.updateMany({
    where: { id: before.id, status: before.status, ...activeInterviewWhere(dossier.id) },
    data: { status: 'annule', cancelledAt: new Date() },
  })
  if (count === 0) return fail(409, INTERVIEW_CHANGED_ERROR)
  const updated = await store.findUnique({ where: { id: before.id } })
  if (!updated) return fail(404, NO_INTERVIEW_ERROR)

  await prisma.auditLog.create({
    data: {
      userId: input.recruiterId,
      action: 'interview_cancelled',
      metadata: { suggestionId: dossier.id, interviewId: before.id, previousStatus: before.status },
    },
  })

  const ctx = calendarContext(dossier)
  const synced = await syncCalendar(store, updated, ctx)
  const row = synced.row
  const { companyName, title } = dossier.opportunity

  await notifyUser({
    userId: dossier.candidateId,
    event: 'interview_cancelled',
    title: 'Entretien annulé',
    message:
      `${companyName} a annulé l’entretien du ${whenText(before)} pour « ${title} ». ` +
      'Votre mise en relation reste active : OffRec revient vers vous pour la suite.',
    link: `/candidat/offres/${dossier.opportunityId}`,
    email: {
      subject: `Entretien annulé pour « ${clip(title, 60)} » — OffRec`,
      body: [
        `${companyName} a annulé l’entretien prévu le ${whenText(before)} pour l’offre « ${title} ».`,
        'Votre mise en relation reste active : OffRec revient vers vous pour la suite.',
      ],
      actionLabel: 'Voir le dossier',
    },
  })
  scheduleAdminNotification({
    event: 'interview_cancelled',
    category: 'recruteur',
    title: 'Entretien annulé',
    message:
      `${clip(companyName, 60)} a annulé l’entretien avec ${candidateName(dossier)} pour « ${clip(title)} ». ` +
      'La mise en relation reste active.',
    link: '/admin/mise-en-relation',
  })
  if (synced.failed) scheduleCalendarAlert(row, ctx, null)

  return { ok: true, httpStatus: 200, body: { interview: toInterviewView(row) } }
}

/* ------------------------------------------------------------------ */
/* Candidat : confirmer, signaler un empêchement                       */
/* ------------------------------------------------------------------ */

/**
 * Le candidat ne voit un entretien qu'à partir de `mise_en_relation` :
 * avant, ou pour le dossier d'un autre, la réponse est la même 404. Puis
 * `checkHiringAction` sur le tour actif.
 */
async function loadCandidateInterview(
  suggestionId: string,
  candidateId: string,
  action: 'confirm_round' | 'report_unavailable',
) {
  const store = interviewStore()
  if (!store) return unavailable()
  const dossier = await loadDossier(suggestionId)
  if (!dossier || dossier.candidateId !== candidateId || dossier.status !== 'mise_en_relation') {
    return fail(404, NO_INTERVIEW_ERROR)
  }
  const context = await loadHiringContext(store, dossier)
  if (!context) return unavailable()
  const check = checkHiringAction({ actor: 'candidate', action, state: context.state, now: new Date() })
  if (!check.ok) return fail(check.httpStatus, check.error)
  const interview = activeRow(context)
  if (!interview) return fail(404, NO_ACTIVE_INTERVIEW_ERROR)
  return { ok: true as const, store, dossier, interview }
}

export async function confirmInterview(input: {
  suggestionId: string
  candidateId: string
}): Promise<ServiceResult<{ interview: Interview }>> {
  const loaded = await loadCandidateInterview(input.suggestionId, input.candidateId, 'confirm_round')
  if (!loaded.ok) return loaded
  const { store, dossier, interview: before } = loaded
  // Déjà confirmé : réponse idempotente, rien n'est réécrit.
  if (before.status === 'confirme') return { ok: true, httpStatus: 200, body: { interview: toInterviewView(before) } }

  const { count } = await store.updateMany({
    where: { id: before.id, status: 'planifie', ...activeInterviewWhere(dossier.id) },
    data: { status: 'confirme', respondedAt: new Date() },
  })
  if (count === 0) return fail(409, INTERVIEW_CHANGED_ERROR)
  const row = (await store.findUnique({ where: { id: before.id } })) ?? before

  await prisma.auditLog.create({
    data: {
      userId: input.candidateId,
      action: 'interview_confirmed',
      metadata: { suggestionId: dossier.id, interviewId: before.id },
    },
  })
  await notifyRecruiter(
    dossier.opportunity.recruiterId,
    'Entretien confirmé',
    `${candidateName(dossier)} a confirmé l’entretien du ${whenText(row)} pour « ${dossier.opportunity.title} ».`,
  )

  return { ok: true, httpStatus: 200, body: { interview: toInterviewView(row) } }
}

export async function reportInterviewUnavailable(input: {
  suggestionId: string
  candidateId: string
  reason: string
}): Promise<ServiceResult<{ interview: Interview }>> {
  const loaded = await loadCandidateInterview(input.suggestionId, input.candidateId, 'report_unavailable')
  if (!loaded.ok) return loaded
  const { store, dossier, interview: before } = loaded

  const { count } = await store.updateMany({
    where: { id: before.id, status: { in: ['planifie', 'confirme'] }, ...activeInterviewWhere(dossier.id) },
    data: { status: 'empechement', declineReason: input.reason, respondedAt: new Date() },
  })
  if (count === 0) return fail(409, INTERVIEW_CHANGED_ERROR)
  const row = (await store.findUnique({ where: { id: before.id } })) ?? before

  // Le motif n'entre pas dans le journal d'audit : il reste sur l'entretien.
  await prisma.auditLog.create({
    data: {
      userId: input.candidateId,
      action: 'interview_unavailable',
      metadata: { suggestionId: dossier.id, interviewId: before.id, previousStatus: before.status },
    },
  })
  const { title, companyName } = dossier.opportunity
  await notifyRecruiter(
    dossier.opportunity.recruiterId,
    'Empêchement signalé',
    `${candidateName(dossier)} ne pourra pas assister à l’entretien du ${whenText(row)} pour « ${title} ». ` +
      `Motif : « ${clip(input.reason, 200)} ». Reprogrammez ou annulez depuis « Candidats proposés ».`,
  )
  scheduleAdminNotification({
    event: 'interview_unavailable',
    category: 'candidat',
    title: 'Empêchement à un entretien',
    message:
      `${candidateName(dossier)} a signalé un empêchement pour l’entretien avec ${clip(companyName, 60)} ` +
      `(« ${clip(title)} »). Le recruteur peut reprogrammer.`,
    link: '/admin/mise-en-relation',
  })

  return { ok: true, httpStatus: 200, body: { interview: toInterviewView(row) } }
}

/* ------------------------------------------------------------------ */
/* Admin : régulariser l'agenda                                        */
/* ------------------------------------------------------------------ */

/**
 * Relance la synchronisation de l'agenda Google d'un entretien (lien Meet
 * en attente, horaire non reporté, suppression échouée) ou crée l'événement
 * d'un entretien fixé en mode simulé avant la configuration de Google
 * (l'entretien passe alors en `provider: google`). Quand un lien devient
 * disponible ou change, le candidat (plateforme + email) et le recruteur
 * (plateforme) en sont informés ; rien n'est renvoyé si le lien est inchangé.
 *
 * Refus (409) : entretien terminé (rien à créer ni à reporter), entretien
 * annulé sans événement Google (rien à supprimer), agenda non configuré.
 * Un entretien annulé qui porte encore un événement est accepté : la
 * synchronisation supprime l'événement.
 */
export async function resyncInterviewCalendar(input: {
  interviewId: string
  adminId: string
}): Promise<ServiceResult<{ interview: AdminInterviewView }>> {
  const store = interviewStore()
  if (!store) return unavailable()
  let before: InterviewRow | null
  try {
    before = await store.findUnique({ where: { id: input.interviewId } })
  } catch (err) {
    if (isInterviewStorageError(err)) return unavailable()
    throw err
  }
  if (!before) return fail(404, 'Entretien introuvable.')
  const dossier = await loadDossier(before.suggestionId)
  if (!dossier) return fail(404, 'Dossier introuvable.')
  if (before.status === 'annule') {
    if (!before.googleEventId) {
      return fail(409, 'Cet entretien est annulé et n’a aucun événement dans l’agenda Google : rien à régulariser.')
    }
  } else if (interviewEnd(before.scheduledAt, before.durationMinutes).getTime() <= Date.now()) {
    return fail(409, 'Cet entretien est terminé : il n’y a plus de lien Meet à créer ni d’horaire à reporter.')
  }
  if (!isGoogleCalendarConfigured()) {
    return fail(409, 'Agenda Google non configuré (mode simulé) : renseignez les variables GOOGLE_* du serveur.')
  }

  const synced = await syncCalendar(store, before, calendarContext(dossier))
  const row = synced.row
  await prisma.auditLog.create({
    data: {
      userId: input.adminId,
      action: 'interview_calendar_resync',
      metadata: { suggestionId: dossier.id, interviewId: row.id, ok: !synced.failed, meetStatus: row.meetStatus },
    },
  })

  const linkNowAvailable =
    row.status !== 'annule' && row.meetStatus === 'disponible' && Boolean(row.meetUrl) && row.meetUrl !== before.meetUrl
  if (linkNowAvailable) {
    const { title, companyName } = dossier.opportunity
    await notifyUser({
      userId: dossier.candidateId,
      event: 'interview_link_ready',
      title: 'Lien de l’entretien disponible',
      message: `Le lien Google Meet de votre entretien du ${whenText(row)} avec ${companyName} pour « ${title} » est disponible.`,
      link: `/candidat/offres/${dossier.opportunityId}`,
      email: {
        subject: `Lien de votre entretien pour « ${clip(title, 60)} » — OffRec`,
        body: [
          `Le lien de votre entretien du ${whenText(row)} avec ${companyName} (offre « ${title} ») est disponible.`,
          linkSentence(row),
        ],
        actionLabel: 'Voir le dossier',
      },
    })
    await notifyRecruiter(
      dossier.opportunity.recruiterId,
      'Lien de l’entretien disponible',
      `Le lien Google Meet de l’entretien du ${whenText(row)} pour « ${title} » est disponible.`,
    )
  }

  if (synced.failed) return fail(502, row.calendarError ?? 'La synchronisation avec Google Calendar a échoué.')
  return { ok: true, httpStatus: 200, body: { interview: toAdminInterviewView(row) } }
}
