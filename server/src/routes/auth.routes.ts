import { Router } from 'express'
import bcrypt from 'bcryptjs'
import rateLimit from 'express-rate-limit'
import { prisma } from '../lib/prisma.js'
import { signSession } from '../lib/jwt.js'
import { requireAuth } from '../middleware/auth.js'
import { candidateProfileSchema, loginSchema, registerSchema } from '../lib/validation.js'
import { requireRole } from '../middleware/rbac.js'
import { serializeUser } from '../lib/serialize.js'

const router = Router()

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
})

const USER_INCLUDE = {
  candidateProfile: true,
  recruiterProfile: true,
  individualProfile: true,
  member: true,
} as const

function setSessionCookie(res: import('express').Response, token: string): void {
  res.cookie(process.env.COOKIE_NAME ?? 'offrec_session', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  })
}

router.post('/register', authLimiter, async (req, res, next) => {
  try {
    const body = registerSchema.parse(req.body)

    const existing = await prisma.user.findUnique({ where: { email: body.email.toLowerCase() } })
    if (existing) {
      res.status(409).json({ error: 'Un compte existe déjà avec cet email.' })
      return
    }

    if (body.role === 'candidate' && !body.candidateProfile) {
      res.status(400).json({ error: 'Profil candidat requis.' })
      return
    }
    if (body.role === 'recruiter' && !body.recruiterProfile) {
      res.status(400).json({ error: 'Profil recruteur requis.' })
      return
    }
    if (body.role === 'particulier' && !body.individualProfile) {
      res.status(400).json({ error: 'Profil particulier requis.' })
      return
    }

    const passwordHash = await bcrypt.hash(body.password, 12)

    const user = await prisma.user.create({
      data: {
        email: body.email.toLowerCase(),
        passwordHash,
        role: body.role,
        candidateProfile: body.candidateProfile ? { create: body.candidateProfile } : undefined,
        recruiterProfile: body.recruiterProfile ? { create: body.recruiterProfile } : undefined,
        individualProfile: body.individualProfile ? { create: body.individualProfile } : undefined,
      },
      include: USER_INCLUDE,
    })

    await prisma.auditLog.create({
      data: { userId: user.id, action: 'register', metadata: { role: user.role } },
    })

    const token = signSession({ sub: user.id, role: user.role })
    setSessionCookie(res, token)
    res.status(201).json({ user: serializeUser(user) })
  } catch (err) {
    next(err)
  }
})

router.post('/login', authLimiter, async (req, res, next) => {
  try {
    const body = loginSchema.parse(req.body)
    const user = await prisma.user.findUnique({
      where: { email: body.email.toLowerCase() },
      include: USER_INCLUDE,
    })
    if (!user) {
      res.status(401).json({ error: 'Identifiants invalides.' })
      return
    }
    const valid = await bcrypt.compare(body.password, user.passwordHash)
    if (!valid) {
      res.status(401).json({ error: 'Identifiants invalides.' })
      return
    }
    if (user.status === 'suspended' || user.status === 'banned') {
      res.status(403).json({ error: 'Ce compte a été suspendu ou banni.' })
      return
    }

    await prisma.auditLog.create({ data: { userId: user.id, action: 'login' } })

    const token = signSession({ sub: user.id, role: user.role })
    setSessionCookie(res, token)
    res.json({ user: serializeUser(user) })
  } catch (err) {
    next(err)
  }
})

router.post('/logout', requireAuth, async (req, res, next) => {
  try {
    if (req.session) {
      await prisma.auditLog.create({ data: { userId: req.session.sub, action: 'logout' } })
    }
    res.clearCookie(process.env.COOKIE_NAME ?? 'offrec_session')
    res.status(204).end()
  } catch (err) {
    next(err)
  }
})

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.session!.sub },
      include: USER_INCLUDE,
    })
    if (!user) {
      res.status(401).json({ error: 'Session invalide.' })
      return
    }
    res.json({ user: serializeUser(user) })
  } catch (err) {
    next(err)
  }
})

router.put('/profile/candidate', requireRole('candidate'), async (req, res, next) => {
  try {
    const body = candidateProfileSchema.parse(req.body)
    const profile = await prisma.candidateProfile.upsert({
      where: { userId: req.session!.sub },
      create: { userId: req.session!.sub, ...body },
      update: body,
    })
    res.json({ candidateProfile: profile })
  } catch (err) {
    next(err)
  }
})

export default router
