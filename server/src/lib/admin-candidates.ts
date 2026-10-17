import type { Prisma, UserRole } from '@prisma/client'
import { parseCvFlags } from './cv-flags.js'

/**
 * Profil candidat CONFIRMÉ vu par l'admin — une seule définition, partagée
 * par l'aperçu « Voir le profil » de la mise en relation
 * (`GET /admin/matching/candidates/:id`) et la fiche des comptes candidats
 * (`GET /admin/candidates/:id`). `select` explicite : jamais de
 * `passwordHash`, ni d'empreinte de fichier, ni des colonnes `cv*` extraites
 * (présentées à part, comme suggestions non confirmées).
 */
export const adminCandidateProfileSelect = {
  fullName: true,
  phone: true,
  province: true,
  city: true,
  gender: true,
  educationLevel: true,
  skills: true,
  experienceLevel: true,
  desiredOpportunityTypes: true,
  availability: true,
  cvUrl: true,
  cvVerificationStatus: true,
  cvFlags: true,
  sector: true,
  matchingConsentAt: true,
} as const satisfies Prisma.CandidateProfileSelect

export type AdminCandidateProfileRow = Prisma.CandidateProfileGetPayload<{
  select: typeof adminCandidateProfileSelect
}>

/** Liste blanche explicite (mêmes clés que l'ancienne réponse de la mise en relation). */
export function toAdminCandidateProfile(p: AdminCandidateProfileRow, user: { email: string; createdAt: Date }) {
  return {
    fullName: p.fullName,
    phone: p.phone,
    province: p.province,
    city: p.city,
    gender: p.gender,
    educationLevel: p.educationLevel,
    skills: p.skills,
    experienceLevel: p.experienceLevel,
    desiredOpportunityTypes: p.desiredOpportunityTypes,
    availability: p.availability,
    cvUrl: p.cvUrl,
    cvVerificationStatus: p.cvVerificationStatus,
    cvFlags: parseCvFlags(p.cvFlags),
    sector: p.sector,
    matchingConsentAt: p.matchingConsentAt ? p.matchingConsentAt.toISOString() : null,
    email: user.email,
    memberSince: user.createdAt.toISOString(),
  }
}

/** Libellé affiché d'un vérificateur de CV — jamais son email. `null` si son compte a été supprimé. */
export function cvVerifierName(
  verifier: {
    role: UserRole
    agentProfile: { fullName: string } | null
    individualProfile: { fullName: string } | null
  } | null,
): string {
  return (
    verifier?.agentProfile?.fullName ??
    verifier?.individualProfile?.fullName ??
    (verifier?.role === 'admin' ? 'Équipe OffRec' : 'Vérificateur OffRec')
  )
}

/** `select` du vérificateur : rôle et nom de profil seulement. */
export const cvVerifierSelect = {
  role: true,
  agentProfile: { select: { fullName: true } },
  individualProfile: { select: { fullName: true } },
} as const satisfies Prisma.UserSelect

// ------------------------------------------------------------------------
// Données extraites du CV (colonnes `cv*`, JSON libre produit par l'IA) :
// relues champ par champ, avec le type attendu — jamais renvoyées telles
// quelles.

function records(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter((v): v is Record<string, unknown> => Boolean(v) && typeof v === 'object' && !Array.isArray(v))
    : []
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null
}

function strList(value: unknown): string[] {
  return Array.isArray(value) ? value.flatMap((v) => (typeof v === 'string' && v.trim() ? [v.trim()] : [])) : []
}

export function normalizeLabel(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase()
}

export interface ExtractedCvSource {
  skills: string[]
  cvSkillsSuggested: string[]
  cvProfessionalTitle: string | null
  cvProfessionalSummary: string | null
  cvExperiences: Prisma.JsonValue
  cvEducation: Prisma.JsonValue
  cvCertifications: Prisma.JsonValue
  cvProjects: Prisma.JsonValue
  cvLanguages: Prisma.JsonValue
  cvTechnologies: string[]
  cvYearsOfExperience: number | null
  cvDesiredLocations: string[]
  cvAvailability: string | null
  cvExtractionConfidence: string
  cvExtractionDate: Date | null
}

/**
 * Suggestions extraites du CV, NON confirmées par le candidat : elles ne
 * modifient jamais le profil et n'entrent dans aucun score. Les compétences
 * détectées déjà présentes dans le profil confirmé sont retirées
 * (comparaison sans casse ni accents).
 */
export function toExtractedCvSuggestions(p: ExtractedCvSource) {
  const confirmed = new Set(p.skills.map(normalizeLabel))
  const seen = new Set<string>()
  const skillsNotInProfile = p.cvSkillsSuggested.filter((skill) => {
    const key = normalizeLabel(skill)
    if (!key || confirmed.has(key) || seen.has(key)) return false
    seen.add(key)
    return true
  })
  const confidence = ['high', 'medium', 'low'].includes(p.cvExtractionConfidence)
    ? (p.cvExtractionConfidence as 'high' | 'medium' | 'low')
    : 'low'
  return {
    extractedAt: p.cvExtractionDate ? p.cvExtractionDate.toISOString() : null,
    confidence,
    professionalTitle: str(p.cvProfessionalTitle),
    professionalSummary: str(p.cvProfessionalSummary),
    yearsOfExperience: p.cvYearsOfExperience,
    skillsNotInProfile,
    technologies: strList(p.cvTechnologies),
    experiences: records(p.cvExperiences).map((e) => ({
      jobTitle: str(e.jobTitle),
      company: str(e.company),
      location: str(e.location),
      startDate: str(e.startDate),
      endDate: str(e.endDate),
      isCurrent: e.isCurrent === true,
      description: str(e.description),
    })),
    education: records(p.cvEducation).map((e) => ({
      degree: str(e.degree),
      school: str(e.school),
      field: str(e.field),
      graduationDate: str(e.graduationDate),
    })),
    certifications: records(p.cvCertifications).map((c) => ({
      name: str(c.name),
      issuer: str(c.issuer),
      issueDate: str(c.issueDate),
    })),
    languages: records(p.cvLanguages).map((l) => ({ name: str(l.name), level: str(l.level) })),
    projects: records(p.cvProjects).map((pr) => ({
      name: str(pr.name),
      role: str(pr.role),
      description: str(pr.description),
    })),
    desiredLocations: strList(p.cvDesiredLocations),
    availability: str(p.cvAvailability),
  }
}
