import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { requireRole } from '../middleware/rbac.js'
import { opportunityInputSchema } from '../lib/validation.js'
import { scoreOpportunity } from '../../../src/lib/recommendation.js'
import type { CandidateProfile } from '../../../src/types/index.js'
import { toDomainCandidateProfile, toDomainOpportunity } from '../lib/domain.js'
import { scheduleOpportunityMatching } from '../lib/matching.js'
import { MISSIONS_UNAVAILABLE_MESSAGE, missionsData } from '../lib/opportunity-missions.js'
import { clip, plural, scheduleAdminNotification } from '../lib/notify.js'
import { loadTalentTrust, recruiterEndorsementView, retainedEndorsements, verificationSummary } from '../lib/talent-trust.js'
import { talentMatch } from '../lib/talent-match.js'
import { compareSubjectTrust } from '../../../src/lib/trust.js'

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
    const { missions, ...body } = opportunityInputSchema.parse(req.body)
    const recruiterProfile = await prisma.recruiterProfile.findUnique({
      where: { userId: req.session!.sub },
    })
    if (!recruiterProfile) {
      res.status(400).json({ error: 'Profil recruteur incomplet.' })
      return
    }
    const missionsField = missionsData(missions ?? [])
    if (!missionsField) {
      res.status(503).json({ error: MISSIONS_UNAVAILABLE_MESSAGE })
      return
    }
    const opportunity = await prisma.opportunity.create({
      data: {
        ...body,
        ...missionsField,
        deadline: new Date(body.deadline),
        recruiterId: req.session!.sub,
        companyName: recruiterProfile.companyName,
      },
    })
    res.status(201).json({ opportunity: toDomainOpportunity(opportunity) })
    scheduleAdminNotification({
      event: 'opportunity_created',
      category: 'recruteur',
      title: 'Nouvelle offre publiée',
      message: `${clip(opportunity.companyName, 60)} a publié l’offre « ${clip(opportunity.title)} » (${clip(opportunity.city, 40)}).`,
      link: '/admin/mise-en-relation',
    })
    // Une offre est publiée dès sa création : le matching part après la réponse.
    scheduleOpportunityMatching(opportunity.id, 'opportunity_created')
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
    const { missions, ...body } = opportunityInputSchema.parse(req.body)
    const missionsField = missionsData(missions)
    if (!missionsField) {
      res.status(503).json({ error: MISSIONS_UNAVAILABLE_MESSAGE })
      return
    }
    const opportunity = await prisma.opportunity.update({
      where: { id: req.params.id },
      data: { ...body, ...missionsField, deadline: new Date(body.deadline) },
    })
    res.json({ opportunity: toDomainOpportunity(opportunity) })
    scheduleAdminNotification({
      event: 'opportunity_updated',
      category: 'recruteur',
      title: 'Offre modifiée',
      message:
        `${clip(opportunity.companyName, 60)} a modifié l’offre « ${clip(opportunity.title)} ». ` +
        'Les suggestions encore à valider sont recalculées.',
      link: '/admin/mise-en-relation',
    })
    scheduleOpportunityMatching(opportunity.id, 'opportunity_updated')
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
    // Compté avant la suppression : les dossiers de l'offre partent avec elle.
    const openFiles = await prisma.matchSuggestion.count({
      where: { opportunityId: existing.id, status: { not: 'ecartee' } },
    })
    await prisma.opportunity.delete({ where: { id: req.params.id } })
    res.status(204).end()
    scheduleAdminNotification({
      event: 'opportunity_deleted',
      category: 'recruteur',
      title: 'Offre supprimée',
      message:
        `${clip(existing.companyName, 60)} a supprimé l’offre « ${clip(existing.title)} »` +
        (openFiles > 0 ? ` : ${plural(openFiles, 'dossier')} de matching en cours ${openFiles > 1 ? 'disparaissent' : 'disparaît'} avec elle.` : '.'),
      link: '/admin/mise-en-relation',
    })
  } catch (err) {
    next(err)
  }
})

/**
 * Shortlist entreprise : combine les candidats diplômés transmis par OffRec
 * (`MatchSuggestion`, statut `proposee_recruteur` et au-delà — validés par
 * un admin ou envoyés directement par le moteur, décision 2026-10-08) et les
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
      // Liste blanche explicite : le recruteur n'obtient que le nom du
      // candidat — jamais son email, son téléphone ni le reste du profil
      // (OffRec reste l'intermédiaire). L'entretien se suit dans
      // « Candidats proposés » (`GET /match-suggestions/received`).
      select: {
        id: true,
        candidateId: true,
        status: true,
        score: true,
        reasons: true,
        candidate: { select: { candidateProfile: { select: { fullName: true } } } },
      },
      orderBy: { score: 'desc' },
    })
    const matched = suggestions
      .filter((s) => s.candidate.candidateProfile)
      .map((s) => ({
        source: 'matche_ia' as const,
        suggestionId: s.id,
        candidateId: s.candidateId,
        fullName: s.candidate.candidateProfile!.fullName,
        status: s.status,
        match: { score: s.score, reasons: s.reasons },
      }))

    // Talents proposés par un agent : deux scores côte à côte, jamais
    // additionnés. Tri : adéquation décroissante, puis confiance (niveau, E,
    // sources) pour départager à adéquation égale, puis ancienneté de la
    // proposition, puis id ; coupe à 10 APRÈS le tri.
    const proposals = await prisma.talentOpportunityProposal.findMany({
      where: { opportunityId: opportunity.id },
      include: { talent: { include: { verifications: { orderBy: { verifiedAt: 'desc' }, take: 1 } } } },
    })
    const trust = await loadTalentTrust(proposals.map((p) => p.talent.id))
    const proposed = proposals
      .map((p) => {
        const entry = trust.get(p.talent.id)!
        return {
          source: 'verifie_humain' as const,
          talentId: p.talent.id,
          fullName: p.talent.fullName,
          trade: p.talent.trade,
          city: p.talent.city,
          district: p.talent.district,
          status: p.talent.status,
          proposedAt: p.proposedAt.toISOString(),
          match: talentMatch(p.talent, opportunity),
          trust: entry.trust,
          verification: verificationSummary(p.talent.verifications[0]),
          endorsements: retainedEndorsements(entry.rows).map(recruiterEndorsementView),
        }
      })
      .sort(
        (a, b) =>
          b.match.score - a.match.score ||
          compareSubjectTrust(a.trust, b.trust) ||
          Date.parse(a.proposedAt) - Date.parse(b.proposedAt) ||
          (a.talentId < b.talentId ? -1 : a.talentId > b.talentId ? 1 : 0),
      )

    res.json({
      opportunity: { id: opportunity.id, title: opportunity.title },
      matched,
      proposed: proposed.slice(0, 10),
    })
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
