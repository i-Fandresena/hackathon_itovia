import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { requireRole } from '../middleware/rbac.js'
import {
  talentProfileInputSchema,
  talentProposeSchema,
  talentVerificationInputSchema,
} from '../lib/validation.js'

const router = Router()

router.use(requireRole('agent'))

router.get('/talents', async (req, res, next) => {
  try {
    const talents = await prisma.talentProfile.findMany({
      where: { agentId: req.session!.sub },
      orderBy: { createdAt: 'desc' },
    })
    res.json({ talents })
  } catch (err) {
    next(err)
  }
})

router.get('/talents/:id', async (req, res, next) => {
  try {
    const talent = await prisma.talentProfile.findUnique({
      where: { id: req.params.id },
      include: {
        verifications: { orderBy: { verifiedAt: 'desc' } },
        proposals: { include: { opportunity: true }, orderBy: { proposedAt: 'desc' } },
      },
    })
    if (!talent || talent.agentId !== req.session!.sub) {
      res.status(404).json({ error: 'Talent introuvable.' })
      return
    }
    res.json({ talent })
  } catch (err) {
    next(err)
  }
})

router.post('/talents', async (req, res, next) => {
  try {
    const body = talentProfileInputSchema.parse(req.body)
    const talent = await prisma.talentProfile.create({
      data: { ...body, agentId: req.session!.sub },
    })
    res.status(201).json({ talent })
  } catch (err) {
    next(err)
  }
})

router.put('/talents/:id', async (req, res, next) => {
  try {
    const existing = await prisma.talentProfile.findUnique({ where: { id: req.params.id } })
    if (!existing || existing.agentId !== req.session!.sub) {
      res.status(404).json({ error: 'Talent introuvable.' })
      return
    }
    const body = talentProfileInputSchema.parse(req.body)
    const talent = await prisma.talentProfile.update({
      where: { id: req.params.id },
      data: body,
    })
    res.json({ talent })
  } catch (err) {
    next(err)
  }
})

/**
 * Un profil ne passe jamais automatiquement d'un statut à l'autre : c'est
 * toujours une action explicite de l'agent (cahier des charges §7.3 règle
 * 14). Chaque vérification est conservée (pas d'écrasement, §7).
 */
router.post('/talents/:id/verify', async (req, res, next) => {
  try {
    const talent = await prisma.talentProfile.findUnique({ where: { id: req.params.id } })
    if (!talent || talent.agentId !== req.session!.sub) {
      res.status(404).json({ error: 'Talent introuvable.' })
      return
    }
    const body = talentVerificationInputSchema.parse(req.body)
    const verification = await prisma.talentVerification.create({
      data: { talentId: talent.id, trade: body.trade, checklist: body.checklist, note: body.note },
    })
    if (talent.status === 'en_attente') {
      await prisma.talentProfile.update({ where: { id: talent.id }, data: { status: 'verifie' } })
    }
    res.status(201).json({ verification })
  } catch (err) {
    next(err)
  }
})

router.post('/talents/:id/propose', async (req, res, next) => {
  try {
    const talent = await prisma.talentProfile.findUnique({ where: { id: req.params.id } })
    if (!talent || talent.agentId !== req.session!.sub) {
      res.status(404).json({ error: 'Talent introuvable.' })
      return
    }
    const body = talentProposeSchema.parse(req.body)
    const opportunity = await prisma.opportunity.findUnique({ where: { id: body.opportunityId } })
    if (!opportunity) {
      res.status(404).json({ error: 'Offre introuvable.' })
      return
    }
    const proposal = await prisma.talentOpportunityProposal
      .create({ data: { talentId: talent.id, opportunityId: opportunity.id } })
      .catch(() => null)
    if (!proposal) {
      res.status(409).json({ error: 'Ce talent a déjà été proposé pour cette offre.' })
      return
    }
    if (talent.status === 'verifie') {
      await prisma.talentProfile.update({ where: { id: talent.id }, data: { status: 'recommande' } })
    }
    await prisma.notification.create({
      data: {
        userId: opportunity.recruiterId,
        title: 'Nouveau profil recommandé',
        message: `Un agent de terrain a recommandé un profil vérifié pour « ${opportunity.title} ».`,
      },
    })
    res.status(201).json({ proposal })
  } catch (err) {
    next(err)
  }
})

router.get('/stats', async (req, res, next) => {
  try {
    const agentId = req.session!.sub
    const [total, verified, placed] = await Promise.all([
      prisma.talentProfile.count({ where: { agentId } }),
      prisma.talentProfile.count({ where: { agentId, status: { in: ['verifie', 'recommande', 'place'] } } }),
      prisma.talentProfile.count({ where: { agentId, status: 'place' } }),
    ])
    res.json({
      profilesCreated: total,
      verificationRate: total > 0 ? verified / total : 0,
      placements: placed,
    })
  } catch (err) {
    next(err)
  }
})

export default router
