import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { requireAuth } from '../middleware/auth.js'
import { sendMessageSchema, startConversationSchema } from '../lib/validation.js'

const router = Router()

function displayNameOf(user: {
  email: string
  candidateProfile: { fullName: string } | null
  recruiterProfile: { companyName: string } | null
  individualProfile: { fullName: string } | null
  agentProfile: { fullName: string } | null
}): string {
  return (
    user.candidateProfile?.fullName ??
    user.recruiterProfile?.companyName ??
    user.individualProfile?.fullName ??
    user.agentProfile?.fullName ??
    user.email
  )
}

const PARTICIPANT_INCLUDE = {
  candidateProfile: { select: { fullName: true } },
  recruiterProfile: { select: { companyName: true } },
  individualProfile: { select: { fullName: true } },
  agentProfile: { select: { fullName: true } },
} as const

router.get('/conversations', requireAuth, async (req, res, next) => {
  try {
    const me = req.session!.sub
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
      conversations.map(async (c) => {
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
    const conversation = await prisma.conversation.findUnique({ where: { id: req.params.id } })
    if (!conversation || (conversation.participantAId !== me && conversation.participantBId !== me)) {
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

router.post('/conversations/:id/messages', requireAuth, async (req, res, next) => {
  try {
    const me = req.session!.sub
    const body = sendMessageSchema.parse(req.body)
    const conversation = await prisma.conversation.findUnique({ where: { id: req.params.id } })
    if (!conversation || (conversation.participantAId !== me && conversation.participantBId !== me)) {
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
