import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { requireRole } from '../middleware/rbac.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

router.use(requireAuth)

/**
 * Fil du candidat : uniquement les offres qu'OffRec a choisi de lui
 * proposer — jamais le catalogue complet (décision produit 2026-09-02).
 */
router.get('/mine', requireRole('candidate'), async (req, res, next) => {
  try {
    const suggestions = await prisma.matchSuggestion.findMany({
      where: {
        candidateId: req.session!.sub,
        status: { in: ['proposee_candidat', 'interet_candidat', 'proposee_recruteur', 'interet_recruteur', 'mise_en_relation'] },
      },
      include: { opportunity: true },
      orderBy: { updatedAt: 'desc' },
    })
    res.json({ suggestions })
  } catch (err) {
    next(err)
  }
})

/**
 * Suggestions transmises par l'admin pour les offres de ce recruteur —
 * un profil décliné (`ecartee`) sort de cette liste : c'est ce qui le
 * "désélectionne" côté recruteur, plus besoin d'y revenir dessus.
 */
router.get('/received', requireRole('recruiter'), async (req, res, next) => {
  try {
    const suggestions = await prisma.matchSuggestion.findMany({
      where: {
        status: { in: ['proposee_recruteur', 'interet_recruteur', 'mise_en_relation'] },
        opportunity: { recruiterId: req.session!.sub },
      },
      include: {
        opportunity: { select: { id: true, title: true } },
        candidate: { select: { id: true, email: true, candidateProfile: true } },
      },
      orderBy: { updatedAt: 'desc' },
    })
    res.json({ suggestions })
  } catch (err) {
    next(err)
  }
})

/**
 * Exprimer un intérêt — jamais un contact direct : ça notifie l'admin,
 * qui décide seul de la suite (§7.3, même esprit que le volet non-diplômé).
 * Journalisé (AuditLog) pour le suivi des décisions prises par les
 * entreprises, visible depuis l'activité récente du tableau de bord admin.
 */
router.post('/:id/interest', async (req, res, next) => {
  try {
    const role = req.session!.role
    if (role !== 'candidate' && role !== 'recruiter') {
      res.status(403).json({ error: 'Accès refusé pour ce rôle.' })
      return
    }
    const suggestion = await prisma.matchSuggestion.findUnique({
      where: { id: req.params.id },
      include: { opportunity: true },
    })
    if (!suggestion) {
      res.status(404).json({ error: 'Suggestion introuvable.' })
      return
    }

    if (role === 'candidate') {
      if (suggestion.candidateId !== req.session!.sub) {
        res.status(404).json({ error: 'Suggestion introuvable.' })
        return
      }
      if (suggestion.status !== 'proposee_candidat') {
        res.status(400).json({ error: 'Cette suggestion ne peut plus être marquée intéressée.' })
        return
      }
      const updated = await prisma.matchSuggestion.update({
        where: { id: suggestion.id },
        data: { status: 'interet_candidat' },
      })
      await prisma.auditLog.create({
        data: {
          userId: req.session!.sub,
          action: 'candidate_interested',
          metadata: { opportunityTitle: suggestion.opportunity.title, suggestionId: suggestion.id },
        },
      })
      res.json({ suggestion: updated })
      return
    }

    // role === 'recruiter'
    if (suggestion.opportunity.recruiterId !== req.session!.sub) {
      res.status(404).json({ error: 'Suggestion introuvable.' })
      return
    }
    if (suggestion.status !== 'proposee_recruteur') {
      res.status(400).json({ error: 'Cette suggestion ne peut plus être marquée intéressée.' })
      return
    }
    const updated = await prisma.matchSuggestion.update({
      where: { id: suggestion.id },
      data: { status: 'interet_recruteur' },
    })
    await prisma.auditLog.create({
      data: {
        userId: req.session!.sub,
        action: 'recruiter_interested',
        metadata: { opportunityTitle: suggestion.opportunity.title, suggestionId: suggestion.id },
      },
    })
    res.json({ suggestion: updated })
  } catch (err) {
    next(err)
  }
})

/**
 * Décliner/annuler — le candidat peut annuler sa candidature à tout moment
 * avant la mise en relation (pas seulement à la proposition initiale) ; le
 * recruteur écarte un profil proposé. Désélectionne (sort de `/received`/
 * `/mine`) et journalise la décision pour l'admin, symétrique de
 * `/interest`. Le candidat/recruteur ne fait que décider, jamais l'admin
 * qui seul fait ensuite avancer le dossier.
 */
router.post('/:id/decline', async (req, res, next) => {
  try {
    const role = req.session!.role
    if (role !== 'candidate' && role !== 'recruiter') {
      res.status(403).json({ error: 'Accès refusé pour ce rôle.' })
      return
    }
    const suggestion = await prisma.matchSuggestion.findUnique({
      where: { id: req.params.id },
      include: { opportunity: true, candidate: { select: { candidateProfile: { select: { fullName: true } } } } },
    })
    if (!suggestion) {
      res.status(404).json({ error: 'Suggestion introuvable.' })
      return
    }

    if (role === 'candidate') {
      if (suggestion.candidateId !== req.session!.sub) {
        res.status(404).json({ error: 'Suggestion introuvable.' })
        return
      }
      if (['mise_en_relation', 'ecartee'].includes(suggestion.status)) {
        res.status(400).json({ error: 'Cette candidature ne peut plus être annulée.' })
        return
      }
      const updated = await prisma.matchSuggestion.update({
        where: { id: suggestion.id },
        data: { status: 'ecartee' },
      })
      await prisma.auditLog.create({
        data: {
          userId: req.session!.sub,
          action: 'candidate_declined',
          metadata: { opportunityTitle: suggestion.opportunity.title, suggestionId: suggestion.id },
        },
      })
      res.json({ suggestion: updated })
      return
    }

    // role === 'recruiter'
    if (suggestion.opportunity.recruiterId !== req.session!.sub) {
      res.status(404).json({ error: 'Suggestion introuvable.' })
      return
    }
    if (!['proposee_recruteur', 'interet_recruteur'].includes(suggestion.status)) {
      res.status(400).json({ error: 'Cette suggestion ne peut plus être déclinée.' })
      return
    }
    const updated = await prisma.matchSuggestion.update({
      where: { id: suggestion.id },
      data: { status: 'ecartee' },
    })
    await prisma.auditLog.create({
      data: {
        userId: req.session!.sub,
        action: 'recruiter_declined',
        metadata: {
          opportunityTitle: suggestion.opportunity.title,
          candidateName: suggestion.candidate.candidateProfile?.fullName ?? null,
          suggestionId: suggestion.id,
        },
      },
    })
    res.json({ suggestion: updated })
  } catch (err) {
    next(err)
  }
})

export default router
