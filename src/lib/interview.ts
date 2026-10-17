/**
 * Règles et affichage des entretiens fixés par le recruteur (décision
 * produit 2026-10-14). Module PARTAGÉ avec le serveur (`server/tsconfig.json`
 * l'inclut) : aucune API navigateur, React ou Vite ici.
 *
 * Madagascar vit en UTC+3 toute l'année (fuseau `Indian/Antananarivo`, pas
 * d'heure d'été) : comme le moteur de confiance, on décale de 3 h fixes au
 * lieu de dépendre d'`Intl` et du fuseau de la machine qui affiche.
 */

import type {
  InterviewDuration,
  InterviewMeetStatus,
  InterviewPeriod,
  InterviewProvider,
  InterviewStatus,
} from '../types/index.js'

export const MADAGASCAR_TIME_ZONE = 'Indian/Antananarivo'
const MADAGASCAR_OFFSET_MS = 3 * 60 * 60 * 1000

/** Durées proposées au recruteur, en minutes. */
export const INTERVIEW_DURATIONS: readonly InterviewDuration[] = [30, 45, 60]

/** Délai minimal entre la saisie et l'entretien. */
export const INTERVIEW_MIN_LEAD_HOURS = 2
/** Horizon maximal de planification. */
export const INTERVIEW_MAX_AHEAD_DAYS = 60

/** Longueurs maximales des textes libres. */
export const INTERVIEW_MESSAGE_MAX = 500
export const INTERVIEW_REASON_MAX = 300

export const INTERVIEW_STATUS_LABELS: Record<InterviewStatus, string> = {
  planifie: 'En attente de confirmation',
  confirme: 'Confirmé par le candidat',
  empechement: 'Empêchement signalé',
  annule: 'Annulé',
}

export const INTERVIEW_MEET_LABELS: Record<InterviewMeetStatus, string> = {
  disponible: 'Lien Google Meet disponible',
  en_attente: 'Lien Google Meet en attente',
  simule: 'Lien Meet simulé (agenda Google non configuré)',
}

const WEEKDAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi']
const MONTHS = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
]

const pad = (value: number) => String(value).padStart(2, '0')

/** Date « murale » de Madagascar, lue via les accesseurs UTC d'un instant décalé. */
function madagascarWall(instant: Date): Date {
  return new Date(instant.getTime() + MADAGASCAR_OFFSET_MS)
}

/** « mardi 21 octobre 2026 à 10 h 00 » (heure de Madagascar). */
export function formatMadagascarDateTime(value: string | Date): string {
  const instant = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(instant.getTime())) return String(value)
  const wall = madagascarWall(instant)
  return (
    `${WEEKDAYS[wall.getUTCDay()]} ${wall.getUTCDate()} ${MONTHS[wall.getUTCMonth()]} ${wall.getUTCFullYear()}` +
    ` à ${pad(wall.getUTCHours())} h ${pad(wall.getUTCMinutes())}`
  )
}

/** Heure de fin « 10 h 45 » (heure de Madagascar). */
export function formatMadagascarTime(value: string | Date): string {
  const instant = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(instant.getTime())) return String(value)
  const wall = madagascarWall(instant)
  return `${pad(wall.getUTCHours())} h ${pad(wall.getUTCMinutes())}`
}

const SHORT_MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']

/** « 16 oct. · 09 h 30 » (heure de Madagascar), pour les libellés compacts
 *  (bouton « Voir l'entretien »). */
export function formatMadagascarShortDateTime(value: string | Date): string {
  const instant = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(instant.getTime())) return String(value)
  const wall = madagascarWall(instant)
  return `${wall.getUTCDate()} ${SHORT_MONTHS[wall.getUTCMonth()]} · ${pad(wall.getUTCHours())} h ${pad(wall.getUTCMinutes())}`
}

/** Fin de l'entretien. */
export function interviewEnd(scheduledAt: string | Date, durationMinutes: number): Date {
  const start = typeof scheduledAt === 'string' ? new Date(scheduledAt) : scheduledAt
  return new Date(start.getTime() + durationMinutes * 60_000)
}

/** Champs `date` (AAAA-MM-JJ) et `time` (HH:MM) en heure de Madagascar. */
export function toMadagascarInputs(value: string | Date): { date: string; time: string } {
  const wall = madagascarWall(typeof value === 'string' ? new Date(value) : value)
  return {
    date: `${wall.getUTCFullYear()}-${pad(wall.getUTCMonth() + 1)}-${pad(wall.getUTCDate())}`,
    time: `${pad(wall.getUTCHours())}:${pad(wall.getUTCMinutes())}`,
  }
}

/**
 * Instant ISO (avec le décalage `+03:00` explicite) pour une date et une
 * heure saisies en heure de Madagascar. `null` si la saisie est invalide.
 */
export function madagascarInputsToIso(date: string, time: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null
  const iso = `${date}T${time}:00+03:00`
  const instant = new Date(iso)
  if (Number.isNaN(instant.getTime())) return null
  // Rejette les dates impossibles que `Date` corrige en silence (31 février…).
  const back = toMadagascarInputs(instant)
  if (back.date !== date || back.time !== time) return null
  return iso
}

const EMAIL_PATTERN = /[^\s@]+@[^\s@]+\.[^\s@]{2,}/
/** Huit chiffres ou plus, éventuellement séparés par des espaces, points ou tirets. */
const PHONE_PATTERN = /(?:\+?\d[\s.\-()]*){8,}/

/**
 * OffRec reste l'intermédiaire : le message du recruteur et le motif
 * d'empêchement du candidat ne doivent porter ni adresse email ni numéro
 * de téléphone. Message français, ou `null` si le texte convient.
 */
export function contactDetailsError(text: string | null | undefined): string | null {
  if (!text) return null
  if (EMAIL_PATTERN.test(text) || PHONE_PATTERN.test(text)) {
    return 'Retirez toute adresse email ou numéro de téléphone : OffRec transmet lui-même les informations utiles.'
  }
  return null
}

/**
 * Contrôle de la fenêtre de planification : au moins 2 h après `now`, au
 * plus 60 jours. Message français, ou `null` si la date convient. Le
 * serveur fait foi ; le client l'utilise pour prévenir la saisie.
 */
export function interviewWindowError(scheduledAt: Date, now: Date): string | null {
  if (Number.isNaN(scheduledAt.getTime())) return 'Date d’entretien invalide.'
  const lead = scheduledAt.getTime() - now.getTime()
  if (lead < INTERVIEW_MIN_LEAD_HOURS * 60 * 60 * 1000) {
    return `L’entretien doit avoir lieu au moins ${INTERVIEW_MIN_LEAD_HOURS} h après maintenant.`
  }
  if (lead > INTERVIEW_MAX_AHEAD_DAYS * 24 * 60 * 60 * 1000) {
    return `L’entretien ne peut pas être fixé à plus de ${INTERVIEW_MAX_AHEAD_DAYS} jours.`
  }
  return null
}

/* ------------------------------------------------------------------ */
/* Listes « Entretiens » (candidat, recruteur, admin)                  */
/* ------------------------------------------------------------------ */

export const INTERVIEW_PERIOD_LABELS: Record<InterviewPeriod, string> = {
  a_venir: 'À venir',
  passes: 'Passés',
  annules: 'Annulés',
  tous: 'Tous',
}

type InterviewTiming = { status: InterviewStatus; scheduledAt: string | Date; durationMinutes: number }

/** Non annulé et pas encore terminé (un entretien en cours est « à venir »). */
export function isInterviewUpcoming(interview: InterviewTiming, now: Date = new Date()): boolean {
  return (
    interview.status !== 'annule' &&
    interviewEnd(interview.scheduledAt, interview.durationMinutes).getTime() > now.getTime()
  )
}

/** Période d'un entretien (jamais `tous`). */
export function interviewPeriodOf(interview: InterviewTiming, now: Date = new Date()): Exclude<InterviewPeriod, 'tous'> {
  if (interview.status === 'annule') return 'annules'
  return isInterviewUpcoming(interview, now) ? 'a_venir' : 'passes'
}

export function interviewInPeriod(interview: InterviewTiming, period: InterviewPeriod, now: Date = new Date()): boolean {
  return period === 'tous' || interviewPeriodOf(interview, now) === period
}

/** « À traiter » côté recruteur : le candidat a signalé un empêchement. */
export function interviewNeedsAction(interview: { status: InterviewStatus }): boolean {
  return interview.status === 'empechement'
}

/**
 * « Réponse attendue » côté candidat : entretien planifié (ou reprogrammé,
 * qui repasse à `planifie`) pas encore confirmé, dont l'heure de début n'est
 * pas passée — même règle que le serveur, qui refuse une confirmation après
 * le début (`confirmInterview`).
 */
export function interviewAwaitsCandidateReply(
  interview: { status: InterviewStatus; scheduledAt: string | Date },
  now: Date = new Date(),
): boolean {
  return interview.status === 'planifie' && startMs(interview.scheduledAt) > now.getTime()
}

const startMs = (value: string | Date) => (typeof value === 'string' ? new Date(value) : value).getTime()

/**
 * Ordre des listes : les entretiens à venir d'abord, du plus proche au plus
 * lointain, puis les autres (passés, annulés) du plus récent au plus ancien ;
 * l'identifiant départage. Le serveur pagine l'admin dans le même ordre.
 */
export function compareInterviewsForList(
  a: InterviewTiming & { id: string },
  b: InterviewTiming & { id: string },
  now: Date = new Date(),
): number {
  const upA = isInterviewUpcoming(a, now)
  const upB = isInterviewUpcoming(b, now)
  if (upA !== upB) return upA ? -1 : 1
  const diff = startMs(a.scheduledAt) - startMs(b.scheduledAt)
  if (diff !== 0) return upA ? diff : -diff
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

/**
 * Libellé du bouton admin de régularisation de l'agenda d'un entretien, ou
 * `null` s'il n'y a rien à faire. Entretien actif (non annulé, pas encore
 * terminé) sans lien Meet : fixé en mode simulé avant la configuration de
 * Google, ou lien en attente / en erreur. Sinon, un échec Google à rattraper
 * (horaire non reporté, événement d'un entretien annulé non supprimé). Le
 * serveur reste juge : 409 si Google n'est pas configuré. Même règle que le
 * filtre « problème d'agenda » de `GET /admin/matching/interviews`.
 */
export function calendarActionLabel(
  interview: InterviewTiming & { meetUrl: string | null; provider: InterviewProvider; calendarError: string | null },
  now: Date = new Date(),
): string | null {
  if (interview.status !== 'annule') {
    if (!isInterviewUpcoming(interview, now)) return null
    if (!interview.meetUrl) {
      return interview.provider === 'simule' ? 'Créer le lien Meet' : 'Relancer l’agenda Google'
    }
  }
  return interview.provider === 'google' && interview.calendarError ? 'Relancer l’agenda Google' : null
}
