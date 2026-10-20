/**
 * « Après l'entretien » (plan du 2026-10-16, sous-lot 2 ; décisions D1–D6) :
 * règles PURES de la suite d'un dossier mis en relation — issue des tours
 * d'entretien, tour suivant, propositions d'embauche, offre pourvue,
 * visibilité par rôle et textes neutres envoyés au candidat.
 *
 * Module PARTAGÉ avec le serveur (`server/tsconfig.json` l'inclut) : aucune
 * API navigateur, React, Vite ni base de données ; l'heure courante est
 * toujours passée en paramètre (`now`), jamais lue ici.
 *
 * `MatchSuggestion.status` reste `mise_en_relation` après l'entretien : la
 * phase du dossier est DÉRIVÉE ici (`hiringPhase`) à partir des tours, des
 * propositions, du placement et de l'offre. L'UI s'en sert pour afficher les
 * boutons ; le serveur reste juge (`checkHiringAction`, puis écriture
 * conditionnelle). Les transitions de DOSSIER restent l'affaire de
 * `checkMatchTransition` / `commitMatchTransition`
 * (server/src/lib/preselection-service.ts) : ce module n'en déclare aucune,
 * et le contrôle « accord en vigueur + compte candidat actif »
 * (`connectionCheck`) est calculé par l'appelant puis passé tel quel.
 */

import type {
  ContractType,
  HireDeclineReason,
  HireProposalStatus,
  HireProposalWithdrawReason,
  InterviewResult,
  InterviewResultReason,
  InterviewStatus,
  MatchSuggestionStatus,
  PlacementStage,
} from '../types/index.js'
import { formatMadagascarDateTime, interviewEnd, toMadagascarInputs } from './interview.js'

/* ------------------------------------------------------------------ */
/* Constantes                                                          */
/* ------------------------------------------------------------------ */

/** D5 : trois tours au plus ; une nouvelle chance après une absence compte comme un tour. */
export const MAX_INTERVIEW_ROUNDS = 3
/** D2 : une proposition sans réponse expire 7 jours après son envoi ou sa dernière modification. */
export const HIRE_PROPOSAL_TTL_DAYS = 7
/** D2 : rappel au candidat 2 jours avant l'échéance (une fois par échéance). */
export const HIRE_PROPOSAL_REMINDER_DAYS = 2
/** Propositions successives au plus par dossier (après expiration ou retrait). */
export const MAX_PROPOSAL_VERSIONS = 3
/** Rappel « issue à renseigner » au recruteur, 24 h après la fin du tour. */
export const OUTCOME_REMINDER_HOURS = 24
/** Issue « en souffrance » pour le résumé admin quotidien. */
export const OUTCOME_OVERDUE_DAYS = 7
/** Date de début d'un poste : au plus 180 jours après aujourd'hui (Madagascar). */
export const HIRE_START_MAX_DAYS = 180
/** D1 : nombre de postes d'une offre. */
export const OPPORTUNITY_POSITIONS_MIN = 1
export const OPPORTUNITY_POSITIONS_MAX = 50
/** Salaire mensuel brut proposé, en Ariary. */
export const HIRE_SALARY_MIN_AR = 50_000
export const HIRE_SALARY_MAX_AR = 100_000_000
/** Durée d'un contrat (CDD, stage…), en mois. */
export const CONTRACT_DURATION_MIN_MONTHS = 1
export const CONTRACT_DURATION_MAX_MONTHS = 36

/** Longueurs des textes libres (tous filtrés par `contactDetailsError`). */
export const OUTCOME_NOTE_MAX = 500
export const ABSENCE_REPLY_MIN = 3
export const ABSENCE_REPLY_MAX = 300
export const HIRE_JOB_TITLE_MIN = 3
export const HIRE_JOB_TITLE_MAX = 120
export const HIRE_MESSAGE_MAX = 500
export const DECLINE_NOTE_MAX = 300

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS

/* ------------------------------------------------------------------ */
/* Listes fermées et libellés                                          */
/* ------------------------------------------------------------------ */

/**
 * Liste fermée qui couvre EXACTEMENT l'union `T` : un oubli ou une valeur
 * inconnue est une erreur de compilation. Le tuple sert aussi aux `z.enum`
 * du serveur (lib/validation.ts).
 */
const closedList =
  <T extends string>() =>
  <const L extends readonly [T, ...T[]]>(list: L & ([T] extends [L[number]] ? unknown : never)): L =>
    list

export const INTERVIEW_RESULTS = closedList<InterviewResult>()(['retenu', 'second_entretien', 'non_retenu', 'absent'])

export const INTERVIEW_RESULT_REASONS = closedList<InterviewResultReason>()([
  'competences_techniques',
  'experience',
  'disponibilite',
  'pretentions_salariales',
  'savoir_etre',
  'autre_candidat_retenu',
  'poste_modifie',
  'points_forts',
  'autre',
])

/** Motifs d'un « Non retenu » (obligatoire). */
export const NEGATIVE_RESULT_REASONS: readonly InterviewResultReason[] = [
  'competences_techniques',
  'experience',
  'disponibilite',
  'pretentions_salariales',
  'savoir_etre',
  'autre_candidat_retenu',
  'poste_modifie',
  'autre',
]

/** Motif (facultatif) d'un « Retenu » ou d'un « Second entretien ». */
export const POSITIVE_RESULT_REASONS: readonly InterviewResultReason[] = ['points_forts']

export const CONTRACT_TYPES = closedList<ContractType>()(['cdi', 'cdd', 'stage', 'alternance', 'freelance'])

/** Contrats dont la durée en mois est obligatoire. */
export const CONTRACTS_WITH_DURATION: readonly ContractType[] = ['cdd', 'stage']

export const HIRE_DECLINE_REASONS = closedList<HireDeclineReason>()([
  'salaire',
  'date_debut',
  'type_contrat',
  'autre_offre_acceptee',
  'localisation',
  'raisons_personnelles',
  'autre',
])

export const HIRE_PROPOSAL_STATUSES = closedList<HireProposalStatus>()([
  'envoyee',
  'acceptee',
  'refusee',
  'expiree',
  'retiree',
])

/** Filtre « Issue » des listes d'entretiens (recruteur, admin). */
export type InterviewOutcomeFilter = 'a_renseigner' | InterviewResult
export const INTERVIEW_OUTCOME_FILTERS = closedList<InterviewOutcomeFilter>()([
  'a_renseigner',
  'retenu',
  'second_entretien',
  'non_retenu',
  'absent',
])

/** Badge d'issue (recruteur, admin — jamais le candidat). */
export const INTERVIEW_RESULT_LABELS: Record<InterviewResult, string> = {
  retenu: 'Retenu',
  second_entretien: 'Second entretien',
  non_retenu: 'Non retenu',
  absent: 'Absent',
}

/** Choix de la modale « Issue de l'entretien ». */
export const INTERVIEW_RESULT_CHOICES: Record<InterviewResult, string> = {
  retenu: 'Retenu',
  second_entretien: 'Second entretien',
  non_retenu: 'Non retenu',
  absent: 'Le candidat ne s’est pas présenté',
}

/** Motifs (recruteur auteur et admin seulement — décision D3). */
export const RESULT_REASON_LABELS: Record<InterviewResultReason, string> = {
  competences_techniques: 'Compétences techniques insuffisantes pour le poste',
  experience: 'Expérience insuffisante ou trop éloignée',
  disponibilite: 'Disponibilité incompatible',
  pretentions_salariales: 'Prétentions salariales hors budget',
  savoir_etre: 'Savoir-être / communication',
  autre_candidat_retenu: 'Un autre candidat correspond mieux',
  poste_modifie: 'Poste modifié, gelé ou supprimé',
  points_forts: 'Profil convaincant',
  autre: 'Autre motif',
}

export const CONTRACT_TYPE_LABELS: Record<ContractType, string> = {
  cdi: 'CDI',
  cdd: 'CDD',
  stage: 'Stage',
  alternance: 'Alternance',
  freelance: 'Freelance / mission',
}

/** Complément de « contrat … » dans les phrases (« contrat de stage »). */
const CONTRACT_TYPE_PHRASES: Record<ContractType, string> = {
  cdi: 'CDI',
  cdd: 'CDD',
  stage: 'de stage',
  alternance: 'd’alternance',
  freelance: 'freelance / mission',
}

/** Catégorie d'un refus de proposition : vue par le candidat, le recruteur (D3) et l'admin. */
export const DECLINE_REASON_LABELS: Record<HireDeclineReason, string> = {
  salaire: 'Salaire proposé',
  date_debut: 'Date de début',
  type_contrat: 'Type de contrat',
  autre_offre_acceptee: 'Autre offre acceptée',
  localisation: 'Lieu de travail',
  raisons_personnelles: 'Raisons personnelles',
  autre: 'Autre raison',
}

export const HIRE_PROPOSAL_STATUS_LABELS: Record<HireProposalStatus, string> = {
  envoyee: 'En attente de réponse',
  acceptee: 'Acceptée',
  refusee: 'Déclinée',
  expiree: 'Expirée',
  retiree: 'Retirée',
}

export const WITHDRAW_REASON_LABELS: Record<HireProposalWithdrawReason, string> = {
  recruteur: 'Retirée par l’entreprise',
  poste_pourvu: 'Poste pourvu',
  compte_inactif: 'Compte inactif',
}

/* ------------------------------------------------------------------ */
/* État d'un dossier et phase dérivée                                  */
/* ------------------------------------------------------------------ */

/** Tour d'entretien tel que les règles le lisent (une ligne `Interview`). */
export interface HiringRoundState {
  id: string
  round: number
  status: InterviewStatus
  scheduledAt: string | Date
  durationMinutes: number
  /** Tour actif : `activeSuggestionId` renseigné (aucune issue encore). */
  active: boolean
  outcome: InterviewResult | null
  /** Le candidat a déjà expliqué son absence (`absenceReply` renseigné). */
  absenceReplied?: boolean
  /** Rappel « issue à renseigner » déjà envoyé. */
  outcomeReminderAt?: string | Date | null
}

/** Proposition d'embauche telle que les règles la lisent. */
export interface HiringProposalState {
  id: string
  version: number
  status: HireProposalStatus
  expiresAt: string | Date
  revision: number
  withdrawReason?: HireProposalWithdrawReason | null
  expiryReminderAt?: string | Date | null
}

/** Tout ce qui décide de la phase d'un dossier. */
export interface HiringDossierState {
  status: MatchSuggestionStatus
  rounds: readonly HiringRoundState[]
  proposals: readonly HiringProposalState[]
  /** Placement lié au dossier (`Placement.suggestionId`), quelle que soit son origine. */
  placement: { stage: PlacementStage } | null
  /** Offre pourvue (`Opportunity.filledAt`), `null` si ouverte. */
  filledAt: string | Date | null
}

/**
 * Phase d'un dossier `mise_en_relation` (plan §4.2). `embauche_annulee`
 * complète le plan : proposition acceptée puis placement passé à `annule`
 * (désistement), pour ne jamais retomber sur une phase qui rouvrirait le
 * dossier.
 */
export type HiringPhase =
  | 'entretien_a_planifier'
  | 'tour_planifie'
  | 'tour_annule'
  | 'issue_a_renseigner'
  | 'second_entretien_a_planifier'
  | 'absent'
  | 'retenu'
  | 'proposition_envoyee'
  | 'embauche'
  | 'embauche_annulee'
  | 'clos_proposition_refusee'
  | 'non_retenu'
  | 'poste_pourvu'

/** Phases qui ne bougent plus, même quand l'offre est pourvue ensuite. */
export const TERMINAL_HIRING_PHASES: readonly HiringPhase[] = [
  'embauche',
  'embauche_annulee',
  'clos_proposition_refusee',
  'non_retenu',
]

/**
 * Vue candidat : jamais l'issue brute. `non_retenu`, `poste_pourvu`,
 * `clos_proposition_refusee` et `embauche_annulee` deviennent `clos` ;
 * l'attente d'une issue et un second entretien encore sans date deviennent
 * `suite_en_attente` (le candidat n'est informé d'un second entretien
 * qu'avec sa date).
 */
export type CandidateHiringPhase =
  | 'entretien_a_planifier'
  | 'entretien_prevu'
  | 'entretien_annule'
  | 'suite_en_attente'
  | 'suite_favorable'
  | 'entretien_manque'
  | 'proposition_recue'
  | 'embauche'
  | 'clos'

const recruiterPhaseLabels: Record<HiringPhase, string> = {
  entretien_a_planifier: 'Entretien à planifier',
  tour_planifie: 'Entretien planifié',
  tour_annule: 'Entretien annulé',
  issue_a_renseigner: 'Issue à renseigner',
  second_entretien_a_planifier: 'Second entretien à planifier',
  absent: 'Absent',
  retenu: 'Retenu',
  proposition_envoyee: 'Proposition envoyée',
  embauche: 'Embauché',
  embauche_annulee: 'Embauche annulée',
  clos_proposition_refusee: 'Proposition déclinée',
  non_retenu: 'Non retenu',
  poste_pourvu: 'Poste pourvu',
}

/** Badges de phase par audience (`HiringPhaseBadge`). */
export const HIRING_PHASE_LABELS: {
  recruiter: Record<HiringPhase, string>
  admin: Record<HiringPhase, string>
  candidate: Record<CandidateHiringPhase, string>
} = {
  recruiter: recruiterPhaseLabels,
  admin: { ...recruiterPhaseLabels, absent: 'Absent au dernier tour' },
  candidate: {
    entretien_a_planifier: 'Entretien en préparation',
    entretien_prevu: 'Entretien prévu',
    entretien_annule: 'Entretien annulé',
    suite_en_attente: 'En attente de la suite',
    suite_favorable: 'Suite favorable',
    entretien_manque: 'Entretien manqué',
    proposition_recue: 'Proposition reçue',
    embauche: 'Embauche confirmée',
    clos: 'Dossier clos',
  },
}

const toMs = (value: string | Date) => (typeof value === 'string' ? new Date(value) : value).getTime()

/** Tours triés par numéro croissant (copie). */
export function sortRounds<T extends { round: number }>(rounds: readonly T[]): T[] {
  return [...rounds].sort((a, b) => a.round - b.round)
}

/** Dernier tour (numéro le plus élevé), ou `undefined`. */
export function latestRound<T extends { round: number }>(rounds: readonly T[]): T | undefined {
  let best: T | undefined
  for (const row of rounds) if (!best || row.round > best.round) best = row
  return best
}

/**
 * Tour actif d'un dossier. Filet de sécurité : sans tour marqué actif, un
 * dernier tour sans issue est traité comme actif (même règle que
 * `repairActiveRounds()` au démarrage).
 */
export function activeRoundOf<T extends { round: number; active: boolean; outcome: InterviewResult | null }>(
  rounds: readonly T[],
): T | undefined {
  const flagged = latestRound(rounds.filter((row) => row.active))
  if (flagged) return flagged
  const last = latestRound(rounds)
  return last && !last.outcome ? last : undefined
}

/** Numéro du prochain tour (1 pour un dossier sans entretien). */
export function nextRoundNumber(rounds: readonly { round: number }[]): number {
  return (latestRound(rounds)?.round ?? 0) + 1
}

type RoundTiming = Pick<HiringRoundState, 'scheduledAt' | 'durationMinutes'>

/** L'heure de fin du tour (début + durée) est passée. */
export function isRoundOver(round: RoundTiming, now: Date): boolean {
  return interviewEnd(round.scheduledAt, round.durationMinutes).getTime() <= now.getTime()
}

/**
 * « Issue à renseigner » : tour actif, ni annulé ni en empêchement, dont
 * l'heure de fin est passée.
 */
export function isOutcomeDue(
  round: RoundTiming & Pick<HiringRoundState, 'active' | 'status' | 'outcome'>,
  now: Date,
): boolean {
  return (
    round.active &&
    !round.outcome &&
    round.status !== 'annule' &&
    round.status !== 'empechement' &&
    isRoundOver(round, now)
  )
}

/** Rappel au recruteur : issue à renseigner depuis 24 h, jamais encore rappelée. */
export function isOutcomeReminderDue(
  round: RoundTiming & Pick<HiringRoundState, 'active' | 'status' | 'outcome' | 'outcomeReminderAt'>,
  now: Date,
): boolean {
  if (!isOutcomeDue(round, now) || round.outcomeReminderAt) return false
  const end = interviewEnd(round.scheduledAt, round.durationMinutes).getTime()
  return end + OUTCOME_REMINDER_HOURS * HOUR_MS <= now.getTime()
}

/** Issue en souffrance depuis plus de 7 jours (résumé admin quotidien). */
export function isOutcomeOverdue(
  round: RoundTiming & Pick<HiringRoundState, 'active' | 'status' | 'outcome'>,
  now: Date,
): boolean {
  if (!isOutcomeDue(round, now)) return false
  const end = interviewEnd(round.scheduledAt, round.durationMinutes).getTime()
  return end + OUTCOME_OVERDUE_DAYS * DAY_MS <= now.getTime()
}

/**
 * Issue « à renseigner » pour les listes, les compteurs `toRecord` et les
 * rappels : tour dû (`isOutcomeDue`) ET dossier dans la phase
 * `issue_a_renseigner`. Un dossier embauché (placement lié non annulé, même
 * déclaré avant les tours), une offre pourvue (`poste_pourvu`) ou un dossier
 * hors `mise_en_relation` n'attendent plus d'issue, même si leur dernier
 * tour n'en a pas.
 */
export function outcomeToRecord(
  round: RoundTiming & Pick<HiringRoundState, 'active' | 'status' | 'outcome'>,
  phase: HiringPhase | null,
  now: Date,
): boolean {
  return phase === 'issue_a_renseigner' && isOutcomeDue(round, now)
}

/**
 * Filtre « Issue » d'une ligne d'entretien. Avec `phase` (phase du dossier,
 * `hiringPhase`), `a_renseigner` suit `outcomeToRecord` — même définition
 * que le compteur `toRecord` ; sans, seulement le tour (`isOutcomeDue`).
 */
export function roundMatchesOutcomeFilter(
  round: RoundTiming & Pick<HiringRoundState, 'active' | 'status' | 'outcome'>,
  filter: InterviewOutcomeFilter,
  now: Date,
  phase?: HiringPhase | null,
): boolean {
  if (filter !== 'a_renseigner') return round.outcome === filter
  return phase === undefined ? isOutcomeDue(round, now) : outcomeToRecord(round, phase, now)
}

/** Proposition encore `envoyee` mais dont l'échéance est passée (le job ne l'a pas encore marquée). */
export function isProposalExpired(proposal: Pick<HiringProposalState, 'status' | 'expiresAt'>, now: Date): boolean {
  return proposal.status === 'envoyee' && toMs(proposal.expiresAt) <= now.getTime()
}

/** Statut à afficher : une proposition échue est `expiree` même avant le passage du job. */
export function effectiveProposalStatus(
  proposal: Pick<HiringProposalState, 'status' | 'expiresAt'>,
  now: Date,
): HireProposalStatus {
  return isProposalExpired(proposal, now) ? 'expiree' : proposal.status
}

/** Échéance d'une proposition envoyée ou modifiée à `from` (D2 : relancée à chaque modification). */
export function hireProposalExpiresAt(from: Date): Date {
  return new Date(from.getTime() + HIRE_PROPOSAL_TTL_DAYS * DAY_MS)
}

/** Instant du rappel J-2. */
export function hireProposalReminderAt(expiresAt: string | Date): Date {
  return new Date(toMs(expiresAt) - HIRE_PROPOSAL_REMINDER_DAYS * DAY_MS)
}

/**
 * Rappel J-2 dû : proposition en attente, non échue, à moins de 2 jours de
 * l'échéance, pas encore rappelée (une modification remet `expiryReminderAt`
 * à `null` avec la nouvelle échéance).
 */
export function isProposalReminderDue(
  proposal: Pick<HiringProposalState, 'status' | 'expiresAt' | 'expiryReminderAt'>,
  now: Date,
): boolean {
  return (
    proposal.status === 'envoyee' &&
    !proposal.expiryReminderAt &&
    !isProposalExpired(proposal, now) &&
    hireProposalReminderAt(proposal.expiresAt).getTime() <= now.getTime()
  )
}

/** Proposition en attente de réponse (envoyée, non échue), ou `undefined`. */
export function pendingProposalOf<T extends Pick<HiringProposalState, 'status' | 'expiresAt' | 'version'>>(
  proposals: readonly T[],
  now: Date,
): T | undefined {
  let best: T | undefined
  for (const row of proposals) {
    if (row.status !== 'envoyee' || isProposalExpired(row, now)) continue
    if (!best || row.version > best.version) best = row
  }
  return best
}

/** Dernière version de proposition, ou `undefined`. */
export function latestProposalOf<T extends { version: number }>(proposals: readonly T[]): T | undefined {
  let best: T | undefined
  for (const row of proposals) if (!best || row.version > best.version) best = row
  return best
}

/** Version de la prochaine proposition du dossier. */
export function nextProposalVersion(proposals: readonly { version: number }[]): number {
  return (latestProposalOf(proposals)?.version ?? 0) + 1
}

const isActivePlacement = (placement: HiringDossierState['placement']) =>
  Boolean(placement && placement.stage !== 'annule')

/** Phase d'après un dernier tour `retenu` : propositions et placement. */
function phaseAfterRetenu(state: HiringDossierState, now: Date): HiringPhase {
  if (state.proposals.some((p) => p.status === 'acceptee')) {
    return state.placement?.stage === 'annule' ? 'embauche_annulee' : 'embauche'
  }
  if (state.proposals.some((p) => p.status === 'refusee')) return 'clos_proposition_refusee'
  if (pendingProposalOf(state.proposals, now)) return 'proposition_envoyee'
  return 'retenu'
}

/**
 * Phase sans la priorité « poste pourvu » : c'est elle que lisent les
 * contrôles d'action (une absence ou un « non retenu » se renseigne encore
 * sur une offre pourvue). `null` hors `mise_en_relation`.
 */
export function baseHiringPhase(state: HiringDossierState, now: Date): HiringPhase | null {
  if (state.status !== 'mise_en_relation') return null
  if (isActivePlacement(state.placement)) return 'embauche'
  if (state.rounds.length === 0) return 'entretien_a_planifier'
  const active = activeRoundOf(state.rounds)
  if (active) {
    if (active.status === 'annule') return 'tour_annule'
    // Empêchement : le recruteur reprogramme ou annule (drapeau « À traiter »
    // existant), jamais d'issue sur ce tour — même passé.
    if (active.status === 'empechement' || !isRoundOver(active, now)) return 'tour_planifie'
    return 'issue_a_renseigner'
  }
  const last = latestRound(state.rounds)
  switch (last?.outcome) {
    case 'second_entretien':
      return 'second_entretien_a_planifier'
    case 'absent':
      return 'absent'
    case 'non_retenu':
      return 'non_retenu'
    case 'retenu':
      return phaseAfterRetenu(state, now)
    default:
      // Inatteignable : un dernier tour sans issue est le tour actif.
      return 'issue_a_renseigner'
  }
}

/**
 * Phase d'un dossier (plan §4.2) : `null` hors `mise_en_relation`. Une offre
 * pourvue l'emporte sur toute phase non terminale (`poste_pourvu`) ; un
 * placement lié et non annulé donne toujours `embauche`.
 */
export function hiringPhase(state: HiringDossierState, now: Date): HiringPhase | null {
  const base = baseHiringPhase(state, now)
  if (base === null) return null
  if (state.filledAt && !TERMINAL_HIRING_PHASES.includes(base)) return 'poste_pourvu'
  return base
}

const CANDIDATE_PHASE: Record<HiringPhase, CandidateHiringPhase> = {
  entretien_a_planifier: 'entretien_a_planifier',
  tour_planifie: 'entretien_prevu',
  tour_annule: 'entretien_annule',
  issue_a_renseigner: 'suite_en_attente',
  second_entretien_a_planifier: 'suite_en_attente',
  absent: 'entretien_manque',
  retenu: 'suite_favorable',
  proposition_envoyee: 'proposition_recue',
  embauche: 'embauche',
  embauche_annulee: 'clos',
  clos_proposition_refusee: 'clos',
  non_retenu: 'clos',
  poste_pourvu: 'clos',
}

/** Phase vue par le candidat (`candidatePhase` de `/mine`), `null` hors `mise_en_relation`. */
export function candidateHiringPhase(state: HiringDossierState, now: Date): CandidateHiringPhase | null {
  const phase = hiringPhase(state, now)
  return phase === null ? null : CANDIDATE_PHASE[phase]
}

/* ------------------------------------------------------------------ */
/* Actions autorisées (plan §4.3)                                      */
/* ------------------------------------------------------------------ */

export type HiringActor = 'recruiter' | 'candidate' | 'admin' | 'system'

/**
 * Actions sur la suite d'un dossier `mise_en_relation`. Les quatre actions
 * d'entretien existantes (`reschedule_round`, `cancel_round`,
 * `confirm_round`, `report_unavailable`) reprennent à l'identique les gardes
 * de server/src/lib/interviews.ts, qui reste juge jusqu'à son branchement
 * sur ce module (sous-lot 3).
 */
export type HiringAction =
  | 'record_outcome'
  | 'schedule_round'
  | 'reschedule_round'
  | 'cancel_round'
  | 'confirm_round'
  | 'report_unavailable'
  | 'absence_reply'
  | 'send_proposal'
  | 'revise_proposal'
  | 'withdraw_proposal'
  | 'accept_proposal'
  | 'decline_proposal'
  | 'expire_proposal'
  | 'reset_outcome'

/**
 * Qui peut quoi. Le contrôle de propriété (offre du recruteur, dossier du
 * candidat) reste à l'appelant, avant ce module (403 / 404). `system` :
 * clôture « offre pourvue » et tâches périodiques.
 */
export const HIRING_ACTION_ACTORS: Record<HiringAction, readonly HiringActor[]> = {
  record_outcome: ['recruiter'],
  schedule_round: ['recruiter'],
  reschedule_round: ['recruiter'],
  cancel_round: ['recruiter', 'system'],
  confirm_round: ['candidate'],
  report_unavailable: ['candidate'],
  absence_reply: ['candidate'],
  send_proposal: ['recruiter'],
  revise_proposal: ['recruiter'],
  withdraw_proposal: ['recruiter', 'system'],
  accept_proposal: ['candidate'],
  decline_proposal: ['candidate'],
  expire_proposal: ['system'],
  reset_outcome: ['admin'],
}

export type HiringCheck = { ok: true } | { ok: false; httpStatus: 400 | 403 | 404 | 409; error: string }

/** Même forme que `TransitionCheck` (`connectionCheck()`, lib/preselection-service.ts). */
export type ConnectionCheckResult = { ok: true } | { ok: false; httpStatus: 400 | 409; error: string }

export interface HiringActionInput {
  actor: HiringActor
  action: HiringAction
  state: HiringDossierState
  now: Date
  /** Tour visé (`interviewId` du corps). Par défaut : le tour actif, ou le dernier tour concerné. */
  interviewId?: string
  /** Issue choisie (`record_outcome`). Absente : « l'issue peut-elle être renseignée ? » (UI). */
  result?: InterviewResult
  /** Proposition visée (réponse du candidat, expiration). Par défaut : la proposition en attente. */
  proposalId?: string
  /** Révision lue par l'auteur de la requête. Absente : non vérifiée (UI). */
  revision?: number
  /**
   * Résultat de `connectionCheck()` (accord de matching en vigueur et compte
   * candidat actif), calculé par le serveur. Absent : non vérifié (UI).
   */
  connection?: ConnectionCheckResult
  /** Comptes suspendus ou bannis, relus par le serveur (acceptation). */
  candidateBlocked?: boolean
  recruiterBlocked?: boolean
}

export const HIRING_FORBIDDEN_ERROR = 'Action non autorisée pour votre rôle.'
export const HIRING_NOT_CONNECTED_ERROR = 'Ce dossier n’est pas mis en relation.'
export const DOSSIER_NOT_FOUND_ERROR = 'Dossier introuvable.'
/** Mêmes textes que server/src/lib/interviews.ts. */
export const NO_INTERVIEW_ERROR = 'Aucun entretien pour ce dossier.'
export const NO_ACTIVE_ROUND_ERROR = 'Aucun entretien en cours pour ce dossier.'
export const ROUND_ALREADY_SCHEDULED_ERROR =
  'Un entretien est déjà fixé pour ce dossier. Utilisez « Reprogrammer » pour changer la date.'
export const NO_FURTHER_ROUND_ERROR = 'La suite de ce dossier ne prévoit pas de nouvel entretien.'
export const MAX_ROUNDS_ERROR = `Nombre maximal de tours atteint (${MAX_INTERVIEW_ROUNDS}).`
export const OUTCOME_ALREADY_RECORDED_ERROR = 'L’issue de cet entretien est déjà renseignée.'
export const OUTCOME_ON_CANCELLED_ERROR = 'Cet entretien est annulé : reprogrammez-le avant d’en renseigner l’issue.'
export const OUTCOME_ON_IMPEDIMENT_ERROR =
  'Le candidat a signalé un empêchement : reprogrammez ou annulez l’entretien.'
export const OUTCOME_RESULT_REQUIRED_ERROR = 'Choisissez l’issue de l’entretien.'
export const NO_OUTCOME_TO_RESET_ERROR = 'Cet entretien n’a pas d’issue à annuler.'
export const OUTCOME_RESET_BLOCKED_ERROR = 'Une suite existe déjà (tour suivant ou proposition).'
export const NO_ABSENCE_ERROR = 'Aucune absence à expliquer pour ce dossier.'
export const ABSENCE_ALREADY_REPLIED_ERROR = 'Vous avez déjà répondu.'
/** Offre pourvue : même texte que la raison de fermeture de l'offre (D1). */
export const OPPORTUNITY_FILLED_ERROR = 'Tous les postes de cette offre sont pourvus.'
export const OUTCOME_RETENU_REQUIRED_ERROR = 'Renseignez d’abord l’issue « Retenu » de l’entretien.'
export const ALREADY_HIRED_ERROR = 'Ce candidat est déjà embauché pour ce poste.'
export const PROPOSAL_PENDING_ERROR = 'Une proposition est déjà en attente pour ce dossier.'
export const PROPOSAL_FINAL_ERROR = 'Le candidat a déjà répondu définitivement.'
export const MAX_PROPOSALS_ERROR = `Nombre maximal de propositions atteint pour ce dossier (${MAX_PROPOSAL_VERSIONS}).`
export const PROPOSAL_CHANGED_ERROR =
  'La proposition a changé entre-temps (réponse du candidat ou expiration). Rechargez la page.'
export const PROPOSAL_NOT_FOUND_ERROR = 'Proposition introuvable.'
export const PROPOSAL_REVISED_ERROR = 'Cette proposition a été modifiée : relisez-la avant de répondre.'
export const PROPOSAL_EXPIRED_ERROR = 'Cette proposition a expiré.'
export const PROPOSAL_WITHDRAWN_ERROR = 'Cette proposition a été retirée par l’entreprise.'
export const PROPOSAL_ALREADY_ANSWERED_ERROR = 'Vous avez déjà répondu à cette proposition.'
export const POSITION_FILLED_ERROR = 'Le poste a été pourvu entre-temps.'
export const PROPOSAL_NOT_EXPIRED_ERROR = 'Cette proposition n’est pas arrivée à échéance.'
export const CANDIDATE_ACCOUNT_INACTIVE_ERROR = 'Votre compte n’est pas actif : contactez OffRec.'
export const RECRUITER_ACCOUNT_INACTIVE_ERROR =
  'Le compte de l’entreprise n’est plus actif : la proposition ne peut pas être acceptée pour le moment.'
/** D4 : `POST /placements` refuse un candidat diplômé (client Prisma régénéré) : son placement naît de l'acceptation. */
export const GRADUATE_PLACEMENT_AUTOMATIC_ERROR =
  'Pour un candidat diplômé, le placement est créé automatiquement quand il accepte votre proposition d’embauche.'

/** « L'entretien n'est pas encore terminé : renseignez l'issue après … ». */
export function outcomeTooEarlyError(round: RoundTiming): string {
  const end = interviewEnd(round.scheduledAt, round.durationMinutes)
  return `L’entretien n’est pas encore terminé : renseignez l’issue après le ${formatMadagascarDateTime(end)} (heure de Madagascar).`
}

const OK: HiringCheck = { ok: true }
const fail = (httpStatus: 400 | 403 | 404 | 409, error: string): HiringCheck => ({ ok: false, httpStatus, error })
const connectionOf = (input: HiringActionInput): HiringCheck => input.connection ?? OK

/**
 * Contrôle unique d'une action sur la suite d'un dossier (plan §4.3). Pur :
 * l'appelant charge l'état, vérifie la propriété, calcule `connection`, puis
 * écrit de façon conditionnelle (le `where` relit l'état contrôlé ici).
 */
export function checkHiringAction(input: HiringActionInput): HiringCheck {
  const { actor, action, state, now } = input
  if (!HIRING_ACTION_ACTORS[action].includes(actor)) return fail(403, HIRING_FORBIDDEN_ERROR)
  const base = baseHiringPhase(state, now)
  if (base === null) {
    return actor === 'candidate' ? fail(404, DOSSIER_NOT_FOUND_ERROR) : fail(400, HIRING_NOT_CONNECTED_ERROR)
  }
  const rounds = state.rounds
  const active = activeRoundOf(rounds)
  const noActive = () => fail(404, rounds.length > 0 ? NO_ACTIVE_ROUND_ERROR : NO_INTERVIEW_ERROR)

  switch (action) {
    case 'record_outcome': {
      if (input.interviewId && active?.id !== input.interviewId) {
        const target = rounds.find((row) => row.id === input.interviewId)
        return target?.outcome ? fail(409, OUTCOME_ALREADY_RECORDED_ERROR) : fail(404, NO_ACTIVE_ROUND_ERROR)
      }
      if (!active) return noActive()
      if (active.status === 'annule') return fail(400, OUTCOME_ON_CANCELLED_ERROR)
      if (active.status === 'empechement') return fail(400, OUTCOME_ON_IMPEDIMENT_ERROR)
      if (!isRoundOver(active, now)) return fail(400, outcomeTooEarlyError(active))
      const result = input.result
      if (!result) return OK
      if (result === 'second_entretien' && active.round >= MAX_INTERVIEW_ROUNDS) return fail(400, MAX_ROUNDS_ERROR)
      if (result === 'retenu' || result === 'second_entretien') {
        // Poursuivre exige une offre ouverte et l'accord du candidat ; clore
        // (non retenu, absent) reste toujours possible.
        if (state.filledAt) return fail(409, OPPORTUNITY_FILLED_ERROR)
        return connectionOf(input)
      }
      return OK
    }

    case 'schedule_round': {
      if (active) return fail(409, ROUND_ALREADY_SCHEDULED_ERROR)
      if (base !== 'entretien_a_planifier' && base !== 'second_entretien_a_planifier' && base !== 'absent') {
        return fail(409, NO_FURTHER_ROUND_ERROR)
      }
      if (rounds.length > 0 && nextRoundNumber(rounds) > MAX_INTERVIEW_ROUNDS) return fail(400, MAX_ROUNDS_ERROR)
      if (state.filledAt) return fail(409, OPPORTUNITY_FILLED_ERROR)
      return connectionOf(input)
    }

    case 'reschedule_round':
      if (!active) return noActive()
      // Offre pourvue (D1) : plus de nouvelle date, même pour un tour annulé
      // ou en empêchement (la clôture annule déjà les tours à venir). Annuler
      // et renseigner « non retenu » / « absent » restent possibles.
      if (state.filledAt) return fail(409, OPPORTUNITY_FILLED_ERROR)
      return connectionOf(input)

    case 'cancel_round':
      if (!active) return noActive()
      if (active.status === 'annule') return fail(409, 'Cet entretien est déjà annulé.')
      return OK

    case 'confirm_round':
      if (!active) return noActive()
      if (active.status === 'confirme') return OK
      if (active.status === 'annule') return fail(409, 'Cet entretien a été annulé par l’entreprise.')
      if (active.status === 'empechement') {
        return fail(409, 'Vous avez signalé un empêchement : l’entreprise va proposer une nouvelle date.')
      }
      if (toMs(active.scheduledAt) < now.getTime()) return fail(409, 'Cet entretien est déjà passé.')
      return OK

    case 'report_unavailable':
      if (!active) return noActive()
      if (active.status === 'annule') return fail(409, 'Cet entretien a été annulé par l’entreprise.')
      if (active.status === 'empechement') return fail(409, 'Vous avez déjà signalé un empêchement pour cet entretien.')
      return OK

    case 'absence_reply': {
      // Une explication par tour `absent`, même si le recruteur a déjà fixé
      // le tour suivant : elle ne part qu'aux admins.
      const target = input.interviewId
        ? rounds.find((row) => row.id === input.interviewId)
        : latestRound(rounds.filter((row) => row.outcome === 'absent'))
      if (!target || target.outcome !== 'absent') return fail(404, NO_ABSENCE_ERROR)
      if (target.absenceReplied) return fail(409, ABSENCE_ALREADY_REPLIED_ERROR)
      return OK
    }

    case 'send_proposal': {
      if (base === 'embauche') return fail(409, ALREADY_HIRED_ERROR)
      if (state.proposals.some((p) => p.status === 'acceptee' || p.status === 'refusee')) {
        return fail(409, PROPOSAL_FINAL_ERROR)
      }
      if (pendingProposalOf(state.proposals, now)) return fail(409, PROPOSAL_PENDING_ERROR)
      if (base !== 'retenu') return fail(400, OUTCOME_RETENU_REQUIRED_ERROR)
      if (state.filledAt) return fail(409, OPPORTUNITY_FILLED_ERROR)
      if (state.proposals.length >= MAX_PROPOSAL_VERSIONS) return fail(409, MAX_PROPOSALS_ERROR)
      return connectionOf(input)
    }

    case 'revise_proposal':
    case 'withdraw_proposal': {
      const pending = pendingProposalOf(state.proposals, now)
      if (!pending) return fail(409, PROPOSAL_CHANGED_ERROR)
      if (actor !== 'system') {
        if (input.proposalId !== undefined && input.proposalId !== pending.id) return fail(409, PROPOSAL_CHANGED_ERROR)
        if (input.revision !== undefined && input.revision !== pending.revision) return fail(409, PROPOSAL_CHANGED_ERROR)
      }
      if (action === 'withdraw_proposal') return OK
      if (state.filledAt) return fail(409, OPPORTUNITY_FILLED_ERROR)
      return connectionOf(input)
    }

    case 'accept_proposal':
    case 'decline_proposal': {
      const target = input.proposalId
        ? state.proposals.find((p) => p.id === input.proposalId)
        : latestProposalOf(state.proposals)
      if (!target) return fail(404, PROPOSAL_NOT_FOUND_ERROR)
      switch (effectiveProposalStatus(target, now)) {
        case 'retiree':
          return fail(409, target.withdrawReason === 'poste_pourvu' ? POSITION_FILLED_ERROR : PROPOSAL_WITHDRAWN_ERROR)
        case 'expiree':
          return fail(409, PROPOSAL_EXPIRED_ERROR)
        case 'acceptee':
        case 'refusee':
          return fail(409, PROPOSAL_ALREADY_ANSWERED_ERROR)
        case 'envoyee':
          break
      }
      if (input.revision !== undefined && input.revision !== target.revision) return fail(409, PROPOSAL_REVISED_ERROR)
      if (action === 'decline_proposal') return OK
      // Le retrait de l'accord de matching n'empêche pas d'accepter (§4.3) ;
      // un compte inactif, oui.
      if (state.filledAt) return fail(409, POSITION_FILLED_ERROR)
      if (input.candidateBlocked) return fail(409, CANDIDATE_ACCOUNT_INACTIVE_ERROR)
      if (input.recruiterBlocked) return fail(409, RECRUITER_ACCOUNT_INACTIVE_ERROR)
      return OK
    }

    case 'expire_proposal': {
      const target = input.proposalId
        ? state.proposals.find((p) => p.id === input.proposalId)
        : latestProposalOf(state.proposals.filter((p) => p.status === 'envoyee'))
      if (!target) return fail(404, PROPOSAL_NOT_FOUND_ERROR)
      return isProposalExpired(target, now) ? OK : fail(409, PROPOSAL_NOT_EXPIRED_ERROR)
    }

    case 'reset_outcome': {
      const target = input.interviewId
        ? rounds.find((row) => row.id === input.interviewId)
        : latestRound(rounds.filter((row) => row.outcome))
      if (!target) return fail(404, input.interviewId ? 'Entretien introuvable.' : NO_OUTCOME_TO_RESET_ERROR)
      if (!target.outcome) return fail(409, NO_OUTCOME_TO_RESET_ERROR)
      if (
        rounds.some((row) => row.round > target.round) ||
        state.proposals.length > 0 ||
        isActivePlacement(state.placement)
      ) {
        return fail(409, OUTCOME_RESET_BLOCKED_ERROR)
      }
      return OK
    }
  }
}

/**
 * Actions possibles pour cet acteur, sans paramètre propre à la requête
 * (pas d'issue choisie, révision non vérifiée) : ce que l'UI affiche. Le
 * serveur reste juge.
 */
export function allowedHiringActions(
  actor: HiringActor,
  state: HiringDossierState,
  now: Date,
  connection?: ConnectionCheckResult,
): HiringAction[] {
  return (Object.keys(HIRING_ACTION_ACTORS) as HiringAction[]).filter(
    (action) =>
      HIRING_ACTION_ACTORS[action].includes(actor) &&
      action !== 'expire_proposal' &&
      checkHiringAction({ actor, action, state, now, connection }).ok,
  )
}

/** Issues proposées dans la modale (vide si l'issue ne peut pas être renseignée). */
export function allowedOutcomeResults(
  state: HiringDossierState,
  now: Date,
  connection?: ConnectionCheckResult,
): InterviewResult[] {
  return INTERVIEW_RESULTS.filter(
    (result) => checkHiringAction({ actor: 'recruiter', action: 'record_outcome', state, now, result, connection }).ok,
  )
}

/* ------------------------------------------------------------------ */
/* Champs d'une issue et d'une proposition (Zod côté serveur)          */
/* ------------------------------------------------------------------ */

/** Motifs acceptés pour une issue (vide pour une absence). */
export function reasonsForResult(result: InterviewResult): readonly InterviewResultReason[] {
  if (result === 'non_retenu') return NEGATIVE_RESULT_REASONS
  if (result === 'absent') return []
  return POSITIVE_RESULT_REASONS
}

/**
 * Cohérence issue / motif : « Non retenu » exige un motif négatif ;
 * « Retenu » et « Second entretien » n'acceptent que « points forts »
 * (facultatif) ; une absence n'a pas de motif.
 */
export function outcomeReasonError(result: InterviewResult, reason: InterviewResultReason | null | undefined): string | null {
  if (result === 'absent') return reason ? 'Une absence ne se motive pas : retirez le motif.' : null
  if (result === 'non_retenu') {
    if (!reason) return 'Choisissez le motif de non-sélection.'
    return NEGATIVE_RESULT_REASONS.includes(reason) ? null : 'Ce motif ne correspond pas à l’issue « Non retenu ».'
  }
  return !reason || POSITIVE_RESULT_REASONS.includes(reason) ? null : 'Ce motif ne correspond pas à l’issue choisie.'
}

/** Montant en Ariary groupé par milliers (« 1 200 000 »), sans dépendre d'`Intl`. */
export function formatAriaryAmount(amount: number): string {
  const digits = String(Math.round(Math.abs(amount)))
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  return amount < 0 ? `-${grouped}` : grouped
}

/** Salaire mensuel brut en Ariary : entier entre 50 000 et 100 000 000. */
export function hireSalaryError(amount: number): string | null {
  if (!Number.isFinite(amount) || !Number.isInteger(amount)) {
    return 'Indiquez le salaire mensuel brut en Ariary, sans décimales.'
  }
  if (amount < HIRE_SALARY_MIN_AR) return `Salaire trop bas : au moins ${formatAriaryAmount(HIRE_SALARY_MIN_AR)} Ar par mois.`
  if (amount > HIRE_SALARY_MAX_AR) return `Salaire trop élevé : au plus ${formatAriaryAmount(HIRE_SALARY_MAX_AR)} Ar par mois.`
  return null
}

/** « Aujourd'hui » à Madagascar (AAAA-MM-JJ). */
export function madagascarToday(now: Date): string {
  return toMadagascarInputs(now).date
}

const civilDayMs = (date: string) => Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10)))

/**
 * Date de début (jour civil AAAA-MM-JJ, Madagascar) : valide, au plus tôt
 * aujourd'hui, au plus tard dans 180 jours.
 */
export function hireStartDateError(date: string, now: Date): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return 'Date de début invalide (format AAAA-MM-JJ attendu).'
  const day = civilDayMs(date)
  const back = new Date(day)
  if (
    Number.isNaN(day) ||
    back.getUTCFullYear() !== Number(date.slice(0, 4)) ||
    back.getUTCMonth() + 1 !== Number(date.slice(5, 7)) ||
    back.getUTCDate() !== Number(date.slice(8, 10))
  ) {
    return 'Date de début invalide.'
  }
  const ahead = Math.round((day - civilDayMs(madagascarToday(now))) / DAY_MS)
  if (ahead < 0) return 'La date de début ne peut pas être déjà passée.'
  if (ahead > HIRE_START_MAX_DAYS) return `La date de début ne peut pas dépasser ${HIRE_START_MAX_DAYS} jours.`
  return null
}

/** Durée en mois : obligatoire pour un CDD ou un stage, interdite pour un CDI, facultative sinon. */
export function contractDurationError(type: ContractType, months: number | null | undefined): string | null {
  const given = months !== null && months !== undefined
  if (!given) {
    return CONTRACTS_WITH_DURATION.includes(type)
      ? `Indiquez la durée du contrat en mois (${CONTRACT_TYPE_LABELS[type]}).`
      : null
  }
  if (type === 'cdi') return 'Un CDI n’a pas de durée : retirez-la.'
  if (!Number.isInteger(months) || months < CONTRACT_DURATION_MIN_MONTHS || months > CONTRACT_DURATION_MAX_MONTHS) {
    return `Durée attendue : de ${CONTRACT_DURATION_MIN_MONTHS} à ${CONTRACT_DURATION_MAX_MONTHS} mois.`
  }
  return null
}

/** Champs modifiables d'une proposition (jour civil AAAA-MM-JJ pour `startDate`). */
export interface HireProposalFields {
  jobTitle: string
  monthlySalaryAr: number
  startDate: string
  contractType: ContractType
  contractDurationMonths: number | null
  message: string | null
}

/** Modification demandée : `undefined` = inchangé ; `null` efface la durée ou le message. */
export type HireProposalChanges = { [K in keyof HireProposalFields]?: HireProposalFields[K] | null }

export const NO_PROPOSAL_CHANGE_ERROR = 'Aucune modification à enregistrer.'

const PROPOSAL_FIELD_KEYS: readonly (keyof HireProposalFields)[] = [
  'jobTitle',
  'monthlySalaryAr',
  'startDate',
  'contractType',
  'contractDurationMonths',
  'message',
]

/**
 * Proposition après modification (`PATCH /:id/hire-proposal`) : fusion des
 * champs envoyés avec la proposition en attente, puis contrôle de la
 * cohérence contrat / durée sur le RÉSULTAT (un CDD devenu CDI doit perdre
 * sa durée, un CDI devenu CDD doit en recevoir une). `changed` liste les
 * champs réellement modifiés ; une modification sans effet est refusée.
 */
export function mergeProposalRevision(
  current: HireProposalFields,
  changes: HireProposalChanges,
): { fields: HireProposalFields; changed: (keyof HireProposalFields)[]; error: string | null } {
  const fields: HireProposalFields = {
    jobTitle: changes.jobTitle ?? current.jobTitle,
    monthlySalaryAr: changes.monthlySalaryAr ?? current.monthlySalaryAr,
    startDate: changes.startDate ?? current.startDate,
    contractType: changes.contractType ?? current.contractType,
    contractDurationMonths:
      changes.contractDurationMonths === undefined ? current.contractDurationMonths : changes.contractDurationMonths,
    message: changes.message === undefined ? current.message : changes.message,
  }
  const changed = PROPOSAL_FIELD_KEYS.filter((key) => fields[key] !== current[key])
  const error = contractDurationError(fields.contractType, fields.contractDurationMonths)
  return { fields, changed, error: error ?? (changed.length === 0 ? NO_PROPOSAL_CHANGE_ERROR : null) }
}

/* ------------------------------------------------------------------ */
/* Offre pourvue (D1)                                                  */
/* ------------------------------------------------------------------ */

export interface OpportunityFillState {
  /** Nombre de postes (`Opportunity.positions`). */
  positions: number
  /** Placements non annulés liés à l'offre (diplômés acceptés et talents déclarés). */
  activePlacements: number
  filledAt: string | Date | null
}

/** L'offre doit passer « pourvue » automatiquement (après une acceptation). */
export function shouldAutoFill(state: OpportunityFillState): boolean {
  return !state.filledAt && state.activePlacements >= state.positions
}

/** « Pourvue (1/2) » (offre fermée) ou « Postes pourvus : 1/2 ». */
export function positionsFillLabel(state: OpportunityFillState): string {
  const ratio = `${Math.min(state.activePlacements, state.positions)}/${state.positions}`
  return state.filledAt ? `Pourvue (${ratio})` : `Postes pourvus : ${ratio}`
}

/** Nombre de postes saisi (création, modification) : 1 à 50, jamais sous les placements actifs. */
export function positionsUpdateError(positions: number, activePlacements: number): string | null {
  if (!Number.isInteger(positions) || positions < OPPORTUNITY_POSITIONS_MIN || positions > OPPORTUNITY_POSITIONS_MAX) {
    return `Nombre de postes attendu : de ${OPPORTUNITY_POSITIONS_MIN} à ${OPPORTUNITY_POSITIONS_MAX}.`
  }
  if (positions < activePlacements) {
    return `${activePlacements} poste${activePlacements > 1 ? 's sont' : ' est'} déjà pourvu${activePlacements > 1 ? 's' : ''} : indiquez au moins ${activePlacements}.`
  }
  return null
}

export type OpportunityFillCheck = { ok: true; positions: number } | { ok: false; httpStatus: 400 | 409; error: string }

/**
 * « Marquer comme pourvue » (clôture manuelle, embauche hors OffRec) et
 * « Rouvrir » (ajouter un poste) par le recruteur propriétaire. À la
 * réouverture, l'offre doit garder au moins un poste libre : `positions`
 * renvoyé = la valeur demandée, sinon max(postes actuels, placements + 1).
 * Les dossiers clos ne sont jamais réactivés (règle `ecartee`).
 */
export function checkOpportunityFillAction(input: {
  action: 'mark_filled' | 'reopen'
  state: OpportunityFillState
  requestedPositions?: number
}): OpportunityFillCheck {
  const { state } = input
  if (input.action === 'mark_filled') {
    if (state.filledAt) return { ok: false, httpStatus: 409, error: 'Cette offre est déjà marquée comme pourvue.' }
    return { ok: true, positions: state.positions }
  }
  if (!state.filledAt) return { ok: false, httpStatus: 409, error: 'Cette offre n’est pas pourvue.' }
  const required = state.activePlacements + 1
  if (required > OPPORTUNITY_POSITIONS_MAX) {
    return { ok: false, httpStatus: 400, error: `Nombre maximal de postes atteint (${OPPORTUNITY_POSITIONS_MAX}).` }
  }
  if (input.requestedPositions !== undefined) {
    const error = positionsUpdateError(input.requestedPositions, required)
    if (error) return { ok: false, httpStatus: 400, error }
    return { ok: true, positions: input.requestedPositions }
  }
  return { ok: true, positions: Math.max(state.positions, required) }
}

/** Ce que la clôture « offre pourvue » fait à un dossier mis en relation (hors embauche). */
export interface FilledClosureEffect {
  /** Tour actif à venir à annuler (événement Google supprimé), ou `null`. */
  cancelRoundId: string | null
  /** Proposition en attente à retirer (`withdrawReason: poste_pourvu`), ou `null`. */
  withdrawProposalId: string | null
}

/**
 * Effets de la clôture sur un dossier `mise_en_relation` : rien pour un
 * dossier embauché ou terminal. Les dossiers non mis en relation passent par
 * `commitMatchTransition` (acteur `system`, sous-lot 5), pas par ici.
 */
export function filledClosureEffect(state: HiringDossierState, now: Date): FilledClosureEffect | null {
  const base = baseHiringPhase(state, now)
  if (base === null || TERMINAL_HIRING_PHASES.includes(base)) return null
  const active = activeRoundOf(state.rounds)
  const upcoming = active && active.status !== 'annule' && !isRoundOver(active, now) ? active : undefined
  return {
    cancelRoundId: upcoming?.id ?? null,
    withdrawProposalId: pendingProposalOf(state.proposals, now)?.id ?? null,
  }
}

/**
 * Message « poste pourvu » à envoyer au candidat d'un AUTRE dossier de
 * l'offre : `mis_en_relation` (nom de l'entreprise déjà connu, in-app +
 * email) si son dossier est encore en cours (`filledClosureEffect` non
 * `null`) ; `profil_transmis` (sans nom d'entreprise, in-app) pour un
 * dossier qu'il voit dans « Mes dossiers » sans mise en relation ; `null`
 * sinon (file de validation, déjà écarté, embauché ou déjà clos).
 */
export function filledNoticeKind(state: HiringDossierState, now: Date): 'mis_en_relation' | 'profil_transmis' | null {
  switch (state.status) {
    case 'mise_en_relation':
      return filledClosureEffect(state, now) ? 'mis_en_relation' : null
    case 'proposee_recruteur':
    case 'interet_recruteur':
    case 'proposee_candidat':
    case 'interet_candidat':
      return 'profil_transmis'
    case 'suggeree':
    case 'ecartee':
      return null
  }
}

/* ------------------------------------------------------------------ */
/* Visibilité par rôle (D3) — listes blanches                          */
/* ------------------------------------------------------------------ */

export type HiringAudience = 'candidate' | 'recruiter' | 'admin'

/** Qui regarde. `recruiter` = le recruteur PROPRIÉTAIRE de l'offre (vérifié par l'appelant). */
export interface HiringViewer {
  audience: HiringAudience
  userId: string
}

/**
 * Matrice de visibilité (plan §6.1) :
 * - issue et motif : recruteur propriétaire et admin, jamais le candidat ;
 * - note privée : son SEUL auteur (ni l'admin) ;
 * - explication d'absence : le candidat (la sienne) et l'admin, jamais le recruteur ;
 * - catégorie d'un refus : candidat, recruteur, admin ; précision : candidat et admin ;
 * - raison d'un retrait : recruteur et admin.
 */
export const HIRING_VISIBILITY = {
  outcome: (viewer: HiringViewer) => viewer.audience !== 'candidate',
  outcomeReason: (viewer: HiringViewer) => viewer.audience !== 'candidate',
  outcomeNote: (viewer: HiringViewer, authorId: string | null | undefined) =>
    viewer.audience !== 'candidate' && Boolean(authorId) && viewer.userId === authorId,
  absenceReply: (viewer: HiringViewer) => viewer.audience !== 'recruiter',
  declineReason: (_viewer: HiringViewer) => true,
  declineNote: (viewer: HiringViewer) => viewer.audience !== 'recruiter',
  withdrawReason: (viewer: HiringViewer) => viewer.audience !== 'candidate',
} as const

/** Colonnes d'issue d'un tour, telles que lues en base. */
export interface RoundOutcomeSource {
  outcome: InterviewResult | null
  outcomeReason: InterviewResultReason | null
  outcomeNote: string | null
  outcomeAt: string | Date | null
  outcomeById: string | null
  absenceReply: string | null
  absenceReplyAt: string | Date | null
}

/** Champs d'issue renvoyés avec un tour (seulement ceux que le lecteur peut voir). */
export interface RoundOutcomeView {
  outcome?: InterviewResult | null
  outcomeReason?: InterviewResultReason | null
  outcomeAt?: string | null
  outcomeNote?: string | null
  absenceReply?: string | null
  absenceReplyAt?: string | null
  /** Candidat : « Expliquer mon absence » est possible sur ce tour. */
  canExplainAbsence?: boolean
}

const isoOrNull = (value: string | Date | null | undefined): string | null =>
  value === null || value === undefined ? null : typeof value === 'string' ? new Date(value).toISOString() : value.toISOString()

/** Liste blanche des champs d'issue d'un tour pour un lecteur (jamais `outcomeById`). */
export function toRoundOutcomeView(row: RoundOutcomeSource, viewer: HiringViewer): RoundOutcomeView {
  if (viewer.audience === 'candidate') {
    // Le candidat sait déjà, par le texte neutre d'OffRec, qu'un entretien a
    // été manqué ; il ne voit jamais l'issue elle-même.
    return {
      absenceReply: row.absenceReply,
      absenceReplyAt: isoOrNull(row.absenceReplyAt),
      canExplainAbsence: row.outcome === 'absent' && !row.absenceReply,
    }
  }
  const view: RoundOutcomeView = {
    outcome: row.outcome,
    outcomeReason: row.outcomeReason,
    outcomeAt: isoOrNull(row.outcomeAt),
  }
  if (HIRING_VISIBILITY.outcomeNote(viewer, row.outcomeById)) view.outcomeNote = row.outcomeNote
  if (HIRING_VISIBILITY.absenceReply(viewer)) {
    view.absenceReply = row.absenceReply
    view.absenceReplyAt = isoOrNull(row.absenceReplyAt)
  }
  return view
}

/** Ligne `HireProposal` telle que lue en base (sous-ensemble utile). */
export interface HireProposalSource {
  id: string
  version: number
  jobTitle: string
  monthlySalaryAr: number
  startDate: string | Date
  contractType: ContractType
  contractDurationMonths: number | null
  message: string | null
  status: HireProposalStatus
  expiresAt: string | Date
  revision: number
  respondedAt: string | Date | null
  declineReason: HireDeclineReason | null
  declineNote: string | null
  withdrawnAt: string | Date | null
  withdrawReason: HireProposalWithdrawReason | null
  createdAt: string | Date
  updatedAt: string | Date
}

/** Proposition renvoyée à un lecteur : jamais `createdById`, `pendingSuggestionId` ni `expiryReminderAt`. */
export interface HireProposalView {
  id: string
  version: number
  jobTitle: string
  monthlySalaryAr: number
  /** Jour civil AAAA-MM-JJ. */
  startDate: string
  contractType: ContractType
  contractDurationMonths: number | null
  message: string | null
  /** Statut effectif (`expiree` dès l'échéance passée). */
  status: HireProposalStatus
  expiresAt: string
  revision: number
  respondedAt: string | null
  withdrawnAt: string | null
  createdAt: string
  updatedAt: string
  declineReason?: HireDeclineReason | null
  declineNote?: string | null
  withdrawReason?: HireProposalWithdrawReason | null
}

/** Jour civil AAAA-MM-JJ d'une colonne `@db.Date` (minuit UTC) ou d'une chaîne. */
export function civilDate(value: string | Date): string {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  return new Date(value).toISOString().slice(0, 10)
}

/** Liste blanche d'une proposition pour un lecteur (décision D3). */
export function toHireProposalView(row: HireProposalSource, viewer: HiringViewer, now: Date): HireProposalView {
  const view: HireProposalView = {
    id: row.id,
    version: row.version,
    jobTitle: row.jobTitle,
    monthlySalaryAr: row.monthlySalaryAr,
    startDate: civilDate(row.startDate),
    contractType: row.contractType,
    contractDurationMonths: row.contractDurationMonths,
    message: row.message,
    status: effectiveProposalStatus(row, now),
    expiresAt: isoOrNull(row.expiresAt) as string,
    revision: row.revision,
    respondedAt: isoOrNull(row.respondedAt),
    withdrawnAt: isoOrNull(row.withdrawnAt),
    createdAt: isoOrNull(row.createdAt) as string,
    updatedAt: isoOrNull(row.updatedAt) as string,
  }
  if (HIRING_VISIBILITY.declineReason(viewer)) view.declineReason = row.declineReason
  if (HIRING_VISIBILITY.declineNote(viewer)) view.declineNote = row.declineNote
  if (HIRING_VISIBILITY.withdrawReason(viewer)) view.withdrawReason = row.withdrawReason
  return view
}

/**
 * Clés qui ne doivent jamais apparaître dans une réponse au candidat
 * (recette §10.2, parcours récursif). `score` et `preselectionRank` n'y sont
 * pas : `/mine` les renvoie déjà ; seuls les TEXTES au candidat les excluent.
 */
export const CANDIDATE_FORBIDDEN_KEYS: readonly string[] = [
  'outcome',
  'outcomeReason',
  'outcomeNote',
  'outcomeById',
  'withdrawReason',
  'createdById',
]

/** Clés qui ne doivent jamais apparaître dans une réponse au recruteur. */
export const RECRUITER_FORBIDDEN_KEYS: readonly string[] = [
  'email',
  'phone',
  'absenceReply',
  'absenceReplyAt',
  'declineNote',
  'outcomeById',
]

/** Chemins (`a.b[0].c`) des clés interdites trouvées dans une valeur JSON. */
export function findForbiddenKeys(value: unknown, keys: readonly string[], path = ''): string[] {
  if (Array.isArray(value)) return value.flatMap((item, index) => findForbiddenKeys(item, keys, `${path}[${index}]`))
  if (!value || typeof value !== 'object') return []
  const found: string[] = []
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const childPath = path ? `${path}.${key}` : key
    if (keys.includes(key)) found.push(childPath)
    found.push(...findForbiddenKeys(child, keys, childPath))
  }
  return found
}

/* ------------------------------------------------------------------ */
/* Textes neutres envoyés au candidat « par OffRec » (plan §6.4)       */
/* ------------------------------------------------------------------ */

/**
 * Notification au candidat : in-app toujours, email quand `email` est
 * renseigné (`notifyUser`, lib/notify.ts, qui lit l'adresse en base). Les
 * constructeurs ne reçoivent JAMAIS le motif, la note, le score ni le rang :
 * un texte au candidat ne peut pas les contenir.
 */
export interface CandidateNotice {
  event: string
  title: string
  message: string
  email: { subject: string; body: string[]; actionLabel: string } | null
}

const clipTitle = (text: string, max = 60) => (text.length > max ? `${text.slice(0, max - 1)}…` : text)

/** « lundi 2 novembre 2026 » pour un jour civil (colonne `@db.Date` ou AAAA-MM-JJ). */
export function formatCivilDate(value: string | Date): string {
  // Midi à Madagascar : la date murale est celle du jour civil, sans heure.
  return formatMadagascarDateTime(`${civilDate(value)}T12:00:00+03:00`).replace(/ à \d{2} h \d{2}$/, '')
}

/** « contrat CDD, durée 6 mois » / « contrat de stage ». */
function contractPhrase(type: ContractType, months: number | null | undefined): string {
  const base = `contrat ${CONTRACT_TYPE_PHRASES[type]}`
  return months ? `${base}, durée ${months} mois` : base
}

/** Issue `retenu` (in-app seulement). */
export function retenuNotice(input: { opportunityTitle: string }): CandidateNotice {
  return {
    event: 'interview_followup_positive',
    title: 'Suite de votre entretien',
    message:
      `L’entreprise souhaite poursuivre avec vous pour « ${input.opportunityTitle} ». ` +
      'OffRec vous tient informé·e de la prochaine étape ici et par email.',
    email: null,
  }
}

/** Issue `second_entretien` avec sa date (in-app + email). `linkSentence` : phrase du lien Meet. */
export function secondRoundNotice(input: {
  companyName: string
  opportunityTitle: string
  scheduledAt: string | Date
  durationMinutes: number
  round: number
  linkSentence?: string
}): CandidateNotice {
  const when = `${formatMadagascarDateTime(input.scheduledAt)} (heure de Madagascar)`
  const message =
    `${input.companyName} vous propose un second entretien pour « ${input.opportunityTitle} » le ${when}, ` +
    `durée ${input.durationMinutes} minutes. Confirmez votre présence ou signalez un empêchement.`
  return {
    event: 'interview_next_round',
    title: 'Second entretien proposé',
    message,
    email: {
      subject: `Second entretien pour « ${clipTitle(input.opportunityTitle)} » — OffRec`,
      body: [message, ...(input.linkSentence ? [input.linkSentence] : [])],
      actionLabel: 'Confirmer ou signaler un empêchement',
    },
  }
}

/** Issue `non_retenu` (in-app + email). */
export function nonRetenuNotice(input: { opportunityTitle: string }): CandidateNotice {
  const message =
    `Merci d’avoir participé à l’entretien pour « ${input.opportunityTitle} ». ` +
    'L’entreprise a choisi de ne pas donner suite pour ce poste. Cette décision ne remet pas en cause votre profil : ' +
    'OffRec continue de le proposer aux offres qui correspondent à vos compétences.'
  return {
    event: 'interview_followup_closed',
    title: 'Suite de votre entretien',
    message,
    email: {
      subject: `Suite de votre entretien pour « ${clipTitle(input.opportunityTitle)} » — OffRec`,
      body: [message],
      actionLabel: 'Voir mes dossiers',
    },
  }
}

/** Issue `absent` (in-app + email), avec le bouton « Expliquer mon absence ». */
export function absentNotice(input: { opportunityTitle: string; scheduledAt: string | Date }): CandidateNotice {
  const date = formatMadagascarDateTime(input.scheduledAt)
  const message =
    `L’entreprise nous indique que l’entretien du ${date} pour « ${input.opportunityTitle} » n’a pas pu avoir lieu ` +
    'en votre présence. Si vous avez rencontré un empêchement, expliquez-le à OffRec depuis votre espace : ' +
    'nous reviendrons vers vous.'
  return {
    event: 'interview_missed',
    title: `Entretien du ${date}`,
    message,
    email: {
      subject: `Votre entretien pour « ${clipTitle(input.opportunityTitle)} » — OffRec`,
      body: [message],
      actionLabel: 'Expliquer mon absence',
    },
  }
}

export interface ProposalNoticeInput {
  companyName: string
  jobTitle: string
  monthlySalaryAr: number
  contractType: ContractType
  contractDurationMonths: number | null
  startDate: string | Date
  expiresAt: string | Date
}

/** Phrase de la proposition (notification et aperçu « Ce que verra le candidat »). */
export function proposalSummaryText(input: ProposalNoticeInput): string {
  return (
    `${input.companyName} vous propose le poste « ${input.jobTitle} » : ` +
    `${formatAriaryAmount(input.monthlySalaryAr)} Ar brut par mois, ` +
    `${contractPhrase(input.contractType, input.contractDurationMonths)}, ` +
    `début le ${formatCivilDate(input.startDate)}. ` +
    `Répondez avant le ${formatMadagascarDateTime(input.expiresAt)} depuis votre espace OffRec.`
  )
}

/** Proposition envoyée (in-app + email). */
export function proposalSentNotice(input: ProposalNoticeInput): CandidateNotice {
  const message = proposalSummaryText(input)
  return {
    event: 'hire_proposal_received',
    title: 'Proposition d’embauche',
    message,
    email: {
      subject: `Proposition d’embauche : « ${clipTitle(input.jobTitle)} » — OffRec`,
      body: [message],
      actionLabel: 'Voir la proposition',
    },
  }
}

/** Proposition modifiée (in-app + email ; le délai de 7 jours repart). */
export function proposalRevisedNotice(input: {
  companyName: string
  jobTitle: string
  expiresAt: string | Date
}): CandidateNotice {
  const message =
    `${input.companyName} a mis à jour sa proposition pour « ${input.jobTitle} ». ` +
    `Relisez-la : vous avez jusqu’au ${formatMadagascarDateTime(input.expiresAt)} pour répondre.`
  return {
    event: 'hire_proposal_revised',
    title: 'Proposition mise à jour',
    message,
    email: {
      subject: `Proposition mise à jour : « ${clipTitle(input.jobTitle)} » — OffRec`,
      body: [message],
      actionLabel: 'Voir la proposition',
    },
  }
}

/** Proposition retirée par l'entreprise (in-app + email). */
export function proposalWithdrawnNotice(input: { companyName: string; jobTitle: string }): CandidateNotice {
  const message =
    `${input.companyName} a retiré sa proposition pour « ${input.jobTitle} ». OffRec revient vers vous pour la suite.`
  return {
    event: 'hire_proposal_withdrawn',
    title: 'Proposition retirée',
    message,
    email: {
      subject: `Proposition retirée : « ${clipTitle(input.jobTitle)} » — OffRec`,
      body: [message],
      actionLabel: 'Voir mes dossiers',
    },
  }
}

/** Rappel J-2 (in-app + email). */
export function proposalReminderNotice(input: { jobTitle: string; expiresAt: string | Date }): CandidateNotice {
  const message =
    `Votre proposition pour « ${input.jobTitle} » expire le ${formatMadagascarDateTime(input.expiresAt)}. ` +
    'Pensez à répondre depuis votre espace OffRec.'
  return {
    event: 'hire_proposal_reminder',
    title: 'Proposition : réponse attendue',
    message,
    email: {
      subject: `Votre proposition pour « ${clipTitle(input.jobTitle)} » expire bientôt — OffRec`,
      body: [message],
      actionLabel: 'Voir la proposition',
    },
  }
}

/** Proposition expirée (in-app). */
export function proposalExpiredNotice(input: { jobTitle: string }): CandidateNotice {
  return {
    event: 'hire_proposal_expired',
    title: 'Proposition expirée',
    message:
      `La proposition pour « ${input.jobTitle} » a expiré sans réponse. ` +
      'Contactez OffRec si vous êtes toujours intéressé·e.',
    email: null,
  }
}

/** Accusé d'acceptation (in-app). */
export function proposalAcceptedNotice(input: {
  jobTitle: string
  companyName: string
  startDate: string | Date
}): CandidateNotice {
  return {
    event: 'hire_proposal_accepted',
    title: 'Embauche confirmée',
    message:
      `Félicitations ! Vous avez accepté le poste « ${input.jobTitle} » chez ${input.companyName}, ` +
      `début le ${formatCivilDate(input.startDate)}. OffRec vous accompagne pour la suite.`,
    email: null,
  }
}

/** Accusé de refus (in-app). */
export function proposalDeclinedNotice(): CandidateNotice {
  return {
    event: 'hire_proposal_declined',
    title: 'Réponse transmise',
    message: 'Votre réponse a bien été transmise. Votre profil reste proposé par OffRec pour d’autres offres.',
    email: null,
  }
}

/**
 * Poste pourvu par un autre candidat. Dossier mis en relation : in-app +
 * email, avec le nom de l'entreprise (déjà connu). Profil seulement
 * transmis : in-app, SANS le nom de l'entreprise.
 */
export function positionFilledNotice(input: {
  kind: 'mis_en_relation' | 'profil_transmis'
  opportunityTitle: string
  companyName: string
}): CandidateNotice {
  if (input.kind === 'profil_transmis') {
    return {
      event: 'opportunity_filled',
      title: 'Poste pourvu',
      message:
        `Le poste « ${input.opportunityTitle} » pour lequel votre profil avait été transmis a été pourvu. ` +
        'Votre profil reste proposé par OffRec pour d’autres offres.',
      email: null,
    }
  }
  const message =
    `Le poste « ${input.opportunityTitle} » chez ${input.companyName} a été pourvu. ` +
    'Merci pour votre intérêt : votre profil reste proposé par OffRec pour d’autres offres.'
  return {
    event: 'opportunity_filled',
    title: 'Poste pourvu',
    message,
    email: {
      subject: `Le poste « ${clipTitle(input.opportunityTitle)} » a été pourvu — OffRec`,
      body: [message],
      actionLabel: 'Voir mes dossiers',
    },
  }
}

/**
 * Contrôle d'un texte destiné au candidat (recette, garde-fou §11) :
 * libellés de motif, mot « refusé » appliqué à la personne. Liste vide si le
 * texte est neutre.
 */
export function candidateTextLeaks(text: string): string[] {
  const leaks: string[] = Object.values(RESULT_REASON_LABELS).filter((label) =>
    text.toLowerCase().includes(label.toLowerCase()),
  )
  // `\b` ignore les lettres accentuées : recherche simple de « refusé(e)(s) ».
  if (/refusé/i.test(text)) leaks.push('refusé')
  return leaks
}
