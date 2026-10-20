import { createHmac } from 'node:crypto'
import type {
  ContractType,
  ExperienceLevel,
  HireDeclineReason,
  HireProposalStatus,
  HireProposalWithdrawReason,
  InterviewResult,
  InterviewResultReason,
  InterviewStatus,
  MatchClosedReason,
  MatchSuggestionOrigin,
  MatchSuggestionStatus,
  OpportunityType,
  PlacementOrigin,
  PlacementStage,
  Sector,
} from '../../../src/types/index.js'
import { interviewEnd } from '../../../src/lib/interview.js'
import { effectiveProposalStatus, hiringPhase, type HiringPhase } from '../../../src/lib/hiring.js'
import { DAY_MS, mgDayKey, mgStartOfDay } from './day-series.js'

/**
 * Mesure « après l'entretien » (plan du 2026-10-16, sous-lot 7) — règles
 * PURES : aucune base, aucun serveur, l'heure courante est toujours passée
 * (`now`). Le chargement (requêtes groupées) est dans lib/hiring-stats.ts ;
 * ce module ne fait que compter, et `scripts/hiring-examples.ts` le vérifie.
 *
 * Une seule définition, partagée par le tableau de bord admin, celui du
 * recruteur et l'export de recherche :
 * - « dossier transmis » (`isTransmittedDossier`) : celle des « Profils
 *   reçus » du tableau de bord recruteur — jamais `suggeree` ni rien de la
 *   file interne de l'admin ;
 * - étapes de l'entonnoir (`buildDossierFacts`), emboîtées : un dossier ne
 *   compte à une étape que s'il compte à la précédente ;
 * - indicateur « issue renseignée sous 7 jours » (`outcomeTimeliness`, plan §11) ;
 * - lignes pseudonymisées de l'export (`buildResearchExport`).
 */

/* ------------------------------------------------------------------ */
/* Entrées                                                             */
/* ------------------------------------------------------------------ */

/** Statuts qu'un recruteur voit (« Profils reçus »). */
export const TRANSMITTED_STATUSES = ['proposee_recruteur', 'interet_recruteur', 'mise_en_relation'] as const
/** Statuts lus par la mesure : les statuts transmis, plus `ecartee` (filtré par preuve de transmission). */
export const METRICS_STATUSES: readonly MatchSuggestionStatus[] = [...TRANSMITTED_STATUSES, 'ecartee']

export interface MetricsDossier {
  id: string
  opportunityId: string
  recruiterId: string
  status: MatchSuggestionStatus
  /** Score figé à la transmission (instantané, jamais recalculé ensuite). */
  score: number
  origin: MatchSuggestionOrigin
  preselectionRank: number | null
  createdAt: Date
  updatedAt: Date
  connectedAt: Date | null
  closedReason: MatchClosedReason | null
  sector: Sector
  level: ExperienceLevel
  opportunityType: OpportunityType
  filledAt: Date | null
  /** CV du candidat vérifié par un humain (état ACTUEL, pas un instantané). */
  cvVerified: boolean
  /** Candidat ou recruteur sur un domaine de test (`isTestEmail`). */
  isTest: boolean
}

/** Preuves de transmission lues dans le journal d'audit (lib/hiring-stats.ts). */
export interface TransmissionEvidence {
  /** Première transmission journalisée par un admin (vers `proposee_recruteur`). */
  transmittedAt: Date | null
  /** Sortie journalisée depuis un statut visible du recruteur. */
  exitedAfterTransmission: boolean
  /** Comptes qui ont décliné le dossier (`recruiter_declined`). */
  declinedBy: string[]
}

export interface MetricsRound {
  id: string
  suggestionId: string
  round: number
  status: InterviewStatus
  scheduledAt: Date
  durationMinutes: number
  active: boolean
  outcome: InterviewResult | null
  outcomeReason: InterviewResultReason | null
  outcomeAt: Date | null
}

export interface MetricsProposal {
  id: string
  suggestionId: string
  version: number
  status: HireProposalStatus
  expiresAt: Date
  revision: number
  createdAt: Date
  respondedAt: Date | null
  declineReason: HireDeclineReason | null
  contractType: ContractType
  withdrawReason: HireProposalWithdrawReason | null
}

export interface MetricsPlacement {
  id: string
  suggestionId: string
  stage: PlacementStage
  origin: PlacementOrigin
  createdAt: Date
}

/** Domaines des comptes de test et de démonstration. */
export const TEST_EMAIL_DOMAINS = ['offrec-test.invalid', 'demo.mg'] as const

export function isTestEmail(email: string | null | undefined): boolean {
  if (!email) return false
  const domain = email.trim().toLowerCase().split('@').pop() ?? ''
  return (TEST_EMAIL_DOMAINS as readonly string[]).includes(domain)
}

/* ------------------------------------------------------------------ */
/* Transmission (définition des « Profils reçus »)                     */
/* ------------------------------------------------------------------ */

const isVisibleStatus = (status: string): boolean => (TRANSMITTED_STATUSES as readonly string[]).includes(status)

/**
 * Dossier transmis au recruteur : statut `proposee_recruteur`,
 * `interet_recruteur` ou `mise_en_relation`, ou `ecartee` avec une PREUVE de
 * transmission (journal d'audit, sortie depuis un statut visible, ou rang de
 * présélection — posé seulement à la transmission groupée). Un dossier
 * écarté dans la file interne de l'admin n'est jamais compté.
 */
export function isTransmittedDossier(
  dossier: Pick<MetricsDossier, 'status' | 'preselectionRank'>,
  evidence?: TransmissionEvidence,
): boolean {
  if (dossier.status === 'ecartee') {
    return Boolean(evidence?.transmittedAt || evidence?.exitedAfterTransmission || dossier.preselectionRank !== null)
  }
  return isVisibleStatus(dossier.status)
}

/**
 * Date de transmission d'un dossier (le schéma n'a pas de colonne « transmis
 * le ») : la transmission journalisée, sinon la dernière mise à jour d'un
 * dossier encore `proposee_recruteur`, sinon sa création.
 */
export function dossierReceivedAt(
  dossier: Pick<MetricsDossier, 'status' | 'createdAt' | 'updatedAt'>,
  evidence?: TransmissionEvidence,
): Date {
  return evidence?.transmittedAt ?? (dossier.status === 'proposee_recruteur' ? dossier.updatedAt : dossier.createdAt)
}

/* ------------------------------------------------------------------ */
/* Faits par dossier                                                   */
/* ------------------------------------------------------------------ */

export const FUNNEL_STAGES = [
  'proposes',
  'mis_en_relation',
  'entretien_passe',
  'retenus',
  'proposition',
  'embauches',
] as const
export type FunnelStage = (typeof FUNNEL_STAGES)[number]

/** Situation actuelle d'un dossier transmis (chacun dans une seule case). */
export const FUNNEL_SITUATIONS = [
  'embauche',
  'en_cours',
  'ecarte_avant_mise_en_relation',
  'non_retenu',
  'proposition_declinee',
  'poste_pourvu',
  'embauche_annulee',
  'placement_declare',
] as const
export type FunnelSituation = (typeof FUNNEL_SITUATIONS)[number]

export interface DossierDelays {
  transmissionToConnection: number | null
  connectionToFirstInterview: number | null
  interviewToOutcome: number | null
  connectionToProposal: number | null
  proposalToAnswer: number | null
  connectionToHire: number | null
}

export interface DossierFacts {
  dossier: MetricsDossier
  /** Étape 1 — date de transmission (`dossierReceivedAt`, au plus tard `connectedAt`). */
  proposedAt: Date
  /** Étape 2 — `connectedAt` (ou `updatedAt` d'une ligne reprise sans date). */
  connectedAt: Date | null
  /** Étape 3 — fin du premier tour passé. */
  interviewedAt: Date | null
  /** Étape 4 — premier tour « retenu » (date de l'issue). */
  retainedAt: Date | null
  /** Étape 5 — première proposition d'embauche. */
  offeredAt: Date | null
  /** Étape 6 — acceptation (placement `proposition_acceptee` non annulé). */
  hiredAt: Date | null
  hireCancelled: boolean
  phase: HiringPhase | null
  situation: FunnelSituation
  rounds: number
  absentOnce: boolean
  lastOutcome: InterviewResult | null
  lastOutcomeReason: InterviewResultReason | null
  proposals: number
  lastProposalStatus: HireProposalStatus | null
  lastDeclineReason: HireDeclineReason | null
  lastContractType: ContractType | null
  delays: DossierDelays
}

const ms = (d: Date) => d.getTime()
const minDate = (dates: Date[]): Date | null => (dates.length ? new Date(Math.min(...dates.map(ms))) : null)
/** Jours entre deux instants, une décimale ; `null` s'il en manque un. */
export function daysBetween(from: Date | null, to: Date | null): number | null {
  if (!from || !to) return null
  return Math.round((ms(to) - ms(from)) / DAY_MS * 10) / 10
}

/**
 * Tour « passé » (étape 3) : il a une issue (l'issue n'est acceptée
 * qu'après la fin du tour), ou bien il n'est ni annulé ni en empêchement et
 * son heure de fin est passée.
 */
export function isPassedRound(round: Pick<MetricsRound, 'status' | 'scheduledAt' | 'durationMinutes' | 'outcome'>, now: Date): boolean {
  if (round.outcome) return true
  if (round.status === 'annule' || round.status === 'empechement') return false
  return ms(interviewEnd(round.scheduledAt, round.durationMinutes)) <= ms(now)
}

/**
 * Faits d'un dossier, ou `null` s'il n'a jamais été transmis. `rounds`,
 * `proposals` et `placement` : ceux du dossier (le placement LIÉ par
 * `Placement.suggestionId`, quelle que soit son origine).
 */
export function buildDossierFacts(input: {
  dossier: MetricsDossier
  evidence?: TransmissionEvidence
  rounds: readonly MetricsRound[]
  proposals: readonly MetricsProposal[]
  placement: MetricsPlacement | null
  now: Date
}): DossierFacts | null {
  const { dossier, evidence, placement, now } = input
  if (!isTransmittedDossier(dossier, evidence)) return null
  const rounds = [...input.rounds].sort((a, b) => a.round - b.round)
  const proposals = [...input.proposals].sort((a, b) => a.version - b.version)

  const connected = dossier.status === 'mise_en_relation'
  const connectedAt = connected ? (dossier.connectedAt ?? dossier.updatedAt) : null
  // Une transmission précède toujours la mise en relation : une date de
  // réception déduite (création, faute de trace d'audit) postérieure à
  // `connectedAt` est ramenée à `connectedAt` (jamais de délai négatif).
  const received = dossierReceivedAt(dossier, evidence)
  const proposedAt = connectedAt && ms(connectedAt) < ms(received) ? connectedAt : received

  const passed = rounds.filter((r) => isPassedRound(r, now))
  const interviewedAt = connectedAt ? minDate(passed.map((r) => interviewEnd(r.scheduledAt, r.durationMinutes))) : null
  const retained = rounds.filter((r) => r.outcome === 'retenu')
  const retainedAt = interviewedAt
    ? minDate(retained.map((r) => r.outcomeAt ?? interviewEnd(r.scheduledAt, r.durationMinutes)))
    : null
  const offeredAt = retainedAt ? minDate(proposals.map((p) => p.createdAt)) : null
  const autoPlacement = placement && placement.origin === 'proposition_acceptee' ? placement : null
  const accepted = proposals.find((p) => p.status === 'acceptee') ?? null
  const hiredAt =
    offeredAt && autoPlacement && autoPlacement.stage !== 'annule' ? (accepted?.respondedAt ?? autoPlacement.createdAt) : null
  const hireCancelled = Boolean(autoPlacement && autoPlacement.stage === 'annule')

  const phase = hiringPhase(
    {
      status: dossier.status,
      rounds: rounds.map((r) => ({
        id: r.id,
        round: r.round,
        status: r.status,
        scheduledAt: r.scheduledAt,
        durationMinutes: r.durationMinutes,
        active: r.active,
        outcome: r.outcome,
      })),
      proposals: proposals.map((p) => ({
        id: p.id,
        version: p.version,
        status: p.status,
        expiresAt: p.expiresAt,
        revision: p.revision,
        withdrawReason: p.withdrawReason,
      })),
      placement: placement ? { stage: placement.stage } : null,
      filledAt: dossier.filledAt,
    },
    now,
  )

  let situation: FunnelSituation
  if (hiredAt) situation = 'embauche'
  else if (dossier.status === 'ecartee') situation = 'ecarte_avant_mise_en_relation'
  else if (!connected) situation = 'en_cours'
  else if (phase === 'embauche') situation = 'placement_declare'
  else if (phase === 'embauche_annulee') situation = 'embauche_annulee'
  else if (phase === 'non_retenu') situation = 'non_retenu'
  else if (phase === 'clos_proposition_refusee') situation = 'proposition_declinee'
  else if (phase === 'poste_pourvu') situation = 'poste_pourvu'
  // Toutes les autres phases attendent encore une suite (entretien, issue,
  // tour suivant, proposition ou réponse) : dossier en cours.
  else situation = 'en_cours'

  const withOutcome = rounds.filter((r) => r.outcome)
  const lastWithOutcome = withOutcome[withOutcome.length - 1] ?? null
  const lastProposal = proposals[proposals.length - 1] ?? null
  const answered = proposals.filter((p) => p.respondedAt && (p.status === 'acceptee' || p.status === 'refusee'))
  const lastAnswered = answered[answered.length - 1] ?? null
  const firstRound = rounds[0] ?? null

  return {
    dossier,
    proposedAt,
    connectedAt,
    interviewedAt,
    retainedAt,
    offeredAt,
    hiredAt,
    hireCancelled,
    phase,
    situation,
    rounds: rounds.length,
    absentOnce: rounds.some((r) => r.outcome === 'absent'),
    lastOutcome: lastWithOutcome?.outcome ?? null,
    lastOutcomeReason: lastWithOutcome?.outcomeReason ?? null,
    proposals: proposals.length,
    lastProposalStatus: lastProposal ? effectiveProposalStatus(lastProposal, now) : null,
    lastDeclineReason: [...proposals].reverse().find((p) => p.declineReason)?.declineReason ?? null,
    lastContractType: lastProposal?.contractType ?? null,
    delays: {
      transmissionToConnection: daysBetween(proposedAt, connectedAt),
      connectionToFirstInterview: connectedAt && firstRound ? daysBetween(connectedAt, firstRound.scheduledAt) : null,
      interviewToOutcome:
        lastWithOutcome?.outcomeAt
          ? daysBetween(interviewEnd(lastWithOutcome.scheduledAt, lastWithOutcome.durationMinutes), lastWithOutcome.outcomeAt)
          : null,
      connectionToProposal: daysBetween(connectedAt, offeredAt),
      proposalToAnswer: lastAnswered ? daysBetween(lastAnswered.createdAt, lastAnswered.respondedAt) : null,
      connectionToHire: daysBetween(connectedAt, hiredAt),
    },
  }
}

/** Date à laquelle un dossier a atteint une étape (`null` s'il ne l'a pas atteinte). */
export function stageReachedAt(facts: DossierFacts, stage: FunnelStage): Date | null {
  switch (stage) {
    case 'proposes':
      return facts.proposedAt
    case 'mis_en_relation':
      return facts.connectedAt
    case 'entretien_passe':
      return facts.interviewedAt
    case 'retenus':
      return facts.retainedAt
    case 'proposition':
      return facts.offeredAt
    case 'embauches':
      return facts.hiredAt
  }
}

/* ------------------------------------------------------------------ */
/* Période (cohorte de transmission)                                   */
/* ------------------------------------------------------------------ */

export const HIRING_PERIODS = ['30', '90', '365', 'all'] as const
export type HiringPeriod = (typeof HIRING_PERIODS)[number]

/**
 * Début de la période : minuit (Madagascar, UTC+3) du jour J-(n-1), comme
 * les séries des tableaux de bord ; `null` pour « depuis le début ».
 */
export function periodStart(period: HiringPeriod, now: Date): Date | null {
  if (period === 'all') return null
  return new Date(mgStartOfDay(now).getTime() - (Number(period) - 1) * DAY_MS)
}

/** Cohorte : dossiers TRANSMIS pendant la période (suivis jusqu'à `now`). */
export function cohortOf(facts: readonly DossierFacts[], since: Date | null): DossierFacts[] {
  return since ? facts.filter((f) => ms(f.proposedAt) >= ms(since)) : [...facts]
}

/* ------------------------------------------------------------------ */
/* Entonnoir                                                           */
/* ------------------------------------------------------------------ */

/** Part en %, une décimale ; `null` quand le total est nul. */
export function percentOf(part: number, total: number): number | null {
  return total > 0 ? Math.round((part / total) * 1000) / 10 : null
}

export interface DelaySummary {
  count: number
  medianDays: number | null
  meanDays: number | null
}

export function summarizeDelays(values: readonly (number | null)[]): DelaySummary {
  const list = values.filter((v): v is number => typeof v === 'number').sort((a, b) => a - b)
  if (list.length === 0) return { count: 0, medianDays: null, meanDays: null }
  const mid = Math.floor(list.length / 2)
  const median = list.length % 2 ? list[mid] : (list[mid - 1] + list[mid]) / 2
  const mean = list.reduce((s, v) => s + v, 0) / list.length
  return { count: list.length, medianDays: Math.round(median * 10) / 10, meanDays: Math.round(mean * 10) / 10 }
}

export interface FunnelStageCount {
  key: FunnelStage
  count: number
  /** Part de l'étape précédente (%), `null` pour la première ou sans dossier. */
  ratePrevious: number | null
  /** Part des dossiers proposés (%). */
  rateFromStart: number | null
}

export interface HiringFunnel {
  stages: FunnelStageCount[]
  situations: Record<FunnelSituation, number>
  /** Dossiers dont l'offre est pourvue et fermés automatiquement (`closedReason`). */
  closedByFilledOffer: number
  delays: {
    connectionToHire: DelaySummary
    transmissionToConnection: DelaySummary
    connectionToFirstInterview: DelaySummary
    interviewToOutcome: DelaySummary
  }
}

export function stageCounts(facts: readonly DossierFacts[]): Record<FunnelStage, number> {
  const counts = Object.fromEntries(FUNNEL_STAGES.map((s) => [s, 0])) as Record<FunnelStage, number>
  for (const f of facts) for (const stage of FUNNEL_STAGES) if (stageReachedAt(f, stage)) counts[stage]++
  return counts
}

export function computeFunnel(facts: readonly DossierFacts[]): HiringFunnel {
  const counts = stageCounts(facts)
  const stages = FUNNEL_STAGES.map((key, i) => ({
    key,
    count: counts[key],
    ratePrevious: i === 0 ? null : percentOf(counts[key], counts[FUNNEL_STAGES[i - 1]]),
    rateFromStart: percentOf(counts[key], counts.proposes),
  }))
  const situations = Object.fromEntries(FUNNEL_SITUATIONS.map((s) => [s, 0])) as Record<FunnelSituation, number>
  for (const f of facts) situations[f.situation]++
  return {
    stages,
    situations,
    closedByFilledOffer: facts.filter((f) => f.dossier.closedReason === 'offre_pourvue').length,
    delays: {
      connectionToHire: summarizeDelays(facts.map((f) => f.delays.connectionToHire)),
      transmissionToConnection: summarizeDelays(facts.map((f) => f.delays.transmissionToConnection)),
      connectionToFirstInterview: summarizeDelays(facts.map((f) => f.delays.connectionToFirstInterview)),
      interviewToOutcome: summarizeDelays(facts.map((f) => f.delays.interviewToOutcome)),
    },
  }
}

/* ------------------------------------------------------------------ */
/* Indicateur : issue renseignée sous 7 jours (plan §11)               */
/* ------------------------------------------------------------------ */

export const OUTCOME_INDICATOR_TARGET_PERCENT = 80
export const OUTCOME_INDICATOR_GRACE_DAYS = 7
export const OUTCOME_INDICATOR_WINDOW_DAYS = 30

export interface OutcomeTimeliness {
  /** Tours mûrs : non annulés, hors empêchement, fin dans la fenêtre. */
  eligible: number
  /** Parmi eux, issue posée au plus 7 jours après la fin. */
  recordedWithin7d: number
  percent: number | null
  targetPercent: number
  /** `null` sans tour éligible. */
  met: boolean | null
}

/** Tour éligible : ni annulé ni en empêchement (une issue n'y est jamais demandée). */
const isIndicatorRound = (r: Pick<MetricsRound, 'status'>) => r.status !== 'annule' && r.status !== 'empechement'

/**
 * Part des tours terminés dont l'issue a été renseignée sous 7 jours.
 * Dénominateur : tours non annulés, hors `empechement`, dont la fin tombe
 * entre `now − (7 + window)` jours et `now − 7` jours (fenêtre glissante
 * « mûrie » : chaque tour a eu ses 7 jours) ; `windowDays = null` → tous les
 * tours terminés depuis au moins 7 jours. Numérateur : `outcomeAt − fin ≤ 7 j`.
 */
export function outcomeTimeliness(
  rounds: readonly MetricsRound[],
  now: Date,
  windowDays: number | null = OUTCOME_INDICATOR_WINDOW_DAYS,
): OutcomeTimeliness {
  const grace = OUTCOME_INDICATOR_GRACE_DAYS * DAY_MS
  const upper = ms(now) - grace
  const lower = windowDays === null ? Number.NEGATIVE_INFINITY : upper - windowDays * DAY_MS
  let eligible = 0
  let recorded = 0
  for (const r of rounds) {
    if (!isIndicatorRound(r)) continue
    const end = ms(interviewEnd(r.scheduledAt, r.durationMinutes))
    if (end > upper || end < lower) continue
    eligible++
    if (r.outcomeAt && ms(r.outcomeAt) - end <= grace) recorded++
  }
  const percent = percentOf(recorded, eligible)
  return {
    eligible,
    recordedWithin7d: recorded,
    percent,
    targetPercent: OUTCOME_INDICATOR_TARGET_PERCENT,
    met: percent === null ? null : percent >= OUTCOME_INDICATOR_TARGET_PERCENT,
  }
}

/* ------------------------------------------------------------------ */
/* Par offre (recruteur)                                               */
/* ------------------------------------------------------------------ */

export function countsByOpportunity(facts: readonly DossierFacts[]): Map<string, Record<FunnelStage, number>> {
  const groups = new Map<string, DossierFacts[]>()
  for (const f of facts) {
    const list = groups.get(f.dossier.opportunityId)
    if (list) list.push(f)
    else groups.set(f.dossier.opportunityId, [f])
  }
  return new Map([...groups].map(([id, list]) => [id, stageCounts(list)]))
}

/* ------------------------------------------------------------------ */
/* Export de recherche pseudonymisé                                    */
/* ------------------------------------------------------------------ */

/** Taille minimale d'un groupe de quasi-identifiants (secteur, niveau, type, période). */
export const RESEARCH_MIN_GROUP = 5

/**
 * Pseudonyme stable et non réversible : HMAC-SHA256 (clé serveur) de
 * `type:identifiant`, tronqué à 12 caractères hexadécimaux. Même clé →
 * même pseudonyme d'un export à l'autre ; sans la clé, impossible de
 * remonter à l'identifiant (ni de le vérifier par force brute sur les UUID).
 */
export function pseudonym(key: string | Buffer, kind: 'dossier' | 'offre', id: string): string {
  const prefix = kind === 'dossier' ? 'd_' : 'o_'
  return prefix + createHmac('sha256', key).update(`${kind}:${id}`).digest('hex').slice(0, 12)
}

export function scoreBand(score: number): string {
  if (score >= 90) return '90+'
  if (score >= 80) return '80–89'
  if (score >= 70) return '70–79'
  if (score >= 60) return '60–69'
  return '<60'
}

export function rankBand(rank: number | null): string {
  if (rank === null) return 'non classé'
  if (rank <= 3) return '1–3'
  if (rank <= 5) return '4–5'
  if (rank <= 10) return '6–10'
  return '>10'
}

/** Motifs de « non retenu » qui portent sur un critère du score (compétences, niveau, disponibilité). */
export const SCORE_RELATED_REASONS: readonly InterviewResultReason[] = ['competences_techniques', 'experience', 'disponibilite']

export function reasonTiedToScore(reason: InterviewResultReason | null): string {
  if (!reason || reason === 'points_forts') return ''
  return SCORE_RELATED_REASONS.includes(reason) ? 'oui' : 'non'
}

export const RESEARCH_COLUMNS = [
  'dossier',
  'offre',
  'periode_transmission',
  'secteur',
  'niveau_offre',
  'type_offre',
  'generalisation',
  'score',
  'tranche_score',
  'rang_preselection',
  'tranche_rang',
  'origine',
  'cv_verifie',
  'statut_dossier',
  'cloture_auto',
  'mis_en_relation',
  'nb_tours',
  'entretien_passe',
  'absent_au_moins_une_fois',
  'derniere_issue',
  'motif_derniere_issue',
  'motif_lie_au_score',
  'retenu',
  'nb_propositions',
  'derniere_proposition',
  'categorie_refus',
  'type_contrat',
  'embauche',
  'embauche_annulee',
  'phase',
  'j_transmission_mise_en_relation',
  'j_mise_en_relation_1er_entretien',
  'j_fin_entretien_issue',
  'j_mise_en_relation_proposition',
  'j_proposition_reponse',
  'j_mise_en_relation_embauche',
  'compte_test',
] as const
export type ResearchColumn = (typeof RESEARCH_COLUMNS)[number]
export type ResearchRow = Record<ResearchColumn, string | number | null>

const yesNo = (value: boolean) => (value ? 'oui' : 'non')
const REGROUPED = 'regroupé'

function quarterOf(month: string): string {
  const [year, m] = month.split('-')
  return `${year}-T${Math.floor((Number(m) - 1) / 3) + 1}`
}

/** Ligne d'export d'un dossier — liste blanche : jamais de texte libre, de nom, de date exacte ni d'identifiant interne. */
export function toResearchRow(facts: DossierFacts, key: string | Buffer): ResearchRow {
  const d = facts.dossier
  return {
    dossier: pseudonym(key, 'dossier', d.id),
    offre: pseudonym(key, 'offre', d.opportunityId),
    periode_transmission: mgDayKey(facts.proposedAt).slice(0, 7),
    secteur: d.sector,
    niveau_offre: d.level,
    type_offre: d.opportunityType,
    generalisation: 'aucune',
    score: d.score,
    tranche_score: scoreBand(d.score),
    rang_preselection: d.preselectionRank,
    tranche_rang: rankBand(d.preselectionRank),
    origine: d.origin,
    cv_verifie: yesNo(d.cvVerified),
    statut_dossier: d.status,
    cloture_auto: d.closedReason ?? '',
    mis_en_relation: yesNo(Boolean(facts.connectedAt)),
    nb_tours: facts.rounds,
    entretien_passe: yesNo(Boolean(facts.interviewedAt)),
    absent_au_moins_une_fois: yesNo(facts.absentOnce),
    derniere_issue: facts.lastOutcome ?? '',
    motif_derniere_issue: facts.lastOutcomeReason ?? '',
    motif_lie_au_score: reasonTiedToScore(facts.lastOutcomeReason),
    retenu: yesNo(Boolean(facts.retainedAt)),
    nb_propositions: facts.proposals,
    derniere_proposition: facts.lastProposalStatus ?? '',
    categorie_refus: facts.lastDeclineReason ?? '',
    type_contrat: facts.lastContractType ?? '',
    embauche: yesNo(Boolean(facts.hiredAt)),
    embauche_annulee: yesNo(facts.hireCancelled),
    phase: facts.phase ?? '',
    j_transmission_mise_en_relation: facts.delays.transmissionToConnection,
    j_mise_en_relation_1er_entretien: facts.delays.connectionToFirstInterview,
    j_fin_entretien_issue: facts.delays.interviewToOutcome,
    j_mise_en_relation_proposition: facts.delays.connectionToProposal,
    j_proposition_reponse: facts.delays.proposalToAnswer,
    j_mise_en_relation_embauche: facts.delays.connectionToHire,
    compte_test: yesNo(d.isTest),
  }
}

export interface GeneralizationStats {
  /** Lignes dont secteur, niveau et type de l'offre ont été regroupés. */
  offerAttributes: number
  /** Lignes dont la période est passée au trimestre / à l'année / masquée. */
  quarter: number
  year: number
  masked: number
  /** Lignes restant dans un groupe de moins de `minGroup` après généralisation. */
  residualSmallGroups: number
}

/**
 * Petits effectifs (k-anonymat sur secteur, niveau, type d'offre et période) :
 * 1. une combinaison (secteur, niveau, type) de moins de `minGroup` lignes
 *    est regroupée — toutes les lignes d'une offre partagent la même, elle
 *    est donc regroupée pour toute l'offre (pas de recoupement par `offre`) ;
 * 2. une période (mois) de moins de `minGroup` lignes dans sa combinaison
 *    passe au trimestre, puis à l'année, puis est masquée ;
 * 3. les lignes encore isolées sont comptées (avertissement de l'en-tête).
 * Modifie `rows` en place.
 */
export function generalizeResearchRows(rows: ResearchRow[], minGroup = RESEARCH_MIN_GROUP): GeneralizationStats {
  const stats: GeneralizationStats = { offerAttributes: 0, quarter: 0, year: 0, masked: 0, residualSmallGroups: 0 }
  const tags = new Map<ResearchRow, string[]>(rows.map((r) => [r, []]))
  const offerKey = (r: ResearchRow) => `${r.secteur}|${r.niveau_offre}|${r.type_offre}`
  const fullKey = (r: ResearchRow) => `${offerKey(r)}|${r.periode_transmission}`
  const countBy = (keyOf: (r: ResearchRow) => string) => {
    const counts = new Map<string, number>()
    for (const r of rows) counts.set(keyOf(r), (counts.get(keyOf(r)) ?? 0) + 1)
    return counts
  }

  const offerCounts = countBy(offerKey)
  for (const r of rows) {
    if ((offerCounts.get(offerKey(r)) ?? 0) >= minGroup) continue
    r.secteur = REGROUPED
    r.niveau_offre = REGROUPED
    r.type_offre = REGROUPED
    tags.get(r)!.push('secteur_niveau_type')
    stats.offerAttributes++
  }

  const steps: { tag: string; apply: (r: ResearchRow) => void }[] = [
    { tag: 'trimestre', apply: (r) => (r.periode_transmission = quarterOf(String(r.periode_transmission))) },
    { tag: 'annee', apply: (r) => (r.periode_transmission = String(r.periode_transmission).slice(0, 4)) },
    { tag: 'periode_masquee', apply: (r) => (r.periode_transmission = '') },
  ]
  for (const step of steps) {
    const counts = countBy(fullKey)
    const small = rows.filter((r) => r.periode_transmission !== '' && (counts.get(fullKey(r)) ?? 0) < minGroup)
    for (const r of small) {
      step.apply(r)
      // Une seule étiquette de période : la plus forte appliquée.
      const kept = tags.get(r)!.filter((t) => t === 'secteur_niveau_type')
      tags.set(r, [...kept, step.tag])
    }
  }
  // Compteurs de période : niveau final de chaque ligne.
  for (const r of rows) {
    const list = tags.get(r)!
    if (list.includes('trimestre')) stats.quarter++
    if (list.includes('annee')) stats.year++
    if (list.includes('periode_masquee')) stats.masked++
    r.generalisation = list.length ? list.join('+') : 'aucune'
  }
  const finalCounts = countBy(fullKey)
  stats.residualSmallGroups = rows.filter((r) => (finalCounts.get(fullKey(r)) ?? 0) < minGroup).length
  return stats
}

/* ------------------------------------------------------------------ */
/* CSV (mêmes conventions que l'export du tableau de bord admin)       */
/* ------------------------------------------------------------------ */

/** Cellule : virgule décimale, guillemets si `;`, `"` ou fin de ligne. */
export function csvCell(value: string | number | null): string {
  if (value === null) return ''
  const text = typeof value === 'number' ? String(value).replace('.', ',') : value
  return /[;"\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/** Document : BOM UTF-8, `;`, fins de ligne CRLF. */
export function csvDocument(rows: (string | number | null)[][]): string {
  return '﻿' + rows.map((r) => r.map(csvCell).join(';')).join('\r\n') + '\r\n'
}

export interface ResearchExport {
  csv: string
  rowCount: number
  generalization: GeneralizationStats
  testRows: number
}

/**
 * Export complet : en-tête descriptif (lignes « # », à ignorer par l'outil
 * d'analyse), ligne de colonnes, puis une ligne par dossier transmis, triées
 * par pseudonyme (l'ordre ne trahit pas la date de création).
 */
export function buildResearchExport(input: {
  facts: readonly DossierFacts[]
  key: string | Buffer
  now: Date
  excludeTest: boolean
  truncated?: boolean
  minGroup?: number
}): ResearchExport {
  const { now, excludeTest, key } = input
  const minGroup = input.minGroup ?? RESEARCH_MIN_GROUP
  const facts = excludeTest ? input.facts.filter((f) => !f.dossier.isTest) : [...input.facts]
  const rows = facts.map((f) => toResearchRow(f, key))
  const generalization = generalizeResearchRows(rows, minGroup)
  rows.sort((a, b) => String(a.dossier).localeCompare(String(b.dossier)))
  const testRows = rows.filter((r) => r.compte_test === 'oui').length
  const stamp = new Date(now.getTime() + 3 * 3_600_000).toISOString().slice(0, 16).replace('T', ' ')

  const preamble: string[] = [
    `# Export de recherche OffRec - dossiers pseudonymisés, une ligne par dossier transmis à un recruteur. Généré le ${stamp} (heure de Madagascar, UTC+3).`,
    `# Nature des données : en partie des comptes de test et de démonstration (${TEST_EMAIL_DOMAINS.map((d) => '@' + d).join(', ')}). C'est une démonstration du dispositif de mesure, pas un résultat de terrain. Comptes de test : ${excludeTest ? 'exclus' : `inclus (${testRows} ligne(s) compte_test=oui)`}.`,
    `# Anonymisation : dossier et offre = HMAC-SHA256 tronqué, non réversible, stable tant que la clé serveur ne change pas. Aucun nom, email, téléphone, entreprise, note, texte libre, salaire, date exacte ni identifiant interne. Période = mois de transmission.`,
    `# Petits effectifs (moins de ${minGroup} lignes) : ${generalization.offerAttributes} ligne(s) avec secteur/niveau/type regroupés, ${generalization.quarter} période(s) au trimestre, ${generalization.year} à l'année, ${generalization.masked} masquée(s). ${generalization.residualSmallGroups} ligne(s) restent dans un groupe de moins de ${minGroup} : ne pas publier de ligne isolée, seulement des agrégats.`,
    `# Lecture : score et rang = instantanés figés à la transmission. cv_verifie = état actuel du CV. Délais en jours (une décimale). Étapes et définitions : server/API_DOCUMENTATION.md, GET /admin/stats/research-export.${input.truncated ? ' ATTENTION : export tronqué à la limite du serveur.' : ''}`,
  ]
  const table: (string | number | null)[][] = [
    ...preamble.map((line) => [line]),
    [...RESEARCH_COLUMNS],
    ...rows.map((r) => RESEARCH_COLUMNS.map((c) => r[c])),
  ]
  return { csv: csvDocument(table), rowCount: rows.length, generalization, testRows }
}

/** Nom de fichier daté (jour de Madagascar). */
export function researchExportFilename(now: Date): string {
  return `offrec-export-recherche-${mgDayKey(now)}.csv`
}
