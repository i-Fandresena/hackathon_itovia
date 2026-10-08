import { Router } from 'express'
import { access } from 'node:fs/promises'
import path from 'node:path'
import { prisma } from '../lib/prisma.js'
import { isAccountBlocked } from '../middleware/auth.js'
import { canVerifyCv } from '../lib/cv-access.js'

/**
 * Accès authentifié aux fichiers déposés — remplace l'ancien `express.static`
 * public. Un CV contient des coordonnées : il n'est lisible que par le
 * candidat propriétaire, un admin, ou un vérificateur habilité.
 *
 * L'URL reste `/uploads/cv/<uuid>.pdf` : le frontend l'ouvre par un lien, le
 * cookie de session accompagne la requête.
 */
const router = Router()

/** Seuls les noms générés par le dépôt (`randomUUID().pdf`) sont acceptés : aucun path traversal possible. */
const CV_FILE_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$/

const CV_DIR = path.resolve(process.cwd(), 'uploads', 'cv')

router.get('/cv/:file', async (req, res, next) => {
  try {
    if (!req.session) {
      res.status(401).json({ error: 'Authentification requise.' })
      return
    }
    const fileName = req.params.file
    if (!CV_FILE_PATTERN.test(fileName)) {
      res.status(404).json({ error: 'Fichier introuvable.' })
      return
    }
    if (await isAccountBlocked(req.session.sub)) {
      res.status(403).json({ error: 'Compte suspendu ou banni.' })
      return
    }

    const fileUrl = `/uploads/cv/${fileName}`
    let allowed = await canVerifyCv(req.session.role)
    if (!allowed && req.session.role === 'candidate') {
      const [profile, submission] = await Promise.all([
        prisma.candidateProfile.findFirst({
          where: { userId: req.session.sub, cvUrl: fileUrl },
          select: { userId: true },
        }),
        prisma.cvSubmission.findFirst({
          where: { candidateId: req.session.sub, fileUrl },
          select: { id: true },
        }),
      ])
      allowed = Boolean(profile || submission)
    }
    if (!allowed) {
      res.status(403).json({ error: 'Accès refusé à ce fichier.' })
      return
    }

    const filePath = path.join(CV_DIR, fileName)
    try {
      await access(filePath)
    } catch {
      res.status(404).json({ error: 'Fichier introuvable.' })
      return
    }

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', 'inline')
    res.setHeader('Cache-Control', 'private, no-store')
    res.sendFile(filePath, (err) => {
      if (err && !res.headersSent) next(err)
    })
  } catch (err) {
    next(err)
  }
})

export default router
