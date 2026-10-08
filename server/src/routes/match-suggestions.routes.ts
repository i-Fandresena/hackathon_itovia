import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { requireRole } from '../middleware/rbac.js'
import { requireAuth } from '../middleware/auth.js'
import { toDomainOpportunity, type DbOpportunity } from '../lib/domain.js'
import { computeMatchFit } from '../lib/preselection.js'
import type { CandidateProfile, Opportunity } from '../../../src/types/index.js'

const router = Router()

router.use(requireAuth)

/** Champs du profil candidat qu'un recruteur a le droit de recevoir. */
const RECRUITER_VISIBLE_PROFILE = {
  fullName: true,
  province: true,
  city: true,
  educationLevel: true,
  experienceLevel: true,
  skills: true,
  desiredOpportunityTypes: true,
  availability: true,
  sector: true,
} as const

/**
 * Offre telle que le candidat a le droit de la voir dans ses dossiers : liste
 * blanche explicite, sans `recruiterId`, et `companyName` à `null` tant que
 * la mise en relation n'est pas confirmée (OffRec reste l'intermédiaire).
 */
function toCandidateVisibleOpportunity(opportunity: DbOpportunity, revealCompany: boolean) {
  const o = toDomainOpportunity(opportunity)
  return {
    id: o.id,
    title: o.title,
    category: o.category,
    sector: o.sector,
    sectorDetails: o.sectorDetails,
    description: o.description,
    province: o.province,
    city: o.city,
    opportunityType: o.opportunityType,
    requiredSkills: o.requiredSkills,
    level: o.level,
    deadline: o.deadline,
    createdAt: o.createdAt,
    featured: o.featured,
    companyName: revealCompany ? o.companyName : null,
  }
}

/**
 * Dossiers du candidat (décision produit 2026-10-08) : uniquement ceux qui
 * sont partis chez un recruteur (`proposee_recruteur` et au-delà). Les
 * suggestions encore en file de validation admin (`suggeree`) ne lui sont
 * pas montrées. Les lignes héritées `proposee_candidat` / `interet_candidat`
 * encore actives restent listées pour ne perdre aucun dossier en cours.
 */
router.get('/mine', requireRole('candidate'), async (req, res, next) => {
  try {
    const rows = await prisma.matchSuggestion.findMany({
      where: {
        candidateId: req.session!.sub,
        status: { in: ['proposee_candidat', 'interet_candidat', 'proposee_recruteur', 'interet_recruteur', 'mise_en_relation'] },
      },
      include: { opportunity: true },
      orderBy: { updatedAt: 'desc' },
    })
    const suggestions = rows.map(({ opportunity, ...suggestion }) => ({
      ...suggestion,
      opportunity: toCandidateVisibleOpportunity(opportunity, suggestion.status === 'mise_en_relation'),
    }))
    res.json({ suggestions })
  } catch (err) {
    next(err)
  }
})

/**
 * Suggestions transmises par OffRec (validation admin ou envoi direct du
 * moteur de matching) pour les offres de ce recruteur —
 * un profil décliné (`ecartee`) sort de cette liste : c'est ce qui le
 * "désélectionne" côté recruteur, plus besoin d'y revenir dessus.
 *
 * Chaque profil porte `fit`, son adéquation critère par critère avec l'offre
 * du recruteur (`computeMatchFit`) : uniquement des données dérivées des
 * champs de la liste blanche ci-dessus et de sa propre offre. Jamais
 * l'origine de la suggestion, l'indice « présent dans le CV », ni rien de la
 * vérification du CV. Tri : par offre, puis score décroissant.
 */
router.get('/received', requireRole('recruiter'), async (req, res, next) => {
  try {
    const rows = await prisma.matchSuggestion.findMany({
      where: {
        status: { in: ['proposee_recruteur', 'interet_recruteur', 'mise_en_relation'] },
        opportunity: { recruiterId: req.session!.sub },
      },
      // Liste blanche explicite à tous les niveaux — jamais `include`, jamais
      // `candidateProfile: true` : le recruteur ne reçoit ni le téléphone, ni
      // le CV (fichier, données extraites), ni rien de la vérification du CV
      // (statut, drapeaux, empreinte, vérificateur), ni l'origine de la
      // suggestion, qui restent internes à OffRec.
      select: {
        id: true,
        opportunityId: true,
        candidateId: true,
        score: true,
        reasons: true,
        status: true,
        preselectionRank: true,
        createdAt: true,
        updatedAt: true,
        opportunity: {
          select: {
            id: true,
            title: true,
            requiredSkills: true,
            province: true,
            city: true,
            level: true,
            opportunityType: true,
          },
        },
        candidate: { select: { id: true, email: true, candidateProfile: { select: RECRUITER_VISIBLE_PROFILE } } },
      },
    })
    const suggestions = rows
      .map(({ opportunity, ...suggestion }) => {
        const profile = suggestion.candidate.candidateProfile
        return {
          ...suggestion,
          opportunity: { id: opportunity.id, title: opportunity.title },
          fit: profile
            ? computeMatchFit(
                {
                  skills: profile.skills,
                  province: profile.province,
                  city: profile.city,
                  experienceLevel: profile.experienceLevel as CandidateProfile['experienceLevel'],
                  desiredOpportunityTypes: profile.desiredOpportunityTypes as CandidateProfile['desiredOpportunityTypes'],
                },
                {
                  requiredSkills: opportunity.requiredSkills,
                  province: opportunity.province,
                  city: opportunity.city,
                  level: opportunity.level as Opportunity['level'],
                  opportunityType: opportunity.opportunityType as Opportunity['opportunityType'],
                },
              )
            : null,
        }
      })
      .sort(
        (a, b) =>
          a.opportunity.title.localeCompare(b.opportunity.title, 'fr') ||
          a.opportunity.id.localeCompare(b.opportunity.id) ||
          b.score - a.score ||
          a.id.localeCompare(b.id),
      )
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
 *
 * Côté candidat, l'intérêt par offre n'existe plus (décision 2026-10-08) : le
 * consentement global le remplace. Seule une ligne héritée encore en
 * `proposee_candidat` peut être marquée intéressée. Aucune notification ne
 * part au candidat quand le recruteur exprime son intérêt : il n'est prévenu
 * qu'à la mise en relation.
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
        res.status(400).json({
          error:
            'Il n’est plus nécessaire de postuler offre par offre : OffRec propose votre profil aux entreprises dès lors que vous avez donné votre accord depuis votre profil.',
        })
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
 * Décliner/se retirer — le candidat peut se retirer d'un dossier à tout
 * moment avant la mise en relation (droit conservé avec le consentement
 * global : il ne choisit plus les offres, mais peut toujours en refuser
 * une) ; le recruteur écarte un profil proposé. Une ligne retirée n'est
 * jamais réactivée par le moteur de matching. Désélectionne (sort de `/received`/
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
        res.status(400).json({ error: 'Vous ne pouvez plus vous retirer de ce dossier.' })
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
