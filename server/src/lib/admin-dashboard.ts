import type {
  ContactRequestStatus,
  MatchSuggestionStatus,
  PlacementStage,
  TalentStatus,
  UserRole,
  UserStatus,
} from '@prisma/client'
import { prisma } from './prisma.js'
import { startOfUtcDay } from './preselection.js'
import { DAY_MS, bucketByDay, percentOrNull, rollingWeeks, seriesDays, zeroRecord } from './day-series.js'

/**
 * Indicateurs du tableau de bord admin (`GET /admin/stats`, champs ajoutés à
 * côté des anciens). Tout est lu en base au moment de l'appel — aucun chiffre
 * figé, aucune tendance estimée — en requêtes groupées (groupBy / count /
 * aggregate) et, pour les séries datées, une seule lecture des lignes des
 * 30 derniers jours réduite ici en jours (pas de requête par jour).
 *
 * Jours (calendrier de Madagascar, UTC+3 fixe), « 30 derniers jours » et
 * tendances sur 7 jours glissants : définitions communes de `lib/day-series.ts`.
 */

const ROLES: UserRole[] = ['candidate', 'recruiter', 'particulier', 'agent', 'talent', 'admin']
const STATUSES: UserStatus[] = ['active', 'warned', 'restricted', 'suspended', 'banned']
const MATCH_STATUSES: MatchSuggestionStatus[] = [
  'suggeree',
  'proposee_candidat',
  'interet_candidat',
  'proposee_recruteur',
  'interet_recruteur',
  'mise_en_relation',
  'ecartee',
]
const TALENT_STATUSES: TalentStatus[] = ['en_attente', 'verifie', 'recommande', 'place']
const PLACEMENT_STAGES: PlacementStage[] = ['etape1_due', 'etape1_payee', 'etape2_due', 'etape2_payee', 'annule']
const CONTACT_STATUSES: ContactRequestStatus[] = ['nouvelle', 'transmise', 'close']

export async function loadAdminDashboard(adminId: string, now: Date = new Date()) {
  const { start, days } = seriesDays(now)
  const startOfToday = startOfUtcDay(now)

  const [
    usersByRoleStatus,
    recentUsers,
    cvByStatus,
    candidatesWithConsent,
    suggestionsByStatus,
    recentConnections,
    recentSuggestions,
    offersTotal,
    openOffers,
    openOfferRecruiters,
    recentOffers,
    talentsByStatus,
    signalsToProcess,
    signalsInProgress,
    contactByStatus,
    talentLeadsNew,
    companyProofsToReview,
    companiesVisible,
    endorsementsBySubject,
    subscriptionsByPlan,
    plans,
    transactionsLast30,
    placementsByStage,
    placementsLast30,
    adminUnread,
  ] = await Promise.all([
    prisma.user.groupBy({ by: ['role', 'status'], _count: { _all: true } }),
    prisma.user.findMany({ where: { createdAt: { gte: start } }, select: { role: true, createdAt: true } }),
    prisma.candidateProfile.groupBy({
      by: ['cvVerificationStatus'],
      where: { cvUrl: { not: null } },
      _count: { _all: true },
    }),
    prisma.candidateProfile.count({ where: { matchingConsentAt: { not: null } } }),
    prisma.matchSuggestion.groupBy({ by: ['status'], _count: { _all: true } }),
    // `mise_en_relation` est terminal (`ADMIN_ALLOWED_TRANSITIONS`) : la
    // dernière mise à jour d'une telle ligne est la mise en relation elle-même.
    prisma.matchSuggestion.findMany({
      where: { status: 'mise_en_relation', updatedAt: { gte: start } },
      select: { updatedAt: true },
    }),
    prisma.matchSuggestion.findMany({
      where: { createdAt: { gte: new Date(now.getTime() - 14 * DAY_MS) } },
      select: { createdAt: true },
    }),
    prisma.opportunity.count(),
    prisma.opportunity.count({ where: { deadline: { gte: startOfToday } } }),
    // Offre ouverte : même définition que le moteur de matching et la
    // présélection (date limite ≥ début du jour UTC).
    prisma.opportunity.findMany({
      where: { deadline: { gte: startOfToday } },
      distinct: ['recruiterId'],
      select: { recruiterId: true },
    }),
    prisma.opportunity.findMany({
      where: { createdAt: { gte: new Date(now.getTime() - 14 * DAY_MS) } },
      select: { createdAt: true },
    }),
    prisma.talentProfile.groupBy({ by: ['status'], _count: { _all: true } }),
    // Signaux encore ouverts et non expirés (la purge paresseuse les passerait
    // à `expire` : on ne la déclenche pas ici, on ne les compte simplement pas).
    prisma.talentSignal.count({ where: { status: 'nouveau', expiresAt: { gte: now } } }),
    prisma.talentSignal.count({ where: { status: 'pris_en_charge', expiresAt: { gte: now } } }),
    prisma.talentContactRequest.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.talentLead.count({ where: { status: 'nouveau' } }),
    // Même périmètre que `pendingProofs` de `GET /admin/companies`.
    prisma.endorsement.count({
      where: { subjectType: 'entreprise', proofFileUrl: { not: null }, proofAccepted: null },
    }),
    prisma.company.count({ where: { hiddenAt: null } }),
    prisma.endorsement.groupBy({ by: ['subjectType'], where: { excludedAt: null }, _count: { _all: true } }),
    prisma.subscription.groupBy({ by: ['planCode'], _count: { _all: true } }),
    prisma.subscriptionPlan.findMany({ orderBy: { priceAr: 'asc' } }),
    prisma.transaction.aggregate({ where: { createdAt: { gte: start } }, _sum: { amountAr: true }, _count: true }),
    prisma.placement.groupBy({ by: ['stage'], _count: { _all: true } }),
    prisma.placement.count({ where: { createdAt: { gte: start } } }),
    prisma.notification.count({ where: { userId: adminId, read: false } }),
  ])

  /* --- Comptes ---------------------------------------------------- */
  const byRole = zeroRecord(ROLES)
  const byStatus = zeroRecord(STATUSES)
  for (const g of usersByRoleStatus) {
    byRole[g.role] += g._count._all
    byStatus[g.status] += g._count._all
  }
  const accountsTotal = ROLES.reduce((s, r) => s + byRole[r], 0)

  /* --- Inscriptions (30 jours) ------------------------------------ */
  const signupDates = recentUsers.map((u) => u.createdAt)
  const signupsByRole = Object.fromEntries(
    ROLES.map((r) => [r, bucketByDay(recentUsers.filter((u) => u.role === r).map((u) => u.createdAt), days)]),
  ) as Record<UserRole, number[]>
  const weeksByRole = Object.fromEntries(
    ROLES.map((r) => [r, rollingWeeks(recentUsers.filter((u) => u.role === r).map((u) => u.createdAt), now)]),
  ) as Record<UserRole, { last7: number; prev7: number }>
  const signupWeeks = rollingWeeks(signupDates, now)

  /* --- Candidats -------------------------------------------------- */
  const cv = { non_verifie: 0, verifie: 0, rejete: 0 }
  for (const g of cvByStatus) cv[g.cvVerificationStatus] = g._count._all
  const withCv = cv.non_verifie + cv.verifie + cv.rejete

  /* --- Matching --------------------------------------------------- */
  const matchByStatus = zeroRecord(MATCH_STATUSES)
  for (const g of suggestionsByStatus) matchByStatus[g.status] = g._count._all
  // Même périmètre que la file « À valider » de la page Mise en relation.
  const toValidate = matchByStatus.suggeree + matchByStatus.proposee_candidat + matchByStatus.interet_candidat
  const sentToRecruiter =
    matchByStatus.proposee_recruteur + matchByStatus.interet_recruteur + matchByStatus.mise_en_relation
  const connectionDates = recentConnections.map((s) => s.updatedAt)
  const connectionWeeks = rollingWeeks(connectionDates, now)
  const suggestionWeeks = rollingWeeks(recentSuggestions.map((s) => s.createdAt), now)

  /* --- Offres ----------------------------------------------------- */
  const offerWeeks = rollingWeeks(recentOffers.map((o) => o.createdAt), now)

  /* --- Emploi vérifié --------------------------------------------- */
  const talents = zeroRecord(TALENT_STATUSES)
  for (const g of talentsByStatus) talents[g.status] = g._count._all
  const contacts = zeroRecord(CONTACT_STATUSES)
  for (const g of contactByStatus) contacts[g.status] = g._count._all

  /* --- Recommandations -------------------------------------------- */
  const endorsements = { talent: 0, entreprise: 0 }
  for (const g of endorsementsBySubject) endorsements[g.subjectType] = g._count._all

  /* --- Abonnements (prix catalogue, paiements simulés) ------------ */
  const subsByPlan = new Map(subscriptionsByPlan.map((g) => [g.planCode, g._count._all]))
  const planRows = plans.map((p) => ({
    code: p.code,
    name: p.name,
    priceAr: p.priceAr,
    subscribers: subsByPlan.get(p.code) ?? 0,
  }))
  const paidSubscriptions = planRows.filter((p) => p.priceAr > 0).reduce((s, p) => s + p.subscribers, 0)
  const monthlyCatalogAr = planRows.reduce((s, p) => s + p.priceAr * p.subscribers, 0)

  /* --- Placements (suivi déclaratif) ------------------------------ */
  const stages = zeroRecord(PLACEMENT_STAGES)
  for (const g of placementsByStage) stages[g.stage] = g._count._all
  const placementsTotal = PLACEMENT_STAGES.reduce((s, k) => s + stages[k], 0)

  return {
    computedAt: now.toISOString(),
    timezone: 'UTC+3',
    seriesDays: days,
    signups: {
      total: bucketByDay(signupDates, days),
      byRole: signupsByRole,
      last30: signupDates.length,
      last7: signupWeeks.last7,
      prev7: signupWeeks.prev7,
      weeksByRole,
    },
    accounts: { total: accountsTotal, byRole, byStatus },
    candidates: {
      total: byRole.candidate,
      withCv,
      withConsent: candidatesWithConsent,
      cvToVerify: cv.non_verifie,
      cvVerified: cv.verifie,
      cvRejected: cv.rejete,
    },
    matching: {
      byStatus: matchByStatus,
      toValidate,
      transmitted: matchByStatus.proposee_recruteur,
      interest: matchByStatus.interet_recruteur,
      connected: matchByStatus.mise_en_relation,
      dismissed: matchByStatus.ecartee,
      sentToRecruiter,
      /** mises en relation / dossiers transmis encore actifs ou aboutis, en %
       *  (une décimale) ; `null` tant que rien n'a été transmis. */
      conversionPercent: percentOrNull(matchByStatus.mise_en_relation, sentToRecruiter),
      connectedSeries: bucketByDay(connectionDates, days),
      connectedLast30: connectionDates.length,
      connectedLast7: connectionWeeks.last7,
      connectedPrev7: connectionWeeks.prev7,
      createdLast7: suggestionWeeks.last7,
      createdPrev7: suggestionWeeks.prev7,
    },
    offers: {
      total: offersTotal,
      open: openOffers,
      expired: offersTotal - openOffers,
      recruitersWithOpenOffer: openOfferRecruiters.length,
      newLast7: offerWeeks.last7,
      newPrev7: offerWeeks.prev7,
    },
    verifiedEmployment: {
      talentsTotal: TALENT_STATUSES.reduce((s, k) => s + talents[k], 0),
      talentsByStatus: talents,
      signalsToProcess,
      signalsInProgress,
      contactRequestsNew: contacts.nouvelle,
      contactRequestsOpen: contacts.nouvelle + contacts.transmise,
      talentLeadsNew,
    },
    trust: {
      companyProofsToReview,
      companiesVisible,
      talentEndorsements: endorsements.talent,
      companyEndorsements: endorsements.entreprise,
    },
    billing: {
      plans: planRows,
      paidSubscriptions,
      monthlyCatalogAr,
      transactionsLast30Ar: transactionsLast30._sum.amountAr ?? 0,
      transactionsLast30Count: transactionsLast30._count,
    },
    placements: {
      total: placementsTotal,
      byStage: stages,
      inProgress: stages.etape1_due + stages.etape1_payee + stages.etape2_due,
      completed: stages.etape2_payee,
      cancelled: stages.annule,
      last30: placementsLast30,
    },
    notifications: { adminUnread },
  }
}
