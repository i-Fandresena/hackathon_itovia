import type { EndorsementRelation, TalentStatus, TrustLevel } from '../types/index.js'

/**
 * Recommandations de talents et d'entreprises — libellés et listes fermées.
 * Fichier partagé avec le serveur (validation Zod) : aucune API navigateur.
 * Les points forts sont uniquement positifs ; un problème grave passe par un
 * signalement privé, jamais par une recommandation.
 */

export const TRUST_LEVEL_LABELS: Record<TrustLevel, string> = {
  nouveau: 'Nouveau',
  recommande: 'Recommandé',
  tres_recommande: 'Très recommandé',
}

export const TALENT_HIGHLIGHTS = [
  'Travail soigné',
  'Ponctuel·le',
  'Prix respecté',
  'Honnête',
  'Délais tenus',
  'Bon conseil',
  'Propre et ordonné·e',
  'Communique bien',
] as const

export const COMPANY_HIGHLIGHTS = [
  'Paie à l’heure',
  'Respecte le contrat',
  'Forme ses équipes',
  'Sécurité respectée',
  'Bonne ambiance',
  'Horaires respectés',
  'Déclare ses salariés',
] as const

export type TalentHighlight = (typeof TALENT_HIGHLIGHTS)[number]
export type CompanyHighlight = (typeof COMPANY_HIGHLIGHTS)[number]

export const RELATION_LABELS: Record<EndorsementRelation, string> = {
  client: 'Client',
  employeur: 'Employeur',
  collegue: 'Collègue',
  salarie: 'Salarié·e',
  stagiaire: 'Stagiaire',
  prestataire: 'Prestataire',
}

/** Relations possibles quand on recommande un talent. */
export const TALENT_RELATIONS = ['client', 'employeur', 'collegue'] as const satisfies readonly EndorsementRelation[]

/** Relations possibles quand on recommande une entreprise. */
export const COMPANY_RELATIONS = ['salarie', 'stagiaire', 'prestataire'] as const satisfies readonly EndorsementRelation[]

/**
 * Nombre minimal de recommandations retenues avant d'afficher publiquement
 * la répartition par relation d'une entreprise : en dessous, « 1 stagiaire »
 * suffirait à l'employeur pour reconnaître l'auteur.
 */
export const COMPANY_RELATION_MIN = 3

/** « 1 ancien salarié », « 3 anciens salariés », « 2 stagiaires »… */
export function companyRelationCount(relation: (typeof COMPANY_RELATIONS)[number], n: number): string {
  const many = n > 1
  if (relation === 'salarie') return `${n} ${many ? 'anciens salariés' : 'ancien salarié'}`
  if (relation === 'stagiaire') return `${n} ${many ? 'stagiaires' : 'stagiaire'}`
  return `${n} ${many ? 'prestataires' : 'prestataire'}`
}

/**
 * Statut du profil de talent (suivi par l'agent). La valeur `recommande`
 * signifie « proposé à une offre par l'agent » : libellé distinct de la
 * confiance (« Recommandé » = niveau issu des recommandations) pour éviter
 * toute confusion. Valeur d'enum inchangée.
 */
export const TALENT_STATUS_LABELS: Record<TalentStatus, string> = {
  en_attente: 'En attente de vérification',
  verifie: 'Vérifié',
  recommande: 'Proposé à une offre',
  place: 'Placé',
}
