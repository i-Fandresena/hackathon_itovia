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
      include: {
        opportunity: { select: { id: true, title: true, companyName: true } },
        // `select` explicite sur la relation — jamais `include: true`, qui
        // renverrait le User complet (passwordHash compris) au front.
        candidate: { select: { id: true, email: true, candidateProfile: { select: { fullName: true } } } },
        talent: { select: { id: true, fullName: true } },
      },
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
    // Le recruteur autodéclare ses propres étapes en continu — seule une
    // correction faite par un admin (donc sur le placement de quelqu'un
    // d'autre) est une décision à tracer, sur le même modèle que le reste
    // du suivi des décisions (voir admin-matching, match-suggestions).
    if (req.session!.role === 'admin') {
      await prisma.auditLog.create({
        data: {
          userId: req.session!.sub,
          action: 'admin_corrected_placement_stage',
          metadata: { placementId: placement.id, fromStage: placement.stage, toStage: body.stage },
        },
      })
    }
    res.json({ placement: updated })
  } catch (err) {
    next(err)
  }
})

router.get('/', requireRole('admin'), async (_req, res, next) => {
  try {
    const placements = await prisma.placement.findMany({
      include: {
        opportunity: { select: { id: true, title: true, companyName: true } },
        // `select` explicite sur chaque relation User — jamais `include: true`,
        // qui renverrait le compte complet (passwordHash compris) au front.
        recruiter: { select: { id: true, email: true, recruiterProfile: { select: { companyName: true } } } },
        candidate: { select: { id: true, email: true, candidateProfile: { select: { fullName: true } } } },
        talent: { select: { id: true, fullName: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
    res.json({ placements })
  } catch (err) {
    next(err)
  }
})

export default router
