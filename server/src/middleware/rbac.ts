import type { NextFunction, Request, Response } from 'express'
import type { UserRole } from '../../../src/types/index.js'
import { isAccountBlocked } from './auth.js'
import { canVerifyCv } from '../lib/cv-access.js'

/**
 * Vérification des CV : admin, ou rôle que l'admin a explicitement habilité
 * (`CvVerifierRole`). L'habilitation est relue en base à chaque requête : un
 * retrait par l'admin prend effet immédiatement.
 */
export async function requireCvVerifier(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.session) {
      res.status(401).json({ error: 'Authentification requise.' })
      return
    }
    if (!(await canVerifyCv(req.session.role))) {
      res.status(403).json({ error: 'Accès refusé pour ce rôle.' })
      return
    }
    if (await isAccountBlocked(req.session.sub)) {
      res.status(403).json({ error: 'Compte suspendu ou banni.' })
      return
    }
    next()
  } catch (err) {
    next(err)
  }
}

/**
 * Ne jamais faire confiance à un rôle envoyé par le client : ce garde relit
 * uniquement `req.session.role`, dérivé du JWT signé côté serveur.
 */
export function requireRole(...roles: UserRole[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.session) {
      res.status(401).json({ error: 'Authentification requise.' })
      return
    }
    if (!roles.includes(req.session.role)) {
      res.status(403).json({ error: 'Accès refusé pour ce rôle.' })
      return
    }
    if (await isAccountBlocked(req.session.sub)) {
      res.status(403).json({ error: 'Compte suspendu ou banni.' })
      return
    }
    next()
  }
}
