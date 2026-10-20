import {
  latestProposalOf,
  latestRound,
  pendingProposalOf,
  sortRounds,
  type HireProposalView,
  type HiringDossierState,
  type HiringPhase,
  type HiringProposalState,
  type HiringRoundState,
  type RoundOutcomeView,
} from '../../lib/hiring'
import type { Interview, InterviewResult, PlacementOrigin, PlacementStage } from '../../types'

/**
 * Adaptateurs d'affichage « après l'entretien » (sous-lots 4 et 6) :
 * construisent, depuis les tours, propositions et placement renvoyés par le
 * serveur, l'état que lisent les règles pures de src/lib/hiring.ts
 * (`allowedHiringActions`, `allowedOutcomeResults`, `checkHiringAction`).
 * Aucune règle ici : l'UI s'en sert pour afficher les boutons, le serveur
 * reste juge (et sa `phase` fait foi pour les badges).
 */

/** Tour tel que les listes le renvoient (vue recruteur, admin ou candidat). */
export type RoundView = Interview & RoundOutcomeView

/**
 * Tours au format des règles. Le serveur n'expose pas `activeSuggestionId` :
 * le tour actif est le dernier tour sans issue (même filet que
 * `activeRoundOf` et que `repairActiveRounds()` au démarrage).
 */
export function toRoundStates(rounds: readonly RoundView[]): HiringRoundState[] {
  const last = latestRound(rounds)
  return sortRounds(rounds).map((row) => ({
    id: row.id,
    round: row.round ?? 1,
    status: row.status,
    scheduledAt: row.scheduledAt,
    durationMinutes: row.durationMinutes,
    active: Boolean(last && row.id === last.id && !row.outcome),
    outcome: row.outcome ?? null,
    absenceReplied: Boolean(row.absenceReply),
  }))
}

/** Propositions au format des règles (vue recruteur, admin ou candidat). */
export function toProposalStates(proposals: readonly HireProposalView[]): HiringProposalState[] {
  return proposals.map((row) => ({
    id: row.id,
    version: row.version,
    status: row.status,
    expiresAt: row.expiresAt,
    revision: row.revision,
    withdrawReason: row.withdrawReason ?? null,
  }))
}

/**
 * Valeur « offre pourvue » pour les règles quand le serveur ne renvoie pas
 * `filledAt` avec le dossier : seule sa présence compte (`state.filledAt`),
 * et la phase `poste_pourvu` du serveur la révèle pour tout dossier encore
 * en cours (les phases terminales ne dépendent plus de l'offre).
 */
const FILLED_FROM_PHASE = '1970-01-01T00:00:00.000Z'

export interface ConnectedDossierExtras {
  /** Toutes les versions (`/received`), ou la dernière seule faute de mieux. */
  proposals?: readonly HireProposalView[] | null
  placement?: { stage: PlacementStage } | null
  /** `Opportunity.filledAt` quand il est connu (« Mes offres », catalogue). */
  filledAt?: string | null
  /** Phase calculée par le serveur : `poste_pourvu` ⇒ offre pourvue. */
  phase?: HiringPhase | null
}

/**
 * État d'un dossier `mise_en_relation` vu par son recruteur : tours,
 * propositions, placement lié et offre pourvue (`filledAt`, sinon déduit de
 * la phase `poste_pourvu` du serveur). Le serveur relit tout à chaque action.
 */
export function connectedDossierState(
  rounds: readonly RoundView[],
  extras: ConnectedDossierExtras = {},
): HiringDossierState {
  return {
    status: 'mise_en_relation',
    rounds: toRoundStates(rounds),
    proposals: toProposalStates(extras.proposals ?? []),
    placement: extras.placement ?? null,
    filledAt: extras.filledAt ?? (extras.phase === 'poste_pourvu' ? FILLED_FROM_PHASE : null),
  }
}

/** Tours triés, avec repli sur le tour affiché quand la liste complète manque. */
export function roundsOf(dossier: { interviews?: RoundView[] | null; interview?: RoundView | null }): RoundView[] {
  if (dossier.interviews && dossier.interviews.length > 0) return sortRounds(dossier.interviews)
  return dossier.interview ? [dossier.interview] : []
}

/** Propositions d'un dossier : toutes les versions, sinon la dernière seule. */
export function proposalsOf(dossier: {
  proposals?: HireProposalView[] | null
  proposal?: HireProposalView | null
}): HireProposalView[] {
  if (dossier.proposals && dossier.proposals.length > 0) return [...dossier.proposals].sort((a, b) => a.version - b.version)
  return dossier.proposal ? [dossier.proposal] : []
}

/** Dernière version (affichée dans le détail), ou `undefined`. */
export function latestProposal(proposals: readonly HireProposalView[]): HireProposalView | undefined {
  return latestProposalOf(proposals)
}

/** Proposition en attente de réponse (envoyée, non échue), ou `undefined`. */
export function pendingProposal(proposals: readonly HireProposalView[], now: Date = new Date()): HireProposalView | undefined {
  return pendingProposalOf(proposals, now)
}

/**
 * Phase que prend un dossier quand l'issue `outcome` est la dernière chose
 * qui s'y est passée (aucun tour suivant, aucune proposition). L'admin ne
 * voit « Annuler l'issue » que dans ce cas : c'est la condition de
 * `checkHiringAction('reset_outcome')`, relue par le serveur (409 sinon).
 */
export const PHASE_AFTER_OUTCOME: Record<InterviewResult, HiringPhase> = {
  retenu: 'retenu',
  second_entretien: 'second_entretien_a_planifier',
  non_retenu: 'non_retenu',
  absent: 'absent',
}

export function outcomeIsLastStep(round: { outcome?: InterviewResult | null }, phase: HiringPhase | null | undefined): boolean {
  return Boolean(round.outcome && phase && PHASE_AFTER_OUTCOME[round.outcome] === phase)
}

/** Regroupement des dossiers mis en relation (onglets « En cours / Embauchés / Clos »). */
export type DossierGroup = 'en_cours' | 'embauche' | 'clos'

/** Phases terminales qui rangent un dossier dans « Clos » (jamais une embauche). */
const CLOSED_PHASES: readonly HiringPhase[] = ['non_retenu', 'clos_proposition_refusee', 'poste_pourvu', 'embauche_annulee']

/** Groupe d'un dossier d'après la phase du serveur (`null` : en cours). */
export function dossierGroup(phase: HiringPhase | null | undefined): DossierGroup {
  if (phase === 'embauche') return 'embauche'
  if (phase && CLOSED_PHASES.includes(phase)) return 'clos'
  return 'en_cours'
}

export const DOSSIER_GROUP_LABELS: Record<DossierGroup, string> = {
  en_cours: 'En cours',
  embauche: 'Embauchés',
  clos: 'Clos',
}

/** Origine d'un placement (sous-lot 5) : proposition acceptée par le candidat, ou déclaration (talents, historique). */
export const PLACEMENT_ORIGIN_LABELS: Record<PlacementOrigin, string> = {
  proposition_acceptee: 'Proposition acceptée',
  declaration: 'Déclaré',
}
