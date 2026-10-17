import { scoreOpportunity } from '../../../src/lib/recommendation.js'
import type { CandidateProfile, MatchResult } from '../../../src/types/index.js'
import { toDomainOpportunity, type DbOpportunity } from './domain.js'

/**
 * Adéquation talent ↔ offre : adaptateur vers `scoreOpportunity()`, appelée
 * SANS modification (mêmes poids que pour les diplômés). Un talent n'a ni
 * niveau d'études, ni niveau d'expérience, ni types d'offre souhaités :
 * - compétences = compétences déclarées + métier ;
 * - `experienceLevel` inconnu → `levelMatch` neutre (0,5) — cast documenté ;
 * - `desiredOpportunityTypes: []` → `typeMatch` neutre (0,5) ;
 * d'où un plafond d'environ 84 %. Ce score n'est JAMAIS mélangé à celui des
 * diplômés ni additionné à la confiance.
 */

export interface MatchableTalent {
  fullName: string
  phone: string
  province: string
  city: string
  gender: string
  trade: string
  skills: string[]
  availability: string
}

export function talentAsMatchProfile(t: MatchableTalent): CandidateProfile {
  const seen = new Set<string>()
  const skills = [...t.skills, t.trade].filter((s) => {
    const key = s.trim().toLowerCase()
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
  return {
    fullName: t.fullName,
    email: '',
    phone: t.phone,
    province: t.province,
    city: t.city,
    gender: t.gender as CandidateProfile['gender'],
    // Inconnus pour un talent : valeurs hors liste → critères neutres dans scoreOpportunity.
    educationLevel: '' as CandidateProfile['educationLevel'],
    experienceLevel: '' as CandidateProfile['experienceLevel'],
    desiredOpportunityTypes: [],
    skills,
    availability: t.availability as CandidateProfile['availability'],
  }
}

export function talentMatch(t: MatchableTalent, opportunity: DbOpportunity): MatchResult {
  return scoreOpportunity(talentAsMatchProfile(t), toDomainOpportunity(opportunity))
}
