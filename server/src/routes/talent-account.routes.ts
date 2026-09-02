import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { requireRole } from '../middleware/rbac.js'

const router = Router()

router.use(requireRole('talent'))

/**
 * Lecture seule : ce compte n'a aucun pouvoir d'écriture sur TalentProfile
 * (§7.3.14) — il observe le statut de sa demande, puis, une fois qu'un
 * agent l'a reprise, le statut réel du profil vérifié.
 */
router.get('/me', async (req, res, next) => {
  try {
    const account = await prisma.talentAccountProfile.findUnique({
      where: { userId: req.session!.sub },
      include: {
        lead: true,
        talent: {
          include: {
            verifications: { orderBy: { verifiedAt: 'desc' } },
            proposals: { include: { opportunity: true }, orderBy: { proposedAt: 'desc' } },
          },
        },
      },
    })
    if (!account) {
      res.status(404).json({ error: 'Profil introuvable.' })
      return
    }
    res.json({ account })
  } catch (err) {
    next(err)
  }
})

export default router
