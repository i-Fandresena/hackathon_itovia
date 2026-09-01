import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { requireAuth } from '../middleware/auth.js'
import { reportInputSchema } from '../lib/validation.js'
import { resolveTargetUserId } from '../lib/moderation.js'

const router = Router()

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const body = reportInputSchema.parse(req.body)
    const targetUserId = await resolveTargetUserId(body.targetType, body.targetId)
    const report = await prisma.report.create({
      data: {
        reporterId: req.session!.sub,
        targetType: body.targetType,
        targetId: body.targetId,
        targetUserId: targetUserId ?? undefined,
        reason: body.reason,
      },
    })
    res.status(201).json({ report })
  } catch (err) {
    next(err)
  }
})

export default router
