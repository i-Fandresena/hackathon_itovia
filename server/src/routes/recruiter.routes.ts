import { Router } from 'express'
import { requireRole } from '../middleware/rbac.js'
import { loadRecruiterDashboard } from '../lib/recruiter-dashboard.js'

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

export default router
