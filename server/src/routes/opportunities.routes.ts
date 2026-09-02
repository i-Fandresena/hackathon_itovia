import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { requireRole } from '../middleware/rbac.js'
import { opportunityInputSchema } from '../lib/validation.js'
import { scoreOpportunity } from '../../../src/lib/recommendation.js'
import type { CandidateProfile } from '../../../src/types/index.js'
import { toDomainCandidateProfile, toDomainOpportunity } from '../lib/domain.js'

const router = Router()

router.get('/', async (req, res, next) => {
  try {
    const opportunities = await prisma.opportunity.findMany({ orderBy: { createdAt: 'desc' } })
    const domain = opportunities.map(toDomainOpportunity)

    let candidateProfile: CandidateProfile | undefined
    if (req.session?.role === 'candidate') {
      const profile = await prisma.candidateProfile.findUnique({ where: { userId: req.session.sub } })
      if (profile) {
        candidateProfile = toDomainCandidateProfile(profile)
      }
    }

    const results = domain.map((opportunity) => ({
      opportunity,
      match: candidateProfile ? scoreOpportunity(candidateProfile, opportunity) : null,
    }))

    res.json({ opportunities: results })
  } catch (err) {
    next(err)
  }
})

router.get('/mine', requireRole('recruiter'), async (req, res, next) => {
  try {
    const opportunities = await prisma.opportunity.findMany({
      where: { recruiterId: req.session!.sub },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { applications: true } } },
    })
    res.json({
      opportunities: opportunities.map((o) => ({
        ...toDomainOpportunity(o),
        applicationCount: o._count.applications,
      })),
    })
  } catch (err) {
    next(err)
  }
})

router.get('/:id', async (req, res, next) => {
  try {
    const opportunity = await prisma.opportunity.findUnique({ where: { id: req.params.id } })
    if (!opportunity) {
      res.status(404).json({ error: 'Offre introuvable.' })
      return
    }
    res.json({ opportunity: toDomainOpportunity(opportunity) })
  } catch (err) {
    next(err)
  }
})

router.post('/', requireRole('recruiter'), async (req, res, next) => {
  try {
    const body = opportunityInputSchema.parse(req.body)
    const recruiterProfile = await prisma.recruiterProfile.findUnique({
      where: { userId: req.session!.sub },
    })
    if (!recruiterProfile) {
      res.status(400).json({ error: 'Profil recruteur incomplet.' })
      return
    }
    const opportunity = await prisma.opportunity.create({
      data: {
        ...body,
        deadline: new Date(body.deadline),
        recruiterId: req.session!.sub,
        companyName: recruiterProfile.companyName,
      },
    })
    res.status(201).json({ opportunity: toDomainOpportunity(opportunity) })
  } catch (err) {
    next(err)
  }
})

router.put('/:id', requireRole('recruiter'), async (req, res, next) => {
  try {
    const existing = await prisma.opportunity.findUnique({ where: { id: req.params.id } })
    if (!existing || existing.recruiterId !== req.session!.sub) {
      res.status(404).json({ error: 'Offre introuvable.' })
      return
    }
    const body = opportunityInputSchema.parse(req.body)
    const opportunity = await prisma.opportunity.update({
      where: { id: req.params.id },
      data: { ...body, deadline: new Date(body.deadline) },
    })
    res.json({ opportunity: toDomainOpportunity(opportunity) })
  } catch (err) {
    next(err)
  }
})

router.delete('/:id', requireRole('recruiter'), async (req, res, next) => {
  try {
    const existing = await prisma.opportunity.findUnique({ where: { id: req.params.id } })
    if (!existing || existing.recruiterId !== req.session!.sub) {
      res.status(404).json({ error: 'Offre introuvable.' })
      return
    }
    await prisma.opportunity.delete({ where: { id: req.params.id } })
    res.status(204).end()
  } catch (err) {
    next(err)
  }
})

/**
 * Shortlist entreprise : combine les candidats diplômés proposés par un
 * admin (`MatchSuggestion`, statut `proposee_recruteur` et au-delà — plus
 * de classement IA en direct, voir décision produit 2026-09-02) et les
 * talents non-diplômés proposés par un agent pour cette offre. Le badge
 * distinctif (§7.3 règle 17) part de la source des données, jamais fusionné.
 */
router.get('/:id/shortlist', requireRole('recruiter'), async (req, res, next) => {
  try {
    const opportunity = await prisma.opportunity.findUnique({ where: { id: req.params.id } })
    if (!opportunity || opportunity.recruiterId !== req.session!.sub) {
      res.status(404).json({ error: 'Offre introuvable.' })
      return
    }

    const suggestions = await prisma.matchSuggestion.findMany({
      where: {
        opportunityId: opportunity.id,
        status: { in: ['proposee_recruteur', 'interet_recruteur', 'mise_en_relation'] },
      },
      include: { candidate: { include: { candidateProfile: true } } },
      orderBy: { score: 'desc' },
    })
    const matched = suggestions
      .filter((s) => s.candidate.candidateProfile)
      .map((s) => ({
        source: 'matche_ia' as const,
        suggestionId: s.id,
        candidateId: s.candidateId,
        fullName: s.candidate.candidateProfile!.fullName,
        email: s.candidate.email,
        status: s.status,
        match: { score: s.score, reasons: s.reasons },
      }))

    const proposals = await prisma.talentOpportunityProposal.findMany({
      where: { opportunityId: opportunity.id },
      include: { talent: true },
      orderBy: { proposedAt: 'desc' },
    })
    const proposed = proposals.map((p) => ({
      source: 'verifie_humain' as const,
      talentId: p.talent.id,
      fullName: p.talent.fullName,
      trade: p.talent.skills[0] ?? '',
      status: p.talent.status,
    }))

    res.json({ matched, proposed: proposed.slice(0, 10) })
  } catch (err) {
    next(err)
  }
})

router.post('/:id/bookmark', requireRole('candidate'), async (req, res, next) => {
  try {
    await prisma.bookmark.upsert({
      where: {
        candidateId_opportunityId: { candidateId: req.session!.sub, opportunityId: req.params.id },
      },
      create: { candidateId: req.session!.sub, opportunityId: req.params.id },
      update: {},
    })
    res.status(201).end()
  } catch (err) {
    next(err)
  }
})

router.delete('/:id/bookmark', requireRole('candidate'), async (req, res, next) => {
  try {
    await prisma.bookmark
      .delete({
        where: {
          candidateId_opportunityId: { candidateId: req.session!.sub, opportunityId: req.params.id },
        },
      })
      .catch(() => undefined)
    res.status(204).end()
  } catch (err) {
    next(err)
  }
})

export default router
