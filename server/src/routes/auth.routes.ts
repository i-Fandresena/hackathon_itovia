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
import { extractCVDataWithAI, calculateYearsOfExperience } from '../lib/cv-extraction.js'
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
 * Dépôt de CV (MVP §4.2 du cahier des charges) : extraction structurée avec
 * Gemini API pour extraire toutes les données pertinentes (info personnelle,
 * expériences, formation, compétences, langues, projets, certifications).
 * Les données extraites ne sont jamais appliquées automatiquement au profil :
 * le candidat les confirme dans l'UI (§7.3 règle 19, additif jamais décisionnaire).
 * 
 * VALIDATION : Les données personnelles du CV doivent correspondre au profil
 * du candidat connecté (nom, email, téléphone). Si incohérence, le CV est rejeté.
 */
router.post('/profile/candidate/cv', requireRole('candidate'), upload.single('cv'), async (req, res, next) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'Fichier PDF requis.' })
      return
    }

    // Récupérer le profil candidat actuel
    const currentProfile = await prisma.candidateProfile.findUnique({
      where: { userId: req.session!.sub },
      include: { user: { select: { email: true } } },
    })

    if (!currentProfile) {
      res.status(404).json({ error: 'Profil candidat introuvable.' })
      return
    }

    const uploadsDir = path.resolve(process.cwd(), 'uploads', 'cv')
    await mkdir(uploadsDir, { recursive: true })
    const fileName = `${randomUUID()}.pdf`
    await writeFile(path.join(uploadsDir, fileName), req.file.buffer)
    const cvUrl = `/uploads/cv/${fileName}`

    // Extraire le texte du PDF
    let extractedText = ''
    try {
      const parsed = await pdfParse(req.file.buffer)
      extractedText = parsed.text
    } catch {
      extractedText = ''
    }

    if (!extractedText || extractedText.trim().length === 0) {
      res.status(400).json({ error: 'Impossible d\'extraire le texte du PDF. Vérifiez que le fichier est valide.' })
      return
    }

    // Extraire les compétences simples (méthode legacy pour rapidité)
    const suggestedSkillsSimple = COMMON_SKILLS.filter((skill) =>
      extractedText.toLowerCase().includes(skill.toLowerCase()),
    )

    // Extraire les données structurées avec Gemini
    const extractedData = await extractCVDataWithAI(extractedText)

    if (!extractedData) {
      // L'extraction IA a échoué, on retourne quand même le CV avec extraction simple
      console.warn('CV extraction with AI failed for user', req.session!.sub)
      await prisma.candidateProfile.update({
        where: { userId: req.session!.sub },
        data: {
          cvUrl,
          cvSkillsSuggested: suggestedSkillsSimple,
          cvExtractionConfidence: 'low',
          cvExtractionDate: new Date(),
        },
      })
      res.json({
        cvUrl,
        suggestedSkills: suggestedSkillsSimple,
        extractedData: {},
        validationWarnings: ['Extraction IA indisponible, compétences basiques extraites uniquement.'],
      })
      return
    }

    // VALIDATION : Vérifier que les données du CV correspondent au profil
    const validationErrors: string[] = []
    const cvInfo = extractedData.candidateInfo

    // Normaliser les chaînes pour comparaison (minuscules, trim, suppression accents)
    const normalize = (str: string | null | undefined): string => {
      if (!str) return ''
      return str
        .toLowerCase()
        .trim()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
    }

    // Vérifier le nom complet (fullName dans profil vs firstName + lastName dans CV)
    if (cvInfo.firstName || cvInfo.lastName) {
      const profileFullName = normalize(currentProfile.fullName)
      
      // Vérifier si le nom du profil contient le prénom ET le nom du CV
      const firstNameMatch = !cvInfo.firstName || profileFullName.includes(normalize(cvInfo.firstName))
      const lastNameMatch = !cvInfo.lastName || profileFullName.includes(normalize(cvInfo.lastName))
      
      if (!firstNameMatch || !lastNameMatch) {
        validationErrors.push(
          `Le nom dans le CV (${cvInfo.firstName || ''} ${cvInfo.lastName || ''}) ne correspond pas au nom du profil (${currentProfile.fullName}).`
        )
      }
    }

    // Vérifier l'email
    if (cvInfo.email) {
      const cvEmail = normalize(cvInfo.email)
      const profileEmail = normalize(currentProfile.user.email)
      
      if (cvEmail && cvEmail !== profileEmail) {
        validationErrors.push(
          `L'email dans le CV (${cvInfo.email}) ne correspond pas à l'email du profil (${currentProfile.user.email}).`
        )
      }
    }

    // Vérifier le téléphone (comparaison flexible)
    if (cvInfo.phone && currentProfile.phone) {
      // Extraire uniquement les chiffres pour comparaison
      const extractDigits = (phone: string): string => phone.replace(/\D/g, '')
      const cvPhoneDigits = extractDigits(cvInfo.phone)
      const profilePhoneDigits = extractDigits(currentProfile.phone)
      
      // Vérifier si les numéros sont identiques ou si l'un contient l'autre
      if (cvPhoneDigits && profilePhoneDigits) {
        const phoneMatch = 
          cvPhoneDigits === profilePhoneDigits ||
          cvPhoneDigits.includes(profilePhoneDigits) ||
          profilePhoneDigits.includes(cvPhoneDigits)
        
        if (!phoneMatch) {
          validationErrors.push(
            `Le téléphone dans le CV (${cvInfo.phone}) ne correspond pas au téléphone du profil (${currentProfile.phone}).`
          )
        }
      }
    }

    // Si des erreurs de validation sont détectées, rejeter le CV
    if (validationErrors.length > 0) {
      res.status(400).json({
        error: 'Le CV ne correspond pas à votre profil.',
        validationErrors,
        message: 'Les informations personnelles du CV doivent correspondre aux données de votre profil. Veuillez vérifier que le CV téléversé est bien le vôtre.',
      })
      return
    }

    // Calculer les années d'expérience si pas déjà calculé
    const yearsOfExp =
      extractedData.yearsOfExperience ?? calculateYearsOfExperience(extractedData.experiences)

    // Fusionner les compétences : AI + simple extraction
    const allSkills = new Set([
      ...extractedData.skills,
      ...suggestedSkillsSimple,
    ])

    // Mettre à jour le profil avec les données extraites
    await prisma.candidateProfile.update({
      where: { userId: req.session!.sub },
      data: {
        cvUrl,
        cvSkillsSuggested: Array.from(allSkills),
        cvExtractedInfo: extractedData.candidateInfo as any,
        cvProfessionalTitle: extractedData.professionalTitle,
        cvProfessionalSummary: extractedData.professionalSummary,
        cvExperiences: extractedData.experiences as any,
        cvEducation: extractedData.education as any,
        cvCertifications: extractedData.certifications as any,
        cvProjects: extractedData.projects as any,
        cvLanguages: extractedData.languages as any,
        cvTechnologies: extractedData.technologies,
        cvYearsOfExperience: yearsOfExp,
        cvDesiredLocations: extractedData.desiredLocations,
        cvAvailability: extractedData.availability,
        cvExtractionConfidence: extractedData.extractionConfidence,
        cvExtractionDate: new Date(extractedData.extractionDate),
      },
    })

    res.json({
      cvUrl,
      suggestedSkills: Array.from(allSkills),
      extractedData: {
        candidateInfo: extractedData.candidateInfo,
        professionalTitle: extractedData.professionalTitle,
        professionalSummary: extractedData.professionalSummary,
        experiences: extractedData.experiences,
        education: extractedData.education,
        certifications: extractedData.certifications,
        projects: extractedData.projects,
        languages: extractedData.languages,
        skills: extractedData.skills,
        technologies: extractedData.technologies,
        yearsOfExperience: yearsOfExp,
        availability: extractedData.availability,
        desiredLocations: extractedData.desiredLocations,
        extractionConfidence: extractedData.extractionConfidence,
      },
      validationWarnings: [],
    })
  } catch (err) {
    next(err)
  }
})

export default router
