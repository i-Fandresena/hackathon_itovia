import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { requireCvVerifier } from '../middleware/rbac.js'
import { cvQueueQuerySchema, cvVerificationDecisionSchema } from '../lib/validation.js'
import { parseCvFlags } from '../lib/cv-flags.js'
import { cvVerifierName, cvVerifierSelect } from '../lib/admin-candidates.js'
import { actorLabel, clip, scheduleAdminNotification } from '../lib/notify.js'
import { scheduleCandidateMatching } from '../lib/matching.js'

/**
 * Vérification humaine des CV candidats. Les drapeaux automatiques
 * (`cvFlags`) ne sont qu'une aide à la lecture : la décision `verifie` /
 * `rejete` est toujours prise ici, par un admin ou un rôle que l'admin a
 * habilité (`CvVerifierRole`). Chaque décision est ajoutée à l'historique
 * `CvVerification`, jamais écrasée.
 */
const router = Router()

router.use(requireCvVerifier)

router.get('/queue', async (req, res, next) => {
  try {
    const { status } = cvQueueQuerySchema.parse(req.query)
    const profiles = await prisma.candidateProfile.findMany({
      where: { cvUrl: { not: null }, cvVerificationStatus: status },
      select: {
        userId: true,
        fullName: true,
        cvUrl: true,
        cvFlags: true,
        cvVerificationStatus: true,
        cvAttestedAt: true,
        cvExtractionDate: true,
        user: {
          select: {
            email: true,
            cvSubmissions: { orderBy: { createdAt: 'desc' }, take: 1, select: { createdAt: true } },
          },
        },
      },
    })

    const candidates = profiles
      .map((p) => {
        // CV déposés avant l'historique `CvSubmission` : on retombe sur la date d'extraction.
        const submittedAt = p.user.cvSubmissions[0]?.createdAt ?? p.cvAttestedAt ?? p.cvExtractionDate
        return {
          candidateId: p.userId,
          fullName: p.fullName,
          email: p.user.email,
          cvUrl: p.cvUrl,
          submittedAt: submittedAt ? submittedAt.toISOString() : null,
          verificationStatus: p.cvVerificationStatus,
          flags: parseCvFlags(p.cvFlags),
        }
      })
      // Les plus anciens d'abord : file d'attente.
      .sort((a, b) => (a.submittedAt ?? '').localeCompare(b.submittedAt ?? ''))

    res.json({ candidates })
  } catch (err) {
    next(err)
  }
})

router.get('/candidates/:id', async (req, res, next) => {
  try {
    const profile = await prisma.candidateProfile.findUnique({
      where: { userId: req.params.id },
      select: {
        userId: true,
        fullName: true,
        phone: true,
        province: true,
        city: true,
        educationLevel: true,
        experienceLevel: true,
        skills: true,
        cvUrl: true,
        cvProfessionalTitle: true,
        cvExperiences: true,
        cvEducation: true,
        cvCertifications: true,
        cvYearsOfExperience: true,
        cvFlags: true,
        cvVerificationStatus: true,
        cvVerifiedAt: true,
        cvVerificationNote: true,
        user: {
          select: {
            email: true,
            cvVerifications: {
              orderBy: { createdAt: 'desc' },
              select: {
                decision: true,
                note: true,
                createdAt: true,
                // `select` explicite : jamais de `passwordHash` ni d'email du vérificateur.
                verifier: { select: cvVerifierSelect },
              },
            },
          },
        },
      },
    })
    if (!profile) {
      res.status(404).json({ error: 'Candidat introuvable.' })
      return
    }

    res.json({
      candidate: {
        candidateId: profile.userId,
        fullName: profile.fullName,
        email: profile.user.email,
        phone: profile.phone,
        province: profile.province,
        city: profile.city,
        educationLevel: profile.educationLevel,
        experienceLevel: profile.experienceLevel,
        skills: profile.skills,
        cvUrl: profile.cvUrl,
        cvProfessionalTitle: profile.cvProfessionalTitle,
        cvExperiences: profile.cvExperiences ?? [],
        cvEducation: profile.cvEducation ?? [],
        cvCertifications: profile.cvCertifications ?? [],
        cvYearsOfExperience: profile.cvYearsOfExperience,
        flags: parseCvFlags(profile.cvFlags),
        verificationStatus: profile.cvVerificationStatus,
        verifiedAt: profile.cvVerifiedAt ? profile.cvVerifiedAt.toISOString() : null,
        verificationNote: profile.cvVerificationNote,
        history: profile.user.cvVerifications.map((v) => ({
          decision: v.decision,
          note: v.note,
          // `verifier` est nul si son compte a été supprimé : la décision reste dans l'historique.
          verifierName: cvVerifierName(v.verifier),
          createdAt: v.createdAt.toISOString(),
        })),
      },
    })
  } catch (err) {
    next(err)
  }
})

router.post('/candidates/:id/decision', async (req, res, next) => {
  try {
    const body = cvVerificationDecisionSchema.parse(req.body)
    const candidateId = req.params.id
    const verifierId = req.session!.sub

    if (candidateId === verifierId) {
      res.status(403).json({ error: 'Vous ne pouvez pas vérifier votre propre CV.' })
      return
    }

    const profile = await prisma.candidateProfile.findUnique({
      where: { userId: candidateId },
      select: { cvUrl: true },
    })
    if (!profile) {
      res.status(404).json({ error: 'Candidat introuvable.' })
      return
    }
    if (!profile.cvUrl) {
      res.status(400).json({ error: 'Ce candidat n’a déposé aucun CV à vérifier.' })
      return
    }
    // La décision porte sur le fichier que le vérificateur a lu : si le
    // candidat en a déposé un autre entre-temps, elle ne doit pas s'y appliquer.
    if (body.cvUrl && body.cvUrl !== profile.cvUrl) {
      res.status(409).json({
        error: 'Le candidat a déposé un nouveau CV depuis l’ouverture de cette fiche. Rechargez-la avant de décider.',
      })
      return
    }

    const note = body.note && body.note.length > 0 ? body.note : null
    const now = new Date()

    await prisma.$transaction([
      prisma.cvVerification.create({
        data: { candidateId, verifierId, decision: body.decision, note },
      }),
      prisma.candidateProfile.update({
        where: { userId: candidateId },
        data: {
          cvVerificationStatus: body.decision,
          cvVerifiedAt: now,
          cvVerifiedById: verifierId,
          cvVerificationNote: note,
        },
      }),
      prisma.auditLog.create({
        data: {
          userId: verifierId,
          action: 'cv_verification',
          metadata: { candidateId, decision: body.decision, cvUrl: profile.cvUrl },
        },
      }),
      prisma.notification.create({
        data: {
          userId: candidateId,
          title: body.decision === 'verifie' ? 'CV vérifié' : 'CV non validé',
          message:
            body.decision === 'verifie'
              ? 'Votre CV a été vérifié par OffRec.'
              : `Votre CV n’a pas été validé. Vous pouvez en déposer un nouveau depuis votre profil. Motif : ${note}`,
          link: '/candidat/profil',
        },
      }),
    ])

    res.json({ verificationStatus: body.decision })
    // Vérification déléguée (rôle habilité par l'admin) : les admins en sont
    // informés. Une décision prise par un admin n'est pas notifiée — c'est
    // déjà une action d'admin, tracée dans le journal d'audit.
    if (req.session!.role !== 'admin') {
      const verifierRole = req.session!.role
      scheduleAdminNotification(async () => {
        const candidate = await prisma.candidateProfile.findUnique({
          where: { userId: candidateId },
          select: { fullName: true },
        })
        return {
          event: 'cv_verification_delegated',
          category: verifierRole === 'agent' ? 'agent' : 'annuaire',
          title: body.decision === 'verifie' ? 'CV vérifié par un vérificateur habilité' : 'CV rejeté par un vérificateur habilité',
          message:
            `${await actorLabel(verifierId)} a ${body.decision === 'verifie' ? 'vérifié' : 'rejeté'} le CV de ` +
            `${clip(candidate?.fullName, 60) || 'un candidat'}.`,
          link: '/verification-cv',
        }
      })
    }
    // Un CV vérifié ouvre l'envoi direct au recruteur : les suggestions encore
    // en file dont le score atteint le seuil haut peuvent être promues.
    if (body.decision === 'verifie') {
      scheduleCandidateMatching(candidateId, 'cv_verified')
    }
  } catch (err) {
    next(err)
  }
})

export default router
