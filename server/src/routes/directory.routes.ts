import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { requireAuth } from '../middleware/auth.js'
import { getOrCreateMember } from '../lib/member.js'
import { providerInputSchema, recommendationInputSchema } from '../lib/validation.js'
import { canRecommend, evaluateProvider, rankProviders } from '../../../src/lib/trust.js'
import type { Member, Provider, Recommendation } from '../../../src/types/index.js'

const router = Router()

type DbMember = { id: string; displayName: string; district: string; city: string; joinedAt: Date; phoneVerified: boolean }
type DbProvider = {
  id: string
  name: string
  trade: string
  description: string
  district: string
  city: string
  province: string
  phone: string
  whatsapp: string | null
  addedByMemberId: string
  claimedByMemberId: string | null
  createdAt: Date
}
type DbRecommendation = {
  id: string
  providerId: string
  authorMemberId: string
  authorDistrict: string
  rating: number
  wouldUseAgain: boolean
  jobLabel: string
  jobDate: Date
  pricePaid: number | null
  priceUnit: string | null
  comment: string
  proof: string
  createdAt: Date
  confirmations: { memberId: string }[]
}

function toDomainMember(m: DbMember): Member {
  return {
    id: m.id,
    displayName: m.displayName,
    district: m.district,
    city: m.city,
    joinedAt: m.joinedAt.toISOString(),
    phoneVerified: m.phoneVerified,
  }
}

function toDomainProvider(p: DbProvider): Provider {
  return {
    id: p.id,
    name: p.name,
    trade: p.trade,
    description: p.description,
    district: p.district,
    city: p.city,
    province: p.province,
    phone: p.phone,
    whatsapp: p.whatsapp ?? undefined,
    addedByMemberId: p.addedByMemberId,
    claimedByMemberId: p.claimedByMemberId ?? undefined,
    createdAt: p.createdAt.toISOString(),
  }
}

function toDomainRecommendation(r: DbRecommendation, membersById: Map<string, DbMember>): Recommendation {
  const author = membersById.get(r.authorMemberId)
  return {
    id: r.id,
    providerId: r.providerId,
    authorMemberId: r.authorMemberId,
    authorName: author?.displayName ?? 'Membre',
    authorDistrict: r.authorDistrict,
    rating: r.rating,
    wouldUseAgain: r.wouldUseAgain,
    jobLabel: r.jobLabel,
    jobDate: r.jobDate.toISOString(),
    pricePaid: r.pricePaid ?? undefined,
    priceUnit: r.priceUnit ?? undefined,
    comment: r.comment,
    proof: r.proof as Recommendation['proof'],
    confirmations: r.confirmations.map((c) => c.memberId),
    createdAt: r.createdAt.toISOString(),
  }
}

async function loadDirectoryData() {
  const [providers, recommendations, members] = await Promise.all([
    prisma.provider.findMany(),
    prisma.recommendation.findMany({ include: { confirmations: true } }),
    prisma.member.findMany(),
  ])
  const membersById = new Map(members.map((m) => [m.id, m]))
  const domainMembers = new Map(members.map((m) => [m.id, toDomainMember(m)]))
  const domainProviders = providers.map(toDomainProvider)
  const domainRecommendations = recommendations.map((r) => toDomainRecommendation(r, membersById))
  return { domainProviders, domainRecommendations, domainMembers, rawProviders: providers, rawRecommendations: recommendations }
}

/**
 * Données brutes (non classées) de l'annuaire. Le frontend calcule lui-même
 * `rankProviders`/`evaluateProvider` à partir de ces tableaux, exactement
 * comme à l'époque du prototype localStorage — même moteur, même code,
 * simplement alimenté par l'API au lieu du stockage local.
 */
router.get('/raw', async (_req, res, next) => {
  try {
    const { domainProviders, domainRecommendations, domainMembers } = await loadDirectoryData()
    res.json({
      providers: domainProviders,
      recommendations: domainRecommendations,
      members: Array.from(domainMembers.values()),
    })
  } catch (err) {
    next(err)
  }
})

router.get('/providers', async (req, res, next) => {
  try {
    const { domainProviders, domainRecommendations, domainMembers } = await loadDirectoryData()
    const viewerDistrict = typeof req.query.district === 'string' ? req.query.district : undefined
    const ranked = rankProviders(domainProviders, domainRecommendations, domainMembers, { viewerDistrict })
    res.json({ providers: ranked })
  } catch (err) {
    next(err)
  }
})

router.get('/providers/:id', async (req, res, next) => {
  try {
    const { domainProviders, domainRecommendations, domainMembers } = await loadDirectoryData()
    const provider = domainProviders.find((p) => p.id === req.params.id)
    if (!provider) {
      res.status(404).json({ error: 'Prestataire introuvable.' })
      return
    }
    const viewerDistrict = typeof req.query.district === 'string' ? req.query.district : undefined
    const trust = evaluateProvider(provider, domainRecommendations, domainMembers, { viewerDistrict })
    const recommendations = domainRecommendations
      .filter((r) => r.providerId === provider.id)
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    res.json({ provider, trust, recommendations })
  } catch (err) {
    next(err)
  }
})

router.post('/providers', requireAuth, async (req, res, next) => {
  try {
    const { authorDisplayName, authorDistrict, ...providerBody } = req.body
    if (!authorDisplayName || !authorDistrict) {
      res.status(400).json({ error: 'Nom affiché et quartier requis pour publier une fiche.' })
      return
    }
    const body = providerInputSchema.parse(providerBody)
    const member = await getOrCreateMember(req.session!.sub, {
      displayName: authorDisplayName,
      district: authorDistrict,
    })
    const provider = await prisma.provider.create({
      data: { ...body, addedByMemberId: member.id },
    })
    res.status(201).json({ provider: toDomainProvider(provider) })
  } catch (err) {
    next(err)
  }
})

router.post('/providers/:id/claim', requireAuth, async (req, res, next) => {
  try {
    const { authorDisplayName, authorDistrict } = req.body
    if (!authorDisplayName || !authorDistrict) {
      res.status(400).json({ error: 'Nom affiché et quartier requis.' })
      return
    }
    const member = await getOrCreateMember(req.session!.sub, {
      displayName: authorDisplayName,
      district: authorDistrict,
    })
    const provider = await prisma.provider.update({
      where: { id: req.params.id },
      data: { claimedByMemberId: member.id },
    })
    res.json({ provider: toDomainProvider(provider) })
  } catch (err) {
    next(err)
  }
})

router.post('/providers/:id/recommendations', requireAuth, async (req, res, next) => {
  try {
    const { authorDisplayName, authorDistrict, ...recBody } = req.body
    if (!authorDisplayName || !authorDistrict) {
      res.status(400).json({ error: 'Nom affiché et quartier requis pour publier un retour.' })
      return
    }
    const body = recommendationInputSchema.parse({ ...recBody, providerId: req.params.id })

    const { domainProviders, domainRecommendations } = await loadDirectoryData()
    const provider = domainProviders.find((p) => p.id === req.params.id)
    if (!provider) {
      res.status(404).json({ error: 'Prestataire introuvable.' })
      return
    }

    const member = await getOrCreateMember(req.session!.sub, {
      displayName: authorDisplayName,
      district: authorDistrict,
    })

    const check = canRecommend(member.id, provider, domainRecommendations)
    if (!check.ok) {
      res.status(409).json({ error: check.error })
      return
    }

    const recommendation = await prisma.recommendation.create({
      data: {
        providerId: provider.id,
        authorMemberId: member.id,
        authorDistrict,
        rating: body.rating,
        wouldUseAgain: body.wouldUseAgain,
        jobLabel: body.jobLabel,
        jobDate: new Date(body.jobDate),
        pricePaid: body.pricePaid,
        priceUnit: body.priceUnit,
        comment: body.comment,
        proof: body.proof,
      },
    })
    res.status(201).json({ recommendation })
  } catch (err) {
    next(err)
  }
})

router.post('/recommendations/:id/confirm', requireAuth, async (req, res, next) => {
  try {
    const recommendation = await prisma.recommendation.findUnique({ where: { id: req.params.id } })
    if (!recommendation) {
      res.status(404).json({ error: 'Recommandation introuvable.' })
      return
    }
    // Confirmer ne collecte ni nom ni quartier : un membre sans historique
    // est créé avec des valeurs génériques (corrigées à sa 1re vraie contribution).
    const member = await getOrCreateMember(req.session!.sub)
    if (member.id === recommendation.authorMemberId) {
      res.status(400).json({ error: 'Impossible de confirmer votre propre recommandation.' })
      return
    }
    await prisma.recommendationConfirmation.upsert({
      where: { recommendationId_memberId: { recommendationId: recommendation.id, memberId: member.id } },
      create: { recommendationId: recommendation.id, memberId: member.id },
      update: {},
    })
    res.status(201).end()
  } catch (err) {
    next(err)
  }
})

export default router
