import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { requireRole } from '../middleware/rbac.js'
import { subscribeSchema } from '../lib/validation.js'

const router = Router()

router.get('/plans', async (_req, res, next) => {
  try {
    const plans = await prisma.subscriptionPlan.findMany({ orderBy: { priceAr: 'asc' } })
    res.json({ plans })
  } catch (err) {
    next(err)
  }
})

router.get('/subscription', requireRole('recruiter'), async (req, res, next) => {
  try {
    const subscription = await prisma.subscription.findUnique({
      where: { recruiterId: req.session!.sub },
      include: { plan: true },
    })
    res.json({ subscription: subscription ?? null })
  } catch (err) {
    next(err)
  }
})

/**
 * Abonnement + paiement 100 % simulés (MockPaymentProvider) : aucune donnée
 * bancaire réelle ne transite ici. L'architecture (plan en base, transaction
 * journalisée) permet de brancher un vrai prestataire plus tard sans changer
 * ce contrat d'API.
 */
router.post('/subscribe', requireRole('recruiter'), async (req, res, next) => {
  try {
    const body = subscribeSchema.parse(req.body)
    const plan = await prisma.subscriptionPlan.findUnique({ where: { code: body.planCode } })
    if (!plan) {
      res.status(404).json({ error: 'Plan introuvable.' })
      return
    }

    const subscription = await prisma.subscription.upsert({
      where: { recruiterId: req.session!.sub },
      create: { recruiterId: req.session!.sub, planCode: plan.code },
      update: { planCode: plan.code, startedAt: new Date() },
      include: { plan: true },
    })

    if (plan.priceAr > 0) {
      await prisma.transaction.create({
        data: {
          recruiterId: req.session!.sub,
          type: 'subscription',
          amountAr: plan.priceAr,
          description: `Abonnement ${plan.name}`,
        },
      })
    }

    res.json({ subscription })
  } catch (err) {
    next(err)
  }
})

export default router
