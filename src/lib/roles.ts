import type { UserRole } from '../types'

const HOME_PATH: Record<UserRole, string> = {
  candidate: '/candidat',
  recruiter: '/recruteur',
  particulier: '/particulier',
  admin: '/admin',
  agent: '/agent',
  talent: '/mon-espace',
}

/** Libellés français des rôles — source unique (carte de profil du rail,
 *  réglage « qui peut vérifier les CV »). */
export const ROLE_LABELS: Record<UserRole, string> = {
  candidate: 'Candidat',
  recruiter: 'Recruteur',
  particulier: 'Particulier',
  admin: 'Administrateur',
  agent: 'Agent de terrain',
  talent: 'Compte de suivi',
}

/** Espace d'accueil d'un rôle une fois connecté. */
export function homePathForRole(role: UserRole): string {
  return HOME_PATH[role]
}
