import { Router } from 'express'
import crypto from 'node:crypto'
import rateLimit from 'express-rate-limit'
import { prisma } from '../lib/prisma.js'
import { sendVerificationEmail } from '../lib/mailer.js'
import { sendVerificationCodeSchema, verifyCodeSchema } from '../lib/validation.js'

const router = Router()

const CODE_TTL_MS = 10 * 60 * 1000
const RESEND_COOLDOWN_MS = 45 * 1000
const MAX_ATTEMPTS = 5

const sendLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
})

const verifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
})

/** Code peppéré avec JWT_SECRET plutôt qu'en clair — un bcrypt serait
 *  inutilement lent pour 10 000 combinaisons déjà protégées par le
 *  rate-limit et le compteur de tentatives par ligne. */
function hashCode(code: string): string {
  return crypto.createHmac('sha256', process.env.JWT_SECRET ?? '').update(code).digest('hex')
}

/** Signe l'id de la ligne EmailVerification pour le lien cliquable de
 *  l'email — jamais le code à 4 chiffres en clair dans une URL/des logs. */
function signConfirmToken(id: string): string {
  const mac = crypto.createHmac('sha256', process.env.JWT_SECRET ?? '').update(id).digest('hex')
  return `${id}.${mac}`
}

function verifyConfirmToken(token: string): string | null {
  const [id, mac] = token.split('.')
  if (!id || !mac) return null
  const expected = crypto.createHmac('sha256', process.env.JWT_SECRET ?? '').update(id).digest('hex')
  const a = Buffer.from(mac)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null
  return id
}

router.post('/send-code', sendLimiter, async (req, res, next) => {
  try {
    const { email } = sendVerificationCodeSchema.parse(req.body)
    const normalizedEmail = email.toLowerCase()

    const recent = await prisma.emailVerification.findFirst({
      where: { email: normalizedEmail },
      orderBy: { createdAt: 'desc' },
    })
    if (recent && Date.now() - recent.createdAt.getTime() < RESEND_COOLDOWN_MS) {
      res.status(429).json({ error: 'Veuillez patienter avant de redemander un code.' })
      return
    }

    const code = String(crypto.randomInt(1000, 10000))
    const record = await prisma.emailVerification.create({
      data: {
        email: normalizedEmail,
        codeHash: hashCode(code),
        expiresAt: new Date(Date.now() + CODE_TTL_MS),
      },
    })

    const result = await sendVerificationEmail(normalizedEmail, code, signConfirmToken(record.id))
    if (!result.ok) {
      res.status(502).json({ error: result.reason ?? 'Envoi impossible pour le moment.' })
      return
    }
    res.status(201).json({ ok: true })
  } catch (err) {
    next(err)
  }
})

router.post('/verify-code', verifyLimiter, async (req, res, next) => {
  try {
    const { email, code } = verifyCodeSchema.parse(req.body)
    const normalizedEmail = email.toLowerCase()

    const record = await prisma.emailVerification.findFirst({
      where: { email: normalizedEmail, verifiedAt: null },
      orderBy: { createdAt: 'desc' },
    })
    if (!record || record.expiresAt < new Date()) {
      res.status(400).json({ error: 'Code expiré ou introuvable. Demandez un nouveau code.' })
      return
    }
    if (record.attempts >= MAX_ATTEMPTS) {
      res.status(429).json({ error: 'Trop de tentatives. Demandez un nouveau code.' })
      return
    }
    if (hashCode(code) !== record.codeHash) {
      await prisma.emailVerification.update({
        where: { id: record.id },
        data: { attempts: { increment: 1 } },
      })
      res.status(400).json({ error: 'Code incorrect.' })
      return
    }

    const token = crypto.randomBytes(32).toString('hex')
    await prisma.emailVerification.update({
      where: { id: record.id },
      data: { verifiedAt: new Date(), token },
    })
    res.json({ token })
  } catch (err) {
    next(err)
  }
})

/** Sondé par la modale pendant qu'elle est ouverte : détecte une
 *  vérification faite via le lien cliqué dans l'email (autre onglet). */
router.get('/status', async (req, res, next) => {
  try {
    const email = typeof req.query.email === 'string' ? req.query.email.toLowerCase() : ''
    if (!email) {
      res.status(400).json({ error: 'Email requis.' })
      return
    }
    const record = await prisma.emailVerification.findFirst({
      where: { email },
      orderBy: { createdAt: 'desc' },
    })
    if (!record || !record.verifiedAt || !record.token) {
      res.json({ verified: false })
      return
    }
    res.json({ verified: true, token: record.token })
  } catch (err) {
    next(err)
  }
})

router.get('/confirm', async (req, res, next) => {
  try {
    const id = verifyConfirmToken(typeof req.query.token === 'string' ? req.query.token : '')
    if (!id) {
      res.status(400).json({ error: 'Lien invalide.' })
      return
    }
    const record = await prisma.emailVerification.findUnique({ where: { id } })
    if (!record || record.expiresAt < new Date()) {
      res.status(400).json({ error: 'Lien expiré. Retournez à l’inscription pour redemander un code.' })
      return
    }
    if (!record.verifiedAt || !record.token) {
      await prisma.emailVerification.update({
        where: { id },
        data: { verifiedAt: new Date(), token: crypto.randomBytes(32).toString('hex') },
      })
    }
    res.json({ ok: true, email: record.email })
  } catch (err) {
    next(err)
  }
})

export default router
