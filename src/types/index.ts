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
  /** Accord de la personne recueilli par l'agent ; `null` : profil
   *  antérieur, accord non tracé. */
  consentAt?: string | null
  /** Quartier déclaré (facultatif). */
  district?: string | null
  /** Accord explicite de visibilité publique (« Talents recommandés »),
   *  distinct de `consentAt`, révocable ; `null` : pas de fiche publique. */
  publicConsentAt?: string | null
  /** Identifiant public aléatoire de la fiche, régénéré à chaque accord. */
  publicRef?: string | null
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
  /** Suggestions (`COMMON_SKILLS`) ou saisies libres du recruteur — règles
   *  dans `src/lib/opportunityFields.ts`. */
  requiredSkills: string[]
  /** Missions du poste, dans l'ordre choisi par le recruteur (`[]` si aucune).
   *  Montrées au candidat avant la mise en relation : jamais de nom
   *  d'entreprise ni de coordonnées (`src/lib/opportunityFields.ts`). */
  missions: string[]
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
 * Entretiens (décision produit 2026-10-14) — miroir de Prisma `Interview`
 * ---------------------------------------------------------------------- */

/** `planifie` : en attente de la réponse du candidat ; `confirme` /
 *  `empechement` : réponse du candidat ; `annule` : annulé par le recruteur. */
export type InterviewStatus = 'planifie' | 'confirme' | 'empechement' | 'annule'

/** Agenda utilisé : vrai agenda Google d'OffRec, ou mode simulé (aucun
 *  identifiant configuré, développement). */
export type InterviewProvider = 'google' | 'simule'

/** `disponible` : lien Google Meet généré ; `en_attente` : Google a échoué,
 *  lien à régulariser par OffRec ; `simule` : aucun lien n'existe. */
export type InterviewMeetStatus = 'disponible' | 'en_attente' | 'simule'

export type InterviewDuration = 30 | 45 | 60

/** Période des listes « Entretiens » (recruteur, admin) : `a_venir` =
 *  non annulé et pas encore terminé ; `passes` = non annulé et terminé ;
 *  `annules` ; `tous`. Voir `interviewPeriodOf()` (src/lib/interview.ts). */
export type InterviewPeriod = 'a_venir' | 'passes' | 'annules' | 'tous'

/** Entretien tel que le candidat et le recruteur le voient : jamais
 *  l'identifiant de l'événement Google, l'erreur technique ni l'auteur. */
export interface Interview {
  id: string
  suggestionId: string
  /** Instant de début (ISO, UTC) — à afficher en heure de Madagascar. */
  scheduledAt: string
  durationMinutes: number
  message: string | null
  status: InterviewStatus
  provider: InterviewProvider
  meetStatus: InterviewMeetStatus
  /** `null` sans lien, et toujours `null` une fois l'entretien annulé. */
  meetUrl: string | null
  declineReason: string | null
  respondedAt: string | null
  cancelledAt: string | null
  rescheduleCount: number
  createdAt: string
  updatedAt: string
}

/** Vue admin : en plus, l'état de synchronisation de l'agenda Google. */
export interface AdminInterview extends Interview {
  /** Dernier échec de synchronisation (message court), `null` si à jour. */
  calendarError: string | null
  hasGoogleEvent: boolean
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
  missions: string[]
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

/**
 * Origine d'une notification destinée aux administrateurs — miroir de l'enum
 * Prisma `NotificationCategory`. Sert uniquement de filtre d'affichage.
 */
export type NotificationCategory = 'candidat' | 'recruteur' | 'agent' | 'systeme' | 'moderation' | 'annuaire'

export const NOTIFICATION_CATEGORIES: readonly NotificationCategory[] = [
  'candidat',
  'recruteur',
  'agent',
  'systeme',
  'moderation',
  'annuaire',
]

export interface Notification {
  id: string
  userId: string
  title: string
  message: string
  /** Absente ou `null` : notification personnelle, ou antérieure aux catégories. */
  category?: NotificationCategory | null
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

/* -------------------------------------------------------------------------
 * Recommandations de talents et d'entreprises — confiance par niveaux
 * ---------------------------------------------------------------------- */

/** Niveau de confiance affiché d'un talent ou d'une entreprise. */
export type TrustLevel = 'nouveau' | 'recommande' | 'tres_recommande'

/** Lien entre l'auteur d'une recommandation et la personne ou l'entreprise
 *  recommandée. Talent : client, employeur, collègue ; entreprise : salarié,
 *  stagiaire, prestataire. */
export type EndorsementRelation =
  | 'client'
  | 'employeur'
  | 'collegue'
  | 'salarie'
  | 'stagiaire'
  | 'prestataire'

/** Ce qu'il faut savoir de l'auteur pour calculer sa fiabilité. */
export interface AuthorStats {
  phoneVerified: boolean
  joinedAt: string
  /** Retours publiés par l'auteur, annuaire et recommandations confondus. */
  authoredCount: number
  /** Confirmations reçues au total sur ces retours. */
  confirmationsReceived: number
}

/**
 * Une recommandation vue par le moteur, quel que soit son sujet. Construite
 * côté serveur : `authorLinkKey` est une empreinte opaque (jamais un
 * téléphone) qui ne doit pas être envoyée au client.
 */
export interface TrustEvidence {
  id: string
  authorMemberId: string
  /** Empreinte d'auteur : deux recommandations de même empreinte forment
   *  une seule source. `null` si inconnue. */
  authorLinkKey: string | null
  authorDistrict: string
  /** `null` : auteur inconnu, fiabilité par défaut (0,3). */
  author: AuthorStats | null
  proof: ProofType
  /** Seule une preuve acceptée par un agent pèse ; sinon `aucune`. */
  proofAccepted: boolean | null
  jobDate: string
  createdAt: string
  confirmations: number
  /** Renseigné quand un agent a écarté la recommandation : elle ne compte plus. */
  excludedAt: string | null
}

/** Résultat de `evaluateSubject` — explicable, comme `TrustResult`. */
export interface SubjectTrust {
  /** Indice 0–100, `null` tant que le niveau est « Nouveau ». */
  index: number | null
  level: TrustLevel
  /** Recommandations retenues (une par auteur, exclusions retirées). */
  recommendationCount: number
  independentSources: number
  sourcesWithProof: number
  /** Somme des poids effectifs, diversité comprise (E). */
  evidenceWeight: number
  lastJobAt: string | null
  reasons: string[]
  warnings: string[]
}

/** Cycle de vie d'un signal de talent recommandé (file des agents). */
export type TalentSignalStatus =
  | 'nouveau'
  | 'pris_en_charge'
  | 'converti'
  | 'refuse'
  | 'injoignable'
  | 'expire'
  | 'fusionne'

/* -------------------------------------------------------------------------
 * Vitrine publique « Talents recommandés » et demandes de contact via OffRec
 * ---------------------------------------------------------------------- */

/**
 * Fiche publique d'un talent : LISTE BLANCHE exacte de ce que voit un
 * visiteur. Jamais de nom (même partiel), téléphone, id interne, photo,
 * agent, commentaire, libellé de travail ni auteur.
 */
export interface PublicTalent {
  /** Identifiant public aléatoire (10 caractères) — jamais l'id du profil. */
  publicRef: string
  trade: string
  sector: Sector
  city: string
  district: string | null
  level: TrustLevel
  independentSources: number
  /** Les 3 points forts les plus cités (liste fermée). */
  highlights: string[]
  /** Mois de la dernière vérification par un agent, `AAAA-MM`. */
  verifiedMonth: string | null
}

/** État de la visibilité publique, vu par l'agent du talent (et l'admin). */
export interface PublicVisibilityState {
  granted: boolean
  publicConsentAt: string | null
  publicRef: string | null
  /** Accord donné et toutes les conditions réunies : la fiche est en ligne. */
  visible: boolean
  /** Conditions manquantes pour publier. */
  blockers: string[]
}

export type ContactRequestStatus = 'nouvelle' | 'transmise' | 'close'

/* -------------------------------------------------------------------------
 * Entreprises recommandées (anciens salariés, stagiaires, prestataires)
 * ---------------------------------------------------------------------- */

/** Relations possibles d'un auteur avec une entreprise. */
export type CompanyRelation = 'salarie' | 'stagiaire' | 'prestataire'

/** Point fort cité et nombre de recommandations retenues qui le citent. */
export interface HighlightCount {
  label: string
  count: number
}

/**
 * Fiche publique d'une entreprise : LISTE BLANCHE exacte de ce que voit un
 * visiteur (et la vitrine). Jamais d'auteur (même pseudonyme), de quartier
 * d'auteur, de commentaire, de libellé de poste, de date de travail, de
 * preuve, ni de compte recruteur lié.
 */
export interface PublicCompany {
  id: string
  name: string
  sector: Sector
  city: string
  level: TrustLevel
  /** Sources indépendantes (moteur `evaluateSubject`). */
  independentSources: number
  /**
   * Répartition des recommandations retenues par relation (« 3 anciens
   * salariés, 1 stagiaire »). `null` tant qu'il y a moins de
   * `COMPANY_RELATION_MIN` recommandations retenues : un petit effectif
   * permettrait à l'employeur de deviner l'auteur.
   */
  relations: Record<CompanyRelation, number> | null
  /** Décompte des points forts cités (liste fermée), du plus cité au moins cité. */
  highlights: HighlightCount[]
}

/** Encart du recruteur lié : niveau, nombre, points forts — jamais d'auteur ni de commentaire. */
export interface LinkedCompanySummary {
  id: string
  name: string
  sector: Sector
  city: string
  level: TrustLevel
  recommendationCount: number
  independentSources: number
  highlights: HighlightCount[]
}
