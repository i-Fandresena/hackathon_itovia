import { Prisma } from '@prisma/client'
import type { AlreadyPlacedView } from '../../../src/types/index.js'
import { alreadyPlacedView, placedMatchingExcluded } from '../../../src/lib/hiring.js'
import { prisma } from './prisma.js'

/**
 * Candidat déjà en poste via OffRec (décision 2026-11-12).
 *
 * UNE définition du « placement actif du candidat », partagée par
 * l'acceptation d'une proposition (lib/hire-proposals.ts), l'éligibilité au
 * matching et à la présélection (lib/matching.ts, lib/preselection-service.ts,
 * transition admin vers `proposee_recruteur`) et le badge admin « Déjà
 * placé » : un `Placement` du candidat diplômé (`candidateId`) dont l'étape
 * n'est pas `annule`, quelle que soit son origine (proposition acceptée ou
 * déclaration reprise) et même si son offre a été supprimée.
 *
 * Réintégration au matching par un admin : SANS migration. La décision est
 * une ligne du journal d'audit (`candidate_matching_reintegrated`, levée par
 * `candidate_matching_reintegration_revoked`, `metadata.candidateId`), déjà
 * l'endroit où vivent les actions sensibles d'un admin, jamais effacé, et lu
 * par lot (une requête pour tous les candidats). La dernière ligne compte.
 * Une réintégration ne vaut que pour les placements créés avant elle : une
 * nouvelle embauche remet le candidat en pause (`placedMatchingExcluded`).
 * `matchingConsentAt` n'est jamais modifié (D6).
 */

type Client = Prisma.TransactionClient | typeof prisma

export const MATCHING_REINTEGRATED_ACTION = 'candidate_matching_reintegrated'
export const MATCHING_REINTEGRATION_REVOKED_ACTION = 'candidate_matching_reintegration_revoked'

/** Où d'un placement actif du candidat (une ou plusieurs personnes). */
export function activeCandidatePlacementWhere(candidateId: string | { in: string[] }): Prisma.PlacementWhereInput {
  return { candidateId, stage: { not: 'annule' } }
}

/** Placements actifs du candidat sur une AUTRE offre (offre supprimée comprise). */
export function countActivePlacementsElsewhere(client: Client, candidateId: string, opportunityId: string): Promise<number> {
  return client.placement.count({
    where: {
      ...activeCandidatePlacementWhere(candidateId),
      OR: [{ opportunityId: { not: opportunityId } }, { opportunityId: null }],
    },
  })
}

/**
 * Verrou transactionnel du candidat (`pg_advisory_xact_lock`, relâché à la
 * fin de la transaction) : deux acceptations simultanées sur deux offres
 * passent l'une après l'autre, et la seconde recompte les placements de la
 * première. Pris APRÈS le verrou de l'offre et celui du dossier (ordre
 * offre → dossier → candidat), jamais avant.
 */
export async function lockCandidate(tx: Prisma.TransactionClient, candidateId: string): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`offrec:candidate:${candidateId}`}, 0))`
}

interface ReintegrationRow {
  candidateId: string
  action: string
  createdAt: Date
}

/** Réintégration EN VIGUEUR (dernière ligne = réintégration) par candidat. `ids` absent : tous. */
export async function loadMatchingReintegrations(
  ids?: readonly string[],
  client: Client = prisma,
): Promise<Map<string, Date>> {
  const out = new Map<string, Date>()
  if (ids && ids.length === 0) return out
  const filter = ids ? Prisma.sql`AND "metadata"->>'candidateId' = ANY(${[...ids]}::text[])` : Prisma.empty
  const rows = await client.$queryRaw<ReintegrationRow[]>(Prisma.sql`
    SELECT DISTINCT ON ("metadata"->>'candidateId')
           "metadata"->>'candidateId' AS "candidateId", "action", "createdAt"
    FROM "AuditLog"
    WHERE "action" IN (${MATCHING_REINTEGRATED_ACTION}, ${MATCHING_REINTEGRATION_REVOKED_ACTION})
      AND "metadata"->>'candidateId' IS NOT NULL
      ${filter}
    ORDER BY "metadata"->>'candidateId', "createdAt" DESC, "id" DESC
  `)
  for (const row of rows) {
    if (row.action === MATCHING_REINTEGRATED_ACTION) out.set(row.candidateId, row.createdAt)
  }
  return out
}

export interface CandidatePlacementStatus {
  /** Dates de création des placements actifs. */
  placements: Date[]
  reintegratedAt: Date | null
  /** Exclu du matching (motif `candidat_en_poste`). */
  excluded: boolean
  view: AlreadyPlacedView | null
}

/**
 * État « déjà placé » des candidats donnés (`ids` absent : tous les
 * candidats placés). Deux requêtes pour tout le lot. Seuls les candidats qui
 * ont un placement actif figurent dans le résultat.
 */
export async function loadCandidatePlacementStatus(
  ids?: readonly string[],
  client: Client = prisma,
): Promise<Map<string, CandidatePlacementStatus>> {
  const out = new Map<string, CandidatePlacementStatus>()
  if (ids && ids.length === 0) return out
  const placements = await client.placement.findMany({
    where: ids ? activeCandidatePlacementWhere({ in: [...new Set(ids)] }) : { candidateId: { not: null }, stage: { not: 'annule' } },
    select: { candidateId: true, createdAt: true },
  })
  const byCandidate = new Map<string, Date[]>()
  for (const p of placements) {
    if (!p.candidateId) continue
    const list = byCandidate.get(p.candidateId)
    if (list) list.push(p.createdAt)
    else byCandidate.set(p.candidateId, [p.createdAt])
  }
  if (byCandidate.size === 0) return out
  const reintegrations = await loadMatchingReintegrations([...byCandidate.keys()], client)
  for (const [candidateId, dates] of byCandidate) {
    const reintegratedAt = reintegrations.get(candidateId) ?? null
    out.set(candidateId, {
      placements: dates,
      reintegratedAt,
      excluded: placedMatchingExcluded(dates, reintegratedAt),
      view: alreadyPlacedView(dates, reintegratedAt),
    })
  }
  return out
}

/** Badge admin d'un candidat (`null` s'il n'a aucun placement actif). */
export function alreadyPlacedOf(statuses: Map<string, CandidatePlacementStatus>, candidateId: string): AlreadyPlacedView | null {
  return statuses.get(candidateId)?.view ?? null
}

/** Message d'une transmission refusée pour un candidat en poste (transition admin). */
export const CANDIDATE_PLACED_TRANSMIT_ERROR =
  'Ce candidat est déjà en poste via OffRec : son matching est en pause. Réintégrez-le depuis sa fiche (Candidats) avant de le transmettre.'
