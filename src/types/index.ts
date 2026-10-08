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

/** Point relevé automatiquement à l'analyse d'un CV — un indice à
 *  contrôler par un humain, jamais une décision ni une accusation. */
export interface CvFlag {
  code: string
  severity: 'info' | 'alerte'
  message: string
}

/** Vérification humaine du CV par OffRec (admin ou rôle autorisé par
 *  l'admin). Tout nouveau dépôt repart de `non_verifie`. */
export type CvVerificationStatus = 'non_verifie' | 'verifie' | 'rejete'

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
  // === Données extraites du CV ===
  cvExtractedInfo?: {
    firstName: string | null
    lastName: string | null
    email: string | null
    phone: string | null
    city: string | null
    country: string | null
    linkedin: string | null
    github: string | null
    portfolio: string | null
  }
  cvProfessionalTitle?: string | null
  cvProfessionalSummary?: string | null
  cvExperiences?: Array<{
    jobTitle: string
    company: string
    location: string | null
    startDate: string | null
    endDate: string | null
    isCurrent: boolean
    description: string
    technologies: string[]
  }>
  cvEducation?: Array<{
    degree: string
    school: string
    field: string | null
    graduationDate: string | null
    description: string | null
  }>
  cvCertifications?: Array<{
    name: string
    issuer: string
    issueDate: string | null
    expiryDate: string | null
    credentialUrl: string | null
  }>
  cvProjects?: Array<{
    name: string
    description: string
    role: string | null
    startDate: string | null
    endDate: string | null
    technologies: string[]
    url: string | null
  }>
  cvLanguages?: Array<{
    name: string
    level: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2' | 'Natif' | null
  }>
  cvTechnologies?: string[]
  cvYearsOfExperience?: number | null
  cvDesiredLocations?: string[]
  cvAvailability?: string | null
  cvExtractionConfidence?: 'high' | 'medium' | 'low'
  cvExtractionDate?: string
  // === Vérification humaine du CV (lecture seule côté candidat) ===
  cvVerificationStatus?: CvVerificationStatus
  cvFlags?: CvFlag[] | null
  /** Note du vérificateur — renseignée notamment en cas de rejet. */
  cvVerificationNote?: string | null
  cvVerifiedAt?: string | null
  /** Consentement global de matching (décision 2026-10-08) : date ISO à
   *  laquelle le candidat a accepté qu'OffRec propose son profil aux
   *  entreprises ; `null`/absent = jamais donné ou retiré. Lecture seule —
   *  se donne et se retire par les endpoints dédiés, jamais par
   *  l'enregistrement du profil. Jamais transmis au recruteur. */
  matchingConsentAt?: string | null
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
  /** Calculé par le serveur : admin, ou rôle que l'admin a autorisé à
   *  vérifier les CV. Sert uniquement à l'affichage — le serveur revalide. */
  canVerifyCv?: boolean
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

/** OffRec est l'intermédiaire (décisions produit 2026-09-02 et 2026-10-08) :
 *  ni le candidat ni le recruteur n'agissent en direct l'un sur l'autre.
 *  Chaîne en vigueur : `suggeree` (file de validation admin) →
 *  `proposee_recruteur` → `interet_recruteur` → `mise_en_relation`, ou
 *  `ecartee`. Le moteur de matching peut créer directement en
 *  `proposee_recruteur` (score élevé + CV vérifié).
 *  `proposee_candidat` / `interet_candidat` sont des valeurs HÉRITÉES du
 *  parcours « postuler offre par offre » : plus jamais produites, mais des
 *  lignes existantes peuvent encore les porter. */
export type MatchSuggestionStatus =
  | 'suggeree'
  | 'proposee_candidat'
  | 'interet_candidat'
  | 'proposee_recruteur'
  | 'interet_recruteur'
  | 'mise_en_relation'
  | 'ecartee'

/** Qui a créé la suggestion : le moteur de matching ou un admin. */
export type MatchSuggestionOrigin = 'systeme' | 'admin'

export interface MatchSuggestion {
  id: string
  opportunityId: string
  candidateId: string
  score: number
  reasons: string[]
  status: MatchSuggestionStatus
  origin: MatchSuggestionOrigin
  /** Rang dans la présélection ATS au moment de la transmission groupée par
   *  un admin ; `null`/absent pour un envoi direct du moteur ou une
   *  transmission unitaire. */
  preselectionRank?: number | null
  createdAt: string
  updatedAt: string
}

/* -------------------------------------------------------------------------
 * Présélection ATS par offre (couche au-dessus de `scoreOpportunity`)
 * ---------------------------------------------------------------------- */

/** Adéquation d'un profil avec une offre, critère par critère. Calcul
 *  déterministe sur le profil CONFIRMÉ et les attributs de l'offre — jamais
 *  sur les colonnes `cv*`. Ne contient que des données dérivées de champs
 *  que le recruteur a déjà le droit de voir. */
export interface MatchFit {
  skills: {
    /** Compétences requises par l'offre présentes au profil (libellés de l'offre). */
    covered: string[]
    /** Compétences requises par l'offre absentes du profil. */
    missing: string[]
  }
  location: {
    match: 'meme_ville' | 'meme_province' | 'autre'
    /** Lieu de l'offre, rappelé pour l'affichage. */
    province: string
    city: string
  }
  level: {
    required: ExperienceLevel
    candidate: ExperienceLevel
    /** Écart d'au plus un niveau — même définition que la raison « Niveau
     *  d'expérience compatible » de `scoreOpportunity`. */
    conforme: boolean
  }
  type: {
    offered: OpportunityType
    /** `sans_preference` : le candidat n'a déclaré aucun type recherché. */
    match: 'souhaite' | 'sans_preference' | 'non_souhaite'
  }
}

/** Motif d'élimination, dans l'ordre d'évaluation de l'entonnoir. Les quatre
 *  derniers sont des filtres optionnels activés par l'admin. */
export type PreselectionMotif =
  | 'offre_fermee'
  | 'compte_inactif'
  | 'sans_consentement'
  | 'sans_cv'
  | 'deja_ecarte'
  | 'aucune_competence_commune'
  | 'score_insuffisant'
  | 'cv_non_verifie'
  | 'autre_province'
  | 'niveau_non_conforme'
  | 'type_non_souhaite'

/** Filtres éliminatoires optionnels de la présélection. */
export interface PreselectionFilters {
  verifiedOnly: boolean
  sameProvince: boolean
  levelMatch: boolean
  desiredType: boolean
}

export type PreselectionTop = 5 | 10

/** État de la suggestion existante pour la paire (offre, candidat). */
export interface PreselectionSuggestionState {
  id: string
  status: MatchSuggestionStatus
  origin: MatchSuggestionOrigin
}

/** Candidat retenu dans la présélection (vue admin). */
export interface PreselectionEntry {
  rank: number
  candidateId: string
  fullName: string
  email: string
  score: number
  reasons: string[]
  fit: MatchFit
  /** INDICE affiché, jamais décisionnel : compétences requises absentes du
   *  profil mais détectées par l'IA dans le CV (`cvSkillsSuggested`). N'entre
   *  ni dans le score, ni dans les filtres, ni dans le classement. Jamais
   *  transmis au recruteur. */
  cvHintSkills: string[]
  /** Secteur d'intérêt du candidat comparé à celui de l'offre : information
   *  seulement — le secteur est une étiquette, pas un critère. */
  sectorMatch: 'identique' | 'different' | 'non_renseigne'
  cvVerificationStatus: CvVerificationStatus
  cvFlagCount: number
  /** Date ISO du consentement de matching. */
  consentAt: string
  suggestion: PreselectionSuggestionState | null
  /** `false` : déjà transmis ou dossier trop avancé — voir `blockedReason`. */
  transmissible: boolean
  blockedReason: string | null
}

/** Candidat éliminé, avec le premier motif rencontré dans l'entonnoir. */
export interface PreselectionEliminated {
  candidateId: string
  fullName: string
  motif: PreselectionMotif
  motifLabel: string
  /** Score `scoreOpportunity` à titre indicatif. */
  score: number
  suggestion: PreselectionSuggestionState | null
}

export interface PreselectionOpportunity {
  id: string
  title: string
  companyName: string
  category: string
  sector: Sector
  province: string
  city: string
  opportunityType: OpportunityType
  requiredSkills: string[]
  level: ExperienceLevel
  deadline: string
  /** `false` : date limite dépassée ou compte recruteur inactif. */
  open: boolean
  closedReason: string | null
}

export interface PreselectionResult {
  opportunity: PreselectionOpportunity
  top: PreselectionTop
  filters: PreselectionFilters
  /** Score minimum (`MATCH_THRESHOLD`) appliqué par le filtre « score insuffisant ». */
  threshold: number
  counts: {
    /** Tous les comptes candidats évalués. */
    evaluated: number
    eliminated: number
    /** Candidats ayant passé tous les filtres (avant coupe au top N). */
    qualified: number
    /** Candidats affichés : `min(top, qualified)`. */
    retained: number
    /** Éliminés par motif, dans l'ordre de l'entonnoir (motifs à zéro omis). */
    byMotif: { motif: PreselectionMotif; label: string; count: number }[]
  }
  ranked: PreselectionEntry[]
  eliminated: PreselectionEliminated[]
}

/** Compte rendu, par candidat, d'une transmission groupée au recruteur. */
export interface PreselectionTransmitOutcome {
  candidateId: string
  fullName: string | null
  transmitted: boolean
  /** Raison du refus, `null` si transmis. */
  reason: string | null
  rank: number | null
  suggestionId: string | null
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
