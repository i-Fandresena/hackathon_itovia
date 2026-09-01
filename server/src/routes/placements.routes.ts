import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { requireRole } from '../middleware/rbac.js'
import { placementInputSchema, placementStageSchema } from '../lib/validation.js'

const router = Router()

router.post('/', requireRole('recruiter'), async (req, res, next) => {
  try {
    const body = placementInputSchema.parse(req.body)
    const placement = await prisma.placement.create({
      data: {
        recruiterId: req.session!.sub,
        opportunityId: body.opportunityId,
        candidateId: body.candidateId,
        talentId: body.talentId,
        monthlySalaryAr: body.monthlySalaryAr,
      },
    })
    res.status(201).json({ placement })
  } catch (err) {
    next(err)
  }
})

router.get('/mine', requireRole('recruiter'), async (req, res, next) => {
  try {
    const placements = await prisma.placement.findMany({
      where: { recruiterId: req.session!.sub },
      include: { opportunity: true, candidate: { include: { candidateProfile: true } }, talent: true },
      orderBy: { createdAt: 'desc' },
    })
    res.json({ placements })
  } catch (err) {
    next(err)
  }
})

router.put('/:id/stage', requireRole('recruiter', 'admin'), async (req, res, next) => {
  try {
    const placement = await prisma.placement.findUnique({ where: { id: req.params.id } })
    if (!placement) {
      res.status(404).json({ error: 'Placement introuvable.' })
      return
    }
    if (req.session!.role === 'recruiter' && placement.recruiterId !== req.session!.sub) {
      res.status(404).json({ error: 'Placement introuvable.' })
      return
    }
    const body = placementStageSchema.parse(req.body)
    const updated = await prisma.placement.update({
      where: { id: placement.id },
      data: { stage: body.stage },
    })
    res.json({ placement: updated })
  } catch (err) {
    next(err)
  }
})

router.get('/', requireRole('admin'), async (_req, res, next) => {
  try {
    const placements = await prisma.placement.findMany({
      include: {
        opportunity: true,
        recruiter: { include: { recruiterProfile: true } },
        candidate: { include: { candidateProfile: true } },
        talent: true,
      },
      orderBy: { createdAt: 'desc' },
    })
    res.json({ placements })
  } catch (err) {
    next(err)
  }
})

export default router
