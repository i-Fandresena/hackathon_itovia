import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { requireRole } from '../middleware/rbac.js'
import { moderationResolveSchema } from '../lib/validation.js'

const ACTION_TO_STATUS = {
  warning: 'warned',
  restriction: 'restricted',
  suspension: 'suspended',
  ban: 'banned',
} as const

const router = Router()

router.use(requireRole('admin'))

router.get('/stats', async (_req, res, next) => {
  try {
    const [
      candidateCount,
      recruiterCount,
      individualCount,
      opportunityCount,
      applicationCount,
      providerCount,
      recommendationCount,
      memberCount,
      openReportCount,
      recentAuditLogs,
    ] = await Promise.all([
      prisma.user.count({ where: { role: 'candidate' } }),
      prisma.user.count({ where: { role: 'recruiter' } }),
      prisma.user.count({ where: { role: 'particulier' } }),
      prisma.opportunity.count(),
      prisma.application.count(),
      prisma.provider.count(),
      prisma.recommendation.count(),
      prisma.member.count(),
      prisma.report.count({ where: { status: 'open' } }),
      prisma.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 15,
        include: { user: { select: { email: true, role: true } } },
      }),
    ])

    const [payingSubscriptions, revenueAgg] = await Promise.all([
      prisma.subscription.count({ where: { planCode: { not: 'FREE' } } }),
      prisma.transaction.aggregate({ _sum: { amountAr: true }, _count: true }),
    ])

    res.json({
      users: { candidates: candidateCount, recruiters: recruiterCount, individuals: individualCount },
      opportunities: opportunityCount,
      applications: applicationCount,
      providers: providerCount,
      recommendations: recommendationCount,
      members: memberCount,
      openReports: openReportCount,
      revenue: {
        payingRecruiters: payingSubscriptions,
        totalAr: revenueAgg._sum.amountAr ?? 0,
        transactionCount: revenueAgg._count,
      },
      recentActivity: recentAuditLogs.map((log) => ({
        id: log.id,
        action: log.action,
        userEmail: log.user?.email ?? null,
        userRole: log.user?.role ?? null,
        createdAt: log.createdAt.toISOString(),
      })),
    })
  } catch (err) {
    next(err)
  }
})

router.get('/reports', async (_req, res, next) => {
  try {
    const reports = await prisma.report.findMany({
      where: { status: 'open' },
      orderBy: { createdAt: 'desc' },
      include: {
        reporter: { select: { email: true } },
        targetUser: { select: { email: true, role: true, status: true } },
      },
    })
    res.json({
      reports: reports.map((r) => ({
        id: r.id,
        targetType: r.targetType,
        targetId: r.targetId,
        reason: r.reason,
        createdAt: r.createdAt.toISOString(),
        reporterEmail: r.reporter.email,
        targetUser: r.targetUser
          ? { email: r.targetUser.email, role: r.targetUser.role, status: r.targetUser.status }
          : null,
      })),
    })
  } catch (err) {
    next(err)
  }
})

/**
 * Résout un signalement : classe sans suite (dismiss) ou applique une étape
 * du pipeline Warning -> Restriction -> Suspension -> Bannissement. L'humain
 * (l'admin) décide ; ce n'est jamais une IA qui bannit à sa place.
 */
router.post('/reports/:id/resolve', async (req, res, next) => {
  try {
    const body = moderationResolveSchema.parse(req.body)
    const report = await prisma.report.findUnique({ where: { id: req.params.id } })
    if (!report || report.status !== 'open') {
      res.status(404).json({ error: 'Signalement introuvable ou déjà traité.' })
      return
    }

    await prisma.moderationAction.create({
      data: {
        reportId: report.id,
        adminId: req.session!.sub,
        targetUserId: report.targetUserId,
        action: body.action,
        note: body.note,
      },
    })
    await prisma.report.update({ where: { id: report.id }, data: { status: 'resolved' } })

    if (body.action !== 'dismiss' && report.targetUserId) {
      await prisma.user.update({
        where: { id: report.targetUserId },
        data: { status: ACTION_TO_STATUS[body.action] },
      })
    }

    await prisma.auditLog.create({
      data: {
        userId: req.session!.sub,
        action: `moderation:${body.action}`,
        metadata: { reportId: report.id, targetUserId: report.targetUserId },
      },
    })

    res.status(204).end()
  } catch (err) {
    next(err)
  }
})

export default router
