import type { NextFunction, Request, Response } from 'express'
import { ZodError } from 'zod'

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof ZodError) {
    res.status(400).json({ error: 'Données invalides.', details: err.flatten() })
    return
  }
  if (err instanceof Error) {
    console.error(err)
    res.status(500).json({ error: 'Erreur serveur.' })
    return
  }
  console.error('Erreur inconnue', err)
  res.status(500).json({ error: 'Erreur serveur.' })
}

export function notFound(_req: Request, res: Response): void {
  res.status(404).json({ error: 'Ressource introuvable.' })
}
