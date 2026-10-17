import type { MatchSuggestion as DbMatchSuggestion } from '@prisma/client'
import type {
  AdminInterview,
  Interview,
  InterviewDuration,
  InterviewMeetStatus,
  InterviewProvider,
  InterviewStatus,
  MatchSuggestionStatus,
} from '../../../src/types/index.js'
import {
  formatMadagascarDateTime,
  interviewEnd,
} from '../../../src/lib/interview.js'
import { prisma } from './prisma.js'
import { clip, notifyUser, scheduleAdminNotification } from './notify.js'
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
 * Un seul entretien par dossier (contrainte unique), reprogrammé ou annulé
 * en place. Le candidat confirme ou signale un empêchement ; il ne propose
 * jamais de date.
 *
 * L'agenda Google est un effet secondaire : s'il échoue, la mise en relation
 * et l'entretien restent enregistrés (« lien Meet en attente ») et les
 * admins sont prévenus pour régulariser (`resyncInterviewCalendar`).
 *
 * Accès au modèle Prisma `Interview` : via `interviewStore()`, typé ici, pour
 * que le serveur démarre et compile encore avec un client Prisma généré
 * AVANT l'ajout du modèle — les routes répondent alors 503 avec la marche à
 * suivre, et les listes de dossiers s'affichent sans entretien.
 */

/* ------------------------------------------------------------------ */
/* Accès au modèle                                                     */
/* ------------------------------------------------------------------ */

export interface InterviewRow {
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
}

type InterviewData = Partial<Omit<InterviewRow, 'id' | 'createdAt' | 'updatedAt' | 'rescheduleCount'>> & {
  rescheduleCount?: number | { increment: number }
}

type InterviewCreateData = Pick<
  InterviewRow,
  'suggestionId' | 'scheduledAt' | 'durationMinutes' | 'message' | 'provider' | 'meetStatus' | 'createdById'
>

type Where = Record<string, unknown>

interface InterviewDelegate {
  findUnique(args: { where: { id: string } | { suggestionId: string } }): Promise<InterviewRow | null>
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
 * Entretiens des dossiers donnés, par identifiant de dossier. Ne lève pas
 * si le modèle n'est pas encore disponible : la liste s'affiche sans.
 */
export async function loadInterviewsBySuggestion(suggestionIds: string[]): Promise<Map<string, InterviewRow>> {
  const result = new Map<string, InterviewRow>()
  if (suggestionIds.length === 0) return result
  const store = interviewStore()
  if (!store) {
    warnUnavailable('client Prisma non régénéré')
    return result
  }
  try {
    const rows = await store.findMany({ where: { suggestionId: { in: suggestionIds } } })
    for (const row of rows) result.set(row.suggestionId, row)
  } catch (err) {
    if (!isInterviewStorageError(err)) throw err
    warnUnavailable('migration non appliquée')
  }
  return result
}

/* ------------------------------------------------------------------ */
/* Vues                                                                */
/* ------------------------------------------------------------------ */

/** Vue candidat / recruteur : liste blanche, jamais l'événement Google ni l'auteur. */
export function toInterviewView(row: InterviewRow): Interview {
  return {
    id: row.id,
    suggestionId: row.suggestionId,
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

export function toAdminInterviewView(row: InterviewRow): AdminInterview {
  return { ...toInterviewView(row), calendarError: row.calendarError, hasGoogleEvent: Boolean(row.googleEventId) }
}

/* ------------------------------------------------------------------ */
/* Dossier et contexte                                                 */
/* ------------------------------------------------------------------ */

async function loadDossier(suggestionId: string) {
  return prisma.matchSuggestion.findUnique({
    where: { id: suggestionId },
    include: {
      opportunity: { select: { id: true, title: true, companyName: true, recruiterId: true } },
      candidate: {
        select: { status: true, candidateProfile: { select: { fullName: true, matchingConsentAt: true } } },
      },
    },
  })
}

type Dossier = NonNullable<Awaited<ReturnType<typeof loadDossier>>>

const isBlocked = (status: string) => status === 'suspended' || status === 'banned'

function candidateName(dossier: Dossier): string {
  return clip(dossier.candidate.candidateProfile?.fullName, 60) || 'le candidat'
}

export type InterviewOutcome<T> = { ok: true; httpStatus: 200 | 201; body: T } | { ok: false; httpStatus: number; error: string }

const fail = (httpStatus: number, error: string): { ok: false; httpStatus: number; error: string } => ({
  ok: false,
  httpStatus,
  error,
})

export const unavailable = () => fail(503, INTERVIEWS_UNAVAILABLE_ERROR)

/** Lecture de l'entretien d'un dossier ; `undefined` si le stockage manque. */
async function findInterview(store: InterviewDelegate, suggestionId: string): Promise<InterviewRow | null | undefined> {
  try {
    return await store.findUnique({ where: { suggestionId } })
  } catch (err) {
    if (isInterviewStorageError(err)) {
      warnUnavailable('migration non appliquée')
      return undefined
    }
    throw err
  }
}

/* ------------------------------------------------------------------ */
/* Agenda Google                                                       */
/* ------------------------------------------------------------------ */

interface CalendarContext {
  suggestionId: string
  title: string
  companyName: string
  candidateName: string
}

function calendarContext(dossier: Dossier): CalendarContext {
  return {
    suggestionId: dossier.id,
    title: dossier.opportunity.title,
    companyName: dossier.opportunity.companyName,
    candidateName: candidateName(dossier),
  }
}

/** Titre et description de l'événement : jamais d'email ni de téléphone. */
function calendarEvent(row: InterviewRow, ctx: CalendarContext): CalendarEventInput {
  return {
    summary: `Entretien OffRec — ${clip(ctx.title, 80)}`,
    description: [
      `Entretien organisé par OffRec pour l’offre « ${clip(ctx.title, 120)} » (${clip(ctx.companyName, 80)}).`,
      `Candidat : ${ctx.candidateName}.`,
      `Durée : ${row.durationMinutes} minutes.`,
      'OffRec transmet lui-même le lien au candidat et au recruteur : aucun invité n’est ajouté à cet événement.',
      `Référence du dossier : ${ctx.suggestionId}`,
    ].join('\n'),
    start: row.scheduledAt,
    end: interviewEnd(row.scheduledAt, row.durationMinutes),
    reference: ctx.suggestionId,
  }
}

/**
 * Aligne l'agenda Google sur la ligne en base (création, mise à jour ou
 * suppression selon l'état) et enregistre le résultat. Ne lève jamais pour
 * une erreur Google : `calendarError` est renseigné et `failed` vaut `true`.
 */
async function syncCalendar(
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
function scheduleCalendarAlert(row: InterviewRow, ctx: CalendarContext, actorId: string | null): void {
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

function whenText(row: Pick<InterviewRow, 'scheduledAt' | 'durationMinutes'>): string {
  return `${formatMadagascarDateTime(row.scheduledAt)} (heure de Madagascar)`
}

function linkSentence(row: InterviewRow): string {
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

async function notifyRecruiter(recruiterId: string, title: string, message: string): Promise<void> {
  try {
    await prisma.notification.create({
      data: { userId: recruiterId, title, message, link: '/recruteur/candidatures' },
    })
  } catch (err) {
    console.error('[interviews] Notification du recruteur impossible', err)
  }
}

/* ------------------------------------------------------------------ */
/* Recruteur : fixer un entretien (= mise en relation)                 */
/* ------------------------------------------------------------------ */

export interface ScheduleInput {
  suggestionId: string
  recruiterId: string
  scheduledAt: Date
  durationMinutes: InterviewDuration
  message: string | null
}

class StaleDossierError extends Error {}

const ALREADY_SCHEDULED_ERROR =
  'Un entretien est déjà fixé pour ce dossier. Utilisez « Reprogrammer » pour changer la date.'
const NOT_OWNER_ERROR = 'Ce dossier ne concerne pas l’une de vos offres.'

const isUniqueViolation = (err: unknown) =>
  Boolean(err && typeof err === 'object' && (err as { code?: unknown }).code === 'P2002')

/**
 * Le recruteur propriétaire de l'offre fixe l'entretien : depuis
 * `proposee_recruteur` ou `interet_recruteur`, le dossier passe en
 * `mise_en_relation` dans la même transaction que la création de
 * l'entretien ; sur un dossier déjà `mise_en_relation` sans entretien
 * (confirmé par un admin), l'entretien est seulement ajouté.
 */
export async function scheduleInterview(
  input: ScheduleInput,
): Promise<InterviewOutcome<{ suggestion: ReturnType<typeof suggestionView>; interview: Interview }>> {
  const store = interviewStore()
  if (!store) return unavailable()
  const dossier = await loadDossier(input.suggestionId)
  if (!dossier) return fail(404, 'Dossier introuvable.')
  if (dossier.opportunity.recruiterId !== input.recruiterId) return fail(403, NOT_OWNER_ERROR)

  const existing = await findInterview(store, dossier.id)
  if (existing === undefined) return unavailable()
  if (existing) return fail(409, ALREADY_SCHEDULED_ERROR)

  const from = dossier.status as MatchSuggestionStatus
  const needsTransition = (RECRUITER_ALLOWED_TRANSITIONS[from] ?? []).includes('mise_en_relation')
  if (!needsTransition && from !== 'mise_en_relation') {
    return fail(400, 'Ce dossier ne peut plus recevoir d’entretien.')
  }
  const hasConsent = Boolean(dossier.candidate.candidateProfile?.matchingConsentAt)
  const candidateBlocked = isBlocked(dossier.candidate.status)
  const check = needsTransition
    ? checkMatchTransition({ actor: 'recruiter', from, to: 'mise_en_relation', hasConsent, candidateBlocked })
    : connectionCheck(hasConsent, candidateBlocked)
  if (!check.ok) return fail(check.httpStatus, check.error)

  const configured = isGoogleCalendarConfigured()
  let suggestion: DbMatchSuggestion
  let created: InterviewRow
  try {
    const result = await prisma.$transaction(async (tx) => {
      let current: DbMatchSuggestion = dossier
      if (needsTransition) {
        const moved = await commitMatchTransition(tx, { id: dossier.id, from, to: 'mise_en_relation' })
        if (!moved) throw new StaleDossierError()
        current = moved
      }
      const txStore = interviewStore(tx)
      if (!txStore) throw new Error('Modèle Interview indisponible dans la transaction.')
      const interview = await txStore.create({
        data: {
          suggestionId: dossier.id,
          scheduledAt: input.scheduledAt,
          durationMinutes: input.durationMinutes,
          message: input.message,
          provider: configured ? 'google' : 'simule',
          meetStatus: configured ? 'en_attente' : 'simule',
          createdById: input.recruiterId,
        },
      })
      return { current, interview }
    })
    suggestion = result.current
    created = result.interview
  } catch (err) {
    if (err instanceof StaleDossierError) return fail(409, STALE_SUGGESTION_ERROR)
    if (isUniqueViolation(err)) return fail(409, ALREADY_SCHEDULED_ERROR)
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
  await prisma.auditLog.create({
    data: {
      userId: input.recruiterId,
      action: 'interview_created',
      metadata: {
        suggestionId: dossier.id,
        interviewId: created.id,
        scheduledAt: created.scheduledAt.toISOString(),
        durationMinutes: created.durationMinutes,
        provider: created.provider,
        connected: needsTransition,
      },
    },
  })

  const ctx = calendarContext(dossier)
  const synced = await syncCalendar(store, created, ctx)
  const row = synced.row

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

  return { ok: true, httpStatus: 201, body: { suggestion: suggestionView(suggestion), interview: toInterviewView(row) } }
}

/* ------------------------------------------------------------------ */
/* Recruteur : reprogrammer, annuler                                   */
/* ------------------------------------------------------------------ */

async function loadRecruiterInterview(suggestionId: string, recruiterId: string) {
  const store = interviewStore()
  if (!store) return unavailable()
  const dossier = await loadDossier(suggestionId)
  if (!dossier) return fail(404, 'Dossier introuvable.')
  if (dossier.opportunity.recruiterId !== recruiterId) return fail(403, NOT_OWNER_ERROR)
  const interview = await findInterview(store, dossier.id)
  if (interview === undefined) return unavailable()
  if (!interview || dossier.status !== 'mise_en_relation') return fail(404, 'Aucun entretien pour ce dossier.')
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
export async function rescheduleInterview(input: RescheduleInput): Promise<InterviewOutcome<{ interview: Interview }>> {
  const loaded = await loadRecruiterInterview(input.suggestionId, input.recruiterId)
  if (!loaded.ok) return loaded
  const { store, dossier, interview: before } = loaded
  const check = connectionCheck(
    Boolean(dossier.candidate.candidateProfile?.matchingConsentAt),
    isBlocked(dossier.candidate.status),
  )
  if (!check.ok) return fail(check.httpStatus, check.error)

  const { count } = await store.updateMany({
    where: { id: before.id, updatedAt: before.updatedAt },
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
  })
  if (count === 0) return fail(409, 'Cet entretien a changé entre-temps. Rechargez la page.')
  const updated = await store.findUnique({ where: { id: before.id } })
  if (!updated) return fail(404, 'Aucun entretien pour ce dossier.')

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
}): Promise<InterviewOutcome<{ interview: Interview }>> {
  const loaded = await loadRecruiterInterview(input.suggestionId, input.recruiterId)
  if (!loaded.ok) return loaded
  const { store, dossier, interview: before } = loaded
  if (before.status === 'annule') return fail(409, 'Cet entretien est déjà annulé.')

  const { count } = await store.updateMany({
    where: { id: before.id, status: before.status },
    data: { status: 'annule', cancelledAt: new Date() },
  })
  if (count === 0) return fail(409, 'Cet entretien a changé entre-temps. Rechargez la page.')
  const updated = await store.findUnique({ where: { id: before.id } })
  if (!updated) return fail(404, 'Aucun entretien pour ce dossier.')

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
 * avant, ou pour le dossier d'un autre, la réponse est la même 404.
 */
async function loadCandidateInterview(suggestionId: string, candidateId: string) {
  const store = interviewStore()
  if (!store) return unavailable()
  const dossier = await loadDossier(suggestionId)
  if (!dossier || dossier.candidateId !== candidateId || dossier.status !== 'mise_en_relation') {
    return fail(404, 'Aucun entretien pour ce dossier.')
  }
  const interview = await findInterview(store, dossier.id)
  if (interview === undefined) return unavailable()
  if (!interview) return fail(404, 'Aucun entretien pour ce dossier.')
  return { ok: true as const, store, dossier, interview }
}

export async function confirmInterview(input: {
  suggestionId: string
  candidateId: string
}): Promise<InterviewOutcome<{ interview: Interview }>> {
  const loaded = await loadCandidateInterview(input.suggestionId, input.candidateId)
  if (!loaded.ok) return loaded
  const { store, dossier, interview: before } = loaded
  if (before.status === 'confirme') return { ok: true, httpStatus: 200, body: { interview: toInterviewView(before) } }
  if (before.status === 'annule') return fail(409, 'Cet entretien a été annulé par l’entreprise.')
  if (before.status === 'empechement') {
    return fail(409, 'Vous avez signalé un empêchement : l’entreprise va proposer une nouvelle date.')
  }
  if (before.scheduledAt.getTime() < Date.now()) return fail(409, 'Cet entretien est déjà passé.')

  const { count } = await store.updateMany({
    where: { id: before.id, status: 'planifie' },
    data: { status: 'confirme', respondedAt: new Date() },
  })
  if (count === 0) return fail(409, 'Cet entretien a changé entre-temps. Rechargez la page.')
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
}): Promise<InterviewOutcome<{ interview: Interview }>> {
  const loaded = await loadCandidateInterview(input.suggestionId, input.candidateId)
  if (!loaded.ok) return loaded
  const { store, dossier, interview: before } = loaded
  if (before.status === 'annule') return fail(409, 'Cet entretien a été annulé par l’entreprise.')
  if (before.status === 'empechement') return fail(409, 'Vous avez déjà signalé un empêchement pour cet entretien.')

  const { count } = await store.updateMany({
    where: { id: before.id, status: { in: ['planifie', 'confirme'] } },
    data: { status: 'empechement', declineReason: input.reason, respondedAt: new Date() },
  })
  if (count === 0) return fail(409, 'Cet entretien a changé entre-temps. Rechargez la page.')
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
}): Promise<InterviewOutcome<{ interview: AdminInterview }>> {
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
