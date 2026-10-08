import type { UserRole } from '../../../src/types/index.js'
import { prisma } from './prisma.js'

/**
 * Rôles que l'admin peut habiliter à vérifier les CV.
 *
 * Exclus volontairement :
 * - `candidate` et `talent` : conflit d'intérêts (ils sont eux-mêmes évalués) ;
 * - `recruiter` : candidats et recruteurs n'accèdent jamais directement aux
 *   coordonnées de l'autre (invariant « OffRec intermédiaire », décision
 *   2026-09-02) — or vérifier un CV donne accès au fichier et aux coordonnées.
 * `admin` n'y figure pas : il peut toujours vérifier, sans ligne en base.
 */
export const GRANTABLE_CV_VERIFIER_ROLES: readonly UserRole[] = ['agent', 'particulier']

/** Rôles actuellement habilités par l'admin (hors admin lui-même). */
export async function listCvVerifierRoles(): Promise<UserRole[]> {
  const rows = await prisma.cvVerifierRole.findMany({ select: { role: true } })
  // Filtre défensif : une ligne résiduelle pour un rôle devenu non
  // habilitable ne doit jamais ouvrir l'accès.
  return GRANTABLE_CV_VERIFIER_ROLES.filter((role) => rows.some((row) => row.role === role))
}

/** Vrai pour `admin`, ou pour un rôle habilitable ayant une ligne `CvVerifierRole`. */
export async function canVerifyCv(role: UserRole): Promise<boolean> {
  if (role === 'admin') return true
  if (!GRANTABLE_CV_VERIFIER_ROLES.includes(role)) return false
  const row = await prisma.cvVerifierRole.findUnique({ where: { role }, select: { role: true } })
  return Boolean(row)
}
