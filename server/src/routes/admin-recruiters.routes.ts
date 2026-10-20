import { Router } from 'express'
import type { MatchSuggestionStatus, Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { requireRole } from '../middleware/rbac.js'
import { adminRecruiterIdParamSchema, adminRecruiterListQuerySchema } from '../lib/validation.js'
import { loadCompanyTrust } from '../lib/companies.js'
import { opportunityClosedReason, startOfUtcDay } from '../lib/preselection.js'
import { MISSIONS_SELECT, missionsOf } from '../lib/opportunity-missions.js'
import { HIRING_SUPPORTED, filledAtOf } from '../lib/hiring-store.js'

/**
 * Comptes recruteurs, côté admin (`/api/admin/recruiters`) — CONSULTATION
 * seulement : identité du compte, profil déclaré, abonnement, fiche
 * entreprise liée, offres et avancement des profils proposés. Aucune action
 * ici (sanction : `/admin/moderation` ; liaison d'entreprise :
 * `/admin/companies` ; transmission de profils : `/admin/matching`).
 *
 * Réponses construites par liste blanche explicite (jamais de `passwordHash`,
 * ni du téléphone du recruteur, ni d'un objet Prisma étalé). Tous les
 * compteurs viennent de requêtes groupées : pas de requête par recruteur.
 */
const router = Router()

router.use(requireRole('admin'))

const recruiterSelect = {
  id: true,
  email: true,
  status: true,
  createdAt: true,
  recruiterProfile: { select: { companyName: true, sector: true, city: true, province: true } },
  subscription: {
    select: { planCode: true, startedAt: true, plan: { select: { name: true, priceAr: true } } },
  },
  linkedCompany: { select: { id: true, name: true, city: true, hiddenAt: true } },
} as const

type RecruiterRow = Prisma.UserGetPayload<{ select: typeof recruiterSelect }>

interface OpportunityLite {
  id: string
  recruiterId: string
  deadline: Date
  createdAt: Date
}

/**
 * `filledAt` (offre pourvue, D1) ajouté au `select` des offres seulement avec
 * un client Prisma régénéré ; lu ensuite par `filledAtOf` (`null` sinon).
 */
const OPPORTUNITY_FILL_SELECT = (HIRING_SUPPORTED ? { filledAt: true } : {}) as {}

/**
 * Offre ouverte : la définition UNIQUE `opportunityClosedReason`
 * (lib/preselection.ts, jumelle SQL `openOpportunityWhere`) — date limite
 * non dépassée, offre non pourvue, compte recruteur actif. Sous-lot 6 : une
 * offre pourvue n'était plus comptée à part et passait pour ouverte.
 */
function offerState(o: OpportunityLite, recruiterStatus: string, now: Date) {
  const filledAt = filledAtOf(o)
  const closedReason = opportunityClosedReason({ deadline: o.deadline, filledAt }, { role: 'recruiter', status: recruiterStatus }, now)
  return {
    open: closedReason === null,
    closedReason,
    filled: filledAt !== null,
    /** Date limite dépassée sur une offre non pourvue. */
    expired: filledAt === null && o.deadline < startOfUtcDay(now),
  }
}

/** Statuts suivis un par un ; `proposee_candidat` / `interet_candidat` (hérités) sont regroupés dans `legacy`. */
type SuggestionCounts = Record<
  'suggeree' | 'proposee_recruteur' | 'interet_recruteur' | 'mise_en_relation' | 'ecartee' | 'legacy',
  number
>

function emptySuggestionCounts(): SuggestionCounts {
  return { suggeree: 0, proposee_recruteur: 0, interet_recruteur: 0, mise_en_relation: 0, ecartee: 0, legacy: 0 }
}

function suggestionKey(status: MatchSuggestionStatus): keyof SuggestionCounts {
  return status === 'proposee_candidat' || status === 'interet_candidat' ? 'legacy' : status
}

function later(a: Date | null, b: Date | null | undefined): Date | null {
  if (!b) return a
  return !a || b > a ? b : a
}

/**
 * Agrège, en un nombre fixe de requêtes groupées, l'activité d'un ensemble de
 * recruteurs à partir de leurs offres (déjà chargées par l'appelant).
 */
async function loadActivity(recruiterIds: string[], opportunities: OpportunityLite[]) {
  const oppIds = opportunities.map((o) => o.id)
  const [suggestions, proposals, placements, reports] = await Promise.all([
    oppIds.length
      ? prisma.matchSuggestion.groupBy({
          by: ['opportunityId', 'status'],
          where: { opportunityId: { in: oppIds } },
          _count: { _all: true },
          _max: { updatedAt: true },
        })
      : Promise.resolve([]),
    oppIds.length
      ? prisma.talentOpportunityProposal.groupBy({
          by: ['opportunityId'],
          where: { opportunityId: { in: oppIds } },
          _count: { _all: true },
          _max: { proposedAt: true },
        })
      : Promise.resolve([]),
    recruiterIds.length
      ? prisma.placement.groupBy({
          by: ['recruiterId'],
          where: { recruiterId: { in: recruiterIds } },
          _count: { _all: true },
          _max: { updatedAt: true },
        })
      : Promise.resolve([]),
    recruiterIds.length
      ? prisma.report.groupBy({
          by: ['targetUserId'],
          where: { status: 'open', targetUserId: { in: recruiterIds } },
          _count: { _all: true },
        })
      : Promise.resolve([]),
  ])

  const suggestionsByOpp = new Map<string, SuggestionCounts>()
  const lastSuggestionByOpp = new Map<string, Date | null>()
  for (const g of suggestions) {
    const counts = suggestionsByOpp.get(g.opportunityId) ?? emptySuggestionCounts()
    counts[suggestionKey(g.status)] += g._count._all
    suggestionsByOpp.set(g.opportunityId, counts)
    lastSuggestionByOpp.set(g.opportunityId, later(lastSuggestionByOpp.get(g.opportunityId) ?? null, g._max.updatedAt))
  }
  const proposalsByOpp = new Map(proposals.map((p) => [p.opportunityId, { count: p._count._all, last: p._max.proposedAt }]))
  const placementsByRecruiter = new Map(placements.map((p) => [p.recruiterId, { count: p._count._all, last: p._max.updatedAt }]))
  const reportsByUser = new Map(reports.map((r) => [r.targetUserId as string, r._count._all]))

  return { suggestionsByOpp, lastSuggestionByOpp, proposalsByOpp, placementsByRecruiter, reportsByUser }
}

type Activity = Awaited<ReturnType<typeof loadActivity>>

/** Fiche recruteur (liste et détail) — liste blanche explicite. */
function buildSummaries(
  recruiters: RecruiterRow[],
  opportunities: OpportunityLite[],
  activity: Activity,
  trust: Awaited<ReturnType<typeof loadCompanyTrust>>,
) {
  const now = new Date()
  const oppsByRecruiter = new Map<string, OpportunityLite[]>()
  for (const o of opportunities) {
    const list = oppsByRecruiter.get(o.recruiterId) ?? []
    list.push(o)
    oppsByRecruiter.set(o.recruiterId, list)
  }

  return recruiters.map((r) => {
    const opps = oppsByRecruiter.get(r.id) ?? []
    const totals = emptySuggestionCounts()
    let talentProposals = 0
    let lastActivity: Date | null = r.createdAt
    for (const o of opps) {
      lastActivity = later(lastActivity, o.createdAt)
      const s = activity.suggestionsByOpp.get(o.id)
      if (s) for (const k of Object.keys(totals) as (keyof SuggestionCounts)[]) totals[k] += s[k]
      lastActivity = later(lastActivity, activity.lastSuggestionByOpp.get(o.id))
      const p = activity.proposalsByOpp.get(o.id)
      if (p) {
        talentProposals += p.count
        lastActivity = later(lastActivity, p.last)
      }
    }
    const placement = activity.placementsByRecruiter.get(r.id)
    lastActivity = later(lastActivity, placement?.last)
    const states = opps.map((o) => offerState(o, r.status, now))
    const openOffers = states.filter((state) => state.open).length
    const companyTrust = r.linkedCompany ? trust.get(r.linkedCompany.id)?.trust : undefined

    return {
      id: r.id,
      email: r.email,
      displayName: r.recruiterProfile?.companyName || r.email,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
      lastActivityAt: (lastActivity ?? r.createdAt).toISOString(),
      profile: r.recruiterProfile
        ? {
            companyName: r.recruiterProfile.companyName,
            sector: r.recruiterProfile.sector,
            city: r.recruiterProfile.city,
            province: r.recruiterProfile.province,
          }
        : null,
      subscription: r.subscription
        ? {
            planCode: r.subscription.planCode,
            planName: r.subscription.plan.name,
            priceAr: r.subscription.plan.priceAr,
            startedAt: r.subscription.startedAt.toISOString(),
          }
        : null,
      linkedCompany: r.linkedCompany
        ? {
            id: r.linkedCompany.id,
            name: r.linkedCompany.name,
            city: r.linkedCompany.city,
            hidden: r.linkedCompany.hiddenAt !== null,
            trust: companyTrust
              ? {
                  level: companyTrust.level,
                  index: companyTrust.index,
                  independentSources: companyTrust.independentSources,
                }
              : null,
          }
        : null,
      counts: {
        offers: opps.length,
        /** Offres ouvertes : `opportunityClosedReason` (non pourvue, date limite, compte actif). */
        openOffers,
        /** Offres pourvues (D1), quelle que soit leur date limite. */
        filledOffers: states.filter((state) => state.filled).length,
        /** Date limite dépassée, offre non pourvue. */
        expiredOffers: states.filter((state) => state.expired).length,
        /** Profils en attente de validation admin (`suggeree`). */
        awaitingValidation: totals.suggeree,
        /** Profils actuellement chez le recruteur : transmis, intérêt exprimé ou mis en relation. */
        proposedProfiles: totals.proposee_recruteur + totals.interet_recruteur + totals.mise_en_relation,
        /** Le recruteur s'est dit intéressé (y compris ceux déjà mis en relation). */
        interests: totals.interet_recruteur + totals.mise_en_relation,
        connections: totals.mise_en_relation,
        discarded: totals.ecartee,
        talentProposals,
        placements: placement?.count ?? 0,
        openReports: activity.reportsByUser.get(r.id) ?? 0,
      },
    }
  })
}

async function loadCompanyTrustFor(recruiters: RecruiterRow[]) {
  return loadCompanyTrust(recruiters.flatMap((r) => (r.linkedCompany ? [r.linkedCompany.id] : [])))
}

/**
 * Liste des comptes recruteurs. Le tri par activité a besoin des compteurs de
 * tous les comptes filtrés : ils sont agrégés en un nombre fixe de requêtes
 * groupées, puis triés et paginés en mémoire (volume attendu : quelques
 * centaines de comptes au plus).
 */
router.get('/', async (req, res, next) => {
  try {
    const query = adminRecruiterListQuerySchema.parse(req.query)
    const baseWhere: Prisma.UserWhereInput = {
      role: 'recruiter',
      ...(query.q
        ? {
            OR: [
              { email: { contains: query.q, mode: 'insensitive' } },
              { recruiterProfile: { companyName: { contains: query.q, mode: 'insensitive' } } },
              { linkedCompany: { name: { contains: query.q, mode: 'insensitive' } } },
            ],
          }
        : {}),
    }
    const where: Prisma.UserWhereInput = query.status ? { ...baseWhere, status: query.status } : baseWhere

    const [recruiters, statusGroups, totalRecruiters] = await Promise.all([
      prisma.user.findMany({ where, select: recruiterSelect }),
      prisma.user.groupBy({ by: ['status'], where: baseWhere, _count: { _all: true } }),
      prisma.user.count({ where: { role: 'recruiter' } }),
    ])
    const ids = recruiters.map((r) => r.id)
    const opportunities = ids.length
      ? await prisma.opportunity.findMany({
          where: { recruiterId: { in: ids } },
          select: { id: true, recruiterId: true, deadline: true, createdAt: true, ...OPPORTUNITY_FILL_SELECT },
        })
      : []
    const [activity, trust] = await Promise.all([loadActivity(ids, opportunities), loadCompanyTrustFor(recruiters)])
    const summaries = buildSummaries(recruiters, opportunities, activity, trust)

    summaries.sort((a, b) => {
      if (query.sort === 'name') {
        const byName = a.displayName.localeCompare(b.displayName, 'fr', { sensitivity: 'base' })
        if (byName !== 0) return byName
      } else if (query.sort === 'recent') {
        const byDate = Date.parse(b.createdAt) - Date.parse(a.createdAt)
        if (byDate !== 0) return byDate
      } else {
        const byActivity = Date.parse(b.lastActivityAt) - Date.parse(a.lastActivityAt)
        if (byActivity !== 0) return byActivity
      }
      return a.id.localeCompare(b.id)
    })

    const statusCounts = { active: 0, warned: 0, restricted: 0, suspended: 0, banned: 0 }
    for (const g of statusGroups) statusCounts[g.status] = g._count._all

    res.json({
      total: summaries.length,
      totalRecruiters,
      limit: query.limit,
      offset: query.offset,
      statusCounts,
      recruiters: summaries.slice(query.offset, query.offset + query.limit),
    })
  } catch (err) {
    next(err)
  }
})

/** Plafond d'offres renvoyées dans le détail (les compteurs portent toujours sur toutes). */
const DETAIL_OPPORTUNITY_LIMIT = 200

/**
 * Détail d'un recruteur : sa fiche, ses offres (ouvertes d'abord) avec la
 * répartition des profils par statut, et la conversation existante entre
 * l'admin connecté et ce recruteur, s'il y en a une.
 */
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = adminRecruiterIdParamSchema.parse(req.params)
    const me = req.session!.sub
    const recruiter = await prisma.user.findFirst({ where: { id, role: 'recruiter' }, select: recruiterSelect })
    if (!recruiter) {
      res.status(404).json({ error: 'Compte recruteur introuvable.' })
      return
    }

    const [opportunities, conversation] = await Promise.all([
      prisma.opportunity.findMany({
        where: { recruiterId: id },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          recruiterId: true,
          title: true,
          companyName: true,
          category: true,
          sector: true,
          opportunityType: true,
          level: true,
          province: true,
          city: true,
          requiredSkills: true,
          ...MISSIONS_SELECT,
          deadline: true,
          featured: true,
          createdAt: true,
          ...OPPORTUNITY_FILL_SELECT,
        },
      }),
      prisma.conversation.findFirst({
        where: {
          OR: [
            { participantAId: me, participantBId: id },
            { participantAId: id, participantBId: me },
          ],
        },
        orderBy: { createdAt: 'desc' },
        select: { id: true },
      }),
    ])
    const oppIds = opportunities.map((o) => o.id)
    const [activity, trust, placementsByOpp] = await Promise.all([
      loadActivity([id], opportunities),
      loadCompanyTrustFor([recruiter]),
      oppIds.length
        ? prisma.placement.groupBy({
            by: ['opportunityId'],
            where: { opportunityId: { in: oppIds } },
            _count: { _all: true },
          })
        : Promise.resolve([]),
    ])
    const [summary] = buildSummaries([recruiter], opportunities, activity, trust)
    const placementCount = new Map(placementsByOpp.map((p) => [p.opportunityId as string, p._count._all]))

    const now = new Date()
    const offers = opportunities
      .map((o) => ({
        id: o.id,
        title: o.title,
        companyName: o.companyName,
        category: o.category,
        sector: o.sector,
        opportunityType: o.opportunityType,
        level: o.level,
        province: o.province,
        city: o.city,
        requiredSkills: o.requiredSkills,
        missions: missionsOf(o),
        featured: o.featured,
        createdAt: o.createdAt.toISOString(),
        deadline: o.deadline.toISOString(),
        // Même définition que les compteurs (`offerState`) : `open`,
        // `closedReason` (texte affiché), `filled`, `expired`.
        ...offerState(o, recruiter.status, now),
        suggestions: activity.suggestionsByOpp.get(o.id) ?? emptySuggestionCounts(),
        talentProposals: activity.proposalsByOpp.get(o.id)?.count ?? 0,
        placements: placementCount.get(o.id) ?? 0,
      }))
      // Ouvertes d'abord (date limite la plus proche en tête), puis fermées —
      // pourvues ou expirées (les plus récentes en tête).
      .sort((a, b) => {
        if (a.open !== b.open) return a.open ? -1 : 1
        const byDeadline = !a.open
          ? Date.parse(b.deadline) - Date.parse(a.deadline)
          : Date.parse(a.deadline) - Date.parse(b.deadline)
        return byDeadline !== 0 ? byDeadline : a.id.localeCompare(b.id)
      })

    res.json({
      recruiter: summary,
      conversationId: conversation?.id ?? null,
      opportunitiesTotal: offers.length,
      opportunities: offers.slice(0, DETAIL_OPPORTUNITY_LIMIT),
    })
  } catch (err) {
    next(err)
  }
})

export default router
