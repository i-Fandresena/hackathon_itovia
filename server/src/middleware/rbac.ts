import type { NextFunction, Request, Response } from 'express'
import type { UserRole } from '../../../src/types/index.js'
import { isAccountBlocked } from './auth.js'

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
