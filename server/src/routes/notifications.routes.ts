import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

router.get('/mine', requireAuth, async (req, res, next) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.session!.sub },
      orderBy: { createdAt: 'desc' },
    })
    res.json({ notifications })
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
