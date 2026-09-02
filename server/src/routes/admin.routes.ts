import bcrypt from 'bcryptjs'
import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { requireRole } from '../middleware/rbac.js'
import { createAgentSchema, moderationResolveSchema } from '../lib/validation.js'

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
      agentCount,
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
      prisma.user.count({ where: { role: 'agent' } }),
      prisma.opportunity.count(),
      prisma.application.count(),
      prisma.provider.count(),
      prisma.recommendation.count(),
      prisma.member.count(),
      prisma.report.count({ where: { status: 'open' } }),
      // Connexions/déconnexions exclues : elles noieraient les décisions
      // réelles (intérêt/déclin) dans la liste — comptées à part, affichées
      // de façon minimale (voir `recentLoginCount`).
      prisma.auditLog.findMany({
        where: { action: { notIn: ['login', 'logout'] } },
        orderBy: { createdAt: 'desc' },
        take: 15,
        include: { user: { select: { email: true, role: true } } },
      }),
    ])

    const recentLoginCount = await prisma.auditLog.count({
      where: { action: { in: ['login', 'logout'] }, createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
    })

    const [payingSubscriptions, revenueAgg] = await Promise.all([
      prisma.subscription.count({ where: { planCode: { not: 'FREE' } } }),
      prisma.transaction.aggregate({ _sum: { amountAr: true }, _count: true }),
    ])

    // KPI d'inclusion féminine (cahier des charges §4, §10) : part de femmes
    // parmi les profils « recommandés » — candidats ayant postulé au moins
    // une fois, et talents non-diplômés recommandés/placés par un agent.
    const [candidatesWithApplications, talentsRecommended, placementsByStage, activeRecruiters] =
      await Promise.all([
        prisma.application.findMany({
          distinct: ['candidateId'],
          select: { candidate: { select: { candidateProfile: { select: { gender: true } } } } },
        }),
        prisma.talentProfile.findMany({
          where: { status: { in: ['recommande', 'place'] } },
          select: { gender: true },
        }),
        prisma.placement.groupBy({ by: ['stage'], _count: true }),
        prisma.opportunity.findMany({ distinct: ['recruiterId'], select: { recruiterId: true } }),
      ])
    const genderPool = [
      ...candidatesWithApplications
        .map((c) => c.candidate.candidateProfile?.gender)
        .filter((g): g is 'femme' | 'homme' | 'autre' => Boolean(g)),
      ...talentsRecommended.map((t) => t.gender),
    ]
    const femalePercent =
      genderPool.length > 0
        ? Math.round((genderPool.filter((g) => g === 'femme').length / genderPool.length) * 1000) / 10
        : 0
    const placementCount = placementsByStage.reduce((sum, p) => sum + p._count, 0)

    res.json({
      users: {
        candidates: candidateCount,
        recruiters: recruiterCount,
        individuals: individualCount,
        agents: agentCount,
      },
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
      employment: {
        femalePercent,
        genderPoolSize: genderPool.length,
        placements: placementCount,
        placementsByStage: Object.fromEntries(placementsByStage.map((p) => [p.stage, p._count])),
        activePartnerCompanies: activeRecruiters.length,
      },
      recentActivity: recentAuditLogs.map((log) => ({
        id: log.id,
        action: log.action,
        userEmail: log.user?.email ?? null,
        userRole: log.user?.role ?? null,
        metadata: log.metadata ?? null,
        createdAt: log.createdAt.toISOString(),
      })),
      // Connexions/déconnexions des 7 derniers jours — affichées en résumé,
      // pas en liste, pour ne pas noyer les décisions réelles ci-dessus.
      recentLoginCount,
    })
  } catch (err) {
    next(err)
  }
})

/**
 * Provisionne un compte agent : pas de self-service (cahier des charges §12
 * — un statut de vérification agent non fiable détruirait la promesse
 * « compétences vérifiées »).
 */
router.post('/agents', async (req, res, next) => {
  try {
    const body = createAgentSchema.parse(req.body)
    const existing = await prisma.user.findUnique({ where: { email: body.email.toLowerCase() } })
    if (existing) {
      res.status(409).json({ error: 'Un compte existe déjà avec cet email.' })
      return
    }
    const passwordHash = await bcrypt.hash(body.password, 12)
    const user = await prisma.user.create({
      data: {
        email: body.email.toLowerCase(),
        passwordHash,
        role: 'agent',
        agentProfile: { create: body.agentProfile },
      },
      include: { agentProfile: true },
    })
    await prisma.auditLog.create({
      data: { userId: req.session!.sub, action: 'admin:create_agent', metadata: { agentUserId: user.id } },
    })
    res.status(201).json({
      agent: { id: user.id, email: user.email, agentProfile: user.agentProfile },
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
