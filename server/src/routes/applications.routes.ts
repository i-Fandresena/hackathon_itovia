import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { requireRole } from '../middleware/rbac.js'

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
        createdAt: a.createdAt.toISOString(),
        opportunityTitle: a.opportunity.title,
      })),
    })
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
