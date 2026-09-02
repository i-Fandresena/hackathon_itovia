import type {
  Availability,
  ConfidenceLevel,
  EducationLevel,
  ExperienceLevel,
  Gender,
  OpportunityType,
  ProofType,
  Sector,
} from '../types/index.js'

export const PROVINCES = [
  'Antananarivo',
  'Toamasina',
  'Fianarantsoa',
  'Mahajanga',
  'Toliara',
  'Antsiranana',
] as const

export const CATEGORIES = [
  'Administration',
  'Marketing',
  'IT / Digital',
  'Ventes',
  'Design',
  'Logistique',
  'Community management',
  'Saisie de données',
  'Services freelance',
] as const

export const COMMON_SKILLS = [
  'Excel',
  'Word',
  'Communication',
  'Français',
  'Malagasy',
  'Anglais',
  'Réseaux sociaux',
  'Canva',
  'JavaScript',
  'React',
  'Python',
  'SQL',
  'Photoshop',
  'Gestion de projet',
  'Service client',
  'Comptabilité',
  'Rédaction',
  'SEO',
  'Community management',
  'Logistique',
  'Livraison',
  'Vente terrain',
] as const

export const EDUCATION_LABELS: Record<EducationLevel, string> = {
  bac: 'Baccalauréat',
  licence: 'Licence',
  master: 'Master',
  autodidacte: 'Autodidacte',
  technique: 'Formation technique',
}

export const EXPERIENCE_LABELS: Record<ExperienceLevel, string> = {
  debutant: 'Débutant',
  junior: 'Junior (1–2 ans)',
  intermediaire: 'Intermédiaire (3–5 ans)',
  senior: 'Senior (5+ ans)',
}

export const OPPORTUNITY_TYPE_LABELS: Record<OpportunityType, string> = {
  emploi: 'Emploi',
  stage: 'Stage',
  mission: 'Mission courte',
  freelance: 'Freelance',
  alternance: 'Alternance',
}

export const AVAILABILITY_LABELS: Record<Availability, string> = {
  immediate: 'Disponible immédiatement',
  m1: 'Dans 1 mois',
  m3: 'Dans 3 mois',
  flexible: 'Flexible',
}

export const GENDER_LABELS: Record<Gender, string> = {
  femme: 'Femme',
  homme: 'Homme',
  autre: 'Autre / préfère ne pas préciser',
}

/* -------------------------------------------------------------------------
 * Taxonomie secteur — filtre transversal (candidats, entreprises, talents,
 * offres), jamais une section de navigation séparée au stade pilote.
 * ---------------------------------------------------------------------- */

export const SECTORS: Sector[] = [
  'btp',
  'textile_artisanat',
  'digital',
  'agroalimentaire',
  'services_commerce',
  'autre',
]

export const SECTOR_LABELS: Record<Sector, string> = {
  btp: 'BTP / Construction',
  textile_artisanat: 'Textile / Artisanat',
  digital: 'Digital',
  agroalimentaire: 'Agroalimentaire',
  services_commerce: 'Services / Commerce',
  autre: 'Autre',
}

/** Libellés des champs additionnels par secteur (`Opportunity.sectorDetails`)
 *  — affichage seulement, la clé technique reste en camelCase en base. */
export const SECTOR_DETAIL_LABELS: Record<string, string> = {
  outils: 'Outils requis',
  chantier: 'Infos chantier',
  transport: 'Transport / logement',
  stackTechnique: 'Stack technique',
  teletravail: 'Télétravail',
}

/** Secteurs mis en avant pour le pilote — densité plutôt que dilution
 *  (150-200 profils visés sur 6 mois, une seule région) : les autres
 *  secteurs restent sélectionnables, juste pas mis en avant. */
export const ACTIVE_SECTORS: Sector[] = ['btp', 'textile_artisanat', 'digital']

export const STATS = {
  opportunities: 240,
  candidates: 1800,
  recruiters: 120,
  provinces: 6,
}

/* -------------------------------------------------------------------------
 * Annuaire de confiance — verticale construction, Antananarivo
 * ---------------------------------------------------------------------- */

export const TRADES = [
  'Fournisseur de briques',
  'Fournisseur ciment / fer',
  'Maçon',
  'Charpentier',
  'Menuisier',
  'Plombier',
  'Électricien',
  'Peintre',
  'Carreleur',
  'Soudeur / ferronnier',
  'Transport de matériaux',
  'Terrassement',
  'Puisatier',
  'Dessinateur / architecte',
  'Couturière',
  'Tisserand',
  'Cordonnier',
  'Brodeuse',
  'Développeur web',
  'Community manager',
  'Graphiste',
] as const

/** Secteur associé à chaque métier — dérive `sector` depuis `trade` pour
 *  éviter de faire ressaisir la même information deux fois. */
export const TRADE_SECTOR: Record<(typeof TRADES)[number], Sector> = {
  'Fournisseur de briques': 'btp',
  'Fournisseur ciment / fer': 'btp',
  Maçon: 'btp',
  Charpentier: 'btp',
  Menuisier: 'btp',
  Plombier: 'btp',
  Électricien: 'btp',
  Peintre: 'btp',
  Carreleur: 'btp',
  'Soudeur / ferronnier': 'btp',
  'Transport de matériaux': 'btp',
  Terrassement: 'btp',
  Puisatier: 'btp',
  'Dessinateur / architecte': 'btp',
  Couturière: 'textile_artisanat',
  Tisserand: 'textile_artisanat',
  Cordonnier: 'textile_artisanat',
  Brodeuse: 'textile_artisanat',
  'Développeur web': 'digital',
  'Community manager': 'digital',
  Graphiste: 'digital',
}

/** Quartiers et communes de l'agglomération d'Antananarivo. La maille est
 *  volontairement fine : « à Tana » ne sert à rien, « à Alasora » si. */
export const DISTRICTS = [
  'Alasora',
  'Ambanidia',
  'Ambatobe',
  'Ambohibao',
  'Ambohimanarina',
  'Ambohimangakely',
  'Ampitatafika',
  'Analakely',
  'Analamahitsy',
  'Andoharanofotsy',
  'Andraharo',
  'Ankadikely Ilafy',
  'Ankorondrano',
  'Anosizato',
  'Isotry',
  'Itaosy',
  'Ivandry',
  'Ivato',
  'Mahamasina',
  'Sabotsy Namehana',
  'Talatamaty',
  'Tanjombato',
] as const

export const PRICE_UNITS = [
  'par unité',
  'par brique',
  'par sac',
  'par m²',
  'par m³',
  'par jour',
  'par voyage',
  'forfait',
] as const

export const PROOF_LABELS: Record<ProofType, string> = {
  facture: 'Facture ou reçu',
  photo: 'Photo du travail',
  aucune: 'Aucune preuve',
}

export const CONFIDENCE_LABELS: Record<ConfidenceLevel, string> = {
  faible: 'Confiance faible',
  moyenne: 'Confiance moyenne',
  forte: 'Confiance forte',
}
