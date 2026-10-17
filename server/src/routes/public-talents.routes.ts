import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { prisma } from '../lib/prisma.js'
import { requireRole } from '../middleware/rbac.js'
import {
  PUBLIC_REF_PATTERN,
  publicTalentListQuerySchema,
  talentContactRequestInputSchema,
} from '../lib/validation.js'
import { PUBLIC_TALENT_WHERE, findPublicTalent, getPublicTalent, listPublicTalents } from '../lib/public-talents.js'
import { clip, notifyUser, roleLabel, scheduleAdminNotification } from '../lib/notify.js'

/**
 * Vitrine publique « Talents recommandés » (`/api/talents-recommandes`).
 * Lecture SANS authentification : seuls les talents dont l'accord explicite
 * de visibilité publique a été recueilli par leur agent apparaissent, et
 * chaque réponse passe par la liste blanche `toPublicTalent()`.
 *
 * Contact : OffRec reste l'intermédiaire obligatoire. Un utilisateur
 * connecté (hors agent et admin) décrit son besoin ; l'agent du talent traite
 * la demande et organise le contact hors ligne. Le talent n'est jamais mis en
 * relation directement par la plateforme.
 */
const router = Router()

/** Rôles qui peuvent demander un contact : tous sauf agent et admin. */
const REQUESTER_ROLES = ['candidate', 'recruiter', 'particulier', 'talent'] as const

/** Plafond par utilisateur et par 24 h (en base), en plus du limiteur IP. */
const MAX_REQUESTS_PER_DAY = 5

const readLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de requêtes. Réessayez dans quelques minutes.' },
})

const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de demandes envoyées. Réessayez dans quelques minutes.' },
})

const NOT_FOUND = { error: 'Ce talent n’est pas (ou plus) présenté publiquement.' }

router.get('/', readLimiter, async (req, res, next) => {
  try {
    const query = publicTalentListQuerySchema.parse(req.query)
    const result = await listPublicTalents(query)
    // Un retrait d'accord doit prendre effet immédiatement : pas de cache.
    res.set('Cache-Control', 'no-store')
    res.json(result)
  } catch (err) {
    next(err)
  }
})

/**
 * Demandes de contact de l'utilisateur connecté (statut seulement). Déclarée
 * avant `/:publicRef` ; le lien vers la fiche n'est donné que si elle est
 * encore publique.
 */
router.get('/mes-demandes', requireRole(...REQUESTER_ROLES), async (req, res, next) => {
  try {
    const requests = await prisma.talentContactRequest.findMany({
      where: { requesterId: req.session!.sub },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        need: true,
        status: true,
        createdAt: true,
        handledAt: true,
        talentId: true,
        talent: { select: { trade: true, city: true, district: true } },
      },
    })
    const stillPublic = await prisma.talentProfile.findMany({
      where: { ...PUBLIC_TALENT_WHERE, id: { in: [...new Set(requests.map((r) => r.talentId))] } },
      select: { id: true, publicRef: true },
    })
    const refOf = new Map(stillPublic.map((t) => [t.id, t.publicRef]))
    res.json({
      requests: requests.map((r) => ({
        id: r.id,
        need: r.need,
        status: r.status,
        createdAt: r.createdAt.toISOString(),
        handledAt: r.handledAt?.toISOString() ?? null,
        talent: {
          trade: r.talent.trade,
          city: r.talent.city,
          district: r.talent.district ?? null,
          publicRef: refOf.get(r.talentId) ?? null,
        },
      })),
    })
  } catch (err) {
    next(err)
  }
})

router.get('/:publicRef', readLimiter, async (req, res, next) => {
  try {
    const ref = req.params.publicRef
    const talent = PUBLIC_REF_PATTERN.test(ref) ? await getPublicTalent(ref) : null
    res.set('Cache-Control', 'no-store')
    if (!talent) {
      res.status(404).json(NOT_FOUND)
      return
    }
    res.json({ talent })
  } catch (err) {
    next(err)
  }
})

router.post('/:publicRef/contact', contactLimiter, requireRole(...REQUESTER_ROLES), async (req, res, next) => {
  try {
    const ref = req.params.publicRef
    const talent = PUBLIC_REF_PATTERN.test(ref) ? await findPublicTalent(ref) : null
    if (!talent) {
      res.status(404).json(NOT_FOUND)
      return
    }
    const body = talentContactRequestInputSchema.parse(req.body)
    const me = req.session!.sub
    if (talent.accountProfile?.userId === me) {
      res.status(400).json({ error: 'Vous ne pouvez pas demander à être mis en contact avec vous-même.' })
      return
    }
    const since = new Date(Date.now() - 24 * 3600 * 1000)
    const [open, lastDay] = await Promise.all([
      prisma.talentContactRequest.count({
        where: { requesterId: me, talentId: talent.id, status: { in: ['nouvelle', 'transmise'] } },
      }),
      prisma.talentContactRequest.count({ where: { requesterId: me, createdAt: { gte: since } } }),
    ])
    if (open > 0) {
      res.status(409).json({ error: 'Vous avez déjà une demande en cours pour ce talent : l’agent OffRec la traite.' })
      return
    }
    if (lastDay >= MAX_REQUESTS_PER_DAY) {
      res.status(429).json({ error: `${MAX_REQUESTS_PER_DAY} demandes de contact par jour au maximum. Réessayez demain.` })
      return
    }
    const request = await prisma.talentContactRequest.create({
      data: { talentId: talent.id, requesterId: me, need: body.need },
      select: { id: true, status: true, createdAt: true },
    })
    await prisma.auditLog.create({
      data: { userId: me, action: 'talent_contact_requested', metadata: { talentId: talent.id, requestId: request.id } },
    })
    res.status(201).json({
      request: { id: request.id, status: request.status, createdAt: request.createdAt.toISOString() },
      message: 'Demande envoyée : l’agent OffRec qui suit ce talent vous recontacte pour organiser la mise en relation.',
    })
    // Ni le nom du talent, ni celui du demandeur, ni le besoin (texte libre) :
    // ils se lisent dans « Demandes pour mes talents ».
    const who = roleLabel(req.session!.role)
    void notifyUser({
      userId: talent.agentId,
      event: 'talent_contact_requested',
      title: 'Nouvelle demande de contact',
      message: `${who} souhaite contacter un de vos talents (${clip(talent.trade, 40)}, ${clip(talent.city, 40)}) via la vitrine. Organisez la mise en relation.`,
      link: '/agent/demandes-talents',
    })
    scheduleAdminNotification({
      event: 'talent_contact_requested',
      category: 'agent',
      title: 'Demande de contact d’un talent',
      message: `${who} a demandé à contacter un talent de la vitrine (${clip(talent.trade, 40)}, ${clip(talent.city, 40)}). Son agent doit traiter la demande.`,
      link: '/admin/talents',
    })
  } catch (err) {
    next(err)
  }
})

export default router
