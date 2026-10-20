import {
  OUTCOME_OVERDUE_DAYS,
  OUTCOME_REMINDER_HOURS,
  hiringPhase,
  isOutcomeOverdue,
  isOutcomeReminderDue,
  madagascarToday,
} from '../../../src/lib/hiring.js'
import { prisma } from './prisma.js'
import { clip, notifyAdmins, notifyUser, plural } from './notify.js'
import { HIRING_SUPPORTED } from './hiring-store.js'
import { loadOutcomeIndicator } from './hiring-stats.js'
import { buildHiringContexts, roundStateOf } from './hiring-state.js'
import { interviewStore, isInterviewStorageError, whenText, type InterviewRow } from './interviews.js'
import { expireDueProposals, scheduleExpiredNotices, sendProposalReminders } from './hire-proposals.js'

/**
 * Tâches périodiques « après l'entretien » (plan du 2026-10-16, §5.5).
 *
 * 1. Rappel au recruteur 24 h après la fin d'un tour dont l'issue n'est pas
 *    renseignée (in-app, UNE fois par tour : `outcomeReminderAt` posé par une
 *    écriture conditionnelle, seul le gagnant notifie).
 * 2. Résumé aux admins « n issues non renseignées depuis plus de 7 jours »
 *    (in-app, au plus UN par jour de Madagascar : `AuditLog`
 *    `hiring_digest_sent` écrit sous verrou consultatif).
 *    Rappels et résumé ne comptent qu'un tour dont le DOSSIER est dans la
 *    phase `issue_a_renseigner` (même règle que le compteur `toRecord` des
 *    listes, `outcomeToRecord`) : jamais un dossier embauché ni une offre
 *    pourvue.
 * 3. Sous-lot 5 : propositions d'embauche échues marquées `expiree`
 *    (écriture conditionnelle par ligne ; candidat, recruteur et admins
 *    notifiés une seule fois) et rappel J-2 au candidat (`expiryReminderAt`,
 *    une fois par échéance — D2). Une proposition échue est de toute façon
 *    traitée comme expirée sans ces tâches (vues, contrôles, écritures).
 *
 * Mécanisme, sans dépendance de planificateur : `startHiringJobs()` au
 * démarrage puis toutes les 15 min (`setInterval` + `unref`), plus un
 * déclenchement à la demande, après la réponse, depuis les listes
 * d'entretiens (au plus une fois par minute). Elles ne tournent que si
 * `HIRING_JOBS_ENABLED=true` — désactivées par défaut tant que l'écran de
 * saisie de l'issue (sous-lot 4) n'est pas livré, pour ne pas inonder de
 * rappels les recruteurs dont les anciens entretiens n'ont pas d'issue.
 * L'admin peut les lancer lui-même (`POST /admin/matching/hiring-jobs/run`).
 * Idempotentes : relancer ne renvoie jamais un rappel déjà envoyé.
 */

export const HIRING_JOBS_INTERVAL_MS = 15 * 60 * 1000
const LAZY_THROTTLE_MS = 60 * 1000
const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS
/** Plafond de lignes examinées par passage (les suivantes au passage suivant). */
const BATCH_LIMIT = 500

export interface HiringJobsReport {
  /** Rappels « issue à renseigner » réellement envoyés par ce passage. */
  outcomeReminders: number
  /** Issues en souffrance (> 7 jours) au moment du passage. */
  overdueOutcomes: number
  /** Le résumé quotidien est parti à ce passage. */
  digestSent: boolean
  /** Propositions passées `expiree` par ce passage. */
  proposalsExpired: number
  /** Rappels J-2 envoyés aux candidats par ce passage. */
  proposalReminders: number
}

/** Rappels et résumé actifs automatiquement (démarrage, minuterie, listes). */
export function hiringJobsEnabled(): boolean {
  return HIRING_SUPPORTED && process.env.HIRING_JOBS_ENABLED?.trim().toLowerCase() === 'true'
}

/** Tours actifs, sans issue, ni annulés ni en empêchement, d'un dossier mis en relation, commencés avant `before`. */
function pendingOutcomeWhere(before: Date) {
  return {
    activeSuggestionId: { not: null },
    outcome: null,
    status: { in: ['planifie', 'confirme'] },
    scheduledAt: { lte: before },
    suggestion: { status: 'mise_en_relation' },
  }
}

/**
 * Garde les tours dont le dossier attend vraiment une issue (phase
 * `issue_a_renseigner`) : ni embauché, ni offre pourvue.
 */
async function onlyAwaitingOutcome(rows: InterviewRow[], now: Date): Promise<InterviewRow[]> {
  if (rows.length === 0) return rows
  const dossiers = await prisma.matchSuggestion.findMany({
    where: { id: { in: [...new Set(rows.map((row) => row.suggestionId))] } },
    select: { id: true, status: true, opportunityId: true },
  })
  const store = interviewStore()
  const allRounds = store ? await store.findMany({ where: { suggestionId: { in: dossiers.map((d) => d.id) } } }) : rows
  const contexts = await buildHiringContexts(dossiers, allRounds)
  return rows.filter((row) => {
    const context = contexts.get(row.suggestionId)
    return context !== undefined && hiringPhase(context.state, now) === 'issue_a_renseigner'
  })
}

/** Rappel au recruteur, une fois par tour, 24 h après la fin sans issue. */
export async function sendOutcomeReminders(now: Date = new Date()): Promise<number> {
  const store = interviewStore()
  if (!HIRING_SUPPORTED || !store) return 0
  // Début ≤ maintenant − 24 h : surensemble des tours dus, affiné par la règle pure.
  const rows = await store.findMany({
    where: { ...pendingOutcomeWhere(new Date(now.getTime() - OUTCOME_REMINDER_HOURS * HOUR_MS)), outcomeReminderAt: null },
    orderBy: [{ scheduledAt: 'asc' }, { id: 'asc' }],
    take: BATCH_LIMIT,
  })
  const due = await onlyAwaitingOutcome(
    rows.filter((row) => isOutcomeReminderDue(roundStateOf(row), now)),
    now,
  )
  if (due.length === 0) return 0

  const dossiers = await prisma.matchSuggestion.findMany({
    where: { id: { in: [...new Set(due.map((row) => row.suggestionId))] } },
    select: {
      id: true,
      opportunity: { select: { title: true, recruiterId: true } },
      candidate: { select: { candidateProfile: { select: { fullName: true } } } },
    },
  })
  const byId = new Map(dossiers.map((dossier) => [dossier.id, dossier]))

  let sent = 0
  for (const row of due) {
    const dossier = byId.get(row.suggestionId)
    if (!dossier) continue
    // Seul le passage qui pose `outcomeReminderAt` notifie : deux passages
    // simultanés n'envoient jamais deux rappels pour le même tour.
    const { count } = await store.updateMany({
      where: { id: row.id, outcomeReminderAt: null, outcome: null, activeSuggestionId: { not: null } },
      data: { outcomeReminderAt: now },
    })
    if (count === 0) continue
    sent += 1
    await notifyUser({
      userId: dossier.opportunity.recruiterId,
      event: 'interview_outcome_reminder',
      title: 'Issue d’entretien à renseigner',
      message:
        `L’entretien du ${whenText(row)} avec ${clip(dossier.candidate.candidateProfile?.fullName, 60) || 'le candidat'} ` +
        `pour « ${clip(dossier.opportunity.title)} » est terminé : renseignez son issue. ` +
        'OffRec informe ensuite le candidat avec un message neutre.',
      link: '/recruteur/entretiens',
    })
  }
  return sent
}

/** Début (UTC) du jour civil de Madagascar (UTC+3 fixe) qui contient `now`. */
function madagascarDayStart(now: Date): Date {
  return new Date(`${madagascarToday(now)}T00:00:00+03:00`)
}

/** Résumé aux admins : au plus un par jour de Madagascar, seulement s'il y a des issues en souffrance. */
export async function sendOverdueDigest(now: Date = new Date()): Promise<{ overdue: number; sent: boolean }> {
  const store = interviewStore()
  if (!HIRING_SUPPORTED || !store) return { overdue: 0, sent: false }
  const rows: InterviewRow[] = await store.findMany({
    where: pendingOutcomeWhere(new Date(now.getTime() - OUTCOME_OVERDUE_DAYS * DAY_MS)),
    take: 5000,
  })
  const overdue = (await onlyAwaitingOutcome(rows.filter((row) => isOutcomeOverdue(roundStateOf(row), now)), now)).length
  if (overdue === 0) return { overdue, sent: false }

  const day = madagascarToday(now)
  const sent = await prisma.$transaction(async (tx) => {
    // Verrou consultatif de transaction : deux passages simultanés (minuterie
    // et déclenchement à la demande) n'écrivent qu'un résumé.
    await tx.$queryRaw`SELECT 1 AS locked FROM (SELECT pg_advisory_xact_lock(hashtext('offrec_hiring_overdue_digest'))) AS l`
    const already = await tx.auditLog.count({
      where: { action: 'hiring_digest_sent', createdAt: { gte: madagascarDayStart(now) } },
    })
    if (already > 0) return false
    await tx.auditLog.create({ data: { action: 'hiring_digest_sent', metadata: { day, overdue } } })
    return true
  })
  if (sent) {
    // Plan §11 : l'indicateur suivi est rappelé dans le résumé (aucun nom).
    const indicator = await loadOutcomeIndicator(now).catch(() => null)
    const percent = indicator?.last30.percent ?? null
    await notifyAdmins({
      event: 'interview_outcome_overdue',
      category: 'systeme',
      title: 'Issues d’entretien en souffrance',
      message:
        `${plural(overdue, 'issue d’entretien', 'issues d’entretien')} ${overdue > 1 ? 'ne sont' : 'n’est'} pas ` +
        `renseignée${overdue > 1 ? 's' : ''} plus de ${OUTCOME_OVERDUE_DAYS} jours après la fin de l’entretien. ` +
        'Relancez les recruteurs concernés depuis « Entretiens ».' +
        (percent === null
          ? ''
          : ` Issues renseignées sous 7 jours (tours terminés entre J-37 et J-7) : ${String(percent).replace('.', ',')} %, objectif ${indicator!.last30.targetPercent} %.`),
      link: '/admin/entretiens',
    })
  }
  return { overdue, sent }
}

/** Un passage complet ; ne lève pas pour une table ou une colonne absente. */
export async function runHiringJobs(now: Date = new Date()): Promise<HiringJobsReport> {
  const report: HiringJobsReport = {
    outcomeReminders: 0,
    overdueOutcomes: 0,
    digestSent: false,
    proposalsExpired: 0,
    proposalReminders: 0,
  }
  if (!HIRING_SUPPORTED) return report
  try {
    report.outcomeReminders = await sendOutcomeReminders(now)
    const digest = await sendOverdueDigest(now)
    report.overdueOutcomes = digest.overdue
    report.digestSent = digest.sent
    const expired = await expireDueProposals(prisma, now)
    report.proposalsExpired = expired.length
    scheduleExpiredNotices(expired)
    report.proposalReminders = await sendProposalReminders(now)
  } catch (err) {
    if (!isInterviewStorageError(err)) throw err
    console.warn('[hiring] Rappels ignorés : migrations « après l’entretien » non appliquées (npm run prisma:deploy).')
  }
  return report
}

let lastLazyRun = 0

/** Déclenchement à la demande (listes d'entretiens), après la réponse, au plus une fois par minute. */
export function scheduleHiringJobs(): void {
  if (!hiringJobsEnabled()) return
  const now = Date.now()
  if (now - lastLazyRun < LAZY_THROTTLE_MS) return
  lastLazyRun = now
  setImmediate(() => {
    runHiringJobs().catch((err) => console.error('[hiring] Rappels à la demande impossibles', err))
  })
}

/** Au démarrage : un passage, puis toutes les 15 min (minuterie qui ne retient pas le processus). */
export function startHiringJobs(): void {
  if (!HIRING_SUPPORTED) return
  if (!hiringJobsEnabled()) {
    console.log(
      '[hiring] Rappels d’issue, expiration des propositions et rappels J-2 désactivés (HIRING_JOBS_ENABLED=true pour les activer).',
    )
    return
  }
  const tick = () => {
    lastLazyRun = Date.now()
    runHiringJobs()
      .then((report) => {
        if (report.outcomeReminders > 0 || report.digestSent || report.proposalsExpired > 0 || report.proposalReminders > 0) {
          console.log(
            `[hiring] ${report.outcomeReminders} rappel(s) d’issue envoyé(s)` +
              (report.digestSent ? `, résumé admin envoyé (${report.overdueOutcomes} en souffrance)` : '') +
              `, ${report.proposalsExpired} proposition(s) expirée(s), ${report.proposalReminders} rappel(s) J-2.`,
          )
        }
      })
      .catch((err) => console.error('[hiring] Rappels impossibles', err))
  }
  tick()
  setInterval(tick, HIRING_JOBS_INTERVAL_MS).unref()
}
