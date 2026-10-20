import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { requireRole } from '../middleware/rbac.js'
import { opportunityInputSchema, opportunityReopenSchema } from '../lib/validation.js'
import { scoreOpportunity } from '../../../src/lib/recommendation.js'
import type { CandidateProfile } from '../../../src/types/index.js'
import { toDomainCandidateProfile, toDomainOpportunity } from '../lib/domain.js'
import { scheduleOpportunityMatching } from '../lib/matching.js'
import { MISSIONS_UNAVAILABLE_MESSAGE, missionsData } from '../lib/opportunity-missions.js'
import { clip, plural, scheduleAdminNotification } from '../lib/notify.js'
import { loadTalentTrust, recruiterEndorsementView, retainedEndorsements, verificationSummary } from '../lib/talent-trust.js'
import { talentMatch } from '../lib/talent-match.js'
import { compareSubjectTrust } from '../../../src/lib/trust.js'
import { positionsUpdateError } from '../../../src/lib/hiring.js'
import { HIRING_SUPPORTED, positionsData } from '../lib/hiring-store.js'
import {
  applyAutoFillTx,
  countActivePlacements,
  lockOpportunity,
  markOpportunityFilled,
  reopenOpportunity,
  scheduleFilledClosureEffects,
  type FilledClosure,
} from '../lib/opportunity-fill.js'
import type { ServiceResult } from '../lib/interviews.js'
import type { Response } from 'express'

/** Refus du nombre de postes (sous les placements actifs), levé dans la transaction. */
class PositionsRefusal extends Error {}

function sendOutcome<T>(res: Response, outcome: ServiceResult<T>): void {
  if (outcome.ok) res.status(outcome.httpStatus).json(outcome.body)
  else res.status(outcome.httpStatus).json({ error: outcome.error })
}

const router = Router()

/**
 * Catalogue public. Chaque offre porte `positions` et `filledAt` (offre
 * pourvue, D1 : affichée « Pourvue », fermée au matching) ; jamais `filledBy`.
 */
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

/** Offres du recruteur, avec `activePlacements` (placements non annulés : « Pourvue (n/n) », D1). */
router.get('/mine', requireRole('recruiter'), async (req, res, next) => {
  try {
    const opportunities = await prisma.opportunity.findMany({
      where: { recruiterId: req.session!.sub },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { applications: true } } },
    })
    const placed = await prisma.placement.groupBy({
      by: ['opportunityId'],
      where: { opportunityId: { in: opportunities.map((o) => o.id) }, stage: { not: 'annule' } },
      _count: { _all: true },
    })
    const placedBy = new Map(placed.map((g) => [g.opportunityId, g._count._all]))
    res.json({
      opportunities: opportunities.map((o) => ({
        ...toDomainOpportunity(o),
        applicationCount: o._count.applications,
        activePlacements: placedBy.get(o.id) ?? 0,
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
    const { missions, positions, ...body } = opportunityInputSchema.parse(req.body)
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
        ...positionsData(positions),
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
    const { missions, positions, ...body } = opportunityInputSchema.parse(req.body)
    const missionsField = missionsData(missions)
    if (!missionsField) {
      res.status(503).json({ error: MISSIONS_UNAVAILABLE_MESSAGE })
      return
    }
    const data = { ...body, ...missionsField, deadline: new Date(body.deadline) }
    let opportunity: Awaited<ReturnType<typeof prisma.opportunity.update>>
    let closure: FilledClosure | null = null
    if (positions !== undefined && HIRING_SUPPORTED) {
      // Nombre de postes (D1) : jamais sous les placements actifs ; atteint,
      // l'offre passe pourvue et ses autres dossiers sont clos (même
      // transaction, offre verrouillée).
      try {
        const result = await prisma.$transaction(async (tx) => {
          await lockOpportunity(tx, existing.id)
          const error = positionsUpdateError(positions, await countActivePlacements(tx, existing.id))
          if (error) throw new PositionsRefusal(error)
          const updated = await tx.opportunity.update({
            where: { id: existing.id },
            data: { ...data, ...positionsData(positions) },
          })
          const fill = await applyAutoFillTx(tx, existing.id, { now: new Date(), actorId: req.session!.sub })
          return { updated: fill ? ((await tx.opportunity.findUnique({ where: { id: existing.id } })) ?? updated) : updated, fill }
        })
        opportunity = result.updated
        closure = result.fill
      } catch (err) {
        if (err instanceof PositionsRefusal) {
          res.status(400).json({ error: err.message })
          return
        }
        throw err
      }
    } else {
      opportunity = await prisma.opportunity.update({ where: { id: req.params.id }, data })
    }
    res.json({ opportunity: toDomainOpportunity(opportunity) })
    scheduleFilledClosureEffects(closure)
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
 * « Marquer comme pourvue » (D1, embauche faite hors OffRec) : recruteur
 * propriétaire. Les autres dossiers de l'offre sont clos dans la même
 * transaction (non mis en relation → écartés ; mis en relation → tour à
 * venir annulé, proposition en attente retirée) et leurs candidats
 * informés par un message neutre. 200 `{ opportunity }` ; 404 hors de ses
 * offres ; 409 déjà pourvue ; 503 suite non activée.
 */
router.post('/:id/filled', requireRole('recruiter'), async (req, res, next) => {
  try {
    sendOutcome(res, await markOpportunityFilled({ opportunityId: req.params.id, recruiterId: req.session!.sub }))
  } catch (err) {
    next(err)
  }
})

/**
 * « Rouvrir » une offre pourvue (`{ positions? }`, D1) : au moins un poste
 * libre. Les dossiers clos ne sont pas réactivés ; le moteur de matching
 * repart après la réponse. 200 `{ opportunity }` ; 400 nombre de postes
 * invalide ; 404 ; 409 pas pourvue.
 */
router.delete('/:id/filled', requireRole('recruiter'), async (req, res, next) => {
  try {
    const body = opportunityReopenSchema.parse(req.body ?? {})
    const outcome = await reopenOpportunity({
      opportunityId: req.params.id,
      recruiterId: req.session!.sub,
      positions: body.positions,
    })
    sendOutcome(res, outcome)
    if (outcome.ok) scheduleOpportunityMatching(req.params.id, 'opportunity_updated')
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
