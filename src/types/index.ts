export type UserRole = 'candidate' | 'recruiter' | 'particulier' | 'admin' | 'agent' | 'talent'

export type Gender = 'femme' | 'homme' | 'autre'

/** Pipeline talent non-diplômé : jamais automatique au-delà d'une action
 *  explicite de l'agent qui le suit. */
export type TalentStatus = 'en_attente' | 'verifie' | 'recommande' | 'place'

export type ApplicationStatus = 'envoyee' | 'vue' | 'contactee' | 'refusee'

export type AccountTier = 'gratuit' | 'premium'

/** Suivi déclaratif du success fee — jamais de paiement automatisé au MVP. */
export type PlacementStage =
  | 'etape1_due'
  | 'etape1_payee'
  | 'etape2_due'
  | 'etape2_payee'
  | 'annule'

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

export type Availability = 'immediate' | 'm1' | 'm3' | 'flexible'

/** Taxonomie transversale par secteur d'activité — un filtre partagé par
 *  candidats, entreprises, talents et offres, jamais une section de
 *  navigation séparée tant que le pilote n'a pas prouvé une densité
 *  suffisante par secteur. */
export type Sector =
  | 'btp'
  | 'textile_artisanat'
  | 'digital'
  | 'agroalimentaire'
  | 'services_commerce'
  | 'autre'

/** Pipeline de la demande de contact "non-diplômé" à l'inscription — ne
 *  crée jamais de compte ni de TalentProfile directement (§7.3.14) : un
 *  agent reprend la demande et crée lui-même le profil. */
export type LeadStatus = 'nouveau' | 'contacte' | 'converti' | 'ignore'

export interface CandidateProfile {
  fullName: string
  email: string
  phone: string
  province: string
  city: string
  gender: Gender
  educationLevel: EducationLevel
  skills: string[]
  experienceLevel: ExperienceLevel
  desiredOpportunityTypes: OpportunityType[]
  availability: Availability
  cvUrl?: string
  cvSkillsSuggested?: string[]
  /** Secteur d'intérêt déclaré — tag de filtrage, jamais une contrainte de matching. */
  sector?: Sector
}

export interface RecruiterProfile {
  companyName: string
  email: string
  phone: string
  province: string
  city: string
  sector: Sector
  tier?: AccountTier
}

/** Profil d'un particulier qui recherche un professionnel (hors recrutement). */
export interface IndividualProfile {
  fullName: string
  email: string
  phone: string
  province: string
  city: string
}

/** Profil d'un agent de terrain (verticale emploi vérifié). */
export interface AgentProfile {
  fullName: string
  email: string
  phone: string
  province: string
  city: string
}

export interface User {
  id: string
  email: string
  password: string
  role: UserRole
  candidateProfile?: CandidateProfile
  recruiterProfile?: RecruiterProfile
  individualProfile?: IndividualProfile
  agentProfile?: AgentProfile
  talentAccountProfile?: TalentAccountProfile
  createdAt: string
}

/** Talent non-diplômé : créé et géré uniquement par l'agent qui le suit,
 *  pas de compte de connexion propre au MVP. */
export interface TalentProfile {
  id: string
  agentId: string
  fullName: string
  phone: string
  province: string
  city: string
  gender: Gender
  /** Métier déclaré à la création — pilote la grille de vérification
   *  standardisée (§7.3.15), voir data/verificationGrids.ts. */
  trade: string
  sector: Sector
  skills: string[]
  availability: Availability
  status: TalentStatus
  createdAt: string
  updatedAt: string
}

/** Demande de contact "non-diplômé" déposée en self-service à
 *  l'inscription (voir TalentProfile — ne crée jamais de compte). */
export interface TalentLead {
  id: string
  fullName: string
  phone: string
  province: string
  city: string
  gender: Gender
  trade: string
  sector: Sector
  message?: string
  status: LeadStatus
  createdAt: string
}

export type SourcingLeadType = 'talent' | 'opportunity'

/** Piste de veille journalisée par un agent — un signal repéré en ligne ou
 *  sur le terrain, jamais un profil ni une offre publiée en soi tant que
 *  l'agent n'a pas vérifié réellement (§7.3.15). */
export interface SourcingLead {
  id: string
  agentId: string
  type: SourcingLeadType
  source: string
  sourceUrl?: string | null
  trade: string
  sector: Sector
  province: string
  city: string
  description: string
  status: LeadStatus
  talentId?: string | null
  createdAt: string
  updatedAt: string
}

/** Compte de suivi d'un talent non-diplômé — observe son statut, ne peut
 *  jamais créer ni modifier son propre TalentProfile (§7.3.14). */
export interface TalentAccountProfile {
  fullName: string
  email: string
  phone: string
  province: string
  city: string
  gender: Gender
  leadId?: string
  talentId?: string
}

export interface TalentVerification {
  id: string
  talentId: string
  trade: string
  checklist: Record<string, boolean>
  note?: string
  verifiedAt: string
}

export interface TalentOpportunityProposal {
  id: string
  talentId: string
  opportunityId: string
  proposedAt: string
}

/** Mise en relation aboutie, porteuse du suivi success fee. Exactement un
 *  de candidateId/talentId est renseigné. */
export interface Placement {
  id: string
  opportunityId?: string
  recruiterId: string
  candidateId?: string
  talentId?: string
  monthlySalaryAr?: number
  stage: PlacementStage
  createdAt: string
  updatedAt: string
}

export interface Opportunity {
  id: string
  recruiterId: string
  companyName: string
  title: string
  category: string
  sector: Sector
  /** Champs additionnels propres au secteur (ex. outils/chantier pour le
   *  BTP, stack technique pour le digital) — absent pour les secteurs qui
   *  n'en définissent pas. */
  sectorDetails?: Record<string, string | boolean>
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
  status: ApplicationStatus
  createdAt: string
}

/** OffRec est l'intermédiaire (décision produit 2026-09-02) : ni le
 *  candidat ni le recruteur n'agissent en direct l'un sur l'autre, tout
 *  passe par une décision admin. Jamais de saut d'étape. */
export type MatchSuggestionStatus =
  | 'proposee_candidat'
  | 'interet_candidat'
  | 'proposee_recruteur'
  | 'interet_recruteur'
  | 'mise_en_relation'
  | 'ecartee'

export interface MatchSuggestion {
  id: string
  opportunityId: string
  candidateId: string
  score: number
  reasons: string[]
  status: MatchSuggestionStatus
  createdAt: string
  updatedAt: string
}

export interface Notification {
  id: string
  userId: string
  title: string
  message: string
  /** Chemin frontend vers la source de la notification — absent si non cliquable. */
  link?: string | null
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
