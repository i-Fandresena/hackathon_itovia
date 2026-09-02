import { Resend } from 'resend'

const apiKey = process.env.RESEND_API_KEY
const fromEmail = process.env.RESEND_FROM_EMAIL ?? 'OffRec <verification@offrec.qualitec.mg>'
const appUrl = process.env.CORS_ORIGIN ?? 'http://localhost:5173'

const client = apiKey ? new Resend(apiKey) : null

export interface SendResult {
  ok: boolean
  reason?: string
}

/**
 * Le code est aussi affiché en gros caractères sélectionnables (aucun
 * client mail n'exécute de JavaScript : impossible d'avoir un vrai copier-
 * coller déclenché depuis l'email) et le lien "Vérifier mon email" permet
 * une vérification en un clic sans ressaisie — voir EmailVerificationModal
 * côté frontend, qui sonde le statut pour détecter ce clic automatiquement.
 */
function buildHtml(code: string, confirmUrl: string): string {
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
            </tr>
            <tr>
              <td style="font-size:15px;color:#3d4451;line-height:1.5;padding-bottom:20px;">
                Voici votre code de vérification. Il expire dans <strong>10 minutes</strong>.
              </td>
            </tr>
            <tr>
              <td align="center" style="padding-bottom:24px;">
                <div style="display:inline-block;background:#f4f5f7;border-radius:12px;padding:16px 28px;font-family:'SFMono-Regular',Consolas,monospace;font-size:32px;font-weight:700;letter-spacing:10px;color:#0c0e12;">
                  ${code}
                </div>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding-bottom:24px;">
                <a href="${confirmUrl}" style="display:inline-block;background:#1a56ff;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 24px;border-radius:999px;">
                  Vérifier mon email
                </a>
              </td>
            </tr>
            <tr>
              <td style="font-size:13px;color:#6b7280;line-height:1.5;">
                Si vous n'êtes pas à l'origine de cette demande, ignorez simplement cet email — aucun compte ne sera créé.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`.trim()
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
    return { ok: false, reason: 'Service email non configuré (RESEND_API_KEY manquante).' }
  }

  const confirmUrl = `${appUrl}/verification-email?token=${encodeURIComponent(confirmToken)}`

  try {
    const result = await client.emails.send({
      from: fromEmail,
      to: email,
      subject: `Votre code de vérification OffRec : ${code}`,
      html: buildHtml(code, confirmUrl),
    })
    if (result.error) {
      console.error('[mailer] Erreur Resend', result.error)
      return { ok: false, reason: 'Envoi impossible pour le moment.' }
    }
    return { ok: true }
  } catch (err) {
    console.error('[mailer] Erreur envoi email', err)
    return { ok: false, reason: 'Envoi impossible pour le moment.' }
  }
}
