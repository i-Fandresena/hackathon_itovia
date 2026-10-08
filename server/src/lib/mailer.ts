import { Resend } from 'resend'

const apiKey = process.env.RESEND_API_KEY
const fromEmail = process.env.RESEND_FROM_EMAIL ?? 'OffRec <verification@offrec.qualitec.mg>'
/**
 * Expéditeur des emails transactionnels (hors vérification d'adresse). Par
 * défaut l'adresse d'expédition déjà configurée (`RESEND_FROM_EMAIL`, dont le
 * domaine est forcément vérifié chez Resend), sinon une adresse du même
 * domaine que le défaut historique.
 */
const notificationFromEmail =
  process.env.RESEND_NOTIFICATION_FROM_EMAIL ||
  process.env.RESEND_FROM_EMAIL ||
  'OffRec <notifications@offrec.qualitec.mg>'
const replyToEmail = 'contact@qualitec.mg'
const appUrl = process.env.CORS_ORIGIN ?? 'http://localhost:5173'

const client = apiKey ? new Resend(apiKey) : null

export interface SendResult {
  ok: boolean
  reason?: string
}

const NOT_CONFIGURED_REASON = 'Service email non configuré (RESEND_API_KEY manquante).'
const SEND_FAILED_REASON = 'Envoi impossible pour le moment.'

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** URL absolue du frontend pour un chemin interne (`/candidat/...`). */
export function appLink(path: string): string {
  return `${appUrl}${path.startsWith('/') ? path : `/${path}`}`
}

/* ------------------------------------------------------------------ */
/* Gabarit commun                                                      */
/* ------------------------------------------------------------------ */

const TEXT_ROW_STYLE = 'font-size:15px;color:#3d4451;line-height:1.5;padding-bottom:20px;'
const MUTED_ROW_STYLE = 'font-size:13px;color:#6b7280;line-height:1.5;padding-bottom:20px;'

/** `label` et `url` doivent déjà être sûrs pour du HTML. */
function buttonRow(label: string, url: string): string {
  return `
            <tr>
              <td align="center" style="padding-bottom:24px;">
                <a href="${url}" style="display:inline-block;background:#1a56ff;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 24px;border-radius:999px;">
                  ${label}
                </a>
              </td>
            </tr>`
}

/**
 * Enveloppe HTML commune à tous les emails OffRec : logo, carte blanche,
 * pied de page. `rows` est une suite de `<tr>` dont le contenu est déjà
 * échappé par l'appelant ; `footerNote` est la phrase « pourquoi vous
 * recevez cet email ».
 */
function renderLayout(rows: string, footerNote: string): string {
  return `
<!doctype html>
<html lang="fr">
  <body style="margin:0;padding:0;background:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;padding:36px 32px;">
            <tr>
              <td style="font-size:20px;font-weight:700;color:#0c0e12;padding-bottom:24px;">
                Off<span style="color:#1a56ff;">Rec</span>
              </td>
            </tr>${rows}
            <tr>
              <td style="font-size:12px;color:#9ca3af;line-height:1.5;border-top:1px solid #e5e7eb;padding-top:16px;">
                OffRec — Qualitec, Antananarivo, Madagascar.<br />
                ${footerNote}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`.trim()
}

const TEXT_FOOTER = ['—', 'OffRec — Qualitec, Antananarivo, Madagascar', 'offrec.qualitec.mg']

interface OutgoingEmail {
  from: string
  to: string
  subject: string
  html: string
  text: string
}

/** Envoi Resend : ne lève jamais, renvoie `{ ok: false, reason }` en cas d'échec. */
async function deliver(resend: Resend, email: OutgoingEmail): Promise<SendResult> {
  try {
    const result = await resend.emails.send({ ...email, replyTo: replyToEmail })
    if (result.error) {
      console.error('[mailer] Erreur Resend', result.error)
      return { ok: false, reason: SEND_FAILED_REASON }
    }
    return { ok: true }
  } catch (err) {
    console.error('[mailer] Erreur envoi email', err)
    return { ok: false, reason: SEND_FAILED_REASON }
  }
}

/* ------------------------------------------------------------------ */
/* Vérification d'adresse email                                        */
/* ------------------------------------------------------------------ */

/**
 * Le code est aussi affiché en gros caractères sélectionnables (aucun
 * client mail n'exécute de JavaScript : impossible d'avoir un vrai copier-
 * coller déclenché depuis l'email) et le lien "Vérifier mon email" permet
 * une vérification en un clic sans ressaisie — voir EmailVerificationModal
 * côté frontend, qui sonde le statut pour détecter ce clic automatiquement.
 */
function buildHtml(code: string, confirmUrl: string): string {
  const rows = `
            <tr>
              <td style="${TEXT_ROW_STYLE}">
                Voici votre code de vérification. Il expire dans <strong>10 minutes</strong>.
              </td>
            </tr>
            <tr>
              <td align="center" style="padding-bottom:24px;">
                <div style="display:inline-block;background:#f4f5f7;border-radius:12px;padding:16px 28px;font-family:'SFMono-Regular',Consolas,monospace;font-size:32px;font-weight:700;letter-spacing:10px;color:#0c0e12;">
                  ${code}
                </div>
              </td>
            </tr>${buttonRow('Vérifier mon email', confirmUrl)}
            <tr>
              <td style="${MUTED_ROW_STYLE}">
                Si vous n'êtes pas à l'origine de cette demande, ignorez simplement cet email — aucun compte ne sera créé.
              </td>
            </tr>`
  return renderLayout(rows, "Vous recevez cet email suite à une demande d'inscription sur offrec.qualitec.mg.")
}

function buildText(code: string, confirmUrl: string): string {
  return [
    'OffRec — Vérification de votre adresse email',
    '',
    `Votre code de vérification : ${code}`,
    '(expire dans 10 minutes)',
    '',
    `Ou cliquez sur ce lien pour vérifier en un clic : ${confirmUrl}`,
    '',
    "Si vous n'êtes pas à l'origine de cette demande, ignorez cet email — aucun compte ne sera créé.",
    '',
    ...TEXT_FOOTER,
  ].join('\n')
}

export async function sendVerificationEmail(email: string, code: string, confirmToken: string): Promise<SendResult> {
  if (!client) {
    // Le code ne doit jamais apparaître en clair dans des logs de
    // production — seulement utile pour tester le flux en local/dev tant
    // que RESEND_API_KEY n'est pas configurée.
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`[mailer] RESEND_API_KEY non configurée — code de vérification pour ${email} : ${code}`)
    } else {
      console.warn(`[mailer] RESEND_API_KEY non configurée — email de vérification non envoyé à ${email}.`)
    }
    return { ok: false, reason: NOT_CONFIGURED_REASON }
  }

  const confirmUrl = `${appUrl}/verification-email?token=${encodeURIComponent(confirmToken)}`

  return deliver(client, {
    from: fromEmail,
    to: email,
    // Le code n'apparaît jamais dans le sujet : ni exposé sur un écran de
    // verrouillage via l'aperçu de notification, ni comme motif classique
    // de déclenchement des filtres anti-spam sur les OTP en clair.
    subject: 'Confirmez votre adresse email — OffRec',
    html: buildHtml(code, confirmUrl),
    text: buildText(code, confirmUrl),
  })
}

/* ------------------------------------------------------------------ */
/* Email transactionnel générique                                      */
/* ------------------------------------------------------------------ */

export interface TransactionalEmail {
  to: string
  subject: string
  /** Titre affiché en tête du message. */
  title: string
  /** Un paragraphe par entrée — texte brut, échappé ici. */
  body: string[]
  /** Bouton d'action : `url` absolue (voir `appLink`). */
  action?: { label: string; url: string }
}

/**
 * Email transactionnel réutilisable (même gabarit que la vérification
 * d'adresse). Strictement informatif : aucun contenu promotionnel. Même
 * dégradation que `sendVerificationEmail` sans `RESEND_API_KEY` — ne lève
 * jamais, renvoie `{ ok: false, reason }`. L'adresse du destinataire n'est
 * jamais écrite dans les logs.
 */
export async function sendTransactionalEmail(email: TransactionalEmail): Promise<SendResult> {
  if (!client) {
    console.warn(`[mailer] RESEND_API_KEY non configurée — email « ${email.subject} » non envoyé.`)
    return { ok: false, reason: NOT_CONFIGURED_REASON }
  }

  const rows = [
    `
            <tr>
              <td style="font-size:18px;font-weight:700;color:#0c0e12;line-height:1.4;padding-bottom:16px;">
                ${escapeHtml(email.title)}
              </td>
            </tr>`,
    ...email.body.map(
      (paragraph) => `
            <tr>
              <td style="${TEXT_ROW_STYLE}">
                ${escapeHtml(paragraph)}
              </td>
            </tr>`,
    ),
    email.action ? buttonRow(escapeHtml(email.action.label), escapeHtml(email.action.url)) : '',
  ].join('')

  const text = [
    `OffRec — ${email.title}`,
    '',
    ...email.body.flatMap((paragraph) => [paragraph, '']),
    ...(email.action ? [`${email.action.label} : ${email.action.url}`, ''] : []),
    ...TEXT_FOOTER,
  ].join('\n')

  return deliver(client, {
    from: notificationFromEmail,
    to: email.to,
    subject: email.subject,
    html: renderLayout(rows, 'Vous recevez cet email car vous avez un compte sur offrec.qualitec.mg.'),
    text,
  })
}
