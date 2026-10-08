import type {
  CandidateProfile,
  CvVerificationStatus,
  ExperienceLevel,
  MatchFit,
  MatchSuggestionStatus,
  Opportunity,
  PreselectionEliminated,
  PreselectionEntry,
  PreselectionFilters,
  PreselectionMotif,
  PreselectionResult,
  PreselectionSuggestionState,
  PreselectionTop,
  Sector,
} from '../../../src/types/index.js'
import { scoreOpportunity } from '../../../src/lib/recommendation.js'

/**
 * Présélection ATS par offre — logique PURE (aucun accès base, aucun appel
 * IA, aucune horloge implicite) : testable sur des données en mémoire.
 *
 * Couche au-dessus de `scoreOpportunity()`, dont ni la formule ni les poids
 * ne changent :
 *   1. filtres éliminatoires, évalués dans un ordre fixe (entonnoir) — un
 *      candidat éliminé porte le PREMIER motif rencontré ;
 *   2. classement des candidats restants (score, puis départage
 *      déterministe — voir `compareRanked`) ;
 *   3. coupe au top N (5 ou 10).
 *
 * Tout est calculé sur le profil CONFIRMÉ par le candidat. Les compétences
 * détectées par l'IA dans le CV (`cvSkillsSuggested`) ne servent qu'à
 * l'indice `cvHintSkills`, affiché à l'admin : elles n'entrent ni dans le
 * score, ni dans les filtres, ni dans le classement.
 *
 * Ce module porte aussi la définition UNIQUE de l'éligibilité, partagée avec
 * le moteur de matching (`lib/matching.ts`).
 */

/* ------------------------------------------------------------------ */
/* Éligibilité — partagée avec le moteur de matching                   */
/* ------------------------------------------------------------------ */

/** Un compte averti reste pleinement actif ; restreint, suspendu ou banni ne l'est plus. */
export const ACTIVE_USER_STATUSES = ['active', 'warned'] as const

export function isActiveUserStatus(status: string): boolean {
  return (ACTIVE_USER_STATUSES as readonly string[]).includes(status)
}

/** Une offre dont la date limite est aujourd'hui est encore ouverte. */
export function startOfUtcDay(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
}

export type CandidateIneligibility = 'compte_inactif' | 'sans_consentement' | 'sans_cv'

/**
 * Un candidat est proposable s'il a le rôle candidat, un compte actif, un
 * consentement de matching en vigueur et un CV déposé. Retourne le premier
 * manque, ou `null` s'il est éligible.
 */
export function candidateIneligibility(candidate: {
  accountRole: string
  accountStatus: string
  consentAt: Date | string | null
  hasCv: boolean
}): CandidateIneligibility | null {
  if (candidate.accountRole !== 'candidate' || !isActiveUserStatus(candidate.accountStatus)) return 'compte_inactif'
  if (!candidate.consentAt) return 'sans_consentement'
  if (!candidate.hasCv) return 'sans_cv'
  return null
}

/**
 * Une offre est ouverte si sa date limite n'est pas dépassée et si le compte
 * de son recruteur est actif. Retourne la raison de fermeture, ou `null`.
 */
export function opportunityClosedReason(
  opportunity: { deadline: Date | string },
  recruiter: { role: string; status: string } | null,
  now: Date,
): string | null {
  if (new Date(opportunity.deadline).getTime() < startOfUtcDay(now).getTime()) {
    return 'La date limite de l’offre est dépassée.'
  }
  if (!recruiter || recruiter.role !== 'recruiter' || !isActiveUserStatus(recruiter.status)) {
    return 'Le compte du recruteur est inactif.'
  }
  return null
}

function normalizeSkill(skill: string): string {
  return skill.trim().toLowerCase()
}

/** Compétences requises par l'offre, réparties selon leur présence au profil. */
export function splitRequiredSkills(
  candidateSkills: string[],
  requiredSkills: string[],
): { covered: string[]; missing: string[] } {
  const candidate = new Set(candidateSkills.map(normalizeSkill))
  const covered: string[] = []
  const missing: string[] = []
  for (const skill of requiredSkills) {
    if (candidate.has(normalizeSkill(skill))) covered.push(skill)
    else missing.push(skill)
  }
  return { covered, missing }
}

/**
 * Garde-fou en plus du seuil : sans aucune compétence en commun, un profil
 * vide atteint déjà ~40-50 par le seul jeu des valeurs neutres (province,
 * niveau, type) et noierait la file de validation.
 */
export function hasCommonSkill(candidateSkills: string[], requiredSkills: string[]): boolean {
  return splitRequiredSkills(candidateSkills, requiredSkills).covered.length > 0
}

/* ------------------------------------------------------------------ */
/* Transitions admin                                                   */
/* ------------------------------------------------------------------ */

/**
 * Transitions autorisées côté admin (décision produit 2026-10-08) : jamais
 * de retour en arrière depuis `mise_en_relation`/`ecartee` (états terminaux).
 * `suggeree` est la file de validation : l'admin transmet au recruteur ou
 * écarte. `proposee_candidat` / `interet_candidat` sont des valeurs héritées
 * du parcours « postuler offre par offre » : elles ne sont plus produites
 * mais peuvent toujours avancer. Tout passage à `proposee_recruteur` exige
 * en plus le consentement du candidat (`applyAdminTransition`). Les
 * transitions recruteur (`interet_recruteur`) et le retrait du candidat
 * vivent dans match-suggestions.routes.ts.
 */
export const ADMIN_ALLOWED_TRANSITIONS: Record<MatchSuggestionStatus, MatchSuggestionStatus[]> = {
  suggeree: ['proposee_recruteur', 'ecartee'],
  proposee_candidat: ['proposee_recruteur', 'ecartee'],
  interet_candidat: ['proposee_recruteur', 'ecartee'],
  proposee_recruteur: ['ecartee'],
  interet_recruteur: ['mise_en_relation', 'ecartee'],
  mise_en_relation: [],
  ecartee: [],
}

const BLOCKED_REASONS: Partial<Record<MatchSuggestionStatus, string>> = {
  proposee_recruteur: 'Déjà transmis au recruteur.',
  interet_recruteur: 'Déjà transmis : le recruteur a marqué son intérêt.',
  mise_en_relation: 'Déjà mis en relation.',
  ecartee: 'Écarté pour cette offre.',
}

/** `null` si l'admin peut transmettre ce candidat au recruteur, sinon la raison. */
export function transmissionBlockedReason(suggestion: PreselectionSuggestionState | null): string | null {
  if (!suggestion) return null
  if (ADMIN_ALLOWED_TRANSITIONS[suggestion.status].includes('proposee_recruteur')) return null
  return BLOCKED_REASONS[suggestion.status] ?? 'Ce dossier ne peut plus être transmis.'
}

/* ------------------------------------------------------------------ */
/* Détail par critère                                                  */
/* ------------------------------------------------------------------ */

/** Même ordre que `scoreOpportunity` (qui garde le sien, privé). */
const LEVEL_ORDER: readonly ExperienceLevel[] = ['debutant', 'junior', 'intermediaire', 'senior']

function sameText(a: string, b: string): boolean {
  const left = a.trim().toLowerCase()
  return left !== '' && left === b.trim().toLowerCase()
}

/**
 * Adéquation critère par critère. Ne lit que des champs du profil confirmé
 * que le recruteur a déjà le droit de voir (compétences, province, ville,
 * niveau, types recherchés) : le résultat peut lui être transmis tel quel.
 */
export function computeMatchFit(
  profile: Pick<CandidateProfile, 'skills' | 'province' | 'city' | 'experienceLevel' | 'desiredOpportunityTypes'>,
  opportunity: Pick<Opportunity, 'requiredSkills' | 'province' | 'city' | 'level' | 'opportunityType'>,
): MatchFit {
  const sameProvince = sameText(profile.province, opportunity.province)
  const levelGap = Math.abs(LEVEL_ORDER.indexOf(profile.experienceLevel) - LEVEL_ORDER.indexOf(opportunity.level))
  const knownLevels = LEVEL_ORDER.includes(profile.experienceLevel) && LEVEL_ORDER.includes(opportunity.level)
  return {
    skills: splitRequiredSkills(profile.skills, opportunity.requiredSkills),
    location: {
      match: !sameProvince ? 'autre' : sameText(profile.city, opportunity.city) ? 'meme_ville' : 'meme_province',
      province: opportunity.province,
      city: opportunity.city,
    },
    level: {
      required: opportunity.level,
      candidate: profile.experienceLevel,
      conforme: knownLevels && levelGap <= 1,
    },
    type: {
      offered: opportunity.opportunityType,
      match:
        profile.desiredOpportunityTypes.length === 0
          ? 'sans_preference'
          : profile.desiredOpportunityTypes.includes(opportunity.opportunityType)
            ? 'souhaite'
            : 'non_souhaite',
    },
  }
}

/* ------------------------------------------------------------------ */
/* Présélection                                                        */
/* ------------------------------------------------------------------ */

/** Ordre d'évaluation de l'entonnoir, et libellés affichés à l'admin. */
export const PRESELECTION_MOTIFS: readonly { motif: PreselectionMotif; label: string }[] = [
  { motif: 'offre_fermee', label: 'Offre fermée (date limite dépassée ou recruteur inactif)' },
  { motif: 'compte_inactif', label: 'Compte candidat inactif' },
  { motif: 'sans_consentement', label: 'Accord de matching non donné ou retiré' },
  { motif: 'sans_cv', label: 'Aucun CV déposé' },
  { motif: 'deja_ecarte', label: 'Déjà écarté pour cette offre' },
  { motif: 'aucune_competence_commune', label: 'Aucune compétence requise en commun' },
  { motif: 'score_insuffisant', label: 'Score sous le seuil de matching' },
  { motif: 'cv_non_verifie', label: 'CV non vérifié (filtre)' },
  { motif: 'autre_province', label: 'Autre province (filtre)' },
  { motif: 'niveau_non_conforme', label: 'Niveau non conforme (filtre)' },
  { motif: 'type_non_souhaite', label: 'Type d’opportunité non souhaité (filtre)' },
]

const MOTIF_LABELS = Object.fromEntries(PRESELECTION_MOTIFS.map((m) => [m.motif, m.label])) as Record<
  PreselectionMotif,
  string
>

export const NO_PRESELECTION_FILTERS: PreselectionFilters = {
  verifiedOnly: false,
  sameProvince: false,
  levelMatch: false,
  desiredType: false,
}

export interface PreselectionCandidateInput {
  candidateId: string
  email: string
  /** Profil CONFIRMÉ par le candidat. */
  profile: CandidateProfile
  accountRole: string
  accountStatus: string
  consentAt: Date | null
  hasCv: boolean
  cvVerificationStatus: CvVerificationStatus
  cvFlagCount: number
  /** Compétences détectées par l'IA dans le CV — indice affiché uniquement. */
  cvSkillsSuggested: string[]
  sector: Sector | null
  suggestion: PreselectionSuggestionState | null
}

export interface PreselectionInput {
  opportunity: Opportunity
  /** Compte du recruteur de l'offre (`null` s'il est introuvable). */
  recruiter: { role: string; status: string } | null
  candidates: PreselectionCandidateInput[]
  top: PreselectionTop
  filters: PreselectionFilters
  /** `MATCH_THRESHOLD` du moteur. */
  threshold: number
  now: Date
}

interface Evaluated {
  input: PreselectionCandidateInput
  score: number
  reasons: string[]
  fit: MatchFit
}

function knockout(
  { input, score, fit }: Evaluated,
  offerClosed: boolean,
  filters: PreselectionFilters,
  threshold: number,
): PreselectionMotif | null {
  if (offerClosed) return 'offre_fermee'
  const ineligible = candidateIneligibility(input)
  if (ineligible) return ineligible
  if (input.suggestion?.status === 'ecartee') return 'deja_ecarte'
  if (fit.skills.covered.length === 0) return 'aucune_competence_commune'
  if (score < threshold) return 'score_insuffisant'
  if (filters.verifiedOnly && input.cvVerificationStatus !== 'verifie') return 'cv_non_verifie'
  if (filters.sameProvince && fit.location.match === 'autre') return 'autre_province'
  if (filters.levelMatch && !fit.level.conforme) return 'niveau_non_conforme'
  if (filters.desiredType && fit.type.match !== 'souhaite') return 'type_non_souhaite'
  return null
}

const CV_STATUS_RANK: Record<CvVerificationStatus, number> = { verifie: 0, non_verifie: 1, rejete: 2 }
const LOCATION_RANK: Record<MatchFit['location']['match'], number> = { meme_ville: 0, meme_province: 1, autre: 2 }

/**
 * Ordre de classement, du plus au moins prioritaire :
 *   1. score `scoreOpportunity` décroissant ;
 *   2. nombre de compétences requises couvertes, décroissant ;
 *   3. proximité : même ville, puis même province, puis autre ;
 *   4. CV vérifié, puis non vérifié, puis rejeté ;
 *   5. moins de points relevés sur le CV (`cvFlags`) ;
 *   6. consentement le plus ancien d'abord ;
 *   7. identifiant du candidat (ordre total, donc résultat reproductible).
 */
function compareRanked(a: Evaluated, b: Evaluated): number {
  return (
    b.score - a.score ||
    b.fit.skills.covered.length - a.fit.skills.covered.length ||
    LOCATION_RANK[a.fit.location.match] - LOCATION_RANK[b.fit.location.match] ||
    CV_STATUS_RANK[a.input.cvVerificationStatus] - CV_STATUS_RANK[b.input.cvVerificationStatus] ||
    a.input.cvFlagCount - b.input.cvFlagCount ||
    (a.input.consentAt?.getTime() ?? 0) - (b.input.consentAt?.getTime() ?? 0) ||
    (a.input.candidateId < b.input.candidateId ? -1 : a.input.candidateId > b.input.candidateId ? 1 : 0)
  )
}

export function preselect(input: PreselectionInput): PreselectionResult {
  const { opportunity, filters, threshold, top } = input
  const closedReason = opportunityClosedReason(opportunity, input.recruiter, input.now)

  const qualified: Evaluated[] = []
  const eliminated: (PreselectionEliminated & { order: number })[] = []
  const motifCounts = new Map<PreselectionMotif, number>()

  for (const candidate of input.candidates) {
    const match = scoreOpportunity(candidate.profile, opportunity)
    const evaluated: Evaluated = {
      input: candidate,
      score: match.score,
      reasons: match.reasons,
      fit: computeMatchFit(candidate.profile, opportunity),
    }
    const motif = knockout(evaluated, closedReason !== null, filters, threshold)
    if (!motif) {
      qualified.push(evaluated)
      continue
    }
    motifCounts.set(motif, (motifCounts.get(motif) ?? 0) + 1)
    eliminated.push({
      candidateId: candidate.candidateId,
      fullName: candidate.profile.fullName,
      motif,
      motifLabel: MOTIF_LABELS[motif],
      score: match.score,
      suggestion: candidate.suggestion,
      order: PRESELECTION_MOTIFS.findIndex((m) => m.motif === motif),
    })
  }

  qualified.sort(compareRanked)
  // Éliminés : dans l'ordre de l'entonnoir, puis du plus proche au plus éloigné.
  eliminated.sort(
    (a, b) => a.order - b.order || b.score - a.score || (a.candidateId < b.candidateId ? -1 : a.candidateId > b.candidateId ? 1 : 0),
  )

  const ranked: PreselectionEntry[] = qualified.slice(0, top).map((e, index) => {
    const cvSkills = new Set(e.input.cvSkillsSuggested.map(normalizeSkill))
    const blockedReason = transmissionBlockedReason(e.input.suggestion)
    return {
      rank: index + 1,
      candidateId: e.input.candidateId,
      fullName: e.input.profile.fullName,
      email: e.input.email,
      score: e.score,
      reasons: e.reasons,
      fit: e.fit,
      cvHintSkills: e.fit.skills.missing.filter((skill) => cvSkills.has(normalizeSkill(skill))),
      sectorMatch: !e.input.sector ? 'non_renseigne' : e.input.sector === opportunity.sector ? 'identique' : 'different',
      cvVerificationStatus: e.input.cvVerificationStatus,
      cvFlagCount: e.input.cvFlagCount,
      // Un candidat qualifié a forcément un consentement (filtre éliminatoire).
      consentAt: (e.input.consentAt as Date).toISOString(),
      suggestion: e.input.suggestion,
      transmissible: blockedReason === null,
      blockedReason,
    }
  })

  return {
    opportunity: {
      id: opportunity.id,
      title: opportunity.title,
      companyName: opportunity.companyName,
      category: opportunity.category,
      sector: opportunity.sector,
      province: opportunity.province,
      city: opportunity.city,
      opportunityType: opportunity.opportunityType,
      requiredSkills: opportunity.requiredSkills,
      level: opportunity.level,
      deadline: opportunity.deadline,
      open: closedReason === null,
      closedReason,
    },
    top,
    filters,
    threshold,
    counts: {
      evaluated: input.candidates.length,
      eliminated: eliminated.length,
      qualified: qualified.length,
      retained: ranked.length,
      byMotif: PRESELECTION_MOTIFS.filter((m) => motifCounts.has(m.motif)).map((m) => ({
        motif: m.motif,
        label: m.label,
        count: motifCounts.get(m.motif) ?? 0,
      })),
    },
    ranked,
    eliminated: eliminated.map(({ order: _order, ...entry }) => entry),
  }
}
