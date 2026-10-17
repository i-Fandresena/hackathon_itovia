import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { requireAuth } from '../middleware/auth.js'
import { reportInputSchema } from '../lib/validation.js'
import { resolveTargetUserId } from '../lib/moderation.js'
import { scheduleAdminNotification } from '../lib/notify.js'
import { findPublicTalent } from '../lib/public-talents.js'
import { VISIBLE_COMPANY_WHERE } from '../lib/companies.js'

const REPORTER_LABELS: Record<string, string> = {
  candidate: 'Un candidat',
  recruiter: 'Un recruteur',
  particulier: 'Un particulier',
  agent: 'Un agent de terrain',
  talent: 'Un talent',
  admin: 'Un administrateur',
}

const TARGET_LABELS: Record<string, string> = {
  opportunity: 'une offre',
  provider: 'une fiche de l’annuaire',
  recommendation: 'une recommandation de l’annuaire',
  user: 'un compte',
  endorsement: 'une recommandation de talent',
  talent: 'une fiche publique de talent',
  company: 'une fiche entreprise',
}

const router = Router()

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const body = reportInputSchema.parse(req.body)
    // Fiche publique de talent : le client n'en connaît que le `publicRef` ;
    // on enregistre l'id du profil (stable même si l'accord est retiré).
    let targetId = body.targetId
    if (body.targetType === 'talent') {
      const talent = await findPublicTalent(body.targetId)
      if (!talent) {
        res.status(404).json({ error: 'Ce talent n’est pas (ou plus) présenté publiquement.' })
        return
      }
      targetId = talent.id
    }
    if (body.targetType === 'company') {
      const company = await prisma.company.findFirst({ where: { ...VISIBLE_COMPANY_WHERE, id: targetId }, select: { id: true } })
      if (!company) {
        res.status(404).json({ error: 'Entreprise introuvable.' })
        return
      }
    }
    const targetUserId = await resolveTargetUserId(body.targetType, targetId)
    const report = await prisma.report.create({
      data: {
        reporterId: req.session!.sub,
        targetType: body.targetType,
        targetId,
        targetUserId: targetUserId ?? undefined,
        reason: body.reason,
      },
    })
    // Réponse minimale : ni `targetId` résolu (id interne d'un talent) ni
    // `targetUserId` (responsable du contenu) ne repartent vers l'auteur.
    res.status(201).json({ report: { id: report.id, targetType: report.targetType, status: report.status, createdAt: report.createdAt } })
    // Ni l'auteur ni le motif (texte libre, peut contenir des données
    // personnelles) : ils se lisent sur l'écran de modération.
    scheduleAdminNotification({
      event: 'report_created',
      category: 'moderation',
      title: 'Nouveau signalement',
      message:
        `${REPORTER_LABELS[req.session!.role] ?? 'Un utilisateur'} a signalé ${TARGET_LABELS[body.targetType] ?? 'un contenu'}. ` +
        'Une décision de modération est attendue.',
      link: '/admin/moderation',
      excludeUserId: req.session!.role === 'admin' ? req.session!.sub : null,
    })
  } catch (err) {
    next(err)
  }
})

export default router
