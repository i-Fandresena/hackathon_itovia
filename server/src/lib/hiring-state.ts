import type { Prisma } from '@prisma/client'
import type { HiringDossierState, HiringProposalState, HiringRoundState } from '../../../src/lib/hiring.js'
import type { MatchSuggestionStatus, PlacementStage } from '../../../src/types/index.js'
import { prisma } from './prisma.js'
import {
  HIRING_SUPPORTED,
  filledAtOf,
  hireProposalStore,
  isActiveRound,
  loadPlacementStages,
  roundOf,
} from './hiring-store.js'
import type { InterviewRow } from './interviews.js'

/**
 * « Après l'entretien » (plan du 2026-10-16, sous-lot 3) : construit, depuis
 * la base, l'état d'un dossier tel que le lisent les règles pures de
 * src/lib/hiring.ts (`HiringDossierState`) — tours, propositions, placement
 * lié et offre pourvue. Lecture seule, deux à quatre requêtes pour tout un
 * lot de dossiers, jamais une par dossier.
 *
 * Avec un client Prisma antérieur au sous-lot 1 (`HIRING_SUPPORTED` faux),
 * l'état se réduit aux tours (un seul, actif, sans issue) : les contrôles
 * d'entretien gardent leur comportement d'avant.
 */

/** Tour d'entretien tel que les règles le lisent. */
export function roundStateOf(row: InterviewRow): HiringRoundState {
  return {
    id: row.id,
    round: roundOf(row),
    status: row.status,
    scheduledAt: row.scheduledAt,
    durationMinutes: row.durationMinutes,
    active: isActiveRound(row),
    outcome: row.outcome ?? null,
    absenceReplied: Boolean(row.absenceReply),
    outcomeReminderAt: row.outcomeReminderAt ?? null,
  }
}

/** Tours triés par numéro croissant (copie). */
export function sortRoundRows<T extends InterviewRow>(rows: readonly T[]): T[] {
  return [...rows].sort(
    (a, b) => roundOf(a) - roundOf(b) || a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id),
  )
}

/** Dossier dont on veut l'état. */
export interface DossierRef {
  id: string
  status: string
  opportunityId: string
}

export interface HiringContext {
  /** Tous les tours du dossier, triés par numéro. */
  rows: InterviewRow[]
  state: HiringDossierState
}

const isStorageError = (err: unknown): boolean => {
  const code = err && typeof err === 'object' ? (err as { code?: unknown }).code : undefined
  return code === 'P2021' || code === 'P2022'
}

/** Client de lecture : le client global, ou celui d'une transaction en cours. */
export type HiringClient = Prisma.TransactionClient | typeof prisma

/**
 * État de chacun des dossiers donnés, à partir de leurs tours déjà chargés
 * (`rows`, tous dossiers confondus) : propositions, placement lié et date
 * « pourvue » de l'offre sont lus ici, par lot. `client` : celui d'une
 * transaction pour relire l'état sous verrou (écritures du sous-lot 5).
 */
export async function buildHiringContexts(
  dossiers: readonly DossierRef[],
  rows: readonly InterviewRow[],
  client: HiringClient = prisma,
): Promise<Map<string, HiringContext>> {
  const result = new Map<string, HiringContext>()
  if (dossiers.length === 0) return result
  const ids = dossiers.map((dossier) => dossier.id)

  const roundsBySuggestion = new Map<string, InterviewRow[]>()
  for (const row of rows) {
    const list = roundsBySuggestion.get(row.suggestionId)
    if (list) list.push(row)
    else roundsBySuggestion.set(row.suggestionId, [row])
  }

  const proposalsBySuggestion = new Map<string, HiringProposalState[]>()
  let placements = new Map<string, { stage: PlacementStage }>()
  const filledByOpportunity = new Map<string, Date | null>()

  if (HIRING_SUPPORTED) {
    try {
      const store = hireProposalStore(client)
      const [proposals, placementStages, opportunities] = await Promise.all([
        store ? store.findMany({ where: { suggestionId: { in: ids } } }) : Promise.resolve([]),
        loadPlacementStages(ids, client),
        client.opportunity.findMany({ where: { id: { in: [...new Set(dossiers.map((d) => d.opportunityId))] } } }),
      ])
      for (const proposal of proposals) {
        const list = proposalsBySuggestion.get(proposal.suggestionId) ?? []
        list.push({
          id: proposal.id,
          version: proposal.version,
          status: proposal.status,
          expiresAt: proposal.expiresAt,
          revision: proposal.revision,
          withdrawReason: proposal.withdrawReason,
          expiryReminderAt: proposal.expiryReminderAt,
        })
        proposalsBySuggestion.set(proposal.suggestionId, list)
      }
      placements = placementStages
      for (const opportunity of opportunities) filledByOpportunity.set(opportunity.id, filledAtOf(opportunity))
    } catch (err) {
      // Table ou colonne absente (migration non appliquée) : état réduit aux tours.
      if (!isStorageError(err)) throw err
    }
  }

  for (const dossier of dossiers) {
    const sorted = sortRoundRows(roundsBySuggestion.get(dossier.id) ?? [])
    result.set(dossier.id, {
      rows: sorted,
      state: {
        status: dossier.status as MatchSuggestionStatus,
        rounds: sorted.map(roundStateOf),
        proposals: proposalsBySuggestion.get(dossier.id) ?? [],
        placement: placements.get(dossier.id) ?? null,
        filledAt: filledByOpportunity.get(dossier.opportunityId) ?? null,
      },
    })
  }
  return result
}

/** Copie de l'état avec les tours remplacés (après une écriture). */
export function withRounds(state: HiringDossierState, rows: readonly InterviewRow[]): HiringDossierState {
  return { ...state, rounds: sortRoundRows(rows).map(roundStateOf) }
}
