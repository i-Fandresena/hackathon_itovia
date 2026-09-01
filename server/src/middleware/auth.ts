import type { NextFunction, Request, Response } from 'express'
import { verifySession, type SessionPayload } from '../lib/jwt.js'
import { prisma } from '../lib/prisma.js'

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      session?: SessionPayload
    }
  }
}

export function attachSession(req: Request, _res: Response, next: NextFunction): void {
  const cookieName = process.env.COOKIE_NAME ?? 'offrec_session'
  const token = req.cookies?.[cookieName]
  if (token) {
    try {
      req.session = verifySession(token)
    } catch {
      req.session = undefined
    }
  }
  next()
}

/**
 * Un compte suspendu/banni perd l'accès immédiatement, même avec un JWT
 * encore valide : on revérifie le statut en base à chaque requête protégée.
 * Utilisé par `requireAuth` et par `requireRole` (celui-ci ne suppose pas
 * que `requireAuth` a déjà tourné avant lui).
 */
export async function isAccountBlocked(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { status: true } })
  return !user || user.status === 'suspended' || user.status === 'banned'
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.session) {
    res.status(401).json({ error: 'Authentification requise.' })
    return
  }
  if (await isAccountBlocked(req.session.sub)) {
    res.status(403).json({ error: 'Compte suspendu ou banni.' })
    return
  }
  next()
}
