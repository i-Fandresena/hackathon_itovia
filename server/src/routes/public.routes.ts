import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { prisma } from '../lib/prisma.js'
import { talentLeadInputSchema } from '../lib/validation.js'

const router = Router()

/**
 * Endpoint public non authentifié — limiter dédié pour éviter le spam
 * d'un formulaire de contact accessible sans compte (même pattern que
 * authLimiter dans auth.routes.ts).
 */
const leadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
})

/**
 * Demande de contact "non-diplômé" à l'inscription (§7.3.14) : ne crée
 * jamais de TalentProfile ni de compte directement — un agent reprend la
 * demande et crée lui-même le profil (voir agent.routes.ts /leads).
 */
router.post('/', leadLimiter, async (req, res, next) => {
  try {
    const body = talentLeadInputSchema.parse(req.body)
    const lead = await prisma.talentLead.create({ data: body })
    res.status(201).json({ lead })
  } catch (err) {
    next(err)
  }
})

export default router
