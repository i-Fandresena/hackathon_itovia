import { Router } from 'express'
import type { NextFunction, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import rateLimit from 'express-rate-limit'
import multer from 'multer'
// Import direct du sous-module : le point d'entrée `pdf-parse` exécute du
// code de debug qui tente de lire un fichier de test au chargement quand
// `module.parent` est indéfini (cas de l'interop CJS/ESM via tsx).
import pdfParse from 'pdf-parse/lib/pdf-parse.js'
import { Prisma } from '@prisma/client'
import { createHash, randomUUID } from 'node:crypto'
import { writeFile, mkdir, unlink } from 'node:fs/promises'
import path from 'node:path'
import { prisma } from '../lib/prisma.js'
import { signSession } from '../lib/jwt.js'
import { requireAuth } from '../middleware/auth.js'
import { candidateProfileSchema, loginSchema, registerSchema } from '../lib/validation.js'
import { requireRole } from '../middleware/rbac.js'
import { serializeOwnCandidateProfile, serializeUser } from '../lib/serialize.js'
import { canVerifyCv } from '../lib/cv-access.js'
import { checkCvName, computeCvFlags } from '../lib/cv-flags.js'
import { extractCVDataWithAI, calculateYearsOfExperience } from '../lib/cv-extraction.js'
import { COMMON_SKILLS } from '../../../src/data/constants.js'
import { scheduleCandidateMatching } from '../lib/matching.js'

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

const uploadCvFile = upload.single('cv')

/** Erreurs multer (taille, type, champ inattendu) → 400 en français plutôt qu'un 500. */
function handleCvUpload(req: Request, res: Response, next: NextFunction): void {
  uploadCvFile(req, res, (err: unknown) => {
    if (!err) {
      next()
      return
    }
    if (err instanceof multer.MulterError) {
      res.status(400).json({
        error:
          err.code === 'LIMIT_FILE_SIZE'
            ? 'Le fichier dépasse la taille maximale de 5 Mo.'
            : 'Fichier invalide : envoyez un seul PDF dans le champ « cv ».',
      })
      return
    }
    res.status(400).json({ error: 'Seuls les fichiers PDF sont acceptés.' })
  })
}

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

type UserWithProfiles = Prisma.UserGetPayload<{ include: typeof USER_INCLUDE }>

/** Utilisateur renvoyé au client : jamais de `passwordHash`, toujours `canVerifyCv`. */
async function toClientUser(user: UserWithProfiles) {
  return serializeUser(user, { canVerifyCv: await canVerifyCv(user.role) })
}

function setSessionCookie(res: Response, token: string): void {
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
    res.status(201).json({ user: await toClientUser(user) })
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
    res.json({ user: await toClientUser(user) })
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
    res.json({ user: await toClientUser(user) })
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
    res.json({ candidateProfile: serializeOwnCandidateProfile(profile) })
    // Le matching se calcule sur le profil confirmé : on le relance après la réponse.
    scheduleCandidateMatching(req.session!.sub, 'profile_update')
  } catch (err) {
    next(err)
  }
})

/**
 * Consentement global de matching (décision produit 2026-10-08) : le candidat
 * ne postule plus offre par offre, il accepte une fois qu'OffRec propose son
 * profil aux entreprises. Horodaté, révocable, revérifié côté serveur avant
 * toute transmission à un recruteur. Idempotent : redonner un consentement
 * déjà actif conserve sa date d'origine.
 */
router.post('/profile/candidate/matching-consent', requireRole('candidate'), async (req, res, next) => {
  try {
    const userId = req.session!.sub
    const current = await prisma.candidateProfile.findUnique({ where: { userId } })
    if (!current) {
      res.status(404).json({ error: 'Profil candidat introuvable.' })
      return
    }
    if (current.matchingConsentAt) {
      res.json({ candidateProfile: serializeOwnCandidateProfile(current) })
      return
    }
    const [profile] = await prisma.$transaction([
      prisma.candidateProfile.update({ where: { userId }, data: { matchingConsentAt: new Date() } }),
      prisma.auditLog.create({
        data: { userId, action: 'matching_consent_given', metadata: { source: 'profile' } },
      }),
    ])
    res.json({ candidateProfile: serializeOwnCandidateProfile(profile) })
    scheduleCandidateMatching(userId, 'consent_given')
  } catch (err) {
    next(err)
  }
})

/**
 * Retrait du consentement : plus aucune nouvelle proposition, et les
 * suggestions encore en file de validation (`suggeree`) sont écartées. Les
 * dossiers déjà transmis à un recruteur ne sont PAS retirés automatiquement :
 * le candidat s'en retire un par un (`POST /match-suggestions/:id/decline`).
 */
router.delete('/profile/candidate/matching-consent', requireRole('candidate'), async (req, res, next) => {
  try {
    const userId = req.session!.sub
    const current = await prisma.candidateProfile.findUnique({ where: { userId } })
    if (!current) {
      res.status(404).json({ error: 'Profil candidat introuvable.' })
      return
    }
    const [profile, withdrawn] = await prisma.$transaction([
      prisma.candidateProfile.update({ where: { userId }, data: { matchingConsentAt: null } }),
      prisma.matchSuggestion.updateMany({
        where: { candidateId: userId, status: 'suggeree' },
        data: { status: 'ecartee' },
      }),
    ])
    if (current.matchingConsentAt) {
      await prisma.auditLog.create({
        data: { userId, action: 'matching_consent_withdrawn', metadata: { withdrawnSuggestions: withdrawn.count } },
      })
    }
    res.json({ candidateProfile: serializeOwnCandidateProfile(profile), withdrawnSuggestions: withdrawn.count })
  } catch (err) {
    next(err)
  }
})

/**
 * Dépôt de CV (MVP §4.2 du cahier des charges) : extraction structurée avec
 * Gemini API (info personnelle, expériences, formation, compétences, langues,
 * projets, certifications). Les données extraites ne sont jamais appliquées
 * automatiquement au profil : le candidat les confirme dans l'UI (§7.3 règle
 * 19, additif jamais décisionnaire).
 *
 * Lutte contre les faux CV :
 * - attestation sur l'honneur obligatoire (champ multipart `attestation=true`) ;
 * - identité graduée : un nom incompatible avec le profil rejette le dépôt,
 *   un email ou un téléphone différent n'est qu'un drapeau ;
 * - contrôles automatiques (`lib/cv-flags.ts`) : ils ne produisent que des
 *   drapeaux, jamais un rejet ni une sanction ;
 * - la décision appartient à une personne (`cv-verification.routes.ts`) :
 *   tout nouveau dépôt repasse à `non_verifie`.
 *
 * Le fichier n'est écrit sur disque qu'une fois les validations bloquantes
 * passées ; il n'est servi que par la route authentifiée `/uploads/cv/:file`.
 *
 * Consentement de matching : le champ multipart optionnel
 * `matchingConsent=true` (case cochée au dépôt) pose `matchingConsentAt` s'il
 * ne l'est pas déjà. Son absence ne retire JAMAIS un consentement existant —
 * le retrait passe uniquement par `DELETE /profile/candidate/matching-consent`.
 * Le dépôt relance ensuite le matching, qui reste calculé sur le profil
 * confirmé et non sur les données extraites du CV.
 */
router.post('/profile/candidate/cv', requireRole('candidate'), handleCvUpload, async (req, res, next) => {
  try {
    const userId = req.session!.sub

    if (!req.file) {
      res.status(400).json({ error: 'Fichier PDF requis.' })
      return
    }

    if (req.body?.attestation !== 'true') {
      res.status(400).json({
        error:
          'Vous devez attester sur l’honneur que ce CV est le vôtre et que les informations qu’il contient sont exactes.',
      })
      return
    }

    // Le type MIME est déclaré par le client : on vérifie aussi la signature du fichier.
    if (!req.file.buffer.subarray(0, 1024).includes('%PDF-')) {
      res.status(400).json({ error: 'Le fichier envoyé n’est pas un PDF valide.' })
      return
    }

    const currentProfile = await prisma.candidateProfile.findUnique({
      where: { userId },
      include: { user: { select: { email: true } } },
    })

    if (!currentProfile) {
      res.status(404).json({ error: 'Profil candidat introuvable.' })
      return
    }

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

    // Extraire les données structurées avec Gemini (peut renvoyer null : l'IA
    // est additive, le dépôt reste possible sans elle).
    const extractedData = await extractCVDataWithAI(extractedText)
    if (!extractedData) {
      console.warn('CV extraction with AI failed for user', userId)
    }

    // Seule validation d'identité bloquante : le nom.
    if (extractedData) {
      const nameError = checkCvName(extractedData.candidateInfo, currentProfile.fullName)
      if (nameError) {
        res.status(400).json({
          error: 'Le CV ne correspond pas à votre profil.',
          validationErrors: [nameError],
          message:
            'Le nom figurant sur le CV doit correspondre à celui de votre profil. Veuillez vérifier que le CV téléversé est bien le vôtre.',
        })
        return
      }
    }

    // Contrôles non décisionnels : doublon de fichier entre comptes + cohérence.
    const now = new Date()
    const fileHash = createHash('sha256').update(req.file.buffer).digest('hex')
    const duplicate = await prisma.cvSubmission.findFirst({
      where: { fileHash, candidateId: { not: userId } },
      select: { id: true },
    })
    const flags = computeCvFlags({
      extracted: extractedData,
      profile: {
        email: currentProfile.user.email,
        phone: currentProfile.phone,
        experienceLevel: currentProfile.experienceLevel,
        educationLevel: currentProfile.educationLevel,
      },
      duplicateFile: Boolean(duplicate),
      now,
    })
    const flagsJson = flags as unknown as Prisma.InputJsonValue

    const yearsOfExp = extractedData
      ? (extractedData.yearsOfExperience ?? calculateYearsOfExperience(extractedData.experiences))
      : null
    const allSkills = Array.from(new Set([...(extractedData?.skills ?? []), ...suggestedSkillsSimple]))

    // Toutes les validations bloquantes sont passées : on peut écrire le fichier.
    const uploadsDir = path.resolve(process.cwd(), 'uploads', 'cv')
    await mkdir(uploadsDir, { recursive: true })
    const fileName = `${randomUUID()}.pdf`
    const filePath = path.join(uploadsDir, fileName)
    await writeFile(filePath, req.file.buffer)
    const cvUrl = `/uploads/cv/${fileName}`
    const grantsConsent = req.body?.matchingConsent === 'true' && !currentProfile.matchingConsentAt
    const matchingConsentAt = grantsConsent ? now : currentProfile.matchingConsentAt

    // Sans extraction IA, les données structurées d'un ancien CV sont vidées :
    // elles ne décrivent plus le fichier déposé et tromperaient le vérificateur.
    const extractionFields: Prisma.CandidateProfileUpdateInput = extractedData
      ? {
          cvExtractedInfo: extractedData.candidateInfo as unknown as Prisma.InputJsonValue,
          cvProfessionalTitle: extractedData.professionalTitle,
          cvProfessionalSummary: extractedData.professionalSummary,
          cvExperiences: extractedData.experiences as unknown as Prisma.InputJsonValue,
          cvEducation: extractedData.education as unknown as Prisma.InputJsonValue,
          cvCertifications: extractedData.certifications as unknown as Prisma.InputJsonValue,
          cvProjects: extractedData.projects as unknown as Prisma.InputJsonValue,
          cvLanguages: extractedData.languages as unknown as Prisma.InputJsonValue,
          cvTechnologies: extractedData.technologies,
          cvYearsOfExperience: yearsOfExp,
          cvDesiredLocations: extractedData.desiredLocations,
          cvAvailability: extractedData.availability,
          cvExtractionConfidence: extractedData.extractionConfidence,
          cvExtractionDate: new Date(extractedData.extractionDate),
        }
      : {
          cvExtractedInfo: Prisma.DbNull,
          cvProfessionalTitle: null,
          cvProfessionalSummary: null,
          cvExperiences: Prisma.DbNull,
          cvEducation: Prisma.DbNull,
          cvCertifications: Prisma.DbNull,
          cvProjects: Prisma.DbNull,
          cvLanguages: Prisma.DbNull,
          cvTechnologies: [],
          cvYearsOfExperience: null,
          cvDesiredLocations: [],
          cvAvailability: null,
          cvExtractionConfidence: 'low',
          cvExtractionDate: now,
        }

    try {
      await prisma.$transaction([
        prisma.candidateProfile.update({
          where: { userId },
          data: {
            ...extractionFields,
            cvUrl,
            cvSkillsSuggested: allSkills,
            cvFileHash: fileHash,
            cvAttestedAt: now,
            cvFlags: flagsJson,
            // Un nouveau fichier n'hérite jamais de la vérification du précédent.
            cvVerificationStatus: 'non_verifie',
            cvVerifiedAt: null,
            cvVerifiedById: null,
            cvVerificationNote: null,
            ...(grantsConsent ? { matchingConsentAt: now } : {}),
          },
        }),
        prisma.cvSubmission.create({
          data: { candidateId: userId, fileUrl: cvUrl, fileHash, flags: flagsJson, attestedAt: now },
        }),
        prisma.auditLog.create({
          data: {
            userId,
            action: 'cv_upload',
            metadata: { fileUrl: cvUrl, fileHash, flagCodes: flags.map((f) => f.code) },
          },
        }),
        ...(grantsConsent
          ? [
              prisma.auditLog.create({
                data: { userId, action: 'matching_consent_given', metadata: { source: 'cv_upload' } },
              }),
            ]
          : []),
      ])
    } catch (err) {
      // Pas de fichier orphelin si l'enregistrement en base échoue.
      await unlink(filePath).catch(() => undefined)
      throw err
    }

    res.json({
      cvUrl,
      suggestedSkills: allSkills,
      extractedData: extractedData
        ? {
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
          }
        : {},
      validationWarnings: flags.map((f) => f.message),
      flags,
      verificationStatus: 'non_verifie',
      matchingConsentAt: matchingConsentAt ? matchingConsentAt.toISOString() : null,
    })
    scheduleCandidateMatching(userId, 'cv_upload')
  } catch (err) {
    next(err)
  }
})

export default router
