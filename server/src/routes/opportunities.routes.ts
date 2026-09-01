import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { requireRole } from '../middleware/rbac.js'
import { opportunityInputSchema } from '../lib/validation.js'
import { scoreOpportunity } from '../../../src/lib/recommendation.js'
import type { CandidateProfile } from '../../../src/types/index.js'
import { toDomainCandidateProfile, toDomainOpportunity } from '../lib/domain.js'

const router = Router()

router.get('/', async (req, res, next) => {
  try {
    const opportunities = await prisma.opportunity.findMany({ orderBy: { createdAt: 'desc' } })
    const domain = opportunities.map(toDomainOpportunity)

    let candidateProfile: CandidateProfile | undefined
    if (req.session?.role === 'candidate') {
      const profile = await prisma.candidateProfile.findUnique({ where: { userId: req.session.sub } })
      if (profile) {
        candidateProfile = toDomainCandidateProfile(profile)
      }
    }

    const results = domain.map((opportunity) => ({
      opportunity,
      match: candidateProfile ? scoreOpportunity(candidateProfile, opportunity) : null,
    }))

    res.json({ opportunities: results })
  } catch (err) {
    next(err)
  }
})

router.get('/mine', requireRole('recruiter'), async (req, res, next) => {
  try {
    const opportunities = await prisma.opportunity.findMany({
      where: { recruiterId: req.session!.sub },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { applications: true } } },
    })
    res.json({
      opportunities: opportunities.map((o) => ({
        ...toDomainOpportunity(o),
        applicationCount: o._count.applications,
      })),
    })
  } catch (err) {
    next(err)
  }
})

router.get('/:id', async (req, res, next) => {
  try {
    const opportunity = await prisma.opportunity.findUnique({ where: { id: req.params.id } })
    if (!opportunity) {
      res.status(404).json({ error: 'Offre introuvable.' })
      return
    }
    res.json({ opportunity: toDomainOpportunity(opportunity) })
  } catch (err) {
    next(err)
  }
})

router.post('/', requireRole('recruiter'), async (req, res, next) => {
  try {
    const body = opportunityInputSchema.parse(req.body)
    const recruiterProfile = await prisma.recruiterProfile.findUnique({
      where: { userId: req.session!.sub },
    })
    if (!recruiterProfile) {
      res.status(400).json({ error: 'Profil recruteur incomplet.' })
      return
    }
    const opportunity = await prisma.opportunity.create({
      data: {
        ...body,
        deadline: new Date(body.deadline),
        recruiterId: req.session!.sub,
        companyName: recruiterProfile.companyName,
      },
    })
    res.status(201).json({ opportunity: toDomainOpportunity(opportunity) })
  } catch (err) {
    next(err)
  }
})

router.put('/:id', requireRole('recruiter'), async (req, res, next) => {
  try {
    const existing = await prisma.opportunity.findUnique({ where: { id: req.params.id } })
    if (!existing || existing.recruiterId !== req.session!.sub) {
      res.status(404).json({ error: 'Offre introuvable.' })
      return
    }
    const body = opportunityInputSchema.parse(req.body)
    const opportunity = await prisma.opportunity.update({
      where: { id: req.params.id },
      data: { ...body, deadline: new Date(body.deadline) },
    })
    res.json({ opportunity: toDomainOpportunity(opportunity) })
  } catch (err) {
    next(err)
  }
})

router.delete('/:id', requireRole('recruiter'), async (req, res, next) => {
  try {
    const existing = await prisma.opportunity.findUnique({ where: { id: req.params.id } })
    if (!existing || existing.recruiterId !== req.session!.sub) {
      res.status(404).json({ error: 'Offre introuvable.' })
      return
    }
    await prisma.opportunity.delete({ where: { id: req.params.id } })
    res.status(204).end()
  } catch (err) {
    next(err)
  }
})

router.post('/:id/apply', requireRole('candidate'), async (req, res, next) => {
  try {
    const opportunity = await prisma.opportunity.findUnique({ where: { id: req.params.id } })
    if (!opportunity) {
      res.status(404).json({ error: 'Offre introuvable.' })
      return
    }
    const message = typeof req.body?.message === 'string' ? req.body.message.slice(0, 2000) : undefined

    const application = await prisma.application.create({
      data: { opportunityId: opportunity.id, candidateId: req.session!.sub, message },
    })

    await prisma.notification.create({
      data: {
        userId: opportunity.recruiterId,
        title: 'Nouvelle candidature',
        message: `Une nouvelle candidature a été reçue pour "${opportunity.title}".`,
      },
    })

    res.status(201).json({ application })
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'code' in err && err.code === 'P2002') {
      res.status(409).json({ error: 'Vous avez déjà postulé à cette offre.' })
      return
    }
    next(err)
  }
})

router.post('/:id/bookmark', requireRole('candidate'), async (req, res, next) => {
  try {
    await prisma.bookmark.upsert({
      where: {
        candidateId_opportunityId: { candidateId: req.session!.sub, opportunityId: req.params.id },
      },
      create: { candidateId: req.session!.sub, opportunityId: req.params.id },
      update: {},
    })
    res.status(201).end()
  } catch (err) {
    next(err)
  }
})

router.delete('/:id/bookmark', requireRole('candidate'), async (req, res, next) => {
  try {
    await prisma.bookmark
      .delete({
        where: {
          candidateId_opportunityId: { candidateId: req.session!.sub, opportunityId: req.params.id },
        },
      })
      .catch(() => undefined)
    res.status(204).end()
  } catch (err) {
    next(err)
  }
})

export default router
