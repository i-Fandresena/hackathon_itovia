import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { requireRole } from '../middleware/rbac.js'
import { requireAuth } from '../middleware/auth.js'
import { toDomainOpportunity, type DbOpportunity } from '../lib/domain.js'
import { computeMatchFit } from '../lib/preselection.js'
import { clip, scheduleAdminNotification } from '../lib/notify.js'
import {
  activeRow,
  cancelInterview,
  confirmInterview,
  loadHiringContexts,
  reportInterviewUnavailable,
  rescheduleInterview,
  scheduleInterview,
  toCandidateInterviewView,
  toRecruiterInterviewView,
  type ServiceResult,
} from '../lib/interviews.js'
import { listRecruiterInterviews } from '../lib/interview-list.js'
import { recordInterviewOutcome, replyToAbsence } from '../lib/hiring-service.js'
import { scheduleHiringJobs } from '../lib/hiring-jobs.js'
import {
  acceptHireProposal,
  declineHireProposal,
  latestProposalView,
  loadProposalRows,
  proposalView,
  reviseHireProposal,
  sendHireProposal,
  withdrawHireProposal,
} from '../lib/hire-proposals.js'
import { STALE_SUGGESTION_ERROR, commitMatchTransition } from '../lib/preselection-service.js'
import { HIRING_SUPPORTED, displayedRound, loadLinkedPlacements, omitHiringColumns } from '../lib/hiring-store.js'
import { candidateHiringPhase, hiringPhase } from '../../../src/lib/hiring.js'
import type { MatchSuggestion as DbMatchSuggestion } from '@prisma/client'
import {
  absenceReplySchema,
  hireProposalAcceptSchema,
  hireProposalDeclineSchema,
  hireProposalReviseSchema,
  hireProposalSchema,
  hireProposalWithdrawSchema,
  interviewOutcomeSchema,
  interviewRescheduleSchema,
  interviewScheduleSchema,
  interviewUnavailableSchema,
  recruiterInterviewQuerySchema,
} from '../lib/validation.js'
import type { Response } from 'express'
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
    // Rédigées par le recruteur sans nom d'entreprise ni coordonnées
    // (aide du formulaire + refus serveur des emails, téléphones et sites).
    missions: o.missions,
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
 *
 * Après l'entretien (sous-lot 3) : chaque dossier mis en relation porte ses
 * tours (`interviews`, vue candidat : jamais l'issue, le motif ni la note —
 * seulement son explication d'absence et `canExplainAbsence`) et sa phase
 * neutre `candidatePhase` (`candidateHiringPhase` : « Dossier clos »,
 * « Suite favorable », « Entretien manqué »… jamais l'issue brute).
 * Sous-lot 5 : `proposal`, la dernière proposition d'embauche du dossier
 * (vue candidat, D3 : jamais la raison d'un retrait ni l'auteur ; son
 * `id` et sa `revision` servent à l'acceptation).
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
    // L'entretien n'existe qu'à partir de la mise en relation ; on ne le
    // renvoie au candidat que pour un dossier dans cet état (défense).
    const connected = rows.filter((row) => row.status === 'mise_en_relation')
    const [contexts, proposals] = await Promise.all([
      loadHiringContexts(connected),
      loadProposalRows(connected.map((row) => row.id)),
    ])
    const now = new Date()
    const candidateId = req.session!.sub
    const suggestions = rows.map(({ opportunity, ...suggestion }) => {
      const context = suggestion.status === 'mise_en_relation' ? contexts.get(suggestion.id) : undefined
      const interview = context ? displayedRound(context.rows) : undefined
      return {
        // Ni `connectedAt` ni `closedReason` (sous-lot 1).
        ...omitHiringColumns(suggestion),
        opportunity: toCandidateVisibleOpportunity(opportunity, suggestion.status === 'mise_en_relation'),
        interview: interview ? toCandidateInterviewView(interview) : null,
        interviews: context ? context.rows.map(toCandidateInterviewView) : [],
        candidatePhase: HIRING_SUPPORTED && context ? candidateHiringPhase(context.state, now) : null,
        proposal: context ? latestProposalView(proposals.get(suggestion.id), 'candidate', candidateId, now) : null,
      }
    })
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
 * vérification du CV. Tri : par offre, de la plus récemment publiée
 * (`Opportunity.createdAt`) à la plus ancienne, id de l'offre en départage,
 * puis score décroissant et id du dossier.
 *
 * Sous-lot 5 : `proposals` (toutes les versions, vue recruteur D3 : la
 * catégorie d'un refus, jamais sa précision), `proposal` (la dernière) et
 * `placement` (`{ id, stage, origin, startDate }` du placement lié, sinon
 * `null`) ; `phase` complète (proposition envoyée, embauché, déclinée,
 * poste pourvu…).
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
            // Date de publication de l'offre (ordre d'affichage, plus récente d'abord).
            createdAt: true,
          },
        },
        // Ni l'email ni le téléphone : OffRec reste l'intermédiaire.
        candidate: { select: { id: true, candidateProfile: { select: RECRUITER_VISIBLE_PROFILE } } },
      },
    })
    const recruiterId = req.session!.sub
    const connectedIds = rows.filter((row) => row.status === 'mise_en_relation').map((row) => row.id)
    const [contexts, proposalRows, placements] = await Promise.all([
      loadHiringContexts(rows.filter((row) => row.status === 'mise_en_relation')),
      loadProposalRows(connectedIds),
      loadLinkedPlacements(connectedIds),
    ])
    const now = new Date()
    const suggestions = rows
      .map(({ opportunity, ...suggestion }) => {
        const profile = suggestion.candidate.candidateProfile
        const context = contexts.get(suggestion.id)
        const interview = context ? displayedRound(context.rows) : undefined
        const active = context ? activeRow(context) : undefined
        return {
          ...suggestion,
          opportunity: { id: opportunity.id, title: opportunity.title, createdAt: opportunity.createdAt },
          // Tour actif, sinon le dernier (rétrocompatibilité) ; tous les tours
          // avec leur issue et leur motif (note privée : son auteur seulement,
          // jamais l'explication d'absence du candidat — D3).
          interview: interview ? toRecruiterInterviewView(interview, recruiterId) : null,
          interviews: context ? context.rows.map((row) => toRecruiterInterviewView(row, recruiterId)) : [],
          activeInterview: active ? toRecruiterInterviewView(active, recruiterId) : null,
          phase: HIRING_SUPPORTED && context ? hiringPhase(context.state, now) : null,
          proposals: (proposalRows.get(suggestion.id) ?? []).map((row) => proposalView(row, 'recruiter', recruiterId, now)),
          proposal: latestProposalView(proposalRows.get(suggestion.id), 'recruiter', recruiterId, now),
          placement: placements.get(suggestion.id) ?? null,
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
          b.opportunity.createdAt.getTime() - a.opportunity.createdAt.getTime() ||
          a.opportunity.id.localeCompare(b.opportunity.id) ||
          b.score - a.score ||
          a.id.localeCompare(b.id),
      )
    res.json({ suggestions })
    scheduleHiringJobs()
  } catch (err) {
    next(err)
  }
})

/**
 * Onglet « Entretiens » du recruteur : les entretiens de SES offres
 * (dossiers `mise_en_relation`), filtrés par `?period=a_venir|passes|annules|tous`
 * (défaut `a_venir`), `?status=`, `?opportunityId=` et
 * `?outcome=a_renseigner|retenu|second_entretien|non_retenu|absent`, avec
 * des compteurs par offre et globaux (dont `toRecord`, issues à renseigner)
 * et la phase de chaque dossier. Liste blanche (lib/interview-list.ts) : le
 * nom du candidat, l'entretien et son issue, jamais son email ni son
 * téléphone, ni son explication d'absence.
 */
router.get('/interviews', requireRole('recruiter'), async (req, res, next) => {
  try {
    const query = recruiterInterviewQuerySchema.parse(req.query)
    sendOutcome(res, await listRecruiterInterviews(req.session!.sub, query))
    scheduleHiringJobs()
  } catch (err) {
    next(err)
  }
})

/**
 * Intérêt sans date — ancien parcours.
 *
 * Recruteur : RETIRÉ depuis la décision 2026-10-14. « Ce profil
 * m'intéresse » exige désormais une date d'entretien et met directement en
 * relation (`POST /:id/interview`) ; garder un intérêt sans date laisserait
 * des dossiers en `interet_recruteur` attendre un admin qui n'est plus
 * qu'informé. Réponse 400 avec la marche à suivre. Les lignes déjà en
 * `interet_recruteur` reçoivent un entretien par `/interview` (ou sont
 * confirmées par un admin).
 *
 * Candidat : l'intérêt par offre n'existe plus (décision 2026-10-08) ; seule
 * une ligne héritée encore en `proposee_candidat` peut être marquée
 * intéressée.
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
      res.json({ suggestion: omitHiringColumns(updated) })
      return
    }

    // role === 'recruiter'
    if (suggestion.opportunity.recruiterId !== req.session!.sub) {
      res.status(404).json({ error: 'Suggestion introuvable.' })
      return
    }
    res.status(400).json({
      error:
        'Pour donner suite à ce profil, proposez une date d’entretien : la mise en relation est faite en même temps et le candidat est prévenu.',
    })
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
/** Dossier renvoyé après un retrait : liste blanche, sans l'origine de la
 *  suggestion (interne à OffRec). */
function declinedView(row: DbMatchSuggestion) {
  return {
    id: row.id,
    opportunityId: row.opportunityId,
    candidateId: row.candidateId,
    score: row.score,
    reasons: row.reasons,
    status: row.status,
    preselectionRank: row.preselectionRank,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

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
      // Écriture conditionnelle : si le recruteur a fixé un entretien (ou un
      // admin a fait avancer le dossier) entre la lecture et l'écriture, le
      // retrait n'écrase rien et répond 409.
      const updated = await commitMatchTransition(prisma, { id: suggestion.id, from: suggestion.status, to: 'ecartee' })
      if (!updated) {
        res.status(409).json({ error: STALE_SUGGESTION_ERROR })
        return
      }
      await prisma.auditLog.create({
        data: {
          userId: req.session!.sub,
          action: 'candidate_declined',
          // `from` : statut quitté (le tableau de bord recruteur ne compte
          // un retrait que s'il suit une transmission au recruteur).
          metadata: { opportunityTitle: suggestion.opportunity.title, suggestionId: suggestion.id, from: suggestion.status },
        },
      })
      res.json({ suggestion: declinedView(updated) })
      scheduleAdminNotification({
        event: 'candidate_declined',
        category: 'candidat',
        title: 'Candidat retiré d’un dossier',
        message:
          `${clip(suggestion.candidate.candidateProfile?.fullName, 60) || 'Un candidat'} s’est retiré du dossier ` +
          `« ${clip(suggestion.opportunity.title)} » (${clip(suggestion.opportunity.companyName, 60)}).`,
        link: '/admin/mise-en-relation',
      })
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
    // Même écriture conditionnelle que le retrait du candidat : un retrait
    // simultané du candidat ou une transition admin donne 409, jamais un
    // double effet.
    const updated = await commitMatchTransition(prisma, { id: suggestion.id, from: suggestion.status, to: 'ecartee' })
    if (!updated) {
      res.status(409).json({ error: STALE_SUGGESTION_ERROR })
      return
    }
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
    res.json({ suggestion: declinedView(updated) })
    const hadInterest = suggestion.status === 'interet_recruteur'
    scheduleAdminNotification({
      event: 'recruiter_declined',
      category: 'recruteur',
      title: 'Profil décliné par le recruteur',
      message:
        `${clip(suggestion.opportunity.companyName, 60)} a décliné le profil de ` +
        `${clip(suggestion.candidate.candidateProfile?.fullName, 60) || 'un candidat'} pour « ${clip(suggestion.opportunity.title)} »` +
        (hadInterest ? ', après avoir marqué son intérêt.' : '.'),
      link: '/admin/mise-en-relation',
    })
  } catch (err) {
    next(err)
  }
})

/* ------------------------------------------------------------------ */
/* Entretiens (décision produit 2026-10-14) — voir lib/interviews.ts   */
/* ------------------------------------------------------------------ */

function sendOutcome<T>(res: Response, outcome: ServiceResult<T>): void {
  if (outcome.ok) res.status(outcome.httpStatus).json(outcome.body)
  else res.status(outcome.httpStatus).json({ error: outcome.error })
}

/**
 * « Ce profil m'intéresse » : le recruteur propriétaire de l'offre fixe un
 * entretien (`{ scheduledAt, durationMinutes: 30|45|60, message? }`). Depuis
 * `proposee_recruteur` ou `interet_recruteur`, le dossier passe en
 * `mise_en_relation` ; le candidat est notifié (plateforme + email), les
 * admins informés. 403 hors de ses offres, 409 sans accord du candidat,
 * compte candidat inactif ou entretien déjà fixé.
 *
 * Tour suivant (sous-lot 3) : sur un dossier dont le dernier tour a l'issue
 * `second_entretien` ou `absent`, crée le tour n+1 (un seul tour actif, 3
 * tours au plus → 400, offre pourvue → 409) ; le candidat reçoit « Second
 * entretien proposé ». Après `retenu` ou `non_retenu` : 409.
 */
router.post('/:id/interview', requireRole('recruiter'), async (req, res, next) => {
  try {
    const body = interviewScheduleSchema.parse(req.body)
    const outcome = await scheduleInterview({
      suggestionId: req.params.id,
      recruiterId: req.session!.sub,
      scheduledAt: body.scheduledAt,
      durationMinutes: body.durationMinutes,
      message: body.message,
    })
    sendOutcome(res, outcome)
  } catch (err) {
    next(err)
  }
})

/** Reprogrammer (après un empêchement, une annulation, ou pour changer la date). */
router.patch('/:id/interview', requireRole('recruiter'), async (req, res, next) => {
  try {
    const body = interviewRescheduleSchema.parse(req.body)
    const outcome = await rescheduleInterview({
      suggestionId: req.params.id,
      recruiterId: req.session!.sub,
      scheduledAt: body.scheduledAt,
      durationMinutes: body.durationMinutes,
      message: body.message,
    })
    sendOutcome(res, outcome)
  } catch (err) {
    next(err)
  }
})

/** Annuler l'entretien — la mise en relation reste acquise. */
router.post('/:id/interview/cancel', requireRole('recruiter'), async (req, res, next) => {
  try {
    sendOutcome(res, await cancelInterview({ suggestionId: req.params.id, recruiterId: req.session!.sub }))
  } catch (err) {
    next(err)
  }
})

/** Le candidat confirme sa présence. */
router.post('/:id/interview/confirm', requireRole('candidate'), async (req, res, next) => {
  try {
    sendOutcome(res, await confirmInterview({ suggestionId: req.params.id, candidateId: req.session!.sub }))
  } catch (err) {
    next(err)
  }
})

/** Le candidat signale un empêchement (`{ reason }`, court, sans coordonnées). */
router.post('/:id/interview/unavailable', requireRole('candidate'), async (req, res, next) => {
  try {
    const body = interviewUnavailableSchema.parse(req.body)
    sendOutcome(
      res,
      await reportInterviewUnavailable({ suggestionId: req.params.id, candidateId: req.session!.sub, reason: body.reason }),
    )
  } catch (err) {
    next(err)
  }
})

/* ------------------------------------------------------------------ */
/* Après l'entretien (sous-lot 3) — voir lib/hiring-service.ts          */
/* ------------------------------------------------------------------ */

/**
 * Issue du tour actif, par le recruteur propriétaire, une fois l'heure de
 * fin passée : `{ interviewId, result: retenu|second_entretien|non_retenu|absent,
 * reason?, note?, nextRound? }`. 400 avant la fin, sur un tour annulé ou en
 * empêchement, au-delà de 3 tours ; 404 tour non actif ; 409 issue déjà
 * renseignée (double clic), accord retiré ou compte inactif (retenu, second
 * entretien), offre pourvue, tour suivant en conflit ; 503 suite non activée.
 * Le candidat reçoit un texte neutre, jamais le motif ni la note.
 */
router.post('/:id/interview/outcome', requireRole('recruiter'), async (req, res, next) => {
  try {
    const body = interviewOutcomeSchema.parse(req.body)
    sendOutcome(
      res,
      await recordInterviewOutcome({
        suggestionId: req.params.id,
        recruiterId: req.session!.sub,
        interviewId: body.interviewId,
        result: body.result,
        reason: body.reason ?? null,
        note: body.note,
        nextRound: body.nextRound,
      }),
    )
  } catch (err) {
    next(err)
  }
})

/**
 * Le candidat explique son absence (`{ interviewId, reason }`, 3 à 300
 * caractères, sans coordonnées) : une fois par tour absent, lue par les
 * admins seuls. 404 sans absence à expliquer, 409 déjà répondu.
 */
router.post('/:id/interview/absence-reply', requireRole('candidate'), async (req, res, next) => {
  try {
    const body = absenceReplySchema.parse(req.body)
    sendOutcome(
      res,
      await replyToAbsence({
        suggestionId: req.params.id,
        candidateId: req.session!.sub,
        interviewId: body.interviewId,
        reason: body.reason,
      }),
    )
  } catch (err) {
    next(err)
  }
})

/* ------------------------------------------------------------------ */
/* Propositions d'embauche (sous-lot 5) — voir lib/hire-proposals.ts   */
/* ------------------------------------------------------------------ */

/**
 * Le recruteur propriétaire envoie une proposition après un dernier tour
 * « Retenu » : `{ jobTitle, monthlySalaryAr, startDate (AAAA-MM-JJ),
 * contractType, contractDurationMonths?, message? }` (textes sans
 * coordonnées). 201 `{ proposal, phase }` ; 400 hors « Retenu » ou
 * validation ; 403 hors de ses offres ; 409 proposition déjà en attente,
 * réponse définitive, 3 versions atteintes, offre pourvue, accord retiré ou
 * compte inactif ; 503 suite non activée. Échéance : 7 jours (D2).
 */
router.post('/:id/hire-proposal', requireRole('recruiter'), async (req, res, next) => {
  try {
    const body = hireProposalSchema.parse(req.body)
    sendOutcome(
      res,
      await sendHireProposal({
        suggestionId: req.params.id,
        recruiterId: req.session!.sub,
        fields: {
          jobTitle: body.jobTitle,
          monthlySalaryAr: body.monthlySalaryAr,
          startDate: body.startDate,
          contractType: body.contractType,
          contractDurationMonths: body.contractDurationMonths ?? null,
          message: body.message,
        },
      }),
    )
  } catch (err) {
    next(err)
  }
})

/**
 * Modification de la proposition en attente : `{ revision, …champs }`. La
 * cohérence contrat / durée est recontrôlée sur la proposition fusionnée
 * (400) ; `revision + 1`, échéance relancée à 7 jours, candidat re-notifié.
 * 409 si la proposition a changé (réponse, expiration, autre modification).
 */
router.patch('/:id/hire-proposal', requireRole('recruiter'), async (req, res, next) => {
  try {
    const { revision, ...changes } = hireProposalReviseSchema.parse(req.body)
    sendOutcome(
      res,
      await reviseHireProposal({ suggestionId: req.params.id, recruiterId: req.session!.sub, revision, changes }),
    )
  } catch (err) {
    next(err)
  }
})

/** Retrait de la proposition en attente par le recruteur (`{ revision }`), motif `recruteur`. */
router.post('/:id/hire-proposal/withdraw', requireRole('recruiter'), async (req, res, next) => {
  try {
    const body = hireProposalWithdrawSchema.parse(req.body)
    sendOutcome(
      res,
      await withdrawHireProposal({ suggestionId: req.params.id, recruiterId: req.session!.sub, revision: body.revision }),
    )
  } catch (err) {
    next(err)
  }
})

/**
 * Le candidat accepte la révision qu'il a lue (`{ proposalId, revision }`) :
 * placement créé dans la même transaction, offre pourvue si le nombre de
 * postes est atteint. 200 `{ proposal, placementCreated, candidatePhase }` ;
 * 404 pas son dossier ; 409 proposition modifiée, expirée, retirée, déjà
 * répondue, poste pourvu, compte inactif, déjà embauché.
 */
router.post('/:id/hire-proposal/accept', requireRole('candidate'), async (req, res, next) => {
  try {
    const body = hireProposalAcceptSchema.parse(req.body)
    sendOutcome(
      res,
      await acceptHireProposal({
        suggestionId: req.params.id,
        candidateId: req.session!.sub,
        proposalId: body.proposalId,
        revision: body.revision,
      }),
    )
  } catch (err) {
    next(err)
  }
})

/**
 * Le candidat décline (`{ proposalId, revision, reason?, note? }`) : la
 * catégorie est montrée au recruteur, la précision aux admins seulement.
 */
router.post('/:id/hire-proposal/decline', requireRole('candidate'), async (req, res, next) => {
  try {
    const body = hireProposalDeclineSchema.parse(req.body)
    sendOutcome(
      res,
      await declineHireProposal({
        suggestionId: req.params.id,
        candidateId: req.session!.sub,
        proposalId: body.proposalId,
        revision: body.revision,
        reason: body.reason ?? null,
        note: body.note,
      }),
    )
  } catch (err) {
    next(err)
  }
})

export default router
