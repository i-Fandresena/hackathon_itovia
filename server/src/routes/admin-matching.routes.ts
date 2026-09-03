import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { requireRole } from '../middleware/rbac.js'
import { createMatchSuggestionSchema, matchSuggestionStatusSchema } from '../lib/validation.js'
import { scoreOpportunity } from '../../../src/lib/recommendation.js'
import { toDomainCandidateProfile, toDomainOpportunity } from '../lib/domain.js'

const router = Router()

router.use(requireRole('admin'))

/**
 * Transitions autorisées : jamais de saut d'étape, jamais de retour en
 * arrière depuis `mise_en_relation`/`ecartee` (états terminaux). Miroir
 * strict des actions "Transmettre au recruteur" / "Débloquer le contact" /
 * "Écarter" de l'admin minimal (Phase 1) — pas encore les transitions
 * candidat/recruteur (`interet_*`), qui vivent dans match-suggestions.routes.ts.
 */
const ADMIN_ALLOWED_TRANSITIONS: Record<string, string[]> = {
  proposee_candidat: ['ecartee'],
  interet_candidat: ['proposee_recruteur', 'ecartee'],
  proposee_recruteur: ['ecartee'],
  interet_recruteur: ['mise_en_relation', 'ecartee'],
  mise_en_relation: [],
  ecartee: [],
}

/**
 * Vivier de candidats diplômés pour une offre — même moteur que l'ancien
 * classement "matché IA" en direct, mais consulté par l'admin plutôt que
 * montré tel quel au recruteur (décision produit 2026-09-02). `status` reste
 * `null` tant qu'aucune suggestion n'existe (ou qu'elle a été écartée) — le
 * front s'en sert pour proposer "Proposer" ou "Annuler" selon le cas.
 */
router.get('/opportunities/:id/candidate-pool', async (req, res, next) => {
  try {
    const opportunity = await prisma.opportunity.findUnique({ where: { id: req.params.id } })
    if (!opportunity) {
      res.status(404).json({ error: 'Offre introuvable.' })
      return
    }
    const domainOpportunity = toDomainOpportunity(opportunity)

    const [candidateProfiles, existing] = await Promise.all([
      prisma.candidateProfile.findMany({ include: { user: { select: { id: true, email: true } } } }),
      prisma.matchSuggestion.findMany({ where: { opportunityId: opportunity.id } }),
    ])
    const existingByCandidate = new Map(existing.map((s) => [s.candidateId, s]))

    const pool = candidateProfiles
      .map((p) => {
        const suggestion = existingByCandidate.get(p.userId)
        return {
          candidateId: p.userId,
          fullName: p.fullName,
          email: p.user.email,
          suggestionId: suggestion && suggestion.status !== 'ecartee' ? suggestion.id : null,
          status: suggestion && suggestion.status !== 'ecartee' ? suggestion.status : null,
          match: scoreOpportunity(toDomainCandidateProfile(p, p.user.email), domainOpportunity),
        }
      })
      .sort((a, b) => b.match.score - a.match.score)

    res.json({ pool })
  } catch (err) {
    next(err)
  }
})

/**
 * Détail complet d'un profil candidat, pour que l'admin puisse l'examiner
 * avant de décider de le proposer — jamais le mot de passe ni autre champ
 * sensible, `select` explicite uniquement.
 */
router.get('/candidates/:id', async (req, res, next) => {
  try {
    const profile = await prisma.candidateProfile.findUnique({
      where: { userId: req.params.id },
      select: {
        fullName: true,
        phone: true,
        province: true,
        city: true,
        gender: true,
        educationLevel: true,
        skills: true,
        experienceLevel: true,
        desiredOpportunityTypes: true,
        availability: true,
        cvUrl: true,
        sector: true,
        user: { select: { email: true, createdAt: true } },
      },
    })
    if (!profile) {
      res.status(404).json({ error: 'Candidat introuvable.' })
      return
    }
    const { user, ...rest } = profile
    res.json({ candidate: { ...rest, email: user.email, memberSince: user.createdAt } })
  } catch (err) {
    next(err)
  }
})

router.post('/match-suggestions', async (req, res, next) => {
  try {
    const body = createMatchSuggestionSchema.parse(req.body)
    const [opportunity, candidateProfile] = await Promise.all([
      prisma.opportunity.findUnique({ where: { id: body.opportunityId } }),
      prisma.candidateProfile.findUnique({
        where: { userId: body.candidateId },
        include: { user: { select: { email: true } } },
      }),
    ])
    if (!opportunity || !candidateProfile) {
      res.status(404).json({ error: 'Offre ou candidat introuvable.' })
      return
    }
    const match = scoreOpportunity(
      toDomainCandidateProfile(candidateProfile, candidateProfile.user.email),
      toDomainOpportunity(opportunity),
    )

    // Une paire (offre, candidat) ne peut exister qu'une fois en base
    // (contrainte unique) : si une suggestion écartée existe déjà, on la
    // réactive plutôt que d'échouer — c'est exactement ce que permet le
    // bouton "Annuler" côté vivier de candidats.
    const existing = await prisma.matchSuggestion.findUnique({
      where: { opportunityId_candidateId: { opportunityId: body.opportunityId, candidateId: body.candidateId } },
    })
    if (existing && existing.status !== 'ecartee') {
      res.status(409).json({ error: 'Ce candidat a déjà été proposé pour cette offre.' })
      return
    }

    const suggestion = existing
      ? await prisma.matchSuggestion.update({
          where: { id: existing.id },
          data: { status: 'proposee_candidat', score: match.score, reasons: match.reasons },
        })
      : await prisma.matchSuggestion.create({
          data: {
            opportunityId: body.opportunityId,
            candidateId: body.candidateId,
            score: match.score,
            reasons: match.reasons,
          },
        })

    await prisma.notification.create({
      data: {
        userId: body.candidateId,
        title: 'Nouvelle offre recommandée',
        // Jamais l'identité de l'entreprise avant une mise en relation
        // confirmée (décision produit 2026-09-02).
        message: `OffRec vous recommande « ${opportunity.title} ».`,
        link: `/candidat/offres/${opportunity.id}`,
      },
    })

    res.status(201).json({ suggestion })
  } catch (err) {
    next(err)
  }
})

router.get('/match-suggestions', async (req, res, next) => {
  try {
    const status = typeof req.query.status === 'string' ? req.query.status : undefined
    const suggestions = await prisma.matchSuggestion.findMany({
      where: status ? { status: status as never } : undefined,
      include: {
        opportunity: { select: { id: true, title: true, companyName: true } },
        candidate: { select: { id: true, email: true, candidateProfile: { select: { fullName: true } } } },
      },
      orderBy: { updatedAt: 'desc' },
    })
    res.json({ suggestions })
  } catch (err) {
    next(err)
  }
})

router.patch('/match-suggestions/:id', async (req, res, next) => {
  try {
    const existing = await prisma.matchSuggestion.findUnique({
      where: { id: req.params.id },
      include: { opportunity: true },
    })
    if (!existing) {
      res.status(404).json({ error: 'Suggestion introuvable.' })
      return
    }
    const body = matchSuggestionStatusSchema.parse(req.body)
    const allowed = ADMIN_ALLOWED_TRANSITIONS[existing.status] ?? []
    if (!allowed.includes(body.status)) {
      res.status(400).json({ error: `Transition ${existing.status} → ${body.status} non autorisée.` })
      return
    }

    const suggestion = await prisma.matchSuggestion.update({
      where: { id: req.params.id },
      data: { status: body.status },
    })

    if (body.status === 'proposee_recruteur') {
      await prisma.notification.create({
        data: {
          userId: existing.opportunity.recruiterId,
          title: 'Nouveau candidat proposé',
          message: `OffRec vous propose un profil pour « ${existing.opportunity.title} ».`,
          link: '/recruteur/candidatures',
        },
      })
    }
    if (body.status === 'mise_en_relation') {
      await prisma.notification.createMany({
        data: [
          {
            userId: existing.candidateId,
            title: 'Mise en relation confirmée',
            message: `OffRec vous met en relation avec ${existing.opportunity.companyName} pour « ${existing.opportunity.title} ».`,
            link: `/candidat/offres/${existing.opportunityId}`,
          },
          {
            userId: existing.opportunity.recruiterId,
            title: 'Mise en relation confirmée',
            message: `OffRec vous met en relation avec un candidat pour « ${existing.opportunity.title} ».`,
            link: '/recruteur/candidatures',
          },
        ],
      })
    }

    res.json({ suggestion })
  } catch (err) {
    next(err)
  }
})

export default router
