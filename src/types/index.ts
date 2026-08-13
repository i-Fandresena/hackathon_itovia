export type UserRole = 'candidate' | 'recruiter'

export type EducationLevel =
  | 'bac'
  | 'licence'
  | 'master'
  | 'autodidacte'
  | 'technique'

export type ExperienceLevel =
  | 'debutant'
  | 'junior'
  | 'intermediaire'
  | 'senior'

export type OpportunityType =
  | 'emploi'
  | 'stage'
  | 'mission'
  | 'freelance'
  | 'alternance'

export type Availability = 'immediate' | '1mois' | '3mois' | 'flexible'

export interface CandidateProfile {
  fullName: string
  email: string
  phone: string
  province: string
  city: string
  educationLevel: EducationLevel
  skills: string[]
  experienceLevel: ExperienceLevel
  desiredOpportunityTypes: OpportunityType[]
  availability: Availability
}

export interface RecruiterProfile {
  companyName: string
  email: string
  phone: string
  province: string
  city: string
  sector: string
}

export interface User {
  id: string
  email: string
  password: string
  role: UserRole
  candidateProfile?: CandidateProfile
  recruiterProfile?: RecruiterProfile
  createdAt: string
}

export interface Opportunity {
  id: string
  recruiterId: string
  companyName: string
  title: string
  category: string
  description: string
  province: string
  city: string
  opportunityType: OpportunityType
  requiredSkills: string[]
  level: ExperienceLevel
  deadline: string
  createdAt: string
  featured?: boolean
}

export interface Application {
  id: string
  opportunityId: string
  candidateId: string
  candidateName: string
  candidateEmail: string
  candidatePhone: string
  candidateProvince: string
  message?: string
  createdAt: string
}

export interface Notification {
  id: string
  userId: string
  title: string
  message: string
  read: boolean
  createdAt: string
}

export interface MatchResult {
  score: number
  reasons: string[]
}

export interface ScoredOpportunity {
  opportunity: Opportunity
  match: MatchResult
}

/* -------------------------------------------------------------------------
 * Annuaire de confiance — recommandation de prestataires
 * ---------------------------------------------------------------------- */

/** Preuve jointe à une recommandation. Plus la preuve est forte, plus le
 *  retour pèse dans le score du prestataire. */
export type ProofType = 'facture' | 'photo' | 'aucune'

export type ConfidenceLevel = 'faible' | 'moyenne' | 'forte'

/** Identité communautaire d'un contributeur. Distincte du compte `User` :
 *  c'est elle qui porte la réputation, pas le compte d'authentification. */
export interface Member {
  id: string
  displayName: string
  district: string
  city: string
  joinedAt: string
  phoneVerified: boolean
}

/** Le prestataire recommandé : fournisseur, artisan, transporteur… */
export interface Provider {
  id: string
  name: string
  trade: string
  description: string
  district: string
  city: string
  province: string
  phone: string
  whatsapp?: string
  /** Membre qui a créé la fiche (pas forcément le prestataire lui-même). */
  addedByMemberId: string
  /** Renseigné si le prestataire a revendiqué sa fiche : ses propres
   *  recommandations sont alors exclues du score. */
  claimedByMemberId?: string
  createdAt: string
}

/**
 * L'objet central de la plateforme : un membre atteste d'une expérience
 * réelle avec un prestataire. Une recommandation sans travail réalisé et
 * sans date n'a pas de valeur — les deux sont obligatoires.
 */
export interface Recommendation {
  id: string
  providerId: string
  authorMemberId: string
  /** Dénormalisés pour l'affichage (même convention que `Application`). */
  authorName: string
  authorDistrict: string
  rating: number
  /** Signal le plus fiable : referait-il appel à ce prestataire ? */
  wouldUseAgain: boolean
  /** Le travail réalisé — « Livraison de 3 000 briques à Alasora ». */
  jobLabel: string
  /** Date du travail, différente de la date de publication. */
  jobDate: string
  /** Prix réellement payé, en Ariary. C'est la donnée que personne d'autre
   *  ne publie et qui rend l'annuaire utile. */
  pricePaid?: number
  priceUnit?: string
  comment: string
  proof: ProofType
  /** Membres ayant confirmé ce retour (« j'ai eu la même expérience »). */
  confirmations: string[]
  createdAt: string
}

export interface PriceStat {
  median: number
  unit: string
  sampleSize: number
}

/** Résultat du moteur de confiance — explicable, comme `MatchResult`. */
export interface TrustResult {
  score: number
  confidence: ConfidenceLevel
  /** Somme des poids des retours retenus : « combien de preuve » on a. */
  evidenceWeight: number
  recommendationCount: number
  distinctAuthors: number
  wouldUseAgainRate: number
  lastRecommendedAt: string | null
  price: PriceStat | null
  reasons: string[]
  warnings: string[]
}

export interface ScoredProvider {
  provider: Provider
  trust: TrustResult
}
