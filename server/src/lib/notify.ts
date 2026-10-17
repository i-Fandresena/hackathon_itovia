import { prisma } from './prisma.js'
import { appLink, sendTransactionalEmail } from './mailer.js'
import type { NotificationCategory } from '../../../src/types/index.js'

export interface NotifyUserInput {
  userId: string
  /** Identifiant technique de l'événement (ex. `mise_en_relation`) — journalisé. */
  event: string
  title: string
  message: string
  /** Chemin frontend vers la source de la notification. */
  link?: string
  /**
   * Présent : la notification est doublée d'un email transactionnel, envoyé
   * à l'adresse du compte (lue en base ici, jamais fournie par l'appelant).
   * Le bouton d'action pointe vers `link`.
   */
  email?: {
    subject: string
    /** Un paragraphe par entrée. Par défaut : `[message]`. */
    body?: string[]
    actionLabel?: string
  }
}

type Channel = 'in_app' | 'email'
type DispatchStatus = 'sent' | 'skipped' | 'failed'

/**
 * Journal technique : jamais d'adresse email, de nom ni d'identifiant de
 * destinataire — seulement l'événement, le canal et l'issue.
 */
async function logDispatch(event: string, channel: Channel, status: DispatchStatus, reason?: string): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: { action: 'notification_dispatch', metadata: { event, channel, status, reason: reason ?? null } },
    })
  } catch (err) {
    console.error('[notify] Journalisation impossible', err)
  }
}

async function dispatchEmail(input: NotifyUserInput & { email: NonNullable<NotifyUserInput['email']> }): Promise<void> {
  try {
    const user = await prisma.user.findUnique({ where: { id: input.userId }, select: { email: true } })
    if (!user) {
      await logDispatch(input.event, 'email', 'skipped', 'Destinataire introuvable.')
      return
    }
    const result = await sendTransactionalEmail({
      to: user.email,
      subject: input.email.subject,
      title: input.title,
      body: input.email.body ?? [input.message],
      action: input.link
        ? { label: input.email.actionLabel ?? 'Ouvrir mon espace OffRec', url: appLink(input.link) }
        : undefined,
    })
    // Sans clé Resend, ce n'est pas une panne : le canal n'est pas configuré.
    const status: DispatchStatus = result.ok ? 'sent' : result.reason?.includes('RESEND_API_KEY') ? 'skipped' : 'failed'
    await logDispatch(input.event, 'email', status, result.reason)
  } catch (err) {
    console.error('[notify] Envoi email impossible', err)
    await logDispatch(input.event, 'email', 'failed', 'Erreur inattendue.')
  }
}

/**
 * Point d'entrée unique pour notifier un utilisateur sur plusieurs canaux.
 * La notification in-app est toujours créée en premier (et attendue) ;
 * l'email éventuel part ensuite en arrière-plan pour ne pas ralentir la
 * requête d'origine. Ne lève jamais : une notification manquée ne doit pas
 * faire échouer l'action métier qui l'a déclenchée. Chaque tentative écrit
 * un `AuditLog` `notification_dispatch` `{ event, channel, status, reason }`.
 */
export async function notifyUser(input: NotifyUserInput): Promise<void> {
  try {
    await prisma.notification.create({
      data: { userId: input.userId, title: input.title, message: input.message, link: input.link },
    })
    await logDispatch(input.event, 'in_app', 'sent')
  } catch (err) {
    console.error('[notify] Notification in-app impossible', err)
    await logDispatch(input.event, 'in_app', 'failed', 'Erreur inattendue.')
  }

  if (input.email) {
    void dispatchEmail({ ...input, email: input.email })
  }
}

/* ------------------------------------------------------------------ */
/* Notifications des administrateurs                                   */
/* ------------------------------------------------------------------ */

export interface NotifyAdminsInput {
  /** Identifiant technique de l'événement (ex. `recruiter_interested`) — journalisé. */
  event: string
  /** Origine de l'événement : filtre de la page `/admin/notifications`. */
  category: NotificationCategory
  /** Court, sans donnée personnelle. */
  title: string
  /**
   * Phrase factuelle en français. Jamais d'adresse email, de numéro de
   * téléphone, ni de nom réel d'un membre de l'annuaire.
   */
  message: string
  /** Écran admin où agir (route réelle de `src/App.tsx`). */
  link: string
  /** Auteur de l'action : un admin n'est jamais notifié de sa propre action. */
  excludeUserId?: string | null
}

/** Texte libre (titre d'offre, raison sociale…) borné avant d'entrer dans un message. */
export function clip(value: string | null | undefined, max = 80): string {
  const text = (value ?? '').replace(/\s+/g, ' ').trim()
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text
}

/** Accord en nombre : `plural(2, 'suggestion')` → « 2 suggestions ». */
export function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return `${count} ${count > 1 ? pluralForm : singular}`
}

/**
 * Notifie chaque compte administrateur actif d'un événement d'activité de la
 * plateforme — IN-APP uniquement, jamais d'email. Ce n'est pas un miroir du
 * journal d'audit : seuls les événements utiles à un admin passent par ici,
 * formulés pour un humain, avec un lien vers l'écran où agir.
 *
 * Ne lève jamais : une notification manquée ne doit pas faire échouer
 * l'action métier. Un seul `AuditLog` `notification_dispatch` par appel
 * (compteur de destinataires, aucun identifiant).
 */
export async function notifyAdmins(input: NotifyAdminsInput): Promise<void> {
  try {
    const admins = await prisma.user.findMany({
      where: {
        role: 'admin',
        // Même définition que `isAccountBlocked()` : un admin suspendu ou
        // banni n'a plus accès à son espace, il ne reçoit rien.
        status: { notIn: ['suspended', 'banned'] },
        ...(input.excludeUserId ? { id: { not: input.excludeUserId } } : {}),
      },
      select: { id: true },
    })
    if (admins.length === 0) {
      await logDispatch(input.event, 'in_app', 'skipped', 'Aucun administrateur à notifier.')
      return
    }
    await prisma.notification.createMany({
      data: admins.map((admin) => ({
        userId: admin.id,
        category: input.category,
        title: input.title,
        message: input.message,
        link: input.link,
      })),
    })
    await logDispatch(input.event, 'in_app', 'sent', `${admins.length} administrateur(s).`)
  } catch (err) {
    console.error('[notify] Notification des administrateurs impossible', err)
    await logDispatch(input.event, 'in_app', 'failed', 'Erreur inattendue.')
  }
}

/**
 * À appeler APRÈS l'envoi de la réponse HTTP (même motif que
 * `scheduleCandidateMatching`) : la notification des admins ne retarde ni ne
 * fait échouer la requête d'origine. `input` peut être une fonction quand le
 * message demande une lecture en base (nom du candidat, raison sociale…) :
 * elle s'exécute elle aussi en arrière-plan, et `null` annule l'envoi.
 */
export function scheduleAdminNotification(
  input: NotifyAdminsInput | (() => Promise<NotifyAdminsInput | null>),
): void {
  setImmediate(() => {
    Promise.resolve(typeof input === 'function' ? input() : input)
      .then((resolved) => (resolved ? notifyAdmins(resolved) : undefined))
      .catch((err) => {
        console.error('[notify] Préparation de la notification admin impossible', err)
      })
  })
}

const ACTOR_LABELS: Record<string, string> = {
  candidate: 'Un candidat',
  recruiter: 'Un recruteur',
  particulier: 'Un particulier',
  agent: 'Un agent de terrain',
  talent: 'Un talent',
  admin: 'Un administrateur',
}

/**
 * Nom d'affichage de l'auteur d'une action pour un message destiné aux
 * admins : nom du profil candidat, raison sociale du recruteur, nom de
 * l'agent. Un particulier ou un compte de suivi talent n'est jamais nommé
 * (identité de l'annuaire / personne non diplômée) : libellé générique.
 * Jamais l'adresse email.
 */
export async function actorLabel(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      role: true,
      candidateProfile: { select: { fullName: true } },
      recruiterProfile: { select: { companyName: true } },
      agentProfile: { select: { fullName: true } },
    },
  })
  if (!user) return 'Un utilisateur'
  if (user.role === 'candidate' && user.candidateProfile) return clip(user.candidateProfile.fullName, 60)
  if (user.role === 'recruiter' && user.recruiterProfile) return clip(user.recruiterProfile.companyName, 60)
  if (user.role === 'agent' && user.agentProfile) return `L’agent ${clip(user.agentProfile.fullName, 60)}`
  return ACTOR_LABELS[user.role] ?? 'Un utilisateur'
}

/* ------------------------------------------------------------------ */
/* Notifications des agents de terrain                                 */
/* ------------------------------------------------------------------ */

export interface NotifyAgentsInput {
  event: string
  /** Province du sujet : seuls les agents de cette province sont notifiés, à défaut tous. */
  province: string
  /** Court, sans donnée personnelle. */
  title: string
  /** Jamais de nom, de téléphone ni d'email : métier et lieu suffisent. */
  message: string
  link: string
}

/**
 * Notifie in-app les agents actifs de la province (`AgentProfile.province`),
 * ou tous les agents actifs si aucun n'y est rattaché. Jamais d'email.
 * Ne lève jamais.
 */
export async function notifyAgents(input: NotifyAgentsInput): Promise<void> {
  try {
    const active = { role: 'agent' as const, status: { notIn: ['suspended' as const, 'banned' as const] } }
    let agents = await prisma.user.findMany({
      where: { ...active, agentProfile: { province: input.province } },
      select: { id: true },
    })
    if (agents.length === 0) {
      agents = await prisma.user.findMany({ where: active, select: { id: true } })
    }
    if (agents.length === 0) {
      await logDispatch(input.event, 'in_app', 'skipped', 'Aucun agent à notifier.')
      return
    }
    await prisma.notification.createMany({
      data: agents.map((agent) => ({
        userId: agent.id,
        category: 'agent' as const,
        title: input.title,
        message: input.message,
        link: input.link,
      })),
    })
    await logDispatch(input.event, 'in_app', 'sent', `${agents.length} agent(s).`)
  } catch (err) {
    console.error('[notify] Notification des agents impossible', err)
    await logDispatch(input.event, 'in_app', 'failed', 'Erreur inattendue.')
  }
}

/** Libellé générique du rôle (jamais de nom) : « Un particulier », « Un candidat »… */
export function roleLabel(role: string): string {
  return ACTOR_LABELS[role] ?? 'Un utilisateur'
}
