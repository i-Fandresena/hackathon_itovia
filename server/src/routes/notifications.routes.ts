import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { requireAuth } from '../middleware/auth.js'
import { notificationListQuerySchema } from '../lib/validation.js'

const router = Router()

/**
 * Notifications de l'utilisateur connecté, les plus récentes d'abord.
 *
 * Bornée : `limit` (1 à 500, 200 par défaut) évite de renvoyer tout
 * l'historique d'un compte admin, qui reçoit l'activité de la plateforme.
 * `unreadCount` et `total` portent sur l'ensemble des notifications du compte
 * (hors filtres), pas seulement sur la page renvoyée. Filtres optionnels :
 * `category` et `unread=true`.
 */
router.get('/mine', requireAuth, async (req, res, next) => {
  try {
    const query = notificationListQuerySchema.parse(req.query)
    const userId = req.session!.sub
    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: {
          userId,
          ...(query.category ? { category: query.category } : {}),
          ...(query.unread ? { read: false } : {}),
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: query.limit,
      }),
      prisma.notification.count({ where: { userId } }),
      prisma.notification.count({ where: { userId, read: false } }),
    ])
    res.json({ notifications, total, unreadCount })
  } catch (err) {
    next(err)
  }
})

/**
 * Tout marquer comme lu — uniquement les notifications de l'utilisateur
 * connecté (`userId` vient de la session, jamais du client).
 */
router.post('/read-all', requireAuth, async (req, res, next) => {
  try {
    const result = await prisma.notification.updateMany({
      where: { userId: req.session!.sub, read: false },
      data: { read: true },
    })
    res.json({ updated: result.count })
  } catch (err) {
    next(err)
  }
})

router.post('/:id/read', requireAuth, async (req, res, next) => {
  try {
    const notification = await prisma.notification.findUnique({ where: { id: req.params.id } })
    if (!notification || notification.userId !== req.session!.sub) {
      res.status(404).json({ error: 'Notification introuvable.' })
      return
    }
    await prisma.notification.update({ where: { id: req.params.id }, data: { read: true } })
    res.status(204).end()
  } catch (err) {
    next(err)
  }
})

export default router
