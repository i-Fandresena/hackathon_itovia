/**
 * Obtenir le `GOOGLE_REFRESH_TOKEN` de l'agenda OffRec (entretiens, décision
 * 2026-10-14). Flux OAuth « application de bureau » avec redirection locale
 * (loopback) et PKCE : rien n'est écrit sur disque, le jeton est seulement
 * affiché dans ce terminal.
 *
 * Prérequis (une seule fois, avec le compte Google qui possède l'agenda) :
 *   1. https://console.cloud.google.com/ → créer (ou choisir) un projet.
 *   2. « API et services » → « Bibliothèque » → activer « Google Calendar API ».
 *   3. « Écran de consentement OAuth » : type « Externe » (ou « Interne » sur
 *      Google Workspace), nom de l'application « OffRec », adresse d'assistance ;
 *      ajouter le champ d'application `.../auth/calendar.events` ; en mode
 *      « Test », ajouter le compte de l'agenda comme utilisateur test.
 *      Attention : en mode « Test », Google révoque le jeton de rafraîchissement
 *      au bout de 7 jours — publiez l'application (« En production ») pour un
 *      jeton durable.
 *   4. « Identifiants » → « Créer des identifiants » → « ID client OAuth » →
 *      type « Application de bureau ». Noter l'ID client et le code secret.
 *
 * Puis, depuis server/ (les deux variables peuvent aussi être dans server/.env) :
 *   GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=... npx tsx scripts/google-calendar-token.ts
 * (PowerShell : `$env:GOOGLE_CLIENT_ID="..."; $env:GOOGLE_CLIENT_SECRET="..."; npx tsx scripts/google-calendar-token.ts`)
 *
 * Ouvrir l'adresse affichée, se connecter avec le compte de l'agenda OffRec,
 * accepter : le terminal affiche `GOOGLE_REFRESH_TOKEN=...` à copier dans
 * server/.env. `GOOGLE_CALENDAR_ID` vaut `primary` (agenda principal du
 * compte) ou l'identifiant d'un agenda dédié (Paramètres de l'agenda →
 * « Intégrer l'agenda » → « ID de l'agenda »).
 */
import 'dotenv/config'
import { createHash, randomBytes } from 'node:crypto'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'

const SCOPE = 'https://www.googleapis.com/auth/calendar.events'
const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'

const clientId = process.env.GOOGLE_CLIENT_ID?.trim()
const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim()
if (!clientId || !clientSecret) {
  console.error('GOOGLE_CLIENT_ID et GOOGLE_CLIENT_SECRET sont requis (variables d’environnement ou server/.env).')
  process.exit(1)
}

const base64url = (buffer: Buffer) => buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const verifier = base64url(randomBytes(32))
const challenge = base64url(createHash('sha256').update(verifier).digest())
const state = base64url(randomBytes(16))

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://127.0.0.1')
  if (url.pathname !== '/') {
    res.writeHead(404).end()
    return
  }
  const error = url.searchParams.get('error')
  const code = url.searchParams.get('code')
  if (error || !code || url.searchParams.get('state') !== state) {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Autorisation refusée ou invalide.')
    console.error(`Autorisation refusée ou invalide${error ? ` (${error})` : ''}.`)
    server.close()
    process.exitCode = 1
    return
  }
  try {
    const { port } = server.address() as AddressInfo
    const response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: `http://127.0.0.1:${port}`,
        code_verifier: verifier,
      }).toString(),
    })
    const body = (await response.json()) as { refresh_token?: string; error?: string; error_description?: string }
    if (!response.ok || !body.refresh_token) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Échec : voir le terminal.')
      console.error(
        `Échec de l’échange (HTTP ${response.status}) : ${body.error ?? ''} ${body.error_description ?? ''}`.trim(),
        body.refresh_token ? '' : '\nAucun refresh_token reçu : révoquez l’accès de l’application (myaccount.google.com/permissions) puis relancez.',
      )
      process.exitCode = 1
    } else {
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' }).end('C’est fait : vous pouvez fermer cet onglet et revenir au terminal.')
      console.log('\nÀ copier dans server/.env (ne jamais committer) :\n')
      console.log(`GOOGLE_REFRESH_TOKEN=${body.refresh_token}\n`)
    }
  } catch (err) {
    res.writeHead(500).end()
    console.error('Échange impossible :', err instanceof Error ? err.message : err)
    process.exitCode = 1
  } finally {
    server.close()
  }
})

server.listen(0, '127.0.0.1', () => {
  const { port } = server.address() as AddressInfo
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `http://127.0.0.1:${port}`,
    response_type: 'code',
    scope: SCOPE,
    access_type: 'offline',
    prompt: 'consent',
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  })
  console.log('Ouvrez cette adresse dans un navigateur, connectez-vous avec le compte de l’agenda OffRec et acceptez :\n')
  console.log(`${AUTH_URL}?${params}\n`)
  console.log(`En attente de la redirection sur http://127.0.0.1:${port} …`)
})
