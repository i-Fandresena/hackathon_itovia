import type { CandidateProfile, MatchResult, Opportunity } from '../types/index.js'

const LEVEL_ORDER = ['debutant', 'junior', 'intermediaire', 'senior'] as const

function normalizeSkill(skill: string): string {
  return skill.trim().toLowerCase()
}

function skillOverlap(candidateSkills: string[], requiredSkills: string[]): number {
  if (requiredSkills.length === 0) return 0.5
  const candidate = new Set(candidateSkills.map(normalizeSkill))
  const matched = requiredSkills.filter((s) => candidate.has(normalizeSkill(s)))
  return matched.length / requiredSkills.length
}

function locationMatch(candidateProvince: string, oppProvince: string): number {
  if (!candidateProvince || !oppProvince) return 0.3
  if (candidateProvince.toLowerCase() === oppProvince.toLowerCase()) return 1
  return 0.35
}

function levelMatch(candidateLevel: string, requiredLevel: string): number {
  const cIdx = LEVEL_ORDER.indexOf(candidateLevel as (typeof LEVEL_ORDER)[number])
  const rIdx = LEVEL_ORDER.indexOf(requiredLevel as (typeof LEVEL_ORDER)[number])
  if (cIdx < 0 || rIdx < 0) return 0.5
  const diff = Math.abs(cIdx - rIdx)
  if (diff === 0) return 1
  if (diff === 1) return 0.75
  if (diff === 2) return 0.45
  return 0.2
}

function typeMatch(
  desired: CandidateProfile['desiredOpportunityTypes'],
  oppType: Opportunity['opportunityType'],
): number {
  if (desired.length === 0) return 0.5
  return desired.includes(oppType) ? 1 : 0.25
}

function availabilityMatch(): number {
  return 0.85
}

export function scoreOpportunity(
  profile: CandidateProfile,
  opportunity: Opportunity,
): MatchResult {
  const skills = skillOverlap(profile.skills, opportunity.requiredSkills)
  const location = locationMatch(profile.province, opportunity.province)
  const level = levelMatch(profile.experienceLevel, opportunity.level)
  const type = typeMatch(profile.desiredOpportunityTypes, opportunity.opportunityType)
  const availability = availabilityMatch()

  const weights = {
    skills: 0.4,
    location: 0.25,
    level: 0.15,
    type: 0.15,
    availability: 0.05,
  }

  const raw =
    skills * weights.skills +
    location * weights.location +
    level * weights.level +
    type * weights.type +
    availability * weights.availability

  const score = Math.round(raw * 100)
  const reasons: string[] = []

  if (skills >= 0.6) {
    const matched = opportunity.requiredSkills.filter((s) =>
      profile.skills.map(normalizeSkill).includes(normalizeSkill(s)),
    )
    reasons.push(
      matched.length > 0
        ? `Compétences alignées : ${matched.slice(0, 3).join(', ')}`
        : 'Profil proche des compétences demandées',
    )
  }
  if (location >= 0.9) {
    reasons.push(`Même province : ${opportunity.province}`)
  } else if (location > 0.3) {
    reasons.push('Opportunité ouverte aux candidats d’autres régions')
  }
  if (level >= 0.75) {
    reasons.push('Niveau d’expérience compatible')
  }
  if (type >= 0.9) {
    reasons.push('Type d’opportunité correspond à vos préférences')
  }
  if (availability >= 0.8) {
    reasons.push('Compatible avec votre disponibilité')
  }

  if (reasons.length === 0) {
    reasons.push('Opportunité à explorer pour élargir votre horizon')
  }

  return { score, reasons: reasons.slice(0, 4) }
}

export function rankOpportunities(
  profile: CandidateProfile,
  opportunities: Opportunity[],
): { opportunity: Opportunity; match: MatchResult }[] {
  return opportunities
    .map((opportunity) => ({
      opportunity,
      match: scoreOpportunity(profile, opportunity),
    }))
    .sort((a, b) => b.match.score - a.match.score)
}
