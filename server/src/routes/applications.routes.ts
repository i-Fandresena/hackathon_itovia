import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { requireRole } from '../middleware/rbac.js'
import { applicationStatusSchema } from '../lib/validation.js'

const router = Router()

router.get('/mine', requireRole('candidate'), async (req, res, next) => {
  try {
    const applications = await prisma.application.findMany({
      where: { candidateId: req.session!.sub },
      include: { opportunity: true },
      orderBy: { createdAt: 'desc' },
    })
    res.json({ applications })
  } catch (err) {
    next(err)
  }
})

router.get('/received', requireRole('recruiter'), async (req, res, next) => {
  try {
    const applications = await prisma.application.findMany({
      where: { opportunity: { recruiterId: req.session!.sub } },
      include: {
        opportunity: true,
        candidate: { include: { candidateProfile: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
    res.json({
      applications: applications.map((a) => ({
        id: a.id,
        opportunityId: a.opportunityId,
        candidateId: a.candidateId,
        candidateName: a.candidate.candidateProfile?.fullName ?? '',
        candidateEmail: a.candidate.email,
        candidatePhone: a.candidate.candidateProfile?.phone ?? '',
        candidateProvince: a.candidate.candidateProfile?.province ?? '',
        message: a.message ?? undefined,
        status: a.status,
        createdAt: a.createdAt.toISOString(),
        opportunityTitle: a.opportunity.title,
      })),
    })
  } catch (err) {
    next(err)
  }
})

router.put('/:id/status', requireRole('recruiter'), async (req, res, next) => {
  try {
    const application = await prisma.application.findUnique({
      where: { id: req.params.id },
      include: { opportunity: true },
    })
    if (!application || application.opportunity.recruiterId !== req.session!.sub) {
      res.status(404).json({ error: 'Candidature introuvable.' })
      return
    }
    const body = applicationStatusSchema.parse(req.body)
    const updated = await prisma.application.update({
      where: { id: application.id },
      data: { status: body.status },
    })
    await prisma.notification.create({
      data: {
        userId: application.candidateId,
        title: 'Candidature mise à jour',
        message: `Votre candidature pour « ${application.opportunity.title} » a été mise à jour.`,
      },
    })
    res.json({ application: updated })
  } catch (err) {
    next(err)
  }
})

router.get('/mine/bookmarks', requireRole('candidate'), async (req, res, next) => {
  try {
    const bookmarks = await prisma.bookmark.findMany({
      where: { candidateId: req.session!.sub },
      include: { opportunity: true },
    })
    res.json({ bookmarks })
  } catch (err) {
    next(err)
  }
})

export default router
