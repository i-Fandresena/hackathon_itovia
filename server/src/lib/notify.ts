import { prisma } from './prisma.js'
import { appLink, sendTransactionalEmail } from './mailer.js'

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
