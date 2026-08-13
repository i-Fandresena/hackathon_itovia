import type {
  Availability,
  ConfidenceLevel,
  EducationLevel,
  ExperienceLevel,
  OpportunityType,
  ProofType,
} from '../types'

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
  '1mois': 'Dans 1 mois',
  '3mois': 'Dans 3 mois',
  flexible: 'Flexible',
}

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
] as const

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
