import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { requireRole } from '../middleware/rbac.js'
import {
  sourcingLeadInputSchema,
  sourcingLeadStatusSchema,
  talentLeadStatusSchema,
  talentProfileInputSchema,
  talentProposeSchema,
  talentVerificationInputSchema,
} from '../lib/validation.js'

const router = Router()

router.use(requireRole('agent'))

/**
 * Demandes de contact "non-diplômé" déposées en self-service (voir
 * public.routes.ts) — partagées entre tous les agents tant qu'aucun
 * profil réel n'a été créé, puisqu'aucun agent n'en est encore responsable.
 */
router.get('/leads', async (req, res, next) => {
  try {
    const status = typeof req.query.status === 'string' ? req.query.status : undefined
    const leads = await prisma.talentLead.findMany({
      where: status ? { status: status as never } : undefined,
      orderBy: { createdAt: 'desc' },
    })
    res.json({ leads })
  } catch (err) {
    next(err)
  }
})

router.get('/leads/:id', async (req, res, next) => {
  try {
    const lead = await prisma.talentLead.findUnique({ where: { id: req.params.id } })
    if (!lead) {
      res.status(404).json({ error: 'Demande introuvable.' })
      return
    }
    res.json({ lead })
  } catch (err) {
    next(err)
  }
})

router.patch('/leads/:id', async (req, res, next) => {
  try {
    const body = talentLeadStatusSchema.parse(req.body)
    const lead = await prisma.talentLead
      .update({ where: { id: req.params.id }, data: { status: body.status } })
      .catch(() => null)
    if (!lead) {
      res.status(404).json({ error: 'Demande introuvable.' })
      return
    }
    res.json({ lead })
  } catch (err) {
    next(err)
  }
})

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
    const { fromLeadId, fromSourcingLeadId, ...body } = talentProfileInputSchema.parse(req.body)
    const talent = await prisma.$transaction(async (tx) => {
      const created = await tx.talentProfile.create({
        data: { ...body, agentId: req.session!.sub },
      })
      if (fromLeadId) {
        await tx.talentLead.update({ where: { id: fromLeadId }, data: { status: 'converti' } })
        // Si la personne a créé un compte de suivi après sa demande de
        // contact, on le relie au profil désormais réel — c'est ce qui
        // fait apparaître le vrai statut dans "Mon espace" (§7.3.14 : le
        // compte n'a fait qu'observer, l'agent seul a créé ce profil).
        await tx.talentAccountProfile.updateMany({
          where: { leadId: fromLeadId },
          data: { talentId: created.id },
        })
      }
      if (fromSourcingLeadId) {
        await tx.sourcingLead.updateMany({
          where: { id: fromSourcingLeadId, agentId: req.session!.sub },
          data: { status: 'converti', talentId: created.id },
        })
      }
      return created
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
        link: `/recruteur/offres/${opportunity.id}/shortlist`,
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
    const [total, verified, placed, sourcingLeadsCount] = await Promise.all([
      prisma.talentProfile.count({ where: { agentId } }),
      prisma.talentProfile.count({ where: { agentId, status: { in: ['verifie', 'recommande', 'place'] } } }),
      prisma.talentProfile.count({ where: { agentId, status: 'place' } }),
      prisma.sourcingLead.count({ where: { agentId } }),
    ])
    res.json({
      profilesCreated: total,
      verificationRate: total > 0 ? verified / total : 0,
      placements: placed,
      sourcingLeadsCount,
    })
  } catch (err) {
    next(err)
  }
})

/**
 * Veille : signaux qu'un agent a repérés en ligne ou sur le terrain (profil
 * potentiel ou besoin d'une entreprise) — jamais publiés tels quels dans
 * l'annuaire. Un talent n'apparaît vérifié qu'après la même vérification
 * humaine que n'importe quel TalentProfile (§7.3.15) ; une piste d'offre ne
 * devient une vraie Opportunity que si l'entreprise crée elle-même un
 * compte recruteur.
 */
router.get('/sourcing', async (req, res, next) => {
  try {
    const status = typeof req.query.status === 'string' ? req.query.status : undefined
    const type = typeof req.query.type === 'string' ? req.query.type : undefined
    const leads = await prisma.sourcingLead.findMany({
      where: {
        agentId: req.session!.sub,
        status: status ? (status as never) : undefined,
        type: type ? (type as never) : undefined,
      },
      orderBy: { createdAt: 'desc' },
    })
    res.json({ leads })
  } catch (err) {
    next(err)
  }
})

router.get('/sourcing/:id', async (req, res, next) => {
  try {
    const lead = await prisma.sourcingLead.findUnique({ where: { id: req.params.id } })
    if (!lead || lead.agentId !== req.session!.sub) {
      res.status(404).json({ error: 'Piste introuvable.' })
      return
    }
    res.json({ lead })
  } catch (err) {
    next(err)
  }
})

router.post('/sourcing', async (req, res, next) => {
  try {
    const body = sourcingLeadInputSchema.parse(req.body)
    const lead = await prisma.sourcingLead.create({
      data: { ...body, sourceUrl: body.sourceUrl || null, agentId: req.session!.sub },
    })
    res.status(201).json({ lead })
  } catch (err) {
    next(err)
  }
})

router.patch('/sourcing/:id', async (req, res, next) => {
  try {
    const existing = await prisma.sourcingLead.findUnique({ where: { id: req.params.id } })
    if (!existing || existing.agentId !== req.session!.sub) {
      res.status(404).json({ error: 'Piste introuvable.' })
      return
    }
    const body = sourcingLeadStatusSchema.parse(req.body)
    const lead = await prisma.sourcingLead.update({
      where: { id: req.params.id },
      data: { status: body.status },
    })
    res.json({ lead })
  } catch (err) {
    next(err)
  }
})

export default router
