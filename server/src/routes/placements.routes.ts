import { Router } from 'express'
import type { MatchSuggestionStatus, Placement } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { requireRole } from '../middleware/rbac.js'
import { placementInputSchema, placementStageSchema } from '../lib/validation.js'
import { actorLabel, scheduleAdminNotification } from '../lib/notify.js'

const STAGE_LABELS: Record<string, string> = {
  etape1_due: 'étape 1 due',
  etape1_payee: 'étape 1 payée',
  etape2_due: 'étape 2 due',
  etape2_payee: 'étape 2 payée',
  annule: 'annulé',
}

/** Dossier diplômé effectivement transmis au recruteur par OffRec : seuls
 *  ces statuts autorisent la déclaration d'un placement (jamais `suggeree`,
 *  jamais `ecartee`, jamais un statut hérité). */
const PROPOSED_SUGGESTION_STATUSES: readonly MatchSuggestionStatus[] = [
  'proposee_recruteur',
  'interet_recruteur',
  'mise_en_relation',
]

const OPPORTUNITY_NOT_FOUND = 'Offre introuvable.'
const CANDIDATE_NOT_PROPOSED =
  'Ce candidat ne vous a pas été proposé par OffRec pour cette offre : impossible de déclarer son placement.'
const TALENT_NOT_PROPOSED =
  'Ce talent ne vous a pas été proposé par un agent pour cette offre : impossible de déclarer son placement.'
const DUPLICATE_PLACEMENT =
  'Un placement est déjà déclaré pour cette personne sur cette offre. Suivez-le depuis « Placements ».'

/** Refus métier levé dans la transaction de création. */
class PlacementRefusal extends Error {
  constructor(
    readonly httpStatus: number,
    message: string,
  ) {
    super(message)
  }
}

/** Placement renvoyé au recruteur ou à l'admin : liste blanche explicite. */
function toPlacementView(p: Placement) {
  return {
    id: p.id,
    opportunityId: p.opportunityId,
    recruiterId: p.recruiterId,
    candidateId: p.candidateId,
    talentId: p.talentId,
    monthlySalaryAr: p.monthlySalaryAr,
    stage: p.stage,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  }
}

const router = Router()

/**
 * Déclaration d'un placement par le recruteur (suivi déclaratif du success
 * fee). Contrôles (sous-lot 0, 2026-10-16) :
 * - l'offre lui appartient (404 sinon, sans révéler l'offre d'un autre) ;
 * - la personne lui a bien été proposée pour CETTE offre : dossier
 *   `MatchSuggestion` transmis (`proposee_recruteur` et au-delà) pour un
 *   diplômé, `TalentOpportunityProposal` d'un agent pour un talent (400) ;
 * - pas de doublon (même personne, même offre, placement non annulé) : 409.
 *   Les déclarations d'une même offre sont sérialisées par un verrou de
 *   ligne sur l'offre (`FOR UPDATE`), sans contrainte unique en base.
 * `AuditLog` `placement_declared` dans la même transaction.
 */
router.post('/', requireRole('recruiter'), async (req, res, next) => {
  try {
    const body = placementInputSchema.parse(req.body)
    const recruiterId = req.session!.sub

    const opportunity = await prisma.opportunity.findUnique({
      where: { id: body.opportunityId },
      select: { id: true, recruiterId: true },
    })
    if (!opportunity || opportunity.recruiterId !== recruiterId) {
      res.status(404).json({ error: OPPORTUNITY_NOT_FOUND })
      return
    }

    let suggestionId: string | null = null
    if (body.candidateId) {
      const suggestion = await prisma.matchSuggestion.findUnique({
        where: { opportunityId_candidateId: { opportunityId: opportunity.id, candidateId: body.candidateId } },
        select: { id: true, status: true },
      })
      if (!suggestion || !PROPOSED_SUGGESTION_STATUSES.includes(suggestion.status)) {
        res.status(400).json({ error: CANDIDATE_NOT_PROPOSED })
        return
      }
      suggestionId = suggestion.id
    } else {
      const proposal = await prisma.talentOpportunityProposal.findUnique({
        where: { talentId_opportunityId: { talentId: body.talentId!, opportunityId: opportunity.id } },
        select: { id: true },
      })
      if (!proposal) {
        res.status(400).json({ error: TALENT_NOT_PROPOSED })
        return
      }
    }

    let placement: Placement
    try {
      placement = await prisma.$transaction(async (tx) => {
        // Sérialise les déclarations concurrentes sur cette offre (double
        // clic, deux onglets) : la seconde attend la première, puis voit
        // son placement et reçoit 409.
        await tx.$queryRaw`SELECT "id" FROM "Opportunity" WHERE "id" = ${opportunity.id} FOR UPDATE`
        const duplicate = await tx.placement.findFirst({
          where: {
            opportunityId: opportunity.id,
            stage: { not: 'annule' },
            ...(body.candidateId ? { candidateId: body.candidateId } : { talentId: body.talentId }),
          },
          select: { id: true },
        })
        if (duplicate) throw new PlacementRefusal(409, DUPLICATE_PLACEMENT)
        const created = await tx.placement.create({
          data: {
            recruiterId,
            opportunityId: opportunity.id,
            candidateId: body.candidateId,
            talentId: body.talentId,
            monthlySalaryAr: body.monthlySalaryAr,
          },
        })
        await tx.auditLog.create({
          data: {
            userId: recruiterId,
            action: 'placement_declared',
            metadata: {
              placementId: created.id,
              opportunityId: opportunity.id,
              kind: body.candidateId ? 'candidat' : 'talent',
              ...(body.candidateId ? { candidateId: body.candidateId, suggestionId } : { talentId: body.talentId! }),
              ...(body.monthlySalaryAr ? { monthlySalaryAr: body.monthlySalaryAr } : {}),
            },
          },
        })
        return created
      })
    } catch (err) {
      if (err instanceof PlacementRefusal) {
        res.status(err.httpStatus).json({ error: err.message })
        return
      }
      throw err
    }

    res.status(201).json({ placement: toPlacementView(placement) })
    scheduleAdminNotification(async () => ({
      event: 'placement_declared',
      category: 'recruteur',
      title: 'Placement déclaré',
      message:
        `${await actorLabel(recruiterId)} a déclaré le placement d’un ` +
        `${placement.talentId ? 'talent vérifié' : 'candidat diplômé'}. Success fee à suivre.`,
      link: '/admin/placements',
    }))
  } catch (err) {
    next(err)
  }
})

/**
 * Placements du recruteur. Liste blanche explicite à tous les niveaux : le
 * nom du candidat ou du talent, jamais son email ni son téléphone (OffRec
 * reste l'intermédiaire).
 */
router.get('/mine', requireRole('recruiter'), async (req, res, next) => {
  try {
    const placements = await prisma.placement.findMany({
      where: { recruiterId: req.session!.sub },
      include: {
        opportunity: { select: { id: true, title: true, companyName: true } },
        candidate: { select: { id: true, candidateProfile: { select: { fullName: true } } } },
        talent: { select: { id: true, fullName: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
    res.json({
      placements: placements.map((p) => ({
        ...toPlacementView(p),
        opportunity: p.opportunity
          ? { id: p.opportunity.id, title: p.opportunity.title, companyName: p.opportunity.companyName }
          : null,
        candidate: p.candidate
          ? { id: p.candidate.id, fullName: p.candidate.candidateProfile?.fullName ?? null }
          : null,
        talent: p.talent ? { id: p.talent.id, fullName: p.talent.fullName } : null,
      })),
    })
  } catch (err) {
    next(err)
  }
})

router.put('/:id/stage', requireRole('recruiter', 'admin'), async (req, res, next) => {
  try {
    const placement = await prisma.placement.findUnique({ where: { id: req.params.id } })
    if (!placement) {
      res.status(404).json({ error: 'Placement introuvable.' })
      return
    }
    if (req.session!.role === 'recruiter' && placement.recruiterId !== req.session!.sub) {
      res.status(404).json({ error: 'Placement introuvable.' })
      return
    }
    const body = placementStageSchema.parse(req.body)
    const updated = await prisma.placement.update({
      where: { id: placement.id },
      data: { stage: body.stage },
    })
    // Correction d'un admin (sur le placement de quelqu'un d'autre) :
    // `admin_corrected_placement_stage`. Autodéclaration du recruteur :
    // `placement_stage_updated`, seulement si l'étape change vraiment.
    if (req.session!.role === 'admin') {
      await prisma.auditLog.create({
        data: {
          userId: req.session!.sub,
          action: 'admin_corrected_placement_stage',
          metadata: { placementId: placement.id, fromStage: placement.stage, toStage: body.stage },
        },
      })
    } else if (placement.stage !== updated.stage) {
      await prisma.auditLog.create({
        data: {
          userId: req.session!.sub,
          action: 'placement_stage_updated',
          metadata: { placementId: placement.id, fromStage: placement.stage, toStage: updated.stage },
        },
      })
    }
    res.json({ placement: toPlacementView(updated) })
    // Seule l'autodéclaration du recruteur est notifiée : la correction d'un
    // admin est déjà une décision d'admin, tracée dans le journal d'audit.
    if (req.session!.role === 'recruiter' && placement.stage !== updated.stage) {
      const recruiterId = req.session!.sub
      scheduleAdminNotification(async () => ({
        event: 'placement_stage_updated',
        category: 'recruteur',
        title: 'Étape de placement mise à jour',
        message:
          `${await actorLabel(recruiterId)} a fait passer un placement de ` +
          `« ${STAGE_LABELS[placement.stage] ?? placement.stage} » à « ${STAGE_LABELS[updated.stage] ?? updated.stage} ».`,
        link: '/admin/placements',
      }))
    }
  } catch (err) {
    next(err)
  }
})

router.get('/', requireRole('admin'), async (_req, res, next) => {
  try {
    const placements = await prisma.placement.findMany({
      include: {
        opportunity: { select: { id: true, title: true, companyName: true } },
        // `select` explicite sur chaque relation User — jamais `include: true`,
        // qui renverrait le compte complet (passwordHash compris) au front.
        recruiter: { select: { id: true, email: true, recruiterProfile: { select: { companyName: true } } } },
        candidate: { select: { id: true, email: true, candidateProfile: { select: { fullName: true } } } },
        talent: { select: { id: true, fullName: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
    res.json({ placements })
  } catch (err) {
    next(err)
  }
})

export default router
