import type { CandidateProfile, Opportunity } from '../../../src/types/index.js'

export interface DbOpportunity {
  id: string
  recruiterId: string
  companyName: string
  title: string
  category: string
  description: string
  province: string
  city: string
  opportunityType: string
  requiredSkills: string[]
  level: string
  deadline: Date
  createdAt: Date
  featured: boolean
}

export function toDomainOpportunity(o: DbOpportunity): Opportunity {
  return {
    id: o.id,
    recruiterId: o.recruiterId,
    companyName: o.companyName,
    title: o.title,
    category: o.category,
    description: o.description,
    province: o.province,
    city: o.city,
    opportunityType: o.opportunityType as Opportunity['opportunityType'],
    requiredSkills: o.requiredSkills,
    level: o.level as Opportunity['level'],
    deadline: o.deadline.toISOString(),
    createdAt: o.createdAt.toISOString(),
    featured: o.featured,
  }
}

export interface DbCandidateProfile {
  fullName: string
  phone: string
  province: string
  city: string
  gender: string
  educationLevel: string
  skills: string[]
  experienceLevel: string
  desiredOpportunityTypes: string[]
  availability: string
  cvUrl?: string | null
  cvSkillsSuggested?: string[]
}

export function toDomainCandidateProfile(p: DbCandidateProfile, email = ''): CandidateProfile {
  return {
    fullName: p.fullName,
    email,
    phone: p.phone,
    province: p.province,
    city: p.city,
    gender: p.gender as CandidateProfile['gender'],
    educationLevel: p.educationLevel as CandidateProfile['educationLevel'],
    skills: p.skills,
    experienceLevel: p.experienceLevel as CandidateProfile['experienceLevel'],
    desiredOpportunityTypes: p.desiredOpportunityTypes as CandidateProfile['desiredOpportunityTypes'],
    availability: p.availability as CandidateProfile['availability'],
    cvUrl: p.cvUrl ?? undefined,
    cvSkillsSuggested: p.cvSkillsSuggested ?? [],
  }
}
