import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { requireAuth } from '../middleware/auth.js'
import { contactOffrecSchema, sendMessageSchema, startConversationSchema } from '../lib/validation.js'

const router = Router()

function displayNameOf(user: {
  email: string
  role: string
  candidateProfile: { fullName: string } | null
  recruiterProfile: { companyName: string } | null
  individualProfile: { fullName: string } | null
  agentProfile: { fullName: string } | null
}): string {
  if (user.role === 'admin') return 'OffRec'
  return (
    user.candidateProfile?.fullName ??
    user.recruiterProfile?.companyName ??
    user.individualProfile?.fullName ??
    user.agentProfile?.fullName ??
    user.email
  )
}

const PARTICIPANT_INCLUDE = {
  role: true,
  candidateProfile: { select: { fullName: true } },
  recruiterProfile: { select: { companyName: true } },
  individualProfile: { select: { fullName: true } },
  agentProfile: { select: { fullName: true } },
} as const

/**
 * Espace candidat : plus d'onglet Messages (décision produit 2026-09-02,
 * OffRec est l'unique intermédiaire) — bloqué aussi côté API, pas
 * seulement caché dans la nav. Espace recruteur : ne peut échanger
 * qu'avec OffRec (un compte `admin`), jamais directement avec un candidat.
 */
function assertConversationAccess(myRole: string, otherRole: string): string | null {
  if (myRole === 'candidate') return 'La messagerie n’est pas disponible depuis l’espace candidat.'
  if (myRole === 'recruiter' && otherRole !== 'admin') {
    return 'Depuis l’espace recruteur, la messagerie ne permet d’échanger qu’avec OffRec.'
  }
  return null
}

router.get('/conversations', requireAuth, async (req, res, next) => {
  try {
    const me = req.session!.sub
    const myRole = req.session!.role
    if (myRole === 'candidate') {
      res.status(403).json({ error: 'La messagerie n’est pas disponible depuis l’espace candidat.' })
      return
    }
    const conversations = await prisma.conversation.findMany({
      where: { OR: [{ participantAId: me }, { participantBId: me }] },
      include: {
        participantA: { select: { id: true, email: true, ...PARTICIPANT_INCLUDE } },
        participantB: { select: { id: true, email: true, ...PARTICIPANT_INCLUDE } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
        _count: { select: { messages: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    const result = await Promise.all(
      conversations
        .filter((c) => {
          const other = c.participantAId === me ? c.participantB : c.participantA
          return !assertConversationAccess(myRole, other.role)
        })
        .map(async (c) => {
          const other = c.participantAId === me ? c.participantB : c.participantA
          const unread = await prisma.message.count({
            where: { conversationId: c.id, senderId: { not: me }, readAt: null },
          })
          return {
            id: c.id,
            opportunityId: c.opportunityId,
            otherUser: { id: other.id, email: other.email, displayName: displayNameOf(other) },
            lastMessage: c.messages[0]
              ? { content: c.messages[0].content, createdAt: c.messages[0].createdAt.toISOString() }
              : null,
            unreadCount: unread,
          }
        }),
    )
    // Les plus récentes d'abord, par dernier message (pas par date de création).
    result.sort((a, b) => Date.parse(b.lastMessage?.createdAt ?? '0') - Date.parse(a.lastMessage?.createdAt ?? '0'))
    res.json({ conversations: result })
  } catch (err) {
    next(err)
  }
})

router.get('/conversations/:id', requireAuth, async (req, res, next) => {
  try {
    const me = req.session!.sub
    const myRole = req.session!.role
    const conversation = await prisma.conversation.findUnique({
      where: { id: req.params.id },
      include: {
        participantA: { select: { role: true } },
        participantB: { select: { role: true } },
      },
    })
    if (!conversation || (conversation.participantAId !== me && conversation.participantBId !== me)) {
      res.status(404).json({ error: 'Conversation introuvable.' })
      return
    }
    const other = conversation.participantAId === me ? conversation.participantB : conversation.participantA
    if (assertConversationAccess(myRole, other.role)) {
      res.status(404).json({ error: 'Conversation introuvable.' })
      return
    }
    await prisma.message.updateMany({
      where: { conversationId: conversation.id, senderId: { not: me }, readAt: null },
      data: { readAt: new Date() },
    })
    const messages = await prisma.message.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: 'asc' },
    })
    res.json({
      messages: messages.map((m) => ({
        id: m.id,
        senderId: m.senderId,
        content: m.content,
        createdAt: m.createdAt.toISOString(),
        mine: m.senderId === me,
      })),
    })
  } catch (err) {
    next(err)
  }
})

router.post('/conversations', requireAuth, async (req, res, next) => {
  try {
    const me = req.session!.sub
    const myRole = req.session!.role
    const body = startConversationSchema.parse(req.body)
    if (body.toUserId === me) {
      res.status(400).json({ error: 'Impossible de vous écrire à vous-même.' })
      return
    }
    const target = await prisma.user.findUnique({ where: { id: body.toUserId } })
    if (!target) {
      res.status(404).json({ error: 'Destinataire introuvable.' })
      return
    }

    const accessError = assertConversationAccess(myRole, target.role)
    if (accessError) {
      res.status(403).json({ error: accessError })
      return
    }

    const [participantAId, participantBId] = [me, body.toUserId].sort()
    const conversation =
      (await prisma.conversation.findFirst({
        where: { participantAId, participantBId, opportunityId: body.opportunityId ?? null },
      })) ??
      (await prisma.conversation.create({
        data: { participantAId, participantBId, opportunityId: body.opportunityId },
      }))
    await prisma.message.create({
      data: { conversationId: conversation.id, senderId: me, content: body.message },
    })
    if (target.role !== 'admin') {
      await prisma.notification.create({
        data: { userId: target.id, title: 'Nouveau message', message: 'Vous avez reçu un nouveau message.' },
      })
    }
    res.status(201).json({ conversationId: conversation.id })
  } catch (err) {
    next(err)
  }
})

/**
 * Point d'entrée unique pour « contacter OffRec » — le recruteur n'a pas à
 * connaître l'identité d'un compte admin, seulement à envoyer son message.
 */
router.post('/contact-offrec', requireAuth, async (req, res, next) => {
  try {
    const me = req.session!.sub
    const myRole = req.session!.role
    if (myRole === 'candidate' || myRole === 'admin') {
      res.status(403).json({ error: 'Fonctionnalité non disponible pour ce rôle.' })
      return
    }
    const body = contactOffrecSchema.parse(req.body)
    // Le compte admin le plus récemment provisionné plutôt que le premier :
    // sur ce déploiement, l'admin de démo (`seed.ts`) précède toujours le
    // vrai compte d'exploitation créé ensuite via le script séparé.
    const admin = await prisma.user.findFirst({ where: { role: 'admin' }, orderBy: { createdAt: 'desc' } })
    if (!admin) {
      res.status(503).json({ error: 'OffRec est momentanément injoignable.' })
      return
    }

    const [participantAId, participantBId] = [me, admin.id].sort()
    const conversation =
      (await prisma.conversation.findFirst({ where: { participantAId, participantBId, opportunityId: null } })) ??
      (await prisma.conversation.create({ data: { participantAId, participantBId } }))
    await prisma.message.create({
      data: { conversationId: conversation.id, senderId: me, content: body.message },
    })
    await prisma.notification.create({
      data: { userId: admin.id, title: 'Nouveau message', message: 'Vous avez reçu un nouveau message.' },
    })
    res.status(201).json({ conversationId: conversation.id })
  } catch (err) {
    next(err)
  }
})

router.post('/conversations/:id/messages', requireAuth, async (req, res, next) => {
  try {
    const me = req.session!.sub
    const myRole = req.session!.role
    const body = sendMessageSchema.parse(req.body)
    const conversation = await prisma.conversation.findUnique({
      where: { id: req.params.id },
      include: {
        participantA: { select: { role: true } },
        participantB: { select: { role: true } },
      },
    })
    if (!conversation || (conversation.participantAId !== me && conversation.participantBId !== me)) {
      res.status(404).json({ error: 'Conversation introuvable.' })
      return
    }
    const other = conversation.participantAId === me ? conversation.participantB : conversation.participantA
    if (assertConversationAccess(myRole, other.role)) {
      res.status(404).json({ error: 'Conversation introuvable.' })
      return
    }
    const message = await prisma.message.create({
      data: { conversationId: conversation.id, senderId: me, content: body.content },
    })
    const otherId = conversation.participantAId === me ? conversation.participantBId : conversation.participantAId
    await prisma.notification.create({
      data: { userId: otherId, title: 'Nouveau message', message: 'Vous avez reçu un nouveau message.' },
    })
    res.status(201).json({
      message: {
        id: message.id,
        senderId: message.senderId,
        content: message.content,
        createdAt: message.createdAt.toISOString(),
        mine: true,
      },
    })
  } catch (err) {
    next(err)
  }
})

export default router
