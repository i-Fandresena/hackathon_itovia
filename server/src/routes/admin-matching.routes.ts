import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { requireRole } from '../middleware/rbac.js'
import {
  adminHireProposalQuerySchema,
  adminInterviewQuerySchema,
  createMatchSuggestionSchema,
  matchSuggestionQuerySchema,
  matchSuggestionStatusSchema,
  preselectionQuerySchema,
  preselectionTransmitSchema,
} from '../lib/validation.js'
import { scoreOpportunity } from '../../../src/lib/recommendation.js'
import { toDomainCandidateProfile, toDomainOpportunity } from '../lib/domain.js'
import { parseCvFlags } from '../lib/cv-flags.js'
import { adminCandidateProfileSelect, toAdminCandidateProfile } from '../lib/admin-candidates.js'
import { getMatchingConfig, runMatchingForOpportunity } from '../lib/matching.js'
import { applyAdminTransition, loadPreselection, transmitPreselection } from '../lib/preselection-service.js'
import { loadHiringContexts, resyncInterviewCalendar, toAdminInterviewView } from '../lib/interviews.js'
import { listAdminInterviews } from '../lib/interview-list.js'
import { resetInterviewOutcome } from '../lib/hiring-service.js'
import { runHiringJobs, scheduleHiringJobs } from '../lib/hiring-jobs.js'
import { HIRING_SUPPORTED, HIRING_UNAVAILABLE_ERROR, displayedRound, loadLinkedPlacements } from '../lib/hiring-store.js'
import { listAdminHireProposals, loadProposalRows, proposalView } from '../lib/hire-proposals.js'
import { hiringPhase } from '../../../src/lib/hiring.js'

const router = Router()

router.use(requireRole('admin'))

/**
 * Présélection ATS d'une offre (voir lib/preselection.ts) : filtres
 * éliminatoires, classement, puis les `top` meilleurs profils (5 ou 10) avec
 * le détail par critère et l'état de leur suggestion éventuelle. Les
 * candidats éliminés sont renvoyés avec leur motif, et comptés par motif.
 * Lecture seule : rien n'est créé ni transmis. Aucun appel IA.
 */
router.get('/opportunities/:id/preselection', async (req, res, next) => {
  try {
    const { top, ...filters } = preselectionQuerySchema.parse(req.query)
    const preselection = await loadPreselection(req.params.id, { top, filters })
    if (!preselection) {
      res.status(404).json({ error: 'Offre introuvable.' })
      return
    }
    res.json({ preselection })
  } catch (err) {
    next(err)
  }
})

/**
 * Transmission groupée au recruteur d'une sélection de la présélection.
 * Le serveur recalcule la présélection avec les options reçues : seuls les
 * candidats retenus et transmissibles partent, chacun par la même transition
 * que le PATCH unitaire (consentement, notification du recruteur, audit).
 * Réponse détaillée par candidat ; un refus n'annule pas les autres envois.
 */
router.post('/opportunities/:id/preselection/transmit', async (req, res, next) => {
  try {
    const body = preselectionTransmitSchema.parse(req.body)
    const result = await transmitPreselection(
      req.params.id,
      body.candidateIds,
      { top: body.top, filters: body.filters },
      req.session!.sub,
    )
    if (!result) {
      res.status(404).json({ error: 'Offre introuvable.' })
      return
    }
    const transmitted = result.outcomes.filter((o) => o.transmitted).length
    res.json({ outcomes: result.outcomes, transmitted, refused: result.outcomes.length - transmitted })
  } catch (err) {
    next(err)
  }
})

/**
 * Relance manuelle du moteur de matching pour une offre — même règle hybride
 * que les déclencheurs automatiques (voir lib/matching.ts), exécutée ici de
 * façon synchrone pour renvoyer les compteurs à l'admin.
 */
router.post('/opportunities/:id/run-matching', async (req, res, next) => {
  try {
    const opportunity = await prisma.opportunity.findUnique({ where: { id: req.params.id }, select: { id: true } })
    if (!opportunity) {
      res.status(404).json({ error: 'Offre introuvable.' })
      return
    }
    const result = await runMatchingForOpportunity(opportunity.id, {
      trigger: 'admin_manual',
      actorId: req.session!.sub,
    })
    if (!result.eligible) {
      res.status(409).json({ error: 'Le matching ne peut pas être lancé : offre pourvue, expirée ou compte recruteur inactif.' })
      return
    }
    res.json({ result, config: getMatchingConfig() })
  } catch (err) {
    next(err)
  }
})

/**
 * Détail complet d'un profil candidat, pour que l'admin puisse l'examiner
 * avant de décider de le proposer — jamais le mot de passe ni autre champ
 * sensible : `select` et liste blanche partagés avec la fiche des comptes
 * candidats (lib/admin-candidates.ts).
 */
router.get('/candidates/:id', async (req, res, next) => {
  try {
    const profile = await prisma.candidateProfile.findUnique({
      where: { userId: req.params.id },
      select: { ...adminCandidateProfileSelect, user: { select: { email: true, createdAt: true } } },
    })
    if (!profile) {
      res.status(404).json({ error: 'Candidat introuvable.' })
      return
    }
    res.json({ candidate: toAdminCandidateProfile(profile, profile.user) })
  } catch (err) {
    next(err)
  }
})

/**
 * Mise en file manuelle : crée la suggestion dans la file de validation
 * (`suggeree`, origine `admin`), que l'admin transmet ensuite au recruteur.
 * C'est aussi la SEULE façon de réactiver un candidat écarté pour une offre
 * (action explicite de l'admin sur ce candidat, depuis la liste des éliminés
 * de la présélection). Aucune notification au candidat à ce stade : il n'est
 * prévenu qu'à la mise en relation (décision 2026-10-08).
 */
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
    // réactive plutôt que d'échouer. Seul un admin peut réactiver une ligne
    // écartée — le moteur de matching ne le fait jamais.
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
          data: { status: 'suggeree', origin: 'admin', score: match.score, reasons: match.reasons },
        })
      : await prisma.matchSuggestion.create({
          data: {
            opportunityId: body.opportunityId,
            candidateId: body.candidateId,
            score: match.score,
            reasons: match.reasons,
            status: 'suggeree',
            origin: 'admin',
          },
        })

    await prisma.auditLog.create({
      data: {
        userId: req.session!.sub,
        action: 'match_suggestion_created',
        metadata: { suggestionId: suggestion.id, opportunityId: opportunity.id, reactivated: Boolean(existing) },
      },
    })

    res.status(201).json({ suggestion })
  } catch (err) {
    next(err)
  }
})

/**
 * Suivi des suggestions. `?status=suggeree` donne la file de validation :
 * chaque ligne porte le score, les raisons, l'origine (`systeme` | `admin`)
 * et, côté candidat, le statut de vérification du CV et le consentement —
 * de quoi décider de transmettre ou d'écarter sans autre appel.
 */
router.get('/match-suggestions', async (req, res, next) => {
  try {
    const { status } = matchSuggestionQuerySchema.parse(req.query)
    const rows = await prisma.matchSuggestion.findMany({
      where: status ? { status } : undefined,
      include: {
        opportunity: { select: { id: true, title: true, companyName: true } },
        candidate: {
          select: {
            id: true,
            email: true,
            candidateProfile: {
              select: { fullName: true, cvUrl: true, cvVerificationStatus: true, cvFlags: true, matchingConsentAt: true },
            },
          },
        },
      },
      // File de validation : les meilleurs scores d'abord ; sinon les plus récentes.
      orderBy: status === 'suggeree' ? [{ score: 'desc' }, { createdAt: 'asc' }] : { updatedAt: 'desc' },
    })
    // Entretien fixé par le recruteur (décision 2026-10-14) : date, statut,
    // fournisseur et état de l'agenda Google, pour suivre et régulariser ;
    // issue du tour affiché et phase dérivée du dossier (sous-lot 3) ;
    // propositions d'embauche (vue admin, D3) et placement lié (sous-lot 5).
    const connected = rows.filter((row) => row.status === 'mise_en_relation')
    const [contexts, proposalRows, placements] = await Promise.all([
      loadHiringContexts(connected),
      loadProposalRows(connected.map((row) => row.id)),
      loadLinkedPlacements(connected.map((row) => row.id)),
    ])
    const now = new Date()
    const suggestions = rows.map(({ candidate, ...suggestion }) => {
      const profile = candidate.candidateProfile
      const context = contexts.get(suggestion.id)
      const interview = context ? displayedRound(context.rows) : undefined
      return {
        interview: interview ? toAdminInterviewView(interview) : null,
        phase: HIRING_SUPPORTED && context ? hiringPhase(context.state, now) : null,
        proposals: (proposalRows.get(suggestion.id) ?? []).map((row) => proposalView(row, 'admin', '', now)),
        placement: placements.get(suggestion.id) ?? null,
        ...suggestion,
        candidate: {
          id: candidate.id,
          email: candidate.email,
          candidateProfile: profile ? { fullName: profile.fullName } : null,
        },
        cvVerificationStatus: profile?.cvUrl ? profile.cvVerificationStatus : null,
        cvFlagCount: profile?.cvUrl ? parseCvFlags(profile.cvFlags).length : 0,
        matchingConsent: Boolean(profile?.matchingConsentAt),
      }
    })
    res.json({ suggestions })
  } catch (err) {
    next(err)
  }
})

/**
 * Transition unitaire. Règles et effets dans `applyAdminTransition`
 * (lib/preselection-service.ts), partagés avec la transmission groupée.
 */
router.patch('/match-suggestions/:id', async (req, res, next) => {
  try {
    const existing = await prisma.matchSuggestion.findUnique({
      where: { id: req.params.id },
      include: {
        opportunity: true,
        candidate: { select: { status: true, candidateProfile: { select: { matchingConsentAt: true } } } },
      },
    })
    if (!existing) {
      res.status(404).json({ error: 'Suggestion introuvable.' })
      return
    }
    const body = matchSuggestionStatusSchema.parse(req.body)
    const result = await applyAdminTransition({
      suggestion: existing,
      opportunity: existing.opportunity,
      hasConsent: Boolean(existing.candidate.candidateProfile?.matchingConsentAt),
      candidateBlocked: existing.candidate.status === 'suspended' || existing.candidate.status === 'banned',
      to: body.status,
      actorId: req.session!.sub,
    })
    if (!result.ok) {
      res.status(result.httpStatus).json({ error: result.error })
      return
    }
    res.json({ suggestion: result.suggestion })
  } catch (err) {
    next(err)
  }
})

/**
 * Onglet « Entretiens » de l'admin : tous les entretiens de la plateforme,
 * filtrés par `?period=` (défaut `a_venir`), `?status=`, `?opportunityId=`,
 * `?recruiterId=`, `?calendarIssue=true`,
 * `?outcome=a_renseigner|retenu|second_entretien|non_retenu|absent` ; page de
 * `?limit=` (30, 100 au plus) à partir de `?offset=`. Ordre : à venir du plus
 * proche au plus lointain, puis passés et annulés du plus récent au plus
 * ancien. Chaque tour porte son issue, son motif et l'explication d'absence
 * du candidat — jamais la note privée du recruteur (D3) — et la phase du
 * dossier ; compteurs `toRecord` (issues à renseigner) et `noShows` (absences).
 */
router.get('/interviews', async (req, res, next) => {
  try {
    const query = adminInterviewQuerySchema.parse(req.query)
    const outcome = await listAdminInterviews(query)
    if (outcome.ok) res.status(outcome.httpStatus).json(outcome.body)
    else res.status(outcome.httpStatus).json({ error: outcome.error })
    scheduleHiringJobs()
  } catch (err) {
    next(err)
  }
})

/**
 * Annuler l'issue d'un tour (erreur de saisie), seulement si rien n'en
 * découle : ni tour suivant, ni proposition, ni placement (409 sinon). Le
 * tour redevient actif ; le recruteur est prévenu de la renseigner de
 * nouveau. Journalisé (`interview_outcome_reset`).
 */
router.post('/interviews/:id/outcome/reset', async (req, res, next) => {
  try {
    const outcome = await resetInterviewOutcome({ interviewId: req.params.id, adminId: req.session!.sub })
    if (outcome.ok) res.status(outcome.httpStatus).json(outcome.body)
    else res.status(outcome.httpStatus).json({ error: outcome.error })
  } catch (err) {
    next(err)
  }
})

/**
 * Propositions d'embauche de la plateforme (sous-lot 5) :
 * `?status=envoyee|acceptee|refusee|expiree|retiree` (statut effectif : une
 * proposition échue compte comme `expiree` même avant le passage des
 * tâches). Chaque ligne : la proposition (vue admin — catégorie et
 * précision d'un refus, raison d'un retrait), le dossier, l'offre,
 * l'entreprise, le nom du candidat et la phase. 200 lignes au plus.
 */
router.get('/hire-proposals', async (req, res, next) => {
  try {
    const { status } = adminHireProposalQuerySchema.parse(req.query)
    const outcome = await listAdminHireProposals(status)
    if (outcome.ok) res.status(outcome.httpStatus).json(outcome.body)
    else res.status(outcome.httpStatus).json({ error: outcome.error })
  } catch (err) {
    next(err)
  }
})

/**
 * Lance à la demande les tâches « après l'entretien » (lib/hiring-jobs.ts) :
 * rappel au recruteur 24 h après la fin d'un tour sans issue (une fois par
 * tour), résumé aux admins des issues en souffrance depuis plus de 7 jours
 * (une fois par jour), expiration des propositions échues et rappel J-2 au
 * candidat (une fois par échéance). Idempotent. Journalisé (`hiring_jobs_run`).
 */
router.post('/hiring-jobs/run', async (req, res, next) => {
  try {
    if (!HIRING_SUPPORTED) {
      res.status(503).json({ error: HIRING_UNAVAILABLE_ERROR })
      return
    }
    const report = await runHiringJobs()
    await prisma.auditLog.create({
      data: {
        userId: req.session!.sub,
        action: 'hiring_jobs_run',
        metadata: {
          outcomeReminders: report.outcomeReminders,
          overdueOutcomes: report.overdueOutcomes,
          digestSent: report.digestSent,
          proposalsExpired: report.proposalsExpired,
          proposalReminders: report.proposalReminders,
        },
      },
    })
    res.json({ report })
  } catch (err) {
    next(err)
  }
})

/**
 * Régularisation de l'agenda Google d'un entretien (lien Meet en attente,
 * horaire non reporté, suppression échouée, ou entretien fixé en mode simulé
 * avant la configuration de Google) : relance la synchronisation.
 * 409 si Google n'est pas configuré, si l'entretien est terminé ou annulé
 * sans événement ; 502 si Google échoue encore (l'entretien porte alors le
 * nouveau message d'erreur). Journalisé (`interview_calendar_resync`).
 */
router.post('/interviews/:id/calendar-sync', async (req, res, next) => {
  try {
    const outcome = await resyncInterviewCalendar({ interviewId: req.params.id, adminId: req.session!.sub })
    if (outcome.ok) res.status(outcome.httpStatus).json(outcome.body)
    else res.status(outcome.httpStatus).json({ error: outcome.error })
  } catch (err) {
    next(err)
  }
})

export default router
