import type { UserRole } from '../types'

const HOME_PATH: Record<UserRole, string> = {
  candidate: '/candidat',
  recruiter: '/recruteur',
  particulier: '/particulier',
  admin: '/admin',
  agent: '/agent',
}

/** Espace d'accueil d'un rôle une fois connecté. */
export function homePathForRole(role: UserRole): string {
  return HOME_PATH[role]
}
