import { Router } from 'express'
import type { ContactRequestStatus } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { contactRequestListQuerySchema, contactRequestStatusSchema } from '../lib/validation.js'
import { clip, notifyUser, roleLabel } from '../lib/notify.js'

/**
 * Demandes de contact reçues via la vitrine « Talents recommandés » (monté
 * sous `/api/agent`, rôle agent). Un agent ne voit que les demandes visant
 * SES talents. Il organise le contact hors ligne : la plateforme ne transmet
 * jamais les coordonnées du talent au demandeur.
 */
const router = Router()

/** `nouvelle → transmise → close`, ou `nouvelle → close` (demande sans suite). */
const ALLOWED: Record<ContactRequestStatus, ContactRequestStatus[]> = {
  nouvelle: ['transmise', 'close'],
  transmise: ['close'],
  close: [],
}

const requestInclude = {
  talent: { select: { id: true, fullName: true, trade: true, city: true, district: true, agentId: true } },
  requester: {
    select: {
      role: true,
      email: true,
      candidateProfile: { select: { fullName: true, phone: true } },
      recruiterProfile: { select: { companyName: true, phone: true } },
      individualProfile: { select: { fullName: true, phone: true } },
      talentAccountProfile: { select: { fullName: true, phone: true } },
    },
  },
} as const

type Row = Awaited<ReturnType<typeof loadOne>>

function loadOne(id: string) {
  return prisma.talentContactRequest.findUnique({ where: { id }, include: requestInclude })
}

/** Vue agent : le demandeur avec ses coordonnées (l'agent organise le contact). */
function agentView(r: NonNullable<Row>) {
  const q = r.requester
  const profile = q.candidateProfile ?? q.individualProfile ?? q.talentAccountProfile
  return {
    id: r.id,
    status: r.status,
    need: r.need,
    createdAt: r.createdAt.toISOString(),
    handledAt: r.handledAt?.toISOString() ?? null,
    talent: {
      id: r.talent.id,
      fullName: r.talent.fullName,
      trade: r.talent.trade,
      city: r.talent.city,
      district: r.talent.district ?? null,
    },
    requester: {
      role: q.role,
      roleLabel: roleLabel(q.role),
      name: q.recruiterProfile?.companyName ?? profile?.fullName ?? null,
      email: q.email,
      phone: q.recruiterProfile?.phone ?? profile?.phone ?? null,
    },
  }
}

router.get('/contact-requests', async (req, res, next) => {
  try {
    const { status } = contactRequestListQuerySchema.parse(req.query)
    const me = req.session!.sub
    const [requests, grouped] = await Promise.all([
      prisma.talentContactRequest.findMany({
        where: { talent: { agentId: me }, ...(status ? { status } : {}) },
        include: requestInclude,
        orderBy: { createdAt: 'desc' },
        take: 200,
      }),
      prisma.talentContactRequest.groupBy({
        by: ['status'],
        where: { talent: { agentId: me } },
        _count: { _all: true },
      }),
    ])
    res.json({
      counts: Object.fromEntries(grouped.map((g) => [g.status, g._count._all])),
      requests: requests.map(agentView),
    })
  } catch (err) {
    next(err)
  }
})

router.patch('/contact-requests/:id', async (req, res, next) => {
  try {
    const me = req.session!.sub
    const existing = await loadOne(req.params.id)
    // 404 (pas 403) pour la demande d'un talent suivi par un autre agent : on
    // ne révèle pas son existence.
    if (!existing || existing.talent.agentId !== me) {
      res.status(404).json({ error: 'Demande introuvable.' })
      return
    }
    const { status } = contactRequestStatusSchema.parse(req.body)
    if (!ALLOWED[existing.status].includes(status)) {
      res.status(409).json({ error: 'Ce changement de statut n’est pas possible pour cette demande.' })
      return
    }
    const now = new Date()
    const updated = await prisma.talentContactRequest.updateMany({
      where: { id: existing.id, status: existing.status },
      data: { status, handledById: me, handledAt: now },
    })
    if (updated.count === 0) {
      res.status(409).json({ error: 'La demande a changé entre-temps : rechargez la page.' })
      return
    }
    await prisma.auditLog.create({
      data: {
        userId: me,
        action: `talent_contact_request_${status}`,
        metadata: { requestId: existing.id, talentId: existing.talent.id },
      },
    })
    const fresh = await loadOne(existing.id)
    res.json({ request: agentView(fresh!) })
    if (status === 'transmise') {
      // Le demandeur apprend que sa demande avance — jamais le nom ni le
      // contact du talent : l'agent l'appelle hors ligne.
      void notifyUser({
        userId: existing.requesterId,
        event: 'talent_contact_request_transmitted',
        title: 'Votre demande de contact avance',
        message:
          `L’agent OffRec a transmis votre demande au talent (${clip(existing.talent.trade, 40)}, ${clip(existing.talent.city, 40)}). ` +
          'Il vous recontacte pour organiser la mise en relation.',
        link: '/talents#mes-demandes',
      })
    }
  } catch (err) {
    next(err)
  }
})

export default router
