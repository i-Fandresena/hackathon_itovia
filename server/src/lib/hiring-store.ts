import { Prisma } from '@prisma/client'
import type {
  ContractType,
  HireDeclineReason,
  HireProposalStatus,
  HireProposalWithdrawReason,
  InterviewResult,
  MatchClosedReason,
  MatchSuggestionStatus,
  PlacementOrigin,
  PlacementStage,
} from '../../../src/types/index.js'
import { prisma } from './prisma.js'

/**
 * « Après l'entretien » (plan du 2026-10-16, sous-lot 1) : accès au schéma
 * des tours d'entretien, de l'issue, des propositions d'embauche, du lien
 * placement → dossier et de l'offre pourvue.
 *
 * Le client Prisma déjà généré peut être antérieur à ces colonnes : sous
 * Windows, `prisma generate` échoue tant que le backend (`tsx watch`) tient
 * le moteur de requêtes chargé, et `tsx watch` recharge pourtant le code
 * serveur. Même précédent que `interviewStore()` (lib/interviews.ts) et
 * `OPPORTUNITY_MISSIONS_SUPPORTED` (lib/opportunity-missions.ts) :
 * - `HIRING_SUPPORTED` dit si le client connaît le nouveau schéma ;
 * - les helpers renvoient `{}` (ou la forme d'avant) avec un ancien client,
 *   pour ne jamais provoquer d'« Unknown argument » ;
 * - les délégués sont typés ici, pour que `tsc` compile avec l'ancien comme
 *   avec le nouveau client ;
 * - les futures routes du flux d'embauche répondent 503
 *   (`HIRING_UNAVAILABLE_ERROR`) tant que ce n'est pas le cas, et les routes
 *   existantes gardent leur comportement d'avant (un seul tour).
 *
 * La réparation au démarrage (`repairHiringData`) passe par du SQL brut :
 * elle fonctionne avec les deux clients dès que la migration du temps A
 * (20261016090000_hiring_expand) est appliquée, et ne fait que remplir des
 * colonnes encore vides.
 */

const hasKey = (holder: unknown, key: string): boolean =>
  Boolean(holder) && typeof holder === 'object' && Object.prototype.hasOwnProperty.call(holder, key)

const prismaNamespace = Prisma as unknown as Record<string, unknown>

/** Le client Prisma connaît les tours, l'issue, `HireProposal` et les colonnes ajoutées au temps A. */
export const HIRING_SUPPORTED =
  hasKey(prismaNamespace.ModelName, 'HireProposal') &&
  hasKey(prismaNamespace.InterviewScalarFieldEnum, 'round') &&
  hasKey(prismaNamespace.InterviewScalarFieldEnum, 'activeSuggestionId') &&
  hasKey(prismaNamespace.MatchSuggestionScalarFieldEnum, 'connectedAt') &&
  hasKey(prismaNamespace.PlacementScalarFieldEnum, 'suggestionId') &&
  hasKey(prismaNamespace.OpportunityScalarFieldEnum, 'filledAt')

export const HIRING_UNAVAILABLE_ERROR =
  'La suite après l’entretien n’est pas encore activée : arrêtez le backend, lancez « npm run prisma:generate » puis « npm run prisma:deploy » dans server/, puis redémarrez-le.'

/* ------------------------------------------------------------------ */
/* Tours d'entretien                                                   */
/* ------------------------------------------------------------------ */

type Where = Record<string, unknown>

/**
 * Filtre du tour ACTIF d'un dossier. Ancien client : la contrainte « un
 * entretien par dossier » est encore en place, l'unique entretien est le
 * tour actif.
 */
export function activeInterviewWhere(suggestionId: string): Where {
  return HIRING_SUPPORTED ? { activeSuggestionId: suggestionId } : { suggestionId }
}

/** Colonnes d'un nouveau tour (actif) à ajouter au `data` de création, ou `{}`. */
export function interviewRoundData(suggestionId: string, round: number): {} {
  return HIRING_SUPPORTED ? { round, activeSuggestionId: suggestionId } : {}
}

/** Champs de tour d'une ligne `Interview` quel que soit le client. */
export interface InterviewRoundFields {
  round?: number
  activeSuggestionId?: string | null
  outcome?: InterviewResult | null
}

export const roundOf = (row: InterviewRoundFields): number => (typeof row.round === 'number' ? row.round : 1)

/** Ancien client : l'unique entretien du dossier est actif. */
export const isActiveRound = (row: InterviewRoundFields): boolean =>
  HIRING_SUPPORTED ? Boolean(row.activeSuggestionId) : true

/**
 * Tour à montrer quand une vue n'en affiche qu'un (champ `interview` des
 * listes de dossiers, conservé pour la rétrocompatibilité) : le tour actif,
 * sinon le dernier tour.
 */
export function displayedRound<T extends InterviewRoundFields>(rows: readonly T[]): T | undefined {
  let best: T | undefined
  for (const row of rows) {
    if (!best) {
      best = row
      continue
    }
    const rowActive = isActiveRound(row)
    const bestActive = isActiveRound(best)
    if (rowActive !== bestActive ? rowActive : roundOf(row) > roundOf(best)) best = row
  }
  return best
}

/** Filtre « dossier ayant au moins un entretien » (relation 1:1 avant les tours, 1:n après). */
export function suggestionHasInterviewWhere(): Prisma.MatchSuggestionWhereInput {
  const where: Where = HIRING_SUPPORTED ? { interviews: { some: {} } } : { interview: { isNot: null } }
  return where as unknown as Prisma.MatchSuggestionWhereInput
}

/* ------------------------------------------------------------------ */
/* Dossier, placement, offre                                           */
/* ------------------------------------------------------------------ */

/** `connectedAt` à écrire avec une transition vers `mise_en_relation`, ou `{}`. */
export function connectedAtData(to: MatchSuggestionStatus, now: Date = new Date()): {} {
  return HIRING_SUPPORTED && to === 'mise_en_relation' ? { connectedAt: now } : {}
}

/** `select` de `connectedAt` (dossier) pour les tableaux de bord, ou `{}` avec un ancien client. */
export function connectedAtSelect(): {} {
  return HIRING_SUPPORTED ? { connectedAt: true } : {}
}

/**
 * Date de mise en relation d'une ligne `mise_en_relation` : `connectedAt`,
 * sinon `updatedAt` (ancien client, ou ligne pas encore reprise par
 * `repairConnectedAt`) — `mise_en_relation` est terminal.
 */
export function connectedAtOf(row: { updatedAt: Date }): Date {
  const value = (row as { connectedAt?: unknown }).connectedAt
  return value instanceof Date ? value : row.updatedAt
}

/** Filtre « mis en relation depuis `start` » (même règle que `connectedAtOf`). */
export function connectedSinceWhere(start: Date): Prisma.MatchSuggestionWhereInput {
  const where: Where = HIRING_SUPPORTED
    ? {
        status: 'mise_en_relation',
        OR: [{ connectedAt: { gte: start } }, { connectedAt: null, updatedAt: { gte: start } }],
      }
    : { status: 'mise_en_relation', updatedAt: { gte: start } }
  return where as Prisma.MatchSuggestionWhereInput
}

/** Raison d'une clôture automatique (`ecartee`, offre pourvue) à ajouter au `data`, ou `{}`. */
export function closedReasonData(reason: MatchClosedReason): {} {
  return HIRING_SUPPORTED ? { closedReason: reason } : {}
}

/**
 * Colonnes ajoutées au dossier par le temps A, retirées d'une ligne renvoyée
 * telle quelle (forme de réponse inchangée avec l'ancien et le nouveau client).
 */
export function omitHiringColumns<T extends object>(row: T): T {
  const copy = { ...row } as Record<string, unknown>
  delete copy.connectedAt
  delete copy.closedReason
  return copy as T
}

export interface PlacementLink {
  suggestionId?: string | null
  hireProposalId?: string | null
  origin?: PlacementOrigin
  jobTitle?: string | null
  startDate?: Date | null
  contractType?: ContractType | null
}

/** Liens et détails d'un placement à ajouter au `data`, ou `{}` (ancien client). */
export function placementLinkData(link: PlacementLink): {} {
  if (!HIRING_SUPPORTED) return {}
  const data: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(link)) if (value !== undefined) data[key] = value
  return data
}

/** Nombre de postes à écrire (création, modification), ou `{}` (absent, ou ancien client). */
export function positionsData(positions: number | undefined): {} {
  return HIRING_SUPPORTED && positions !== undefined ? { positions } : {}
}

/**
 * Filtre « offre non pourvue » (D1), pendant SQL de la première règle de
 * `opportunityClosedReason()` (lib/preselection.ts) ; `{}` avec un ancien
 * client (aucune offre n'est alors pourvue).
 */
export function unfilledOpportunityWhere(): Prisma.OpportunityWhereInput {
  const where: Where = HIRING_SUPPORTED ? { filledAt: null } : {}
  return where as Prisma.OpportunityWhereInput
}

/** Filtre « offre pourvue » ; avec un ancien client, aucune offre (filtre toujours faux). */
export function filledOpportunityWhere(): Prisma.OpportunityWhereInput {
  const where: Where = HIRING_SUPPORTED ? { filledAt: { not: null } } : { id: { in: [] } }
  return where as Prisma.OpportunityWhereInput
}

/** Offre pourvue (`filledAt` posé) ou rouverte (`null`), à ajouter au `data`, ou `{}`. */
export function opportunityFillData(fill: { filledAt: Date; filledBy: string } | null): {} {
  if (!HIRING_SUPPORTED) return {}
  return fill ? { filledAt: fill.filledAt, filledBy: fill.filledBy } : { filledAt: null, filledBy: null }
}

/** Placement lié à un dossier, tel que les listes le renvoient (jamais le salaire ni les personnes). */
export interface LinkedPlacement {
  id: string
  stage: PlacementStage
  origin: PlacementOrigin
  /** Jour civil AAAA-MM-JJ, ou `null`. */
  startDate: string | null
}

interface PlacementLinkRow {
  id: string
  suggestionId: string | null
  stage: PlacementStage
  origin: PlacementOrigin
  startDate: Date | null
}

interface PlacementLinkDelegate {
  findMany(args: { where: Where; select: Where }): Promise<PlacementLinkRow[]>
}

/**
 * Placement lié à chacun des dossiers donnés (`Placement.suggestionId`),
 * par identifiant de dossier. Vide avec un ancien client (aucun lien).
 */
export async function loadLinkedPlacements(
  suggestionIds: readonly string[],
  client: unknown = prisma,
): Promise<Map<string, LinkedPlacement>> {
  const result = new Map<string, LinkedPlacement>()
  if (!HIRING_SUPPORTED || suggestionIds.length === 0) return result
  const delegate = (client as { placement: unknown }).placement as PlacementLinkDelegate
  const rows = await delegate.findMany({
    where: { suggestionId: { in: [...suggestionIds] } },
    select: { id: true, suggestionId: true, stage: true, origin: true, startDate: true },
  })
  for (const row of rows) {
    if (!row.suggestionId) continue
    result.set(row.suggestionId, {
      id: row.id,
      stage: row.stage,
      origin: row.origin,
      startDate: row.startDate ? row.startDate.toISOString().slice(0, 10) : null,
    })
  }
  return result
}

/** Étape du placement lié à chacun des dossiers donnés (voir `loadLinkedPlacements`). */
export async function loadPlacementStages(
  suggestionIds: readonly string[],
  client: unknown = prisma,
): Promise<Map<string, { stage: PlacementStage }>> {
  const linked = await loadLinkedPlacements(suggestionIds, client)
  return new Map([...linked].map(([id, placement]) => [id, { stage: placement.stage }]))
}

/**
 * Champs « flux d'embauche » d'une ligne `Placement` quel que soit le client
 * (vues recruteur et admin) : origine, dossier, proposition, poste, date de
 * début et type de contrat. Valeurs par défaut avec un ancien client.
 */
export function placementHiringFields(row: object): {
  origin: PlacementOrigin
  suggestionId: string | null
  hireProposalId: string | null
  jobTitle: string | null
  startDate: string | null
  contractType: ContractType | null
} {
  const r = row as {
    origin?: PlacementOrigin
    suggestionId?: string | null
    hireProposalId?: string | null
    jobTitle?: string | null
    startDate?: Date | null
    contractType?: ContractType | null
  }
  return {
    origin: r.origin ?? 'declaration',
    suggestionId: r.suggestionId ?? null,
    hireProposalId: r.hireProposalId ?? null,
    jobTitle: r.jobTitle ?? null,
    startDate: r.startDate instanceof Date ? r.startDate.toISOString().slice(0, 10) : null,
    contractType: r.contractType ?? null,
  }
}

/** « Qui » a pourvu l'offre (`'auto'` ou id du recruteur), quel que soit le client. Interne. */
export function filledByOf(row: object): string | null {
  const value = (row as { filledBy?: unknown }).filledBy
  return typeof value === 'string' ? value : null
}

/** Nombre de postes d'une ligne `Opportunity` quel que soit le client (1 par défaut). */
export function positionsOf(row: object): number {
  const value = (row as { positions?: unknown }).positions
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 ? value : 1
}

/** Date « pourvue » d'une ligne `Opportunity` quel que soit le client. */
export function filledAtOf(row: object): Date | null {
  const value = (row as { filledAt?: unknown }).filledAt
  return value instanceof Date ? value : null
}

/* ------------------------------------------------------------------ */
/* Propositions d'embauche (délégué typé localement)                   */
/* ------------------------------------------------------------------ */

export interface HireProposalRow {
  id: string
  suggestionId: string
  pendingSuggestionId: string | null
  version: number
  jobTitle: string
  monthlySalaryAr: number
  startDate: Date
  contractType: ContractType
  contractDurationMonths: number | null
  message: string | null
  status: HireProposalStatus
  expiresAt: Date
  revision: number
  respondedAt: Date | null
  declineReason: HireDeclineReason | null
  declineNote: string | null
  withdrawnAt: Date | null
  withdrawReason: HireProposalWithdrawReason | null
  expiryReminderAt: Date | null
  createdById: string
  createdAt: Date
  updatedAt: Date
}

export type HireProposalCreateData = Pick<
  HireProposalRow,
  'suggestionId' | 'jobTitle' | 'monthlySalaryAr' | 'startDate' | 'contractType' | 'expiresAt' | 'createdById'
> &
  Partial<Pick<HireProposalRow, 'pendingSuggestionId' | 'version' | 'contractDurationMonths' | 'message'>>

export interface HireProposalDelegate {
  findUnique(args: { where: { id: string } }): Promise<HireProposalRow | null>
  findFirst(args: { where?: Where; orderBy?: Where[] }): Promise<HireProposalRow | null>
  findMany(args: { where?: Where; orderBy?: Where[]; skip?: number; take?: number }): Promise<HireProposalRow[]>
  count(args: { where?: Where }): Promise<number>
  create(args: { data: HireProposalCreateData }): Promise<HireProposalRow>
  updateMany(args: { where: Where; data: Where }): Promise<{ count: number }>
}

/** `null` si le client Prisma a été généré avant le modèle `HireProposal`. */
export function hireProposalStore(client: unknown = prisma): HireProposalDelegate | null {
  if (!HIRING_SUPPORTED) return null
  const delegate = (client as { hireProposal?: HireProposalDelegate } | null)?.hireProposal
  return delegate && typeof delegate.findFirst === 'function' ? delegate : null
}

/* ------------------------------------------------------------------ */
/* Réparation au démarrage (idempotente, ne remplit que des vides)     */
/* ------------------------------------------------------------------ */

/** Colonne ou table absente : la migration du temps A n'est pas appliquée. */
function isMissingSchemaError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const { code, meta, message } = err as { code?: unknown; meta?: { code?: unknown }; message?: unknown }
  if (code === 'P2021' || code === 'P2022') return true
  if (meta?.code === '42703' || meta?.code === '42P01') return true
  return typeof message === 'string' && /does not exist|n'existe pas|n’existe pas/i.test(message)
}

/**
 * Tours créés par un code antérieur au nouveau client (entre le temps A et
 * la régénération) : le dernier tour d'un dossier, sans issue, redevient
 * actif s'il n'y a aucun tour actif sur ce dossier. Ne touche jamais une
 * ligne dont `activeSuggestionId` est déjà renseigné ni un tour avec issue.
 */
export async function repairActiveRounds(): Promise<number> {
  return prisma.$executeRaw`
    UPDATE "Interview" i SET "activeSuggestionId" = i."suggestionId"
    WHERE i."outcome" IS NULL AND i."activeSuggestionId" IS NULL
      AND i."round" = (SELECT max(i2."round") FROM "Interview" i2 WHERE i2."suggestionId" = i."suggestionId")
      AND NOT EXISTS (
        SELECT 1 FROM "Interview" i3
        WHERE i3."suggestionId" = i."suggestionId" AND i3."activeSuggestionId" IS NOT NULL
      )`
}

/**
 * Dossiers mis en relation sans `connectedAt` (transition écrite par un
 * ancien client) : date de la transition dans le journal d'audit, sinon
 * `updatedAt` — même règle que la reprise du temps A.
 */
export async function repairConnectedAt(): Promise<number> {
  return prisma.$executeRaw`
    UPDATE "MatchSuggestion" ms
    SET "connectedAt" = COALESCE(
      (SELECT min(a."createdAt") FROM "AuditLog" a
       WHERE a."action" = 'match_suggestion_status'
         AND a."metadata"->>'suggestionId' = ms."id"
         AND a."metadata"->>'to' = 'mise_en_relation'),
      ms."updatedAt")
    WHERE ms."status" = 'mise_en_relation' AND ms."connectedAt" IS NULL`
}

/** Les deux réparations ; ne lève jamais (journalise). */
export async function repairHiringData(): Promise<{ rounds: number; connectedAt: number } | null> {
  try {
    const rounds = await repairActiveRounds()
    const connectedAt = await repairConnectedAt()
    return { rounds, connectedAt }
  } catch (err) {
    if (isMissingSchemaError(err)) {
      console.warn(
        '[hiring] Réparation au démarrage ignorée : migration 20261016090000_hiring_expand non appliquée (npm run prisma:deploy).',
      )
    } else {
      console.error('[hiring] Réparation au démarrage impossible', err)
    }
    return null
  }
}
