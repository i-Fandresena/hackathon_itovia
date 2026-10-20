import { Router } from 'express'
import { requireRole } from '../middleware/rbac.js'
import { loadRecruiterDashboard } from '../lib/recruiter-dashboard.js'
import { RECRUITER_OFFER_NOT_FOUND_ERROR, loadRecruiterHiringStats } from '../lib/hiring-stats.js'
import { HIRING_UNAVAILABLE_ERROR } from '../lib/hiring-store.js'
import { recruiterHiringStatsQuerySchema } from '../lib/validation.js'

const router = Router()

router.use(requireRole('recruiter'))

/**
 * Tableau de bord du recruteur connecté : offres, profils reçus (à partir de
 * `proposee_recruteur` uniquement), entretiens, placements déclarés,
 * abonnement, notifications et messages non lus — strictement limités à SES
 * données (lib/recruiter-dashboard.ts). Recalculé à chaque appel.
 */
router.get('/stats', async (req, res, next) => {
  try {
    res.json(await loadRecruiterDashboard(req.session!.sub))
  } catch (err) {
    next(err)
  }
})

/**
 * Entonnoir de recrutement du recruteur connecté (sous-lot 7) : SES offres,
 * dossiers que OffRec lui a transmis seulement (jamais `suggeree` ni rien de
 * la présélection interne), cohorte de la période, classement par offre.
 */
router.get('/stats/hiring', async (req, res, next) => {
  try {
    const query = recruiterHiringStatsQuerySchema.parse(req.query)
    const stats = await loadRecruiterHiringStats(req.session!.sub, query)
    res.setHeader('Cache-Control', 'no-store')
    if (!stats) {
      res.status(503).json({ error: HIRING_UNAVAILABLE_ERROR })
      return
    }
    if (stats.notFound) {
      res.status(404).json({ error: RECRUITER_OFFER_NOT_FOUND_ERROR })
      return
    }
    const { notFound: _notFound, ...body } = stats
    res.json(body)
  } catch (err) {
    next(err)
  }
})

export default router
