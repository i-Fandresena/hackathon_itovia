import { Router } from 'express'
import bcrypt from 'bcryptjs'
import rateLimit from 'express-rate-limit'
import multer from 'multer'
// Import direct du sous-module : le point d'entrée `pdf-parse` exécute du
// code de debug qui tente de lire un fichier de test au chargement quand
// `module.parent` est indéfini (cas de l'interop CJS/ESM via tsx).
import pdfParse from 'pdf-parse/lib/pdf-parse.js'
import { randomUUID } from 'node:crypto'
import { writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { prisma } from '../lib/prisma.js'
import { signSession } from '../lib/jwt.js'
import { requireAuth } from '../middleware/auth.js'
import { candidateProfileSchema, loginSchema, registerSchema } from '../lib/validation.js'
import { requireRole } from '../middleware/rbac.js'
import { serializeUser } from '../lib/serialize.js'
import { COMMON_SKILLS } from '../../../src/data/constants.js'

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype !== 'application/pdf') {
      cb(new Error('Seuls les fichiers PDF sont acceptés.'))
      return
    }
    cb(null, true)
  },
})

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
  agentProfile: true,
  talentAccountProfile: true,
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
    const email = body.email.toLowerCase()

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      res.status(409).json({ error: 'Un compte existe déjà avec cet email.' })
      return
    }

    // Aucun compte n'est créé sans email vérifié — jamais de compte "en
    // attente de confirmation" laissé en base.
    const verification = await prisma.emailVerification.findUnique({
      where: { token: body.verificationToken },
    })
    if (!verification || verification.email !== email || !verification.verifiedAt) {
      res.status(400).json({ error: 'Vérification email invalide ou expirée. Recommencez.' })
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
    if (body.role === 'talent' && !body.talentAccountProfile) {
      res.status(400).json({ error: 'Profil requis.' })
      return
    }

    const passwordHash = await bcrypt.hash(body.password, 12)

    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email,
          passwordHash,
          role: body.role,
          candidateProfile: body.candidateProfile ? { create: body.candidateProfile } : undefined,
          recruiterProfile: body.recruiterProfile ? { create: body.recruiterProfile } : undefined,
          individualProfile: body.individualProfile ? { create: body.individualProfile } : undefined,
          talentAccountProfile: body.talentAccountProfile ? { create: body.talentAccountProfile } : undefined,
        },
        include: USER_INCLUDE,
      })
      // Token à usage unique : une fois le compte créé, il ne doit plus
      // pouvoir servir à en créer un autre.
      await tx.emailVerification.delete({ where: { id: verification.id } })
      return created
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

/**
 * Dépôt de CV (MVP §4.2 du cahier des charges) : extraction texte simple +
 * reconnaissance de mots-clés contre le vocabulaire de compétences existant
 * — pas de matching sémantique IA (hors périmètre MVP). Les compétences
 * suggérées ne sont jamais appliquées automatiquement au profil : le
 * candidat les confirme dans l'UI (§7.3 règle 19, additif jamais décisionnaire).
 */
router.post('/profile/candidate/cv', requireRole('candidate'), upload.single('cv'), async (req, res, next) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'Fichier PDF requis.' })
      return
    }

    const uploadsDir = path.resolve(process.cwd(), 'uploads', 'cv')
    await mkdir(uploadsDir, { recursive: true })
    const fileName = `${randomUUID()}.pdf`
    await writeFile(path.join(uploadsDir, fileName), req.file.buffer)
    const cvUrl = `/uploads/cv/${fileName}`

    let extractedText = ''
    try {
      const parsed = await pdfParse(req.file.buffer)
      extractedText = parsed.text.toLowerCase()
    } catch {
      extractedText = ''
    }
    const suggestedSkills = COMMON_SKILLS.filter((skill) =>
      extractedText.includes(skill.toLowerCase()),
    )

    await prisma.candidateProfile.update({
      where: { userId: req.session!.sub },
      data: { cvUrl, cvSkillsSuggested: suggestedSkills },
    })

    res.json({ cvUrl, suggestedSkills })
  } catch (err) {
    next(err)
  }
})

export default router
