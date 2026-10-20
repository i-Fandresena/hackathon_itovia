/**
 * Script de contrôle des règles « après l'entretien » (src/lib/hiring.ts,
 * plan du 2026-10-16, sous-lots 2 et 5) et des schémas Zod qui s'appuient
 * dessus (lib/validation.ts), plus les règles pures serveur de l'offre
 * pourvue (lib/preselection.ts), et la mesure du sous-lot 7 (entonnoir,
 * indicateur, export pseudonymisé : lib/hiring-metrics.ts). Aucune base,
 * aucun serveur : des cas figés, l'heure courante est passée en paramètre
 * (`NOW`).
 *
 *   cd server && npx tsx scripts/hiring-examples.ts
 *
 * Affiche OK / ÉCHEC par vérification et sort en code 1 en cas d'échec.
 */
import {
  ABSENCE_ALREADY_REPLIED_ERROR,
  ALREADY_HIRED_ERROR,
  CANDIDATE_ACCOUNT_INACTIVE_ERROR,
  CANDIDATE_FORBIDDEN_KEYS,
  DOSSIER_NOT_FOUND_ERROR,
  HIRE_PROPOSAL_STATUSES,
  HIRING_FORBIDDEN_ERROR,
  HIRING_NOT_CONNECTED_ERROR,
  HIRING_PHASE_LABELS,
  INTERVIEW_RESULTS,
  MAX_PROPOSALS_ERROR,
  MAX_ROUNDS_ERROR,
  NO_ABSENCE_ERROR,
  NO_ACTIVE_ROUND_ERROR,
  NO_FURTHER_ROUND_ERROR,
  NO_INTERVIEW_ERROR,
  NO_OUTCOME_TO_RESET_ERROR,
  OPPORTUNITY_FILLED_ERROR,
  OUTCOME_ALREADY_RECORDED_ERROR,
  OUTCOME_ON_CANCELLED_ERROR,
  OUTCOME_ON_IMPEDIMENT_ERROR,
  OUTCOME_RESET_BLOCKED_ERROR,
  OUTCOME_RETENU_REQUIRED_ERROR,
  POSITION_FILLED_ERROR,
  PROPOSAL_ALREADY_ANSWERED_ERROR,
  PROPOSAL_CHANGED_ERROR,
  PROPOSAL_EXPIRED_ERROR,
  PROPOSAL_FINAL_ERROR,
  PROPOSAL_NOT_EXPIRED_ERROR,
  PROPOSAL_NOT_FOUND_ERROR,
  PROPOSAL_PENDING_ERROR,
  PROPOSAL_REVISED_ERROR,
  PROPOSAL_WITHDRAWN_ERROR,
  RECRUITER_ACCOUNT_INACTIVE_ERROR,
  RECRUITER_FORBIDDEN_KEYS,
  RESULT_REASON_LABELS,
  ROUND_ALREADY_SCHEDULED_ERROR,
  absentNotice,
  activeRoundOf,
  allowedHiringActions,
  allowedOutcomeResults,
  candidateHiringPhase,
  candidateTextLeaks,
  checkHiringAction,
  checkOpportunityFillAction,
  contractDurationError,
  effectiveProposalStatus,
  filledClosureEffect,
  filledNoticeKind,
  findForbiddenKeys,
  formatAriaryAmount,
  formatCivilDate,
  hireProposalExpiresAt,
  hireProposalReminderAt,
  hireSalaryError,
  hireStartDateError,
  hiringPhase,
  isOutcomeDue,
  isOutcomeOverdue,
  isOutcomeReminderDue,
  isProposalReminderDue,
  isRoundOver,
  madagascarToday,
  mergeProposalRevision,
  NO_PROPOSAL_CHANGE_ERROR,
  outcomeToRecord,
  nextProposalVersion,
  nextRoundNumber,
  nonRetenuNotice,
  outcomeReasonError,
  positionFilledNotice,
  positionsFillLabel,
  positionsUpdateError,
  proposalAcceptedNotice,
  proposalDeclinedNotice,
  proposalExpiredNotice,
  proposalReminderNotice,
  proposalRevisedNotice,
  proposalSentNotice,
  proposalSummaryText,
  proposalWithdrawnNotice,
  reasonsForResult,
  retenuNotice,
  roundMatchesOutcomeFilter,
  secondRoundNotice,
  shouldAutoFill,
  toHireProposalView,
  toRoundOutcomeView,
  type CandidateNotice,
  type ConnectionCheckResult,
  type HireProposalSource,
  type HiringActionInput,
  type HiringCheck,
  type HiringDossierState,
  type HiringPhase,
  type HiringProposalState,
  type HiringRoundState,
  type RoundOutcomeSource,
} from '../../src/lib/hiring.js'
import {
  absenceReplySchema,
  hireProposalAcceptSchema,
  hireProposalDeclineSchema,
  hireProposalReviseSchema,
  hireProposalSchema,
  hireProposalWithdrawSchema,
  interviewOutcomeFilterSchema,
  interviewOutcomeSchema,
  opportunityInputSchema,
  opportunityReopenSchema,
  adminHireProposalQuerySchema,
} from '../src/lib/validation.js'
import {
  ADMIN_ALLOWED_TRANSITIONS,
  OPPORTUNITY_FILLED_REASON,
  SYSTEM_ALLOWED_TRANSITIONS,
  opportunityClosedReason,
} from '../src/lib/preselection.js'
import {
  FUNNEL_STAGES,
  RESEARCH_COLUMNS,
  buildDossierFacts,
  buildResearchExport,
  cohortOf,
  computeFunnel,
  csvCell,
  daysBetween,
  dossierReceivedAt,
  generalizeResearchRows,
  isTestEmail,
  isTransmittedDossier,
  outcomeTimeliness,
  periodStart,
  pseudonym,
  rankBand,
  reasonTiedToScore,
  researchExportFilename,
  scoreBand,
  summarizeDelays,
  toResearchRow,
  type DossierFacts,
  type MetricsDossier,
  type MetricsPlacement,
  type MetricsProposal,
  type MetricsRound,
  type ResearchRow,
} from '../src/lib/hiring-metrics.js'

/** Mardi 20 octobre 2026, 13 h 00 à Madagascar. */
const NOW = new Date('2026-10-20T10:00:00.000Z')
const MIN = 60_000
const HOUR = 60 * MIN
const DAY = 24 * HOUR

let failures = 0
let total = 0
function check(label: string, ok: boolean, detail = '') {
  total++
  if (!ok) failures++
  console.log(`${ok ? 'OK    ' : 'ÉCHEC '} ${label}${detail ? ` — ${detail}` : ''}`)
}
const describe = (res: HiringCheck) => (res.ok ? 'ok' : `${res.httpStatus} ${res.error}`)
function expectOk(label: string, res: HiringCheck) {
  check(label, res.ok, res.ok ? '' : describe(res))
}
function expectFail(label: string, res: HiringCheck, status: number, error?: string) {
  check(label, !res.ok && res.httpStatus === status && (error === undefined || res.error === error), describe(res))
}

const at = (offsetMs: number) => new Date(NOW.getTime() + offsetMs).toISOString()

function round(partial: Partial<HiringRoundState> & { round: number }): HiringRoundState {
  return {
    id: partial.id ?? `r${partial.round}`,
    round: partial.round,
    status: partial.status ?? 'confirme',
    // Par défaut : a commencé il y a 2 h, durée 30 min — donc terminé.
    scheduledAt: partial.scheduledAt ?? at(-2 * HOUR),
    durationMinutes: partial.durationMinutes ?? 30,
    active: partial.active ?? !partial.outcome,
    outcome: partial.outcome ?? null,
    absenceReplied: partial.absenceReplied ?? false,
    outcomeReminderAt: partial.outcomeReminderAt ?? null,
  }
}

function proposal(partial: Partial<HiringProposalState> & { version: number }): HiringProposalState {
  return {
    id: partial.id ?? `p${partial.version}`,
    version: partial.version,
    status: partial.status ?? 'envoyee',
    expiresAt: partial.expiresAt ?? at(3 * DAY),
    revision: partial.revision ?? 0,
    withdrawReason: partial.withdrawReason ?? null,
    expiryReminderAt: partial.expiryReminderAt ?? null,
  }
}

function dossier(partial: Partial<HiringDossierState> = {}): HiringDossierState {
  return { status: 'mise_en_relation', rounds: [], proposals: [], placement: null, filledAt: null, ...partial }
}

const NO_CONSENT: ConnectionCheckResult = { ok: false, httpStatus: 409, error: 'ACCORD_RETIRE' }
const act = (input: Omit<HiringActionInput, 'now'> & { now?: Date }) => checkHiringAction({ now: NOW, ...input })

/** Dossiers types, réutilisés plus bas. */
const retenu1 = [round({ round: 1, outcome: 'retenu' })]
const D = {
  aPlanifier: dossier(),
  planifie: dossier({ rounds: [round({ round: 1, scheduledAt: at(2 * HOUR) })] }),
  enCours: dossier({ rounds: [round({ round: 1, scheduledAt: at(-10 * MIN), durationMinutes: 30 })] }),
  annule: dossier({ rounds: [round({ round: 1, status: 'annule' })] }),
  empechementPasse: dossier({ rounds: [round({ round: 1, status: 'empechement' })] }),
  issue: dossier({ rounds: [round({ round: 1 })] }),
  second: dossier({ rounds: [round({ round: 1, outcome: 'second_entretien' })] }),
  absent: dossier({ rounds: [round({ round: 1, outcome: 'absent' })] }),
  nonRetenu: dossier({ rounds: [round({ round: 1, outcome: 'non_retenu' })] }),
  retenu: dossier({ rounds: retenu1 }),
  proposition: dossier({ rounds: retenu1, proposals: [proposal({ version: 1, revision: 2 })] }),
  propositionEchue: dossier({ rounds: retenu1, proposals: [proposal({ version: 1, expiresAt: at(-MIN) })] }),
  propositionRetiree: dossier({ rounds: retenu1, proposals: [proposal({ version: 1, status: 'retiree', withdrawReason: 'recruteur' })] }),
  embauche: dossier({
    rounds: retenu1,
    proposals: [proposal({ version: 1, status: 'acceptee' })],
    placement: { stage: 'etape1_due' },
  }),
  embaucheAnnulee: dossier({
    rounds: retenu1,
    proposals: [proposal({ version: 1, status: 'acceptee' })],
    placement: { stage: 'annule' },
  }),
  refusee: dossier({ rounds: retenu1, proposals: [proposal({ version: 1, status: 'refusee' })] }),
  /** Placement déclaré avant les tours (seed `opp-1` / `candidat-1`) : aucun entretien. */
  placementDeclare: dossier({ placement: { stage: 'etape1_payee' } }),
}

/* ---------- 1. Phases dérivées ---------- */
console.log('\n1. Phases dérivées (hiringPhase / candidateHiringPhase)')
const phaseCases: [string, HiringDossierState, HiringPhase][] = [
  ['aucun tour', D.aPlanifier, 'entretien_a_planifier'],
  ['tour à venir', D.planifie, 'tour_planifie'],
  ['tour en cours (fin non atteinte)', D.enCours, 'tour_planifie'],
  ['tour actif annulé', D.annule, 'tour_annule'],
  ['empêchement, même passé', D.empechementPasse, 'tour_planifie'],
  ['fin passée sans issue', D.issue, 'issue_a_renseigner'],
  ['second entretien sans date', D.second, 'second_entretien_a_planifier'],
  ['absent', D.absent, 'absent'],
  ['non retenu', D.nonRetenu, 'non_retenu'],
  ['retenu sans proposition', D.retenu, 'retenu'],
  ['proposition en attente', D.proposition, 'proposition_envoyee'],
  ['proposition échue (job pas encore passé) → retenu', D.propositionEchue, 'retenu'],
  ['proposition retirée → retenu', D.propositionRetiree, 'retenu'],
  ['acceptée + placement actif', D.embauche, 'embauche'],
  ['acceptée + placement annulé', D.embaucheAnnulee, 'embauche_annulee'],
  ['proposition refusée', D.refusee, 'clos_proposition_refusee'],
  ['placement déclaré sans entretien', D.placementDeclare, 'embauche'],
  [
    'tour 2 à venir après un second entretien',
    dossier({ rounds: [round({ round: 1, outcome: 'second_entretien' }), round({ round: 2, scheduledAt: at(DAY) })] }),
    'tour_planifie',
  ],
]
for (const [label, state, expected] of phaseCases) {
  const phase = hiringPhase(state, NOW)
  check(`phase : ${label} → ${expected}`, phase === expected, String(phase))
}
const filled = (state: HiringDossierState) => ({ ...state, filledAt: at(-HOUR) })
check('offre pourvue : retenu → poste_pourvu', hiringPhase(filled(D.retenu), NOW) === 'poste_pourvu')
check('offre pourvue : issue à renseigner → poste_pourvu', hiringPhase(filled(D.issue), NOW) === 'poste_pourvu')
check('offre pourvue : proposition en attente → poste_pourvu', hiringPhase(filled(D.proposition), NOW) === 'poste_pourvu')
check('offre pourvue : non retenu reste non_retenu (terminal)', hiringPhase(filled(D.nonRetenu), NOW) === 'non_retenu')
check('offre pourvue : embauché reste embauche', hiringPhase(filled(D.embauche), NOW) === 'embauche')
check('offre pourvue : refus reste clos_proposition_refusee', hiringPhase(filled(D.refusee), NOW) === 'clos_proposition_refusee')
check(
  'hors mise_en_relation → null',
  (['suggeree', 'proposee_recruteur', 'interet_recruteur', 'ecartee'] as const).every(
    (status) => hiringPhase(dossier({ status }), NOW) === null && candidateHiringPhase(dossier({ status }), NOW) === null,
  ),
)
check(
  'filet : dernier tour sans issue et sans drapeau actif → tour actif',
  activeRoundOf([round({ round: 1, outcome: 'second_entretien' }), round({ round: 2, active: false })])?.round === 2,
)
check(
  'tour clos sans drapeau → aucun tour actif',
  activeRoundOf([round({ round: 1, outcome: 'retenu' })]) === undefined,
)

const candidateCases: [string, HiringDossierState, string][] = [
  ['issue à renseigner → suite_en_attente', D.issue, 'suite_en_attente'],
  ['second entretien sans date → suite_en_attente', D.second, 'suite_en_attente'],
  ['retenu → suite_favorable', D.retenu, 'suite_favorable'],
  ['absent → entretien_manque', D.absent, 'entretien_manque'],
  ['proposition → proposition_recue', D.proposition, 'proposition_recue'],
  ['embauché → embauche', D.embauche, 'embauche'],
  ['non retenu → clos', D.nonRetenu, 'clos'],
  ['refus → clos', D.refusee, 'clos'],
  ['poste pourvu → clos', filled(D.retenu), 'clos'],
  ['embauche annulée → clos', D.embaucheAnnulee, 'clos'],
]
for (const [label, state, expected] of candidateCases) {
  const phase = candidateHiringPhase(state, NOW)
  check(`candidat : ${label}`, phase === expected, String(phase))
}
check(
  'libellés candidat : jamais « Non retenu », « Absent » ni « Retenu »',
  Object.values(HIRING_PHASE_LABELS.candidate).every((label) => !/retenu|absent/i.test(label)),
)

/* ---------- 2. Heure de fin, rappels, filtres ---------- */
console.log('\n2. Heure de fin, rappels et filtres')
const endsNow = round({ round: 1, scheduledAt: at(-30 * MIN), durationMinutes: 30 })
const endsSoon = round({ round: 1, scheduledAt: at(-29 * MIN), durationMinutes: 30 })
check('fin = maintenant → terminé', isRoundOver(endsNow, NOW))
check('fin dans 1 min → pas terminé', !isRoundOver(endsSoon, NOW))
check('issue due à la fin exacte', isOutcomeDue(endsNow, NOW))
check('pas d’issue due sur un tour annulé', !isOutcomeDue(round({ round: 1, status: 'annule' }), NOW))
check('pas d’issue due en empêchement', !isOutcomeDue(round({ round: 1, status: 'empechement' }), NOW))
check('pas d’issue due sur un tour clos', !isOutcomeDue(round({ round: 1, outcome: 'retenu' }), NOW))
const ended23h = round({ round: 1, scheduledAt: at(-23 * HOUR - 30 * MIN), durationMinutes: 30 })
const ended24h = round({ round: 1, scheduledAt: at(-24 * HOUR - 30 * MIN), durationMinutes: 30 })
check('rappel recruteur : pas avant 24 h', !isOutcomeReminderDue(ended23h, NOW))
check('rappel recruteur : dû à 24 h', isOutcomeReminderDue(ended24h, NOW))
check('rappel recruteur : une seule fois', !isOutcomeReminderDue({ ...ended24h, outcomeReminderAt: at(-HOUR) }, NOW))
check('en souffrance : pas à 6 jours', !isOutcomeOverdue(round({ round: 1, scheduledAt: at(-6 * DAY) }), NOW))
check('en souffrance : à 7 jours', isOutcomeOverdue(round({ round: 1, scheduledAt: at(-7 * DAY - 30 * MIN) }), NOW))
check('filtre a_renseigner', roundMatchesOutcomeFilter(endsNow, 'a_renseigner', NOW))
check('filtre retenu', roundMatchesOutcomeFilter(round({ round: 1, outcome: 'retenu' }), 'retenu', NOW))
check('filtre absent ≠ retenu', !roundMatchesOutcomeFilter(round({ round: 1, outcome: 'retenu' }), 'absent', NOW))

/* ---------- 3. Issue d'un tour ---------- */
console.log('\n3. Issue d’un tour (record_outcome)')
const outcome = (state: HiringDossierState, extra: Partial<HiringActionInput> = {}) =>
  act({ actor: 'recruiter', action: 'record_outcome', state, interviewId: 'r1', ...extra })
expectFail('avant l’heure de fin → 400', outcome(D.enCours, { result: 'retenu' }), 400)
check(
  'message « pas encore terminé » avec l’heure de fin (Madagascar)',
  (() => {
    const res = outcome(D.enCours, { result: 'retenu' })
    return !res.ok && res.error.includes('13 h 20') && res.error.includes('heure de Madagascar')
  })(),
)
expectOk('juste à la fin → ok', outcome(dossier({ rounds: [endsNow] }), { result: 'non_retenu' }))
expectFail('tour en empêchement → 400', outcome(D.empechementPasse, { result: 'retenu' }), 400, OUTCOME_ON_IMPEDIMENT_ERROR)
expectFail('tour annulé → 400', outcome(D.annule, { result: 'retenu' }), 400, OUTCOME_ON_CANCELLED_ERROR)
expectFail('aucun entretien → 404', outcome(D.aPlanifier, { interviewId: undefined, result: 'retenu' }), 404, NO_INTERVIEW_ERROR)
expectFail('issue déjà posée (double clic) → 409', outcome(D.retenu, { result: 'retenu' }), 409, OUTCOME_ALREADY_RECORDED_ERROR)
expectFail('tour inconnu → 404', outcome(D.issue, { interviewId: 'zz', result: 'retenu' }), 404, NO_ACTIVE_ROUND_ERROR)
expectOk('sans issue choisie : la modale peut s’ouvrir', outcome(D.issue))
for (const result of INTERVIEW_RESULTS) expectOk(`issue ${result} au tour 1`, outcome(D.issue, { result }))
const round3 = dossier({
  rounds: [
    round({ round: 1, id: 'a', outcome: 'second_entretien' }),
    round({ round: 2, id: 'b', outcome: 'absent' }),
    round({ round: 3, id: 'r1' }),
  ],
})
expectFail('second entretien au tour 3 → 400 (D5)', outcome(round3, { result: 'second_entretien' }), 400, MAX_ROUNDS_ERROR)
expectOk('retenu au tour 3 → ok', outcome(round3, { result: 'retenu' }))
expectOk(
  'second entretien au tour 2 → ok',
  outcome(dossier({ rounds: [round({ round: 1, id: 'a', outcome: 'second_entretien' }), round({ round: 2, id: 'r1' })] }), {
    result: 'second_entretien',
  }),
)
expectFail('retenu sur offre pourvue → 409', outcome(filled(D.issue), { result: 'retenu' }), 409, OPPORTUNITY_FILLED_ERROR)
expectFail('second entretien sur offre pourvue → 409', outcome(filled(D.issue), { result: 'second_entretien' }), 409)
expectOk('non retenu sur offre pourvue → ok', outcome(filled(D.issue), { result: 'non_retenu' }))
expectOk('absent sur offre pourvue → ok', outcome(filled(D.issue), { result: 'absent' }))
expectFail('retenu sans accord → 409 (message de connectionCheck)', outcome(D.issue, { result: 'retenu', connection: NO_CONSENT }), 409, 'ACCORD_RETIRE')
expectFail('second entretien sans accord → 409', outcome(D.issue, { result: 'second_entretien', connection: NO_CONSENT }), 409)
expectOk('non retenu sans accord → ok', outcome(D.issue, { result: 'non_retenu', connection: NO_CONSENT }))
expectOk('absent sans accord → ok', outcome(D.issue, { result: 'absent', connection: NO_CONSENT }))
expectFail('candidat → 403', act({ actor: 'candidate', action: 'record_outcome', state: D.issue }), 403, HIRING_FORBIDDEN_ERROR)
expectFail('admin → 403', act({ actor: 'admin', action: 'record_outcome', state: D.issue }), 403)
expectFail(
  'dossier non mis en relation (recruteur) → 400',
  outcome(dossier({ status: 'proposee_recruteur' }), { result: 'retenu' }),
  400,
  HIRING_NOT_CONNECTED_ERROR,
)
check(
  'issues proposées au tour 3 : sans second entretien',
  allowedOutcomeResults(round3, NOW).join(',') === 'retenu,non_retenu,absent',
  allowedOutcomeResults(round3, NOW).join(','),
)
check(
  'issues proposées sans accord : non retenu et absent',
  allowedOutcomeResults(D.issue, NOW, NO_CONSENT).join(',') === 'non_retenu,absent',
)
check('aucune issue avant la fin', allowedOutcomeResults(D.enCours, NOW).length === 0)

/* ---------- 4. Tours suivants ---------- */
console.log('\n4. Tours (schedule_round, D5)')
const schedule = (state: HiringDossierState, extra: Partial<HiringActionInput> = {}) =>
  act({ actor: 'recruiter', action: 'schedule_round', state, ...extra })
expectOk('dossier sans entretien : tour 1', schedule(D.aPlanifier))
check('prochain tour : 1 sans entretien', nextRoundNumber([]) === 1)
expectOk('après second entretien : tour 2', schedule(D.second))
check('prochain tour : 2', nextRoundNumber(D.second.rounds) === 2)
expectOk('après absence : nouvelle chance (tour 2)', schedule(D.absent))
const absentAt2 = dossier({ rounds: [round({ round: 1, id: 'a', outcome: 'second_entretien' }), round({ round: 2, outcome: 'absent' })] })
expectOk('absence au tour 2 : tour 3 possible', schedule(absentAt2))
const absentAt3 = dossier({
  rounds: [
    round({ round: 1, id: 'a', outcome: 'second_entretien' }),
    round({ round: 2, id: 'b', outcome: 'absent' }),
    round({ round: 3, outcome: 'absent' }),
  ],
})
expectFail('absence au tour 3 : pas de tour 4 → 400', schedule(absentAt3), 400, MAX_ROUNDS_ERROR)
expectFail('tour actif existant → 409', schedule(D.planifie), 409, ROUND_ALREADY_SCHEDULED_ERROR)
expectFail('tour annulé (à reprogrammer) → 409', schedule(D.annule), 409, ROUND_ALREADY_SCHEDULED_ERROR)
expectFail('après retenu → 409', schedule(D.retenu), 409, NO_FURTHER_ROUND_ERROR)
expectFail('après non retenu → 409', schedule(D.nonRetenu), 409, NO_FURTHER_ROUND_ERROR)
expectFail('placement déclaré → 409', schedule(D.placementDeclare), 409, NO_FURTHER_ROUND_ERROR)
expectFail('offre pourvue → 409', schedule(filled(D.second)), 409, OPPORTUNITY_FILLED_ERROR)
expectFail('sans accord → 409', schedule(D.second, { connection: NO_CONSENT }), 409, 'ACCORD_RETIRE')

/* ---------- 5. Actions d'entretien existantes (miroir de lib/interviews.ts) ---------- */
console.log('\n5. Actions d’entretien existantes (tour actif)')
expectFail('reprogrammer sans tour actif → 404', act({ actor: 'recruiter', action: 'reschedule_round', state: D.retenu }), 404, NO_ACTIVE_ROUND_ERROR)
expectOk('reprogrammer un tour annulé → ok', act({ actor: 'recruiter', action: 'reschedule_round', state: D.annule }))
expectFail('reprogrammer sans accord → 409', act({ actor: 'recruiter', action: 'reschedule_round', state: D.planifie, connection: NO_CONSENT }), 409)
// Sous-lot 6 : une offre pourvue ne reçoit plus de nouvelle date (D1).
expectFail('reprogrammer un tour annulé sur offre pourvue → 409', act({ actor: 'recruiter', action: 'reschedule_round', state: filled(D.annule) }), 409, OPPORTUNITY_FILLED_ERROR)
expectFail('reprogrammer un empêchement sur offre pourvue → 409', act({ actor: 'recruiter', action: 'reschedule_round', state: filled(D.empechementPasse) }), 409, OPPORTUNITY_FILLED_ERROR)
expectFail('reprogrammer un tour passé sur offre pourvue → 409', act({ actor: 'recruiter', action: 'reschedule_round', state: filled(D.issue) }), 409, OPPORTUNITY_FILLED_ERROR)
expectOk('annuler un empêchement sur offre pourvue → ok', act({ actor: 'recruiter', action: 'cancel_round', state: filled(D.empechementPasse) }))
check(
  'offre pourvue, tour annulé : ni reprogrammer ni planifier (UI)',
  !allowedHiringActions('recruiter', filled(D.annule), NOW).some((a) => a === 'reschedule_round' || a === 'schedule_round'),
  allowedHiringActions('recruiter', filled(D.annule), NOW).join(','),
)
expectFail('annuler un tour annulé → 409', act({ actor: 'recruiter', action: 'cancel_round', state: D.annule }), 409)
expectOk('annulation système (offre pourvue) → ok', act({ actor: 'system', action: 'cancel_round', state: D.planifie }))
expectOk('confirmer avant le début → ok', act({ actor: 'candidate', action: 'confirm_round', state: dossier({ rounds: [round({ round: 1, status: 'planifie', scheduledAt: at(HOUR) })] }) }))
expectFail('confirmer après le début → 409', act({ actor: 'candidate', action: 'confirm_round', state: dossier({ rounds: [round({ round: 1, status: 'planifie' })] }) }), 409)
expectOk('confirmer deux fois → ok (idempotent)', act({ actor: 'candidate', action: 'confirm_round', state: D.planifie }))
expectFail('empêchement déjà signalé → 409', act({ actor: 'candidate', action: 'report_unavailable', state: D.empechementPasse }), 409)
expectFail('candidat sur un tour clos → 404', act({ actor: 'candidate', action: 'confirm_round', state: D.retenu }), 404, NO_ACTIVE_ROUND_ERROR)

/* ---------- 6. Explication d'absence ---------- */
console.log('\n6. Explication d’absence (absence_reply)')
const reply = (state: HiringDossierState, extra: Partial<HiringActionInput> = {}) =>
  act({ actor: 'candidate', action: 'absence_reply', state, ...extra })
expectOk('tour absent → ok', reply(D.absent, { interviewId: 'r1' }))
expectOk('tour absent sans interviewId → dernier tour absent', reply(D.absent))
expectFail('déjà répondu → 409', reply(dossier({ rounds: [round({ round: 1, outcome: 'absent', absenceReplied: true })] })), 409, ABSENCE_ALREADY_REPLIED_ERROR)
expectFail('tour non absent → 404', reply(D.retenu, { interviewId: 'r1' }), 404, NO_ABSENCE_ERROR)
expectOk(
  'tour suivant déjà fixé : l’explication reste possible',
  reply(dossier({ rounds: [round({ round: 1, id: 'a', outcome: 'absent' }), round({ round: 2, scheduledAt: at(DAY) })] }), { interviewId: 'a' }),
)
expectFail('dossier non mis en relation (candidat) → 404', reply(dossier({ status: 'interet_recruteur' })), 404, DOSSIER_NOT_FOUND_ERROR)
expectFail('recruteur → 403', act({ actor: 'recruiter', action: 'absence_reply', state: D.absent }), 403)

/* ---------- 7. Propositions d'embauche (D2) ---------- */
console.log('\n7. Propositions d’embauche')
check('échéance : +7 jours', hireProposalExpiresAt(NOW).toISOString() === at(7 * DAY))
check('rappel : J-2', hireProposalReminderAt(at(7 * DAY)).toISOString() === at(5 * DAY))
check('rappel non dû à J-3', !isProposalReminderDue(proposal({ version: 1, expiresAt: at(3 * DAY) }), NOW))
check('rappel dû à J-2', isProposalReminderDue(proposal({ version: 1, expiresAt: at(2 * DAY) }), NOW))
check('rappel dû à J-1', isProposalReminderDue(proposal({ version: 1, expiresAt: at(DAY) }), NOW))
check('rappel envoyé une seule fois', !isProposalReminderDue(proposal({ version: 1, expiresAt: at(DAY), expiryReminderAt: at(-HOUR) }), NOW))
check('pas de rappel une fois échue', !isProposalReminderDue(proposal({ version: 1, expiresAt: at(-MIN) }), NOW))
check(
  'modification : nouvelle échéance à +7 j, rappel remis à zéro → plus dû',
  !isProposalReminderDue(proposal({ version: 1, expiresAt: hireProposalExpiresAt(NOW).toISOString(), expiryReminderAt: null }), NOW),
)
check('échéance exacte → expirée', effectiveProposalStatus(proposal({ version: 1, expiresAt: at(0) }), NOW) === 'expiree')
check('1 min avant l’échéance → envoyée', effectiveProposalStatus(proposal({ version: 1, expiresAt: at(MIN) }), NOW) === 'envoyee')
check('statut retiree inchangé', effectiveProposalStatus(proposal({ version: 1, status: 'retiree', expiresAt: at(-DAY) }), NOW) === 'retiree')
check('version suivante', nextProposalVersion([proposal({ version: 1 }), proposal({ version: 2 })]) === 3)

const send = (state: HiringDossierState, extra: Partial<HiringActionInput> = {}) =>
  act({ actor: 'recruiter', action: 'send_proposal', state, ...extra })
expectOk('envoi depuis retenu → ok', send(D.retenu))
expectFail('déjà une proposition en attente → 409', send(D.proposition), 409, PROPOSAL_PENDING_ERROR)
expectOk('après échéance (avant le job) → ok', send(D.propositionEchue))
expectOk('après retrait → ok', send(D.propositionRetiree))
expectFail(
  '3 versions déjà envoyées → 409',
  send(dossier({
    rounds: retenu1,
    proposals: [
      proposal({ version: 1, status: 'expiree' }),
      proposal({ version: 2, status: 'retiree' }),
      proposal({ version: 3, status: 'expiree' }),
    ],
  })),
  409,
  MAX_PROPOSALS_ERROR,
)
expectFail('après un refus → 409', send(D.refusee), 409, PROPOSAL_FINAL_ERROR)
expectFail('embauché → 409', send(D.embauche), 409, ALREADY_HIRED_ERROR)
expectFail('après acceptation puis désistement → 409', send(D.embaucheAnnulee), 409, PROPOSAL_FINAL_ERROR)
expectFail('issue pas encore « retenu » → 400', send(D.issue), 400, OUTCOME_RETENU_REQUIRED_ERROR)
expectFail('second entretien → 400', send(D.second), 400, OUTCOME_RETENU_REQUIRED_ERROR)
expectFail('offre pourvue → 409', send(filled(D.retenu)), 409, OPPORTUNITY_FILLED_ERROR)
expectFail('sans accord → 409', send(D.retenu, { connection: NO_CONSENT }), 409, 'ACCORD_RETIRE')

const revise = (state: HiringDossierState, extra: Partial<HiringActionInput> = {}) =>
  act({ actor: 'recruiter', action: 'revise_proposal', state, revision: 2, ...extra })
expectOk('modifier (bonne révision) → ok', revise(D.proposition))
expectFail('modifier (révision périmée) → 409', revise(D.proposition, { revision: 1 }), 409, PROPOSAL_CHANGED_ERROR)
expectFail('modifier une proposition échue → 409', revise(D.propositionEchue, { revision: 0 }), 409, PROPOSAL_CHANGED_ERROR)
expectFail('modifier sans proposition en attente → 409', revise(D.retenu), 409, PROPOSAL_CHANGED_ERROR)
expectFail('modifier sur offre pourvue → 409', revise(filled(D.proposition)), 409, OPPORTUNITY_FILLED_ERROR)
expectFail('modifier sans accord → 409', revise(D.proposition, { connection: NO_CONSENT }), 409)
expectOk('retirer (bonne révision) → ok, même sans accord', act({ actor: 'recruiter', action: 'withdraw_proposal', state: D.proposition, revision: 2, connection: NO_CONSENT }))
expectFail('retirer (révision périmée) → 409', act({ actor: 'recruiter', action: 'withdraw_proposal', state: D.proposition, revision: 0 }), 409, PROPOSAL_CHANGED_ERROR)
expectOk('retrait système (poste pourvu) sans révision', act({ actor: 'system', action: 'withdraw_proposal', state: filled(D.proposition), revision: 99 }))

const answer = (action: 'accept_proposal' | 'decline_proposal', state: HiringDossierState, extra: Partial<HiringActionInput> = {}) =>
  act({ actor: 'candidate', action, state, proposalId: 'p1', revision: 2, ...extra })
expectOk('accepter la révision lue → ok', answer('accept_proposal', D.proposition))
expectOk('accepter sans accord de matching → ok (§4.3)', answer('accept_proposal', D.proposition, { connection: NO_CONSENT }))
expectFail('accepter une révision périmée → 409', answer('accept_proposal', D.proposition, { revision: 1 }), 409, PROPOSAL_REVISED_ERROR)
expectFail('accepter à l’échéance exacte → 409', answer('accept_proposal', dossier({ rounds: retenu1, proposals: [proposal({ version: 1, revision: 2, expiresAt: at(0) })] })), 409, PROPOSAL_EXPIRED_ERROR)
expectFail('accepter une proposition marquée expirée → 409', answer('accept_proposal', dossier({ rounds: retenu1, proposals: [proposal({ version: 1, revision: 2, status: 'expiree' })] })), 409, PROPOSAL_EXPIRED_ERROR)
expectFail('accepter une proposition retirée → 409', answer('accept_proposal', D.propositionRetiree, { revision: 0 }), 409, PROPOSAL_WITHDRAWN_ERROR)
expectFail(
  'accepter une proposition retirée (poste pourvu) → 409 « poste pourvu »',
  answer('accept_proposal', dossier({ rounds: retenu1, proposals: [proposal({ version: 1, status: 'retiree', withdrawReason: 'poste_pourvu' })] }), { revision: 0 }),
  409,
  POSITION_FILLED_ERROR,
)
expectFail('accepter deux fois → 409', answer('accept_proposal', D.embauche, { revision: 0 }), 409, PROPOSAL_ALREADY_ANSWERED_ERROR)
expectFail('accepter sur offre pourvue → 409', answer('accept_proposal', filled(D.proposition)), 409, POSITION_FILLED_ERROR)
expectFail('accepter, compte candidat suspendu → 409', answer('accept_proposal', D.proposition, { candidateBlocked: true }), 409, CANDIDATE_ACCOUNT_INACTIVE_ERROR)
expectFail('accepter, compte recruteur suspendu → 409', answer('accept_proposal', D.proposition, { recruiterBlocked: true }), 409, RECRUITER_ACCOUNT_INACTIVE_ERROR)
expectFail('proposition inconnue → 404', answer('accept_proposal', D.proposition, { proposalId: 'p9' }), 404, PROPOSAL_NOT_FOUND_ERROR)
expectFail('recruteur qui accepte → 403', act({ actor: 'recruiter', action: 'accept_proposal', state: D.proposition }), 403)
expectFail('dossier non mis en relation → 404', answer('accept_proposal', dossier({ status: 'ecartee' })), 404, DOSSIER_NOT_FOUND_ERROR)
expectOk('décliner → ok', answer('decline_proposal', D.proposition))
expectOk('décliner sur offre pourvue (pas encore retirée) → ok', answer('decline_proposal', filled(D.proposition)))
expectFail('décliner une révision périmée → 409', answer('decline_proposal', D.proposition, { revision: 0 }), 409, PROPOSAL_REVISED_ERROR)
expectFail('décliner après refus → 409', answer('decline_proposal', D.refusee, { revision: 0 }), 409, PROPOSAL_ALREADY_ANSWERED_ERROR)
expectOk('expiration système d’une proposition échue', act({ actor: 'system', action: 'expire_proposal', state: D.propositionEchue }))
expectFail('expiration système avant l’échéance → 409', act({ actor: 'system', action: 'expire_proposal', state: D.proposition }), 409, PROPOSAL_NOT_EXPIRED_ERROR)
expectFail('expiration par le recruteur → 403', act({ actor: 'recruiter', action: 'expire_proposal', state: D.propositionEchue }), 403)

/* ---------- 8. Annulation d'une issue (admin) ---------- */
console.log('\n8. Annulation d’une issue (reset_outcome)')
const reset = (state: HiringDossierState, extra: Partial<HiringActionInput> = {}) =>
  act({ actor: 'admin', action: 'reset_outcome', state, ...extra })
expectOk('issue sans suite → ok', reset(D.nonRetenu))
expectOk('retenu sans proposition → ok', reset(D.retenu, { interviewId: 'r1' }))
expectFail('tour suivant existant → 409', reset(dossier({ rounds: [round({ round: 1, outcome: 'second_entretien' }), round({ round: 2, scheduledAt: at(DAY) })] }), { interviewId: 'r1' }), 409, OUTCOME_RESET_BLOCKED_ERROR)
expectFail('proposition existante → 409', reset(D.propositionRetiree), 409, OUTCOME_RESET_BLOCKED_ERROR)
expectFail('aucune issue → 409', reset(D.issue, { interviewId: 'r1' }), 409, NO_OUTCOME_TO_RESET_ERROR)
expectFail('recruteur → 403', act({ actor: 'recruiter', action: 'reset_outcome', state: D.nonRetenu }), 403)

/* ---------- 9. Actions affichées par l'UI ---------- */
console.log('\n9. Actions possibles par phase (allowedHiringActions)')
const list = (actor: 'recruiter' | 'candidate' | 'admin', state: HiringDossierState, connection?: ConnectionCheckResult) =>
  allowedHiringActions(actor, state, NOW, connection).join(',')
check('recruteur, issue à renseigner', list('recruiter', D.issue) === 'record_outcome,reschedule_round,cancel_round', list('recruiter', D.issue))
check('recruteur, retenu', list('recruiter', D.retenu) === 'send_proposal', list('recruiter', D.retenu))
check('recruteur, proposition', list('recruiter', D.proposition) === 'revise_proposal,withdraw_proposal', list('recruiter', D.proposition))
check('recruteur, proposition sans accord', list('recruiter', D.proposition, NO_CONSENT) === 'withdraw_proposal', list('recruiter', D.proposition, NO_CONSENT))
check('recruteur, absent', list('recruiter', D.absent) === 'schedule_round', list('recruiter', D.absent))
check('recruteur, non retenu : rien', list('recruiter', D.nonRetenu) === '', list('recruiter', D.nonRetenu))
check('candidat, proposition', list('candidate', D.proposition) === 'accept_proposal,decline_proposal', list('candidate', D.proposition))
check('candidat, absent', list('candidate', D.absent) === 'absence_reply', list('candidate', D.absent))
check('admin, non retenu', list('admin', D.nonRetenu) === 'reset_outcome', list('admin', D.nonRetenu))

/* ---------- 10. Offre pourvue (D1) ---------- */
console.log('\n10. Offre pourvue (positions, clôture, réouverture)')
check('2 postes, 1 placement → reste ouverte', !shouldAutoFill({ positions: 2, activePlacements: 1, filledAt: null }))
check('2 postes, 2 placements → pourvue', shouldAutoFill({ positions: 2, activePlacements: 2, filledAt: null }))
check('déjà pourvue → pas de seconde clôture', !shouldAutoFill({ positions: 1, activePlacements: 1, filledAt: at(-HOUR) }))
check('libellé pourvue', positionsFillLabel({ positions: 2, activePlacements: 2, filledAt: at(0) }) === 'Pourvue (2/2)')
check('libellé ouverte', positionsFillLabel({ positions: 3, activePlacements: 1, filledAt: null }) === 'Postes pourvus : 1/3')
const markFilled = checkOpportunityFillAction({ action: 'mark_filled', state: { positions: 2, activePlacements: 0, filledAt: null } })
check('clôture manuelle → ok', markFilled.ok)
check('clôture manuelle d’une offre pourvue → 409', !checkOpportunityFillAction({ action: 'mark_filled', state: { positions: 1, activePlacements: 1, filledAt: at(0) } }).ok)
check('rouvrir une offre ouverte → 409', (() => {
  const res = checkOpportunityFillAction({ action: 'reopen', state: { positions: 1, activePlacements: 0, filledAt: null } })
  return !res.ok && res.httpStatus === 409
})())
check('rouvrir (1 poste, 1 placement) → 2 postes', (() => {
  const res = checkOpportunityFillAction({ action: 'reopen', state: { positions: 1, activePlacements: 1, filledAt: at(0) } })
  return res.ok && res.positions === 2
})())
check('rouvrir après clôture manuelle (3 postes, 1 placement) → 3 postes', (() => {
  const res = checkOpportunityFillAction({ action: 'reopen', state: { positions: 3, activePlacements: 1, filledAt: at(0) } })
  return res.ok && res.positions === 3
})())
check('rouvrir avec 2 postes demandés pour 2 placements → 400', (() => {
  const res = checkOpportunityFillAction({ action: 'reopen', state: { positions: 2, activePlacements: 2, filledAt: at(0) }, requestedPositions: 2 })
  return !res.ok && res.httpStatus === 400
})())
check('rouvrir avec 4 postes demandés → 4', (() => {
  const res = checkOpportunityFillAction({ action: 'reopen', state: { positions: 2, activePlacements: 2, filledAt: at(0) }, requestedPositions: 4 })
  return res.ok && res.positions === 4
})())
check('postes : 0 refusé', positionsUpdateError(0, 0) !== null)
check('postes : 51 refusé', positionsUpdateError(51, 0) !== null)
check('postes : sous les placements actifs refusé', positionsUpdateError(1, 2) !== null)
check('postes : égal aux placements accepté', positionsUpdateError(2, 2) === null)

const upcoming = filledClosureEffect(D.planifie, NOW)
check('clôture : tour à venir annulé', upcoming?.cancelRoundId === 'r1' && upcoming.withdrawProposalId === null)
const pastRound = filledClosureEffect(D.issue, NOW)
check('clôture : tour passé sans issue non annulé', pastRound !== null && pastRound.cancelRoundId === null)
check('clôture : proposition en attente retirée', filledClosureEffect(D.proposition, NOW)?.withdrawProposalId === 'p1')
check('clôture : proposition échue non retirée (le job l’expire)', filledClosureEffect(D.propositionEchue, NOW)?.withdrawProposalId === null)
check('clôture : dossier embauché intact', filledClosureEffect(D.embauche, NOW) === null)
check('clôture : dossier non retenu intact', filledClosureEffect(D.nonRetenu, NOW) === null)
check('avis : mis en relation en cours', filledNoticeKind(D.retenu, NOW) === 'mis_en_relation')
check('avis : embauché → aucun', filledNoticeKind(D.embauche, NOW) === null)
check('avis : non retenu → aucun', filledNoticeKind(D.nonRetenu, NOW) === null)
check('avis : profil transmis', filledNoticeKind(dossier({ status: 'proposee_recruteur' }), NOW) === 'profil_transmis')
check('avis : intérêt recruteur', filledNoticeKind(dossier({ status: 'interet_recruteur' }), NOW) === 'profil_transmis')
check('avis : file de validation → aucun', filledNoticeKind(dossier({ status: 'suggeree' }), NOW) === null)
check('avis : écarté → aucun', filledNoticeKind(dossier({ status: 'ecartee' }), NOW) === null)

/* ---------- 11. Champs d'une issue et d'une proposition ---------- */
console.log('\n11. Champs (motifs, salaire, date de début, contrat)')
check('non retenu sans motif → erreur', outcomeReasonError('non_retenu', null) !== null)
check('non retenu + compétences → ok', outcomeReasonError('non_retenu', 'competences_techniques') === null)
check('non retenu + points forts → erreur', outcomeReasonError('non_retenu', 'points_forts') !== null)
check('retenu sans motif → ok', outcomeReasonError('retenu', undefined) === null)
check('retenu + points forts → ok', outcomeReasonError('retenu', 'points_forts') === null)
check('second entretien + expérience → erreur', outcomeReasonError('second_entretien', 'experience') !== null)
check('absent + motif → erreur', outcomeReasonError('absent', 'autre') !== null)
check('motifs d’un retenu : points forts seulement', reasonsForResult('retenu').join() === 'points_forts')
check('motifs d’une absence : aucun', reasonsForResult('absent').length === 0)
check('salaire décimal refusé', hireSalaryError(450_000.5) !== null)
check('salaire 49 999 refusé', hireSalaryError(49_999) !== null)
check('salaire 50 000 accepté', hireSalaryError(50_000) === null)
check('salaire 100 000 001 refusé', hireSalaryError(100_000_001) !== null)
check('montant groupé', formatAriaryAmount(1_200_000) === '1 200 000', formatAriaryAmount(1_200_000))
const lateEvening = new Date('2026-10-20T22:00:00.000Z') // 21 oct. 01 h 00 à Madagascar
check('aujourd’hui à Madagascar (UTC+3)', madagascarToday(lateEvening) === '2026-10-21')
check('début la veille (heure de Madagascar) refusé', hireStartDateError('2026-10-20', lateEvening) !== null)
check('début aujourd’hui accepté', hireStartDateError('2026-10-21', lateEvening) === null)
check('début à +180 j accepté', hireStartDateError('2027-04-18', NOW) === null)
check('début à +181 j refusé', hireStartDateError('2027-04-19', NOW) !== null)
check('date impossible refusée', hireStartDateError('2026-11-31', NOW) !== null)
check('format invalide refusé', hireStartDateError('20/10/2026', NOW) !== null)
check('CDD sans durée → erreur', contractDurationError('cdd', null) !== null)
check('stage sans durée → erreur', contractDurationError('stage', undefined) !== null)
check('CDI avec durée → erreur', contractDurationError('cdi', 12) !== null)
check('CDI sans durée → ok', contractDurationError('cdi', null) === null)
check('freelance sans durée → ok', contractDurationError('freelance', null) === null)
check('CDD 37 mois → erreur', contractDurationError('cdd', 37) !== null)
check('CDD 6 mois → ok', contractDurationError('cdd', 6) === null)

/* ---------- 12. Visibilité (D3) ---------- */
console.log('\n12. Visibilité par rôle (D3)')
const outcomeRow: RoundOutcomeSource = {
  outcome: 'absent',
  outcomeReason: null,
  outcomeNote: 'Note privée du recruteur',
  outcomeAt: at(-HOUR),
  outcomeById: 'rec-1',
  absenceReply: 'Panne de taxi-be',
  absenceReplyAt: at(-MIN),
}
const asCandidate = toRoundOutcomeView(outcomeRow, { audience: 'candidate', userId: 'cand-1' })
const asAuthor = toRoundOutcomeView(outcomeRow, { audience: 'recruiter', userId: 'rec-1' })
const asOtherRecruiter = toRoundOutcomeView(outcomeRow, { audience: 'recruiter', userId: 'rec-2' })
const asAdmin = toRoundOutcomeView(outcomeRow, { audience: 'admin', userId: 'adm-1' })
check('candidat : ni issue, ni motif, ni note', findForbiddenKeys(asCandidate, CANDIDATE_FORBIDDEN_KEYS).length === 0, JSON.stringify(asCandidate))
check('candidat : son explication d’absence', asCandidate.absenceReply === 'Panne de taxi-be' && asCandidate.canExplainAbsence === false)
check('candidat : peut expliquer une absence sans réponse', toRoundOutcomeView({ ...outcomeRow, absenceReply: null }, { audience: 'candidate', userId: 'c' }).canExplainAbsence === true)
check('recruteur auteur : issue, motif et note', asAuthor.outcome === 'absent' && 'outcomeReason' in asAuthor && asAuthor.outcomeNote === 'Note privée du recruteur')
check('recruteur auteur : jamais l’explication d’absence', findForbiddenKeys(asAuthor, RECRUITER_FORBIDDEN_KEYS).length === 0, JSON.stringify(asAuthor))
check('autre recruteur : pas la note', !('outcomeNote' in asOtherRecruiter) && asOtherRecruiter.outcome === 'absent')
check('admin : issue et explication, jamais la note', asAdmin.outcome === 'absent' && asAdmin.absenceReply === 'Panne de taxi-be' && !('outcomeNote' in asAdmin))
check('jamais outcomeById', [asCandidate, asAuthor, asOtherRecruiter, asAdmin].every((view) => !('outcomeById' in view)))

const proposalRow: HireProposalSource & { createdById: string; pendingSuggestionId: string | null; expiryReminderAt: null } = {
  id: 'p1',
  version: 1,
  jobTitle: 'Développeur front-end',
  monthlySalaryAr: 1_200_000,
  startDate: new Date('2026-11-02T00:00:00.000Z'),
  contractType: 'cdd',
  contractDurationMonths: 6,
  message: null,
  status: 'refusee',
  expiresAt: at(3 * DAY),
  revision: 1,
  respondedAt: at(-HOUR),
  declineReason: 'salaire',
  declineNote: 'Précision du candidat',
  withdrawnAt: null,
  withdrawReason: null,
  createdAt: at(-2 * DAY),
  updatedAt: at(-HOUR),
  createdById: 'rec-1',
  pendingSuggestionId: null,
  expiryReminderAt: null,
}
const pCandidate = toHireProposalView(proposalRow, { audience: 'candidate', userId: 'cand-1' }, NOW)
const pRecruiter = toHireProposalView(proposalRow, { audience: 'recruiter', userId: 'rec-1' }, NOW)
const pAdmin = toHireProposalView(proposalRow, { audience: 'admin', userId: 'adm-1' }, NOW)
check('proposition, candidat : sa précision, pas la raison de retrait', pCandidate.declineNote === 'Précision du candidat' && !('withdrawReason' in pCandidate))
check('proposition, recruteur : catégorie du refus sans précision', pRecruiter.declineReason === 'salaire' && !('declineNote' in pRecruiter))
check('proposition, recruteur : aucune clé interdite', findForbiddenKeys(pRecruiter, RECRUITER_FORBIDDEN_KEYS).length === 0)
check('proposition, admin : catégorie et précision', pAdmin.declineReason === 'salaire' && pAdmin.declineNote === 'Précision du candidat')
check(
  'proposition : jamais createdById, pendingSuggestionId ni expiryReminderAt',
  [pCandidate, pRecruiter, pAdmin].every((view) => !('createdById' in view) && !('pendingSuggestionId' in view) && !('expiryReminderAt' in view)),
)
check('proposition : date de début en jour civil', pCandidate.startDate === '2026-11-02')
check(
  'proposition échue : statut effectif « expiree »',
  toHireProposalView({ ...proposalRow, status: 'envoyee', expiresAt: at(-MIN) }, { audience: 'candidate', userId: 'c' }, NOW).status === 'expiree',
)
check('statuts de proposition : liste fermée de 5', HIRE_PROPOSAL_STATUSES.length === 5)
check(
  'recherche récursive des clés interdites',
  findForbiddenKeys({ suggestions: [{ interviews: [{ outcome: 'retenu' }], candidate: { email: 'x' } }] }, [...CANDIDATE_FORBIDDEN_KEYS, 'email']).join()
    === 'suggestions[0].interviews[0].outcome,suggestions[0].candidate.email',
)

/* ---------- 13. Textes neutres au candidat (§6.4) ---------- */
console.log('\n13. Textes neutres au candidat')
const proposalInput = {
  companyName: 'Société Exemple',
  jobTitle: 'Développeur front-end',
  monthlySalaryAr: 1_200_000,
  contractType: 'cdd' as const,
  contractDurationMonths: 6,
  startDate: '2026-11-02',
  expiresAt: at(7 * DAY),
}
const notices: [string, CandidateNotice][] = [
  ['retenu', retenuNotice({ opportunityTitle: 'Développeur front-end' })],
  ['second entretien', secondRoundNotice({ companyName: 'Société Exemple', opportunityTitle: 'Développeur front-end', scheduledAt: at(2 * DAY), durationMinutes: 45, round: 2, linkSentence: 'Le lien Google Meet vous sera transmis par OffRec.' })],
  ['non retenu', nonRetenuNotice({ opportunityTitle: 'Développeur front-end' })],
  ['absent', absentNotice({ opportunityTitle: 'Développeur front-end', scheduledAt: at(-DAY) })],
  ['proposition', proposalSentNotice(proposalInput)],
  ['proposition modifiée', proposalRevisedNotice(proposalInput)],
  ['proposition retirée', proposalWithdrawnNotice(proposalInput)],
  ['rappel J-2', proposalReminderNotice(proposalInput)],
  ['expirée', proposalExpiredNotice(proposalInput)],
  ['acceptée', proposalAcceptedNotice(proposalInput)],
  ['refusée (accusé)', proposalDeclinedNotice()],
  ['poste pourvu (mis en relation)', positionFilledNotice({ kind: 'mis_en_relation', opportunityTitle: 'Développeur front-end', companyName: 'Société Exemple' })],
  ['poste pourvu (profil transmis)', positionFilledNotice({ kind: 'profil_transmis', opportunityTitle: 'Développeur front-end', companyName: 'Société Exemple' })],
]
for (const [label, notice] of notices) {
  const all = [notice.title, notice.message, ...(notice.email ? [notice.email.subject, ...notice.email.body] : [])].join(' ')
  const leaks = candidateTextLeaks(all)
  check(`texte « ${label} » : aucun motif, aucun « refusé »`, leaks.length === 0, leaks.join(', '))
}
check('détection d’un motif dans un texte', candidateTextLeaks(`Motif : ${RESULT_REASON_LABELS.savoir_etre}`).length === 1)
check('retenu : in-app seulement', notices[0][1].email === null)
check('non retenu : email avec l’objet du plan', notices[2][1].email?.subject === 'Suite de votre entretien pour « Développeur front-end » — OffRec')
check('second entretien : email avec la phrase du lien', Boolean(notices[1][1].email?.body.includes('Le lien Google Meet vous sera transmis par OffRec.')))
check('absent : bouton « Expliquer mon absence »', notices[3][1].email?.actionLabel === 'Expliquer mon absence' && notices[3][1].title.startsWith('Entretien du '))
const summary = proposalSummaryText(proposalInput)
check(
  'proposition : salaire, contrat, durée, début et échéance',
  summary.includes('1 200 000 Ar brut par mois') &&
    summary.includes('contrat CDD, durée 6 mois') &&
    summary.includes('début le lundi 2 novembre 2026') &&
    summary.includes('Répondez avant le mardi 27 octobre 2026 à 13 h 00'),
  summary,
)
check('jour civil formaté', formatCivilDate(new Date('2026-11-02T00:00:00.000Z')) === 'lundi 2 novembre 2026')
check('profil transmis : jamais le nom de l’entreprise', !notices[12][1].message.includes('Société Exemple') && notices[12][1].email === null)
check('mis en relation : nom de l’entreprise et email', notices[11][1].message.includes('Société Exemple') && notices[11][1].email !== null)

/* ---------- 14. Schémas Zod du serveur ---------- */
console.log('\n14. Schémas Zod (lib/validation.ts)')
const uuid = '6f1c2b8e-1d2a-4c3b-9e8f-0a1b2c3d4e5f'
const parses = (schema: { safeParse(value: unknown): { success: boolean } }, value: unknown) => schema.safeParse(value).success
const today = madagascarToday(new Date())
const inDays = (days: number) => new Date(Date.parse(`${today}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10)

check('issue : non retenu avec motif → ok', parses(interviewOutcomeSchema, { interviewId: uuid, result: 'non_retenu', reason: 'experience' }))
check('issue : non retenu sans motif → refusé', !parses(interviewOutcomeSchema, { interviewId: uuid, result: 'non_retenu' }))
check('issue : retenu + motif négatif → refusé', !parses(interviewOutcomeSchema, { interviewId: uuid, result: 'retenu', reason: 'experience' }))
check('issue : absent + motif → refusé', !parses(interviewOutcomeSchema, { interviewId: uuid, result: 'absent', reason: 'autre' }))
check('issue : issue inconnue → refusé', !parses(interviewOutcomeSchema, { interviewId: uuid, result: 'refuse' }))
check('issue : note avec email → refusé', !parses(interviewOutcomeSchema, { interviewId: uuid, result: 'retenu', note: 'écrire à rh@exemple.mg' }))
check('issue : note de 501 caractères → refusé', !parses(interviewOutcomeSchema, { interviewId: uuid, result: 'retenu', note: 'x'.repeat(501) }))
const nextRound = { scheduledAt: new Date(Date.now() + 3 * DAY).toISOString(), durationMinutes: 45 }
check('issue : second entretien + date → ok', parses(interviewOutcomeSchema, { interviewId: uuid, result: 'second_entretien', nextRound }))
check('issue : date de tour suivant avec retenu → refusé', !parses(interviewOutcomeSchema, { interviewId: uuid, result: 'retenu', nextRound }))
check('issue : tour suivant dans 1 h → refusé (fenêtre 2 h)', !parses(interviewOutcomeSchema, {
  interviewId: uuid, result: 'second_entretien', nextRound: { scheduledAt: new Date(Date.now() + HOUR).toISOString(), durationMinutes: 30 },
}))
check('absence : explication de 2 caractères → refusé', !parses(absenceReplySchema, { interviewId: uuid, reason: 'ok' }))
check('absence : téléphone → refusé', !parses(absenceReplySchema, { interviewId: uuid, reason: 'Rappelez-moi au 034 12 345 67' }))
check('absence : explication valide → ok', parses(absenceReplySchema, { interviewId: uuid, reason: 'Panne de taxi-be' }))

const validProposal = { jobTitle: 'Développeur front-end', monthlySalaryAr: 1_200_000, startDate: inDays(10), contractType: 'cdi' }
check('proposition CDI → ok', parses(hireProposalSchema, validProposal))
check('proposition : message vide → null', (() => {
  const res = hireProposalSchema.safeParse({ ...validProposal, message: '   ' })
  return res.success && res.data.message === null
})())
check('proposition CDD sans durée → refusé', !parses(hireProposalSchema, { ...validProposal, contractType: 'cdd' }))
check('proposition CDD 6 mois → ok', parses(hireProposalSchema, { ...validProposal, contractType: 'cdd', contractDurationMonths: 6 }))
check('proposition CDI avec durée → refusé', !parses(hireProposalSchema, { ...validProposal, contractDurationMonths: 12 }))
check('proposition : salaire décimal → refusé', !parses(hireProposalSchema, { ...validProposal, monthlySalaryAr: 450_000.5 }))
check('proposition : salaire en texte → refusé', !parses(hireProposalSchema, { ...validProposal, monthlySalaryAr: '1200000' }))
check('proposition : salaire 40 000 → refusé', !parses(hireProposalSchema, { ...validProposal, monthlySalaryAr: 40_000 }))
check('proposition : début hier → refusé', !parses(hireProposalSchema, { ...validProposal, startDate: inDays(-1) }))
check('proposition : début à +181 j → refusé', !parses(hireProposalSchema, { ...validProposal, startDate: inDays(181) }))
check('proposition : poste avec email → refusé', !parses(hireProposalSchema, { ...validProposal, jobTitle: 'Contact rh@exemple.mg' }))
check('proposition : message avec téléphone → refusé', !parses(hireProposalSchema, { ...validProposal, message: 'Appelez le +261 34 12 345 67' }))
check('proposition : type de contrat inconnu → refusé', !parses(hireProposalSchema, { ...validProposal, contractType: 'interim' }))
check('modification : révision seule → refusé', !parses(hireProposalReviseSchema, { revision: 0 }))
check('modification : salaire + révision → ok', parses(hireProposalReviseSchema, { revision: 1, monthlySalaryAr: 1_300_000 }))
check('modification : sans révision → refusé', !parses(hireProposalReviseSchema, { monthlySalaryAr: 1_300_000 }))
check('modification : CDI + durée → refusé', !parses(hireProposalReviseSchema, { revision: 1, contractType: 'cdi', contractDurationMonths: 3 }))
check('retrait : révision → ok', parses(hireProposalWithdrawSchema, { revision: 2 }))
check('retrait : révision négative → refusé', !parses(hireProposalWithdrawSchema, { revision: -1 }))
check('acceptation → ok', parses(hireProposalAcceptSchema, { proposalId: uuid, revision: 0 }))
check('acceptation : identifiant invalide → refusé', !parses(hireProposalAcceptSchema, { proposalId: 'p1', revision: 0 }))
check('refus sans motif → ok', parses(hireProposalDeclineSchema, { proposalId: uuid, revision: 0 }))
check('refus : motif hors liste → refusé', !parses(hireProposalDeclineSchema, { proposalId: uuid, revision: 0, reason: 'recruteur' }))
check('refus : précision avec email → refusé', !parses(hireProposalDeclineSchema, { proposalId: uuid, revision: 0, reason: 'autre', note: 'moi@exemple.mg' }))
check('réouverture sans postes → ok', parses(opportunityReopenSchema, {}))
check('réouverture : 51 postes → refusé', !parses(opportunityReopenSchema, { positions: 51 }))
check('filtre d’issue a_renseigner → ok', parses(interviewOutcomeFilterSchema, 'a_renseigner'))
check('filtre d’issue inconnu → refusé', !parses(interviewOutcomeFilterSchema, 'embauche'))

/* ---------- 15. Sous-lot 5 : issue à renseigner, révision, offre pourvue ---------- */
console.log('\n15. Sous-lot 5 (toRecord, révision fusionnée, offre pourvue)')
const dueRound = round({ round: 1 })
check('toRecord : tour dû + phase issue_a_renseigner → compté', outcomeToRecord(dueRound, 'issue_a_renseigner', NOW))
check('toRecord : tour dû mais dossier embauché (placement relié) → non compté', !outcomeToRecord(dueRound, 'embauche', NOW))
check('toRecord : tour dû mais offre pourvue → non compté', !outcomeToRecord(dueRound, 'poste_pourvu', NOW))
check('toRecord : phase inconnue (null) → non compté', !outcomeToRecord(dueRound, null, NOW))
check('toRecord : tour à venir → non compté', !outcomeToRecord(round({ round: 1, scheduledAt: at(2 * HOUR) }), 'issue_a_renseigner', NOW))
const hiredWithOpenRound = dossier({ rounds: [dueRound], placement: { stage: 'etape1_due' } })
check('ancien placement relié : phase embauche', hiringPhase(hiredWithOpenRound, NOW) === 'embauche')
check(
  'filtre a_renseigner avec phase = même règle que toRecord',
  !roundMatchesOutcomeFilter(dueRound, 'a_renseigner', NOW, hiringPhase(hiredWithOpenRound, NOW)) &&
    roundMatchesOutcomeFilter(dueRound, 'a_renseigner', NOW, 'issue_a_renseigner'),
)
check('filtre a_renseigner sans phase : tour seul (rétrocompatible)', roundMatchesOutcomeFilter(dueRound, 'a_renseigner', NOW))
check('filtre retenu : ignore la phase', roundMatchesOutcomeFilter(round({ round: 1, outcome: 'retenu' }), 'retenu', NOW, 'embauche'))

const current = {
  jobTitle: 'Développeur',
  monthlySalaryAr: 1_200_000,
  startDate: '2026-11-02',
  contractType: 'cdd' as const,
  contractDurationMonths: 6,
  message: 'Bienvenue',
}
const salary = mergeProposalRevision(current, { monthlySalaryAr: 1_300_000 })
check('révision : salaire seul → ok, champ modifié listé', salary.error === null && salary.changed.join() === 'monthlySalaryAr')
check('révision : CDD → CDI sans retirer la durée → refusé', mergeProposalRevision(current, { contractType: 'cdi' }).error === 'Un CDI n’a pas de durée : retirez-la.')
const toCdi = mergeProposalRevision(current, { contractType: 'cdi', contractDurationMonths: null })
check('révision : CDD → CDI avec durée effacée → ok', toCdi.error === null && toCdi.fields.contractDurationMonths === null)
check('révision : CDI → stage sans durée → refusé', mergeProposalRevision({ ...current, contractType: 'cdi', contractDurationMonths: null }, { contractType: 'stage' }).error !== null)
check('révision : message effacé (null) → ok', mergeProposalRevision(current, { message: null }).fields.message === null)
check('révision : message absent → conservé', mergeProposalRevision(current, { jobTitle: 'Dév. front' }).fields.message === 'Bienvenue')
check('révision : valeurs identiques → « aucune modification »', mergeProposalRevision(current, { monthlySalaryAr: 1_200_000 }).error === NO_PROPOSAL_CHANGE_ERROR)

check('offre pourvue → fermée (même texte que l’erreur)', opportunityClosedReason({ deadline: at(10 * DAY), filledAt: at(-HOUR) }, { role: 'recruiter', status: 'active' }, NOW) === OPPORTUNITY_FILLED_REASON)
check('offre pourvue : texte = OPPORTUNITY_FILLED_ERROR', OPPORTUNITY_FILLED_REASON === OPPORTUNITY_FILLED_ERROR)
check('offre non pourvue, date OK → ouverte', opportunityClosedReason({ deadline: at(10 * DAY), filledAt: null }, { role: 'recruiter', status: 'active' }, NOW) === null)
check('offre sans champ filledAt (ancien client) → ouverte', opportunityClosedReason({ deadline: at(10 * DAY) }, { role: 'recruiter', status: 'active' }, NOW) === null)
check(
  'système : seulement « écarter », jamais depuis mise_en_relation ni ecartee',
  Object.values(SYSTEM_ALLOWED_TRANSITIONS).every((to) => to?.length === 1 && to[0] === 'ecartee') &&
    !('mise_en_relation' in SYSTEM_ALLOWED_TRANSITIONS) &&
    !('ecartee' in SYSTEM_ALLOWED_TRANSITIONS),
)
check(
  'système ⊂ admin (aucune transition que l’admin n’aurait pas)',
  Object.entries(SYSTEM_ALLOWED_TRANSITIONS).every(([from, to]) =>
    (to ?? []).every((target) => ADMIN_ALLOWED_TRANSITIONS[from as keyof typeof ADMIN_ALLOWED_TRANSITIONS].includes(target)),
  ),
)
const offer = {
  title: 'Développeur',
  category: 'Informatique',
  sector: 'digital',
  description: 'Une description assez longue.',
  province: 'Antananarivo',
  city: 'Antananarivo',
  opportunityType: 'emploi',
  requiredSkills: ['React'],
  level: 'junior',
  deadline: '2026-12-31',
}
check('offre : sans nombre de postes → ok (absent)', (() => {
  const res = opportunityInputSchema.safeParse(offer)
  return res.success && res.data.positions === undefined
})())
check('offre : 3 postes → ok', parses(opportunityInputSchema, { ...offer, positions: 3 }))
check('offre : 0 poste → refusé', !parses(opportunityInputSchema, { ...offer, positions: 0 }))
check('offre : 51 postes → refusé', !parses(opportunityInputSchema, { ...offer, positions: 51 }))
check('offre : 1,5 poste → refusé', !parses(opportunityInputSchema, { ...offer, positions: 1.5 }))
check('liste admin des propositions : statut expiree → ok', parses(adminHireProposalQuerySchema, { status: 'expiree' }))
check('liste admin des propositions : statut inconnu → refusé', !parses(adminHireProposalQuerySchema, { status: 'pourvue' }))
check('modification : message absent reste absent (pas effacé)', (() => {
  const res = hireProposalReviseSchema.safeParse({ revision: 0, monthlySalaryAr: 1_300_000 })
  return res.success && res.data.message === undefined && res.data.contractDurationMonths === undefined
})())

/* ------------------------------------------------------------------ */
/* Sous-lot 7 : entonnoir, indicateur, export pseudonymisé             */
/* ------------------------------------------------------------------ */

console.log('\n— Mesure (sous-lot 7)')

const mDate = (offsetMs: number) => new Date(NOW.getTime() + offsetMs)
function mDossier(partial: Partial<MetricsDossier> & { id: string }): MetricsDossier {
  return {
    opportunityId: 'opp-a',
    recruiterId: 'rec-a',
    status: 'mise_en_relation',
    score: 82,
    origin: 'systeme',
    preselectionRank: null,
    createdAt: mDate(-20 * DAY),
    updatedAt: mDate(-18 * DAY),
    connectedAt: mDate(-18 * DAY),
    closedReason: null,
    sector: 'digital',
    level: 'junior',
    opportunityType: 'emploi',
    filledAt: null,
    cvVerified: true,
    isTest: false,
    ...partial,
  }
}
function mRound(partial: Partial<MetricsRound> & { round: number; suggestionId: string }): MetricsRound {
  return {
    id: `${partial.suggestionId}-r${partial.round}`,
    status: 'confirme',
    scheduledAt: mDate(-15 * DAY),
    durationMinutes: 60,
    active: !partial.outcome,
    outcome: null,
    outcomeReason: null,
    outcomeAt: null,
    ...partial,
  }
}
function mProposal(partial: Partial<MetricsProposal> & { suggestionId: string; version: number }): MetricsProposal {
  return {
    id: `${partial.suggestionId}-p${partial.version}`,
    status: 'envoyee',
    expiresAt: mDate(3 * DAY),
    revision: 0,
    createdAt: mDate(-10 * DAY),
    respondedAt: null,
    declineReason: null,
    contractType: 'cdi',
    withdrawReason: null,
    ...partial,
  }
}
const facts = (
  d: MetricsDossier,
  rounds: MetricsRound[] = [],
  proposals: MetricsProposal[] = [],
  placement: MetricsPlacement | null = null,
) => buildDossierFacts({ dossier: d, rounds, proposals, placement, now: NOW })
const noEvidence = { exitedAfterTransmission: false, declinedBy: [] as string[] }

// Transmission (même définition que « Profils reçus »).
check('transmis : proposee_recruteur', isTransmittedDossier({ status: 'proposee_recruteur', preselectionRank: null }))
check('non transmis : suggeree', !isTransmittedDossier({ status: 'suggeree', preselectionRank: null }))
check('non transmis : statut hérité proposee_candidat', !isTransmittedDossier({ status: 'proposee_candidat', preselectionRank: null }))
check('écarté sans preuve : non transmis (file interne)', !isTransmittedDossier({ status: 'ecartee', preselectionRank: null }))
check('écarté avec rang de présélection : transmis', isTransmittedDossier({ status: 'ecartee', preselectionRank: 2 }))
check(
  'écarté avec transmission journalisée : transmis',
  isTransmittedDossier({ status: 'ecartee', preselectionRank: null }, { transmittedAt: mDate(-DAY), ...noEvidence }),
)
check(
  'date de réception : transmission journalisée d’abord',
  dossierReceivedAt(mDossier({ id: 'x' }), { transmittedAt: mDate(-3 * DAY), ...noEvidence }).getTime() === mDate(-3 * DAY).getTime(),
)
check(
  'date de réception : updatedAt d’un dossier encore proposee_recruteur',
  dossierReceivedAt(mDossier({ id: 'x', status: 'proposee_recruteur' })).getTime() === mDate(-18 * DAY).getTime(),
)
check('date de réception : création sinon', dossierReceivedAt(mDossier({ id: 'x' })).getTime() === mDate(-20 * DAY).getTime())
check(
  'date de transmission déduite après la mise en relation → ramenée à connectedAt',
  facts(mDossier({ id: 'late', createdAt: mDate(-2 * DAY), connectedAt: mDate(-5 * DAY) }))!.delays.transmissionToConnection === 0,
)
check('suggeree → aucun fait (jamais compté)', facts(mDossier({ id: 'sug', status: 'suggeree' })) === null)

// Un dossier à chaque étape.
const F1 = facts(mDossier({ id: 'd1', status: 'proposee_recruteur', connectedAt: null }))!
const F2 = facts(mDossier({ id: 'd2' }))!
const F3 = facts(mDossier({ id: 'd3' }), [mRound({ suggestionId: 'd3', round: 1 })])!
const F3b = facts(mDossier({ id: 'd3b' }), [
  mRound({ suggestionId: 'd3b', round: 1, outcome: 'non_retenu', outcomeReason: 'experience', outcomeAt: mDate(-14 * DAY) }),
])!
const F4 = facts(mDossier({ id: 'd4' }), [mRound({ suggestionId: 'd4', round: 1, outcome: 'retenu', outcomeAt: mDate(-14 * DAY) })])!
const F5 = facts(
  mDossier({ id: 'd5' }),
  [mRound({ suggestionId: 'd5', round: 1, outcome: 'retenu', outcomeAt: mDate(-14 * DAY) })],
  [mProposal({ suggestionId: 'd5', version: 1, status: 'refusee', respondedAt: mDate(-9 * DAY), declineReason: 'salaire' })],
)!
const F6 = facts(
  mDossier({ id: 'd6', score: 91, preselectionRank: 1 }),
  [
    mRound({ suggestionId: 'd6', round: 1, outcome: 'second_entretien', outcomeAt: mDate(-14 * DAY) }),
    mRound({ suggestionId: 'd6', round: 2, scheduledAt: mDate(-12 * DAY), outcome: 'retenu', outcomeAt: mDate(-11 * DAY) }),
  ],
  [mProposal({ suggestionId: 'd6', version: 1, status: 'acceptee', createdAt: mDate(-10 * DAY), respondedAt: mDate(-8 * DAY) })],
  { id: 'pl6', suggestionId: 'd6', stage: 'etape1_due', origin: 'proposition_acceptee', createdAt: mDate(-8 * DAY) },
)!
const F7 = facts(mDossier({ id: 'd7', status: 'ecartee', preselectionRank: 4, closedReason: 'offre_pourvue', connectedAt: null }))!
const F8 = facts(mDossier({ id: 'd8' }), [mRound({ suggestionId: 'd8', round: 1, scheduledAt: mDate(2 * DAY) })])!
const F9 = facts(mDossier({ id: 'd9' }), [mRound({ suggestionId: 'd9', round: 1, status: 'empechement' })])!
const F10 = facts(mDossier({ id: 'd10' }), [mRound({ suggestionId: 'd10', round: 1, status: 'annule' })])!
const all: DossierFacts[] = [F1, F2, F3, F3b, F4, F5, F6, F7, F8, F9, F10]
const funnel = computeFunnel(all)
const count = (k: (typeof FUNNEL_STAGES)[number]) => funnel.stages.find((s) => s.key === k)!.count
check('entonnoir : 11 proposés (écarté prouvé compris)', count('proposes') === 11)
check('entonnoir : 9 mis en relation', count('mis_en_relation') === 9, String(count('mis_en_relation')))
check('entonnoir : 5 entretiens passés (ni à venir, ni empêchement, ni annulé)', count('entretien_passe') === 5, String(count('entretien_passe')))
check('entonnoir : 3 retenus', count('retenus') === 3, String(count('retenus')))
check('entonnoir : 2 propositions', count('proposition') === 2)
check('entonnoir : 1 embauché', count('embauches') === 1)
check('entonnoir : taux vs étape précédente (1/2 = 50 %)', funnel.stages[5].ratePrevious === 50)
check('entonnoir : taux depuis le début (1/11 = 9,1 %)', funnel.stages[5].rateFromStart === 9.1)
check('entonnoir : première étape sans taux précédent', funnel.stages[0].ratePrevious === null)
check(
  'entonnoir : étapes emboîtées (jamais plus qu’à l’étape précédente)',
  funnel.stages.every((s, i) => i === 0 || s.count <= funnel.stages[i - 1].count),
)
check(
  'délai mise en relation → embauche : 10 jours',
  funnel.delays.connectionToHire.medianDays === 10 && funnel.delays.connectionToHire.count === 1,
  JSON.stringify(funnel.delays.connectionToHire),
)
check(
  'situations : un embauché, un non retenu, une proposition déclinée, un écarté',
  funnel.situations.embauche === 1 &&
    funnel.situations.non_retenu === 1 &&
    funnel.situations.proposition_declinee === 1 &&
    funnel.situations.ecarte_avant_mise_en_relation === 1,
  JSON.stringify(funnel.situations),
)
check('situations : chaque dossier dans une seule case', Object.values(funnel.situations).reduce((s, n) => s + n, 0) === all.length)
check('clôture « offre pourvue » comptée à part', funnel.closedByFilledOffer === 1)
const declaredLegacy = facts(mDossier({ id: 'd11' }), [], [], {
  id: 'pl11',
  suggestionId: 'd11',
  stage: 'etape1_due',
  origin: 'declaration',
  createdAt: mDate(-5 * DAY),
})!
check(
  'placement déclaré (historique) : pas un embauché de l’entonnoir',
  declaredLegacy.hiredAt === null && declaredLegacy.situation === 'placement_declare',
)
const cancelledHire = facts(
  mDossier({ id: 'd12' }),
  [mRound({ suggestionId: 'd12', round: 1, outcome: 'retenu', outcomeAt: mDate(-14 * DAY) })],
  [mProposal({ suggestionId: 'd12', version: 1, status: 'acceptee', respondedAt: mDate(-8 * DAY) })],
  { id: 'pl12', suggestionId: 'd12', stage: 'annule', origin: 'proposition_acceptee', createdAt: mDate(-8 * DAY) },
)!
check(
  'embauche annulée : pas un embauché, marquée annulée',
  cancelledHire.hiredAt === null && cancelledHire.hireCancelled && cancelledHire.situation === 'embauche_annulee',
)
check(
  'cohorte 30 jours : dossiers transmis depuis 30 jours seulement',
  cohortOf([F2, facts(mDossier({ id: 'old', createdAt: mDate(-60 * DAY) }))!], periodStart('30', NOW)).length === 1,
)
check('période « all » : aucune borne', periodStart('all', NOW) === null)
check(
  'période 30 : minuit Madagascar du jour J-29',
  periodStart('30', NOW)!.toISOString() === '2026-09-20T21:00:00.000Z',
  periodStart('30', NOW)!.toISOString(),
)
check('médiane paire et moyenne', JSON.stringify(summarizeDelays([1, 2, 3, 10])) === JSON.stringify({ count: 4, medianDays: 2.5, meanDays: 4 }))
check('médiane sans valeur → null', summarizeDelays([null]).medianDays === null)
check('délai en jours, une décimale', daysBetween(mDate(0), mDate(36 * HOUR)) === 1.5)

// Indicateur « issue renseignée sous 7 jours » (plan §11). Début = fin − 60 min.
const endAgo = (days: number) => mDate(-days * DAY - 60 * MIN)
const ind = outcomeTimeliness(
  [
    // fin J-10, issue 1 jour après : oui
    mRound({ suggestionId: 'i1', round: 1, scheduledAt: endAgo(10), outcome: 'retenu', outcomeAt: mDate(-9 * DAY) }),
    // fin J-20, issue 10 jours après : non
    mRound({ suggestionId: 'i2', round: 1, scheduledAt: endAgo(20), outcome: 'non_retenu', outcomeAt: mDate(-10 * DAY) }),
    // fin J-15, jamais renseignée : non
    mRound({ suggestionId: 'i3', round: 1, scheduledAt: endAgo(15) }),
    // fin J-3 : pas mûr, exclu
    mRound({ suggestionId: 'i4', round: 1, scheduledAt: endAgo(3) }),
    // fin J-50 : hors fenêtre
    mRound({ suggestionId: 'i5', round: 1, scheduledAt: endAgo(50), outcome: 'retenu', outcomeAt: mDate(-49 * DAY) }),
    // annulé, empêchement : exclus
    mRound({ suggestionId: 'i6', round: 1, scheduledAt: endAgo(12), status: 'annule' }),
    mRound({ suggestionId: 'i7', round: 1, scheduledAt: endAgo(12), status: 'empechement' }),
    // fin J-30, issue 7 jours pile après : oui
    mRound({ suggestionId: 'i8', round: 1, scheduledAt: endAgo(30), outcome: 'absent', outcomeAt: mDate(-23 * DAY) }),
  ],
  NOW,
)
check('indicateur : 4 tours éligibles (fenêtre J-37 → J-7)', ind.eligible === 4, JSON.stringify(ind))
check('indicateur : 2 issues sous 7 jours (7 jours pile compris)', ind.recordedWithin7d === 2)
check('indicateur : 50 %, objectif 80 % non atteint', ind.percent === 50 && ind.targetPercent === 80 && ind.met === false)
check('indicateur sans tour : null', outcomeTimeliness([], NOW).percent === null && outcomeTimeliness([], NOW).met === null)
check(
  'indicateur « depuis le début » : le tour de J-50 compte',
  outcomeTimeliness(
    [mRound({ suggestionId: 'i5', round: 1, scheduledAt: endAgo(50), outcome: 'retenu', outcomeAt: mDate(-49 * DAY) })],
    NOW,
    null,
  ).eligible === 1,
)

// Pseudonymes, tranches, export.
check('pseudonyme stable (même clé, même id)', pseudonym('k1', 'dossier', 'abc') === pseudonym('k1', 'dossier', 'abc'))
check('pseudonyme : autre clé → autre valeur', pseudonym('k1', 'dossier', 'abc') !== pseudonym('k2', 'dossier', 'abc'))
check(
  'pseudonyme : dossier et offre de même id distincts',
  pseudonym('k1', 'dossier', 'abc').slice(2) !== pseudonym('k1', 'offre', 'abc').slice(2),
)
check(
  'pseudonyme : forme d_ + 12 hex, sans l’id',
  /^d_[0-9a-f]{12}$/.test(pseudonym('k1', 'dossier', 'd6')) && !pseudonym('k1', 'dossier', 'd6').includes('d6'),
)
check(
  'tranches de score',
  [scoreBand(59), scoreBand(60), scoreBand(79), scoreBand(80), scoreBand(95)].join('|') === '<60|60–69|70–79|80–89|90+',
)
check(
  'tranches de rang',
  [rankBand(null), rankBand(1), rankBand(4), rankBand(7), rankBand(12)].join('|') === 'non classé|1–3|4–5|6–10|>10',
)
check(
  'motif lié au score : expérience oui, savoir-être non, point fort vide',
  reasonTiedToScore('experience') === 'oui' && reasonTiedToScore('savoir_etre') === 'non' && reasonTiedToScore('points_forts') === '',
)
check(
  'comptes de test reconnus',
  isTestEmail('a@demo.mg') && isTestEmail('B@OFFREC-TEST.INVALID') && !isTestEmail('a@gmail.com') && !isTestEmail(null),
)
check('cellule CSV : virgule décimale, guillemets si « ; »', csvCell(2.5) === '2,5' && csvCell('a;b') === '"a;b"' && csvCell(null) === '')
const row6 = toResearchRow(F6, 'k1')
check('ligne : colonnes exactement la liste blanche', Object.keys(row6).join() === RESEARCH_COLUMNS.join())
check(
  'ligne : aucun identifiant interne ni date exacte',
  !Object.values(row6).some(
    (v) => typeof v === 'string' && (v === 'd6' || v === 'opp-a' || v === 'rec-a' || /\d{4}-\d{2}-\d{2}/.test(v)),
  ),
)
check(
  'ligne : mois de transmission, score, rang, embauche, tours',
  row6.periode_transmission === '2026-09' &&
    row6.score === 91 &&
    row6.tranche_rang === '1–3' &&
    row6.embauche === 'oui' &&
    row6.nb_tours === 2,
  JSON.stringify(row6),
)
const many: ResearchRow[] = Array.from({ length: 6 }, (_, i) => toResearchRow(facts(mDossier({ id: `g${i}` }))!, 'k1'))
const lone = toResearchRow(facts(mDossier({ id: 'lone', sector: 'btp', level: 'senior', opportunityId: 'opp-b' }))!, 'k1')
const gen = generalizeResearchRows([...many, lone], 5)
check('petits effectifs : groupe de 6 inchangé', many.every((r) => r.generalisation === 'aucune' && r.secteur === 'digital'))
check(
  'petits effectifs : ligne isolée regroupée et période masquée',
  lone.secteur === 'regroupé' && lone.periode_transmission === '' && String(lone.generalisation).includes('periode_masquee'),
  JSON.stringify(lone),
)
check('petits effectifs : la ligne isolée est signalée', gen.residualSmallGroups === 1 && gen.offerAttributes === 1, JSON.stringify(gen))
const testFact: DossierFacts = { ...F2, dossier: { ...F2.dossier, id: 't1', isTest: true } }
const exp = buildResearchExport({ facts: [...all, testFact], key: 'k1', now: NOW, excludeTest: true })
check('export : BOM, « ; », CRLF', exp.csv.startsWith('﻿#') && exp.csv.includes('\r\n') && exp.csv.includes(RESEARCH_COLUMNS.join(';')))
check('export : comptes de test exclus', exp.rowCount === all.length && exp.testRows === 0)
check(
  'export : note méthodologique (comptes de test, démonstration)',
  exp.csv.includes('pas un résultat de terrain') && exp.csv.includes('@offrec-test.invalid'),
)
check('export : stable d’un appel à l’autre', exp.csv === buildResearchExport({ facts: [...all], key: 'k1', now: NOW, excludeTest: true }).csv)
check('export : nom de fichier daté', researchExportFilename(NOW) === 'offrec-export-recherche-2026-10-20.csv')

console.log(failures ? `\n${failures} échec(s) sur ${total} contrôles.` : `\nTous les contrôles sont OK (${total}).`)
process.exit(failures ? 1 : 0)
