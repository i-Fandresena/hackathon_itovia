import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { requireRole } from '../middleware/rbac.js'
import { loadTalentTrust } from '../lib/talent-trust.js'
import { publicVisibilityState } from '../lib/public-talents.js'

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
    // Recommandations reçues : niveau et nombre seulement — jamais l'identité
    // des auteurs, leurs commentaires ni leurs photos.
    let talent = null
    if (account.talent) {
      const { phoneKey: _phoneKey, ...rest } = account.talent
      const tr = (await loadTalentTrust([rest.id])).get(rest.id)!.trust
      // Fiche publique : lecture seule — seul l'agent recueille ou retire
      // l'accord (§7.3.14) ; le talent voit si elle est en ligne et son lien.
      const vis = await publicVisibilityState(rest.id)
      talent = {
        ...rest,
        trust: { level: tr.level, recommendationCount: tr.recommendationCount, independentSources: tr.independentSources },
        publicVisibility: {
          visible: vis?.visible ?? false,
          publicConsentAt: vis?.publicConsentAt ?? null,
          publicRef: vis?.visible ? vis.publicRef : null,
        },
      }
    }
    res.json({ account: { ...account, talent } })
  } catch (err) {
    next(err)
  }
})

export default router
