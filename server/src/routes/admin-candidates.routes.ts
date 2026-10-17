import { Router } from 'express'
import type { MatchSuggestionStatus, Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { requireRole } from '../middleware/rbac.js'
import { adminCandidateIdParamSchema, adminCandidateListQuerySchema } from '../lib/validation.js'
import { parseCvFlags } from '../lib/cv-flags.js'
import {
  adminCandidateProfileSelect,
  cvVerifierName,
  cvVerifierSelect,
  normalizeLabel,
  toAdminCandidateProfile,
  toExtractedCvSuggestions,
} from '../lib/admin-candidates.js'
import { startOfUtcDay } from '../lib/preselection.js'
import { candidateCompletionChecks, candidateProfileCompletion } from '../../../src/lib/recommendation.js'

/**
 * Comptes candidats, côté admin (`/api/admin/candidates`) — CONSULTATION
 * seulement : compte, profil confirmé, CV et sa vérification, suggestions
 * extraites du CV (présentées à part, jamais appliquées au profil), dossiers
 * de mise en relation. Aucune action ici (sanction : `/admin/moderation` ;
 * décision sur le CV : `/verification-cv` ; transmission : `/admin/matching`).
 *
 * Réponses construites par liste blanche explicite (jamais de `passwordHash`,
 * d'empreinte de fichier ni d'objet Prisma étalé). Le téléphone n'apparaît
 * que dans le détail (l'admin y a droit), jamais dans la liste. Tous les
 * compteurs viennent de requêtes groupées : pas de requête par candidat.
 */
const router = Router()

router.use(requireRole('admin'))

const candidateSelect = {
  id: true,
  email: true,
  status: true,
  createdAt: true,
  candidateProfile: {
    select: {
      fullName: true,
      // Lu pour le taux de complétion uniquement : jamais renvoyé dans la liste.
      phone: true,
      province: true,
      city: true,
      educationLevel: true,
      experienceLevel: true,
      sector: true,
      skills: true,
      desiredOpportunityTypes: true,
      cvUrl: true,
      cvVerificationStatus: true,
      cvFlags: true,
      cvAttestedAt: true,
      cvExtractionDate: true,
      matchingConsentAt: true,
    },
  },
} as const satisfies Prisma.UserSelect

type CandidateRow = Prisma.UserGetPayload<{ select: typeof candidateSelect }>

/** Statuts suivis un par un ; `proposee_candidat` / `interet_candidat` (hérités) sont regroupés dans `legacy`. */
type DossierCounts = Record<
  'suggeree' | 'proposee_recruteur' | 'interet_recruteur' | 'mise_en_relation' | 'ecartee' | 'legacy',
  number
>

function emptyDossierCounts(): DossierCounts {
  return { suggeree: 0, proposee_recruteur: 0, interet_recruteur: 0, mise_en_relation: 0, ecartee: 0, legacy: 0 }
}

function dossierKey(status: MatchSuggestionStatus): keyof DossierCounts {
  return status === 'proposee_candidat' || status === 'interet_candidat' ? 'legacy' : status
}

function later(a: Date | null, b: Date | null | undefined): Date | null {
  if (!b) return a
  return !a || b > a ? b : a
}

/**
 * Activité d'un ensemble de candidats, en un nombre fixe de requêtes
 * groupées : dossiers par statut, dépôts de CV, actions du compte (journal
 * d'audit : connexion, dépôt, consentement…), signalements ouverts.
 */
async function loadActivity(ids: string[]) {
  if (ids.length === 0) {
    return {
      dossiers: new Map<string, DossierCounts>(),
      lastDossier: new Map<string, Date | null>(),
      lastSubmission: new Map<string, Date | null>(),
      lastAudit: new Map<string, Date | null>(),
      reports: new Map<string, number>(),
    }
  }
  const [suggestions, submissions, audits, reports] = await Promise.all([
    prisma.matchSuggestion.groupBy({
      by: ['candidateId', 'status'],
      where: { candidateId: { in: ids } },
      _count: { _all: true },
      _max: { updatedAt: true },
    }),
    prisma.cvSubmission.groupBy({
      by: ['candidateId'],
      where: { candidateId: { in: ids } },
      _max: { createdAt: true },
    }),
    prisma.auditLog.groupBy({
      by: ['userId'],
      where: { userId: { in: ids } },
      _max: { createdAt: true },
    }),
    prisma.report.groupBy({
      by: ['targetUserId'],
      where: { status: 'open', targetUserId: { in: ids } },
      _count: { _all: true },
    }),
  ])

  const dossiers = new Map<string, DossierCounts>()
  const lastDossier = new Map<string, Date | null>()
  for (const g of suggestions) {
    const counts = dossiers.get(g.candidateId) ?? emptyDossierCounts()
    counts[dossierKey(g.status)] += g._count._all
    dossiers.set(g.candidateId, counts)
    lastDossier.set(g.candidateId, later(lastDossier.get(g.candidateId) ?? null, g._max.updatedAt))
  }
  return {
    dossiers,
    lastDossier,
    lastSubmission: new Map(submissions.map((s) => [s.candidateId, s._max.createdAt])),
    lastAudit: new Map(audits.map((a) => [a.userId as string, a._max.createdAt])),
    reports: new Map(reports.map((r) => [r.targetUserId as string, r._count._all])),
  }
}

type Activity = Awaited<ReturnType<typeof loadActivity>>

/** Fiche candidat (liste et détail) — liste blanche explicite. */
function buildSummary(c: CandidateRow, activity: Activity) {
  const p = c.candidateProfile
  let lastActivity: Date | null = c.createdAt
  lastActivity = later(lastActivity, activity.lastAudit.get(c.id))
  lastActivity = later(lastActivity, activity.lastSubmission.get(c.id))
  lastActivity = later(lastActivity, activity.lastDossier.get(c.id))
  lastActivity = later(lastActivity, p?.matchingConsentAt)
  // CV déposés avant l'historique `CvSubmission` : on retombe sur l'attestation puis l'extraction (comme la file des CV).
  const submittedAt = p?.cvUrl ? (activity.lastSubmission.get(c.id) ?? p.cvAttestedAt ?? p.cvExtractionDate) : null
  const dossiers = activity.dossiers.get(c.id) ?? emptyDossierCounts()

  return {
    id: c.id,
    email: c.email,
    /** Nom du profil, ou l'email à défaut de profil. */
    displayName: p?.fullName.trim() || c.email,
    status: c.status,
    createdAt: c.createdAt.toISOString(),
    lastActivityAt: (lastActivity ?? c.createdAt).toISOString(),
    profile: p
      ? {
          city: p.city,
          province: p.province,
          educationLevel: p.educationLevel,
          experienceLevel: p.experienceLevel,
          sector: p.sector,
          skillsCount: p.skills.length,
        }
      : null,
    /** Taux de complétion (0–100), même règle que la carte « Complétez votre profil » du candidat. */
    completion: p ? candidateProfileCompletion(p) : null,
    cv: {
      uploaded: Boolean(p?.cvUrl),
      /** `null` sans CV déposé. */
      verificationStatus: p?.cvUrl ? p.cvVerificationStatus : null,
      submittedAt: submittedAt ? submittedAt.toISOString() : null,
      flagCount: p?.cvUrl ? parseCvFlags(p.cvFlags).length : 0,
    },
    matchingConsentAt: p?.matchingConsentAt ? p.matchingConsentAt.toISOString() : null,
    counts: {
      ...dossiers,
      openReports: activity.reports.get(c.id) ?? 0,
    },
  }
}

type CandidateSummary = ReturnType<typeof buildSummary>

/** Filtres appliqués en mémoire (recherche sans accents, y compris dans les compétences). */
function matchesFilters(
  c: CandidateRow,
  query: { q?: string; consent?: 'given' | 'missing'; cv?: 'present' | 'absent' | 'non_verifie' | 'verifie' | 'rejete' },
): boolean {
  const p = c.candidateProfile
  if (query.q) {
    const needle = normalizeLabel(query.q)
    const haystack = [c.email, p?.fullName ?? '', ...(p?.skills ?? [])].map(normalizeLabel)
    if (!haystack.some((value) => value.includes(needle))) return false
  }
  if (query.consent) {
    const given = Boolean(p?.matchingConsentAt)
    if (given !== (query.consent === 'given')) return false
  }
  if (query.cv) {
    const hasCv = Boolean(p?.cvUrl)
    if (query.cv === 'present' && !hasCv) return false
    if (query.cv === 'absent' && hasCv) return false
    if (query.cv !== 'present' && query.cv !== 'absent' && (!hasCv || p?.cvVerificationStatus !== query.cv)) return false
  }
  return true
}

function compareSummaries(sort: 'activity' | 'recent' | 'name' | 'completion') {
  return (a: CandidateSummary, b: CandidateSummary) => {
    if (sort === 'name') {
      const byName = a.displayName.localeCompare(b.displayName, 'fr', { sensitivity: 'base' })
      if (byName !== 0) return byName
    } else if (sort === 'recent') {
      const byDate = Date.parse(b.createdAt) - Date.parse(a.createdAt)
      if (byDate !== 0) return byDate
    } else if (sort === 'completion') {
      const byCompletion = (b.completion ?? -1) - (a.completion ?? -1)
      if (byCompletion !== 0) return byCompletion
      const byActivity = Date.parse(b.lastActivityAt) - Date.parse(a.lastActivityAt)
      if (byActivity !== 0) return byActivity
    } else {
      const byActivity = Date.parse(b.lastActivityAt) - Date.parse(a.lastActivityAt)
      if (byActivity !== 0) return byActivity
    }
    return a.id.localeCompare(b.id)
  }
}

/**
 * Liste des comptes candidats. La recherche (sans accents, y compris dans les
 * compétences), les filtres et les tris par activité ou complétude portent
 * sur des valeurs calculées : les comptes sont chargés avec une projection
 * étroite, filtrés, triés puis paginés en mémoire (volume attendu : quelques
 * milliers de comptes au plus), les compteurs venant de requêtes groupées.
 * `statusCounts` suit la recherche et les autres filtres, pas le filtre de
 * statut lui-même (comme pour les recruteurs).
 */
router.get('/', async (req, res, next) => {
  try {
    const query = adminCandidateListQuerySchema.parse(req.query)
    const rows = await prisma.user.findMany({ where: { role: 'candidate' }, select: candidateSelect })

    const base = rows.filter((c) => matchesFilters(c, query))
    const statusCounts = { active: 0, warned: 0, restricted: 0, suspended: 0, banned: 0 }
    for (const c of base) statusCounts[c.status] += 1
    const filtered = query.status ? base.filter((c) => c.status === query.status) : base

    const activity = await loadActivity(filtered.map((c) => c.id))
    const summaries = filtered.map((c) => buildSummary(c, activity)).sort(compareSummaries(query.sort))

    res.json({
      total: summaries.length,
      totalCandidates: rows.length,
      limit: query.limit,
      offset: query.offset,
      statusCounts,
      candidates: summaries.slice(query.offset, query.offset + query.limit),
    })
  } catch (err) {
    next(err)
  }
})

/** Plafond de dossiers renvoyés dans le détail (les compteurs portent toujours sur tous). */
const DETAIL_DOSSIER_LIMIT = 200

/**
 * Détail d'un candidat : fiche (comme dans la liste), profil confirmé
 * complet, CV (dépôts, vérification et son historique, alertes), suggestions
 * extraites du CV — séparées du profil et jamais appliquées —, et ses
 * dossiers de mise en relation, les plus récemment mis à jour d'abord.
 */
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = adminCandidateIdParamSchema.parse(req.params)
    const candidate = await prisma.user.findFirst({ where: { id, role: 'candidate' }, select: candidateSelect })
    if (!candidate) {
      res.status(404).json({ error: 'Compte candidat introuvable.' })
      return
    }

    const [activity, details, dossiers] = await Promise.all([
      loadActivity([id]),
      prisma.user.findUnique({
        where: { id },
        select: {
          email: true,
          createdAt: true,
          candidateProfile: {
            select: {
              ...adminCandidateProfileSelect,
              cvAttestedAt: true,
              cvVerifiedAt: true,
              cvVerificationNote: true,
              cvSkillsSuggested: true,
              cvProfessionalTitle: true,
              cvProfessionalSummary: true,
              cvExperiences: true,
              cvEducation: true,
              cvCertifications: true,
              cvProjects: true,
              cvLanguages: true,
              cvTechnologies: true,
              cvYearsOfExperience: true,
              cvDesiredLocations: true,
              cvAvailability: true,
              cvExtractionConfidence: true,
              cvExtractionDate: true,
            },
          },
          cvSubmissions: { orderBy: { createdAt: 'desc' }, select: { createdAt: true, fileUrl: true, flags: true } },
          cvVerifications: {
            orderBy: { createdAt: 'desc' },
            select: { decision: true, note: true, createdAt: true, verifier: { select: cvVerifierSelect } },
          },
        },
      }),
      prisma.matchSuggestion.findMany({
        where: { candidateId: id },
        orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
        select: {
          id: true,
          status: true,
          score: true,
          origin: true,
          reasons: true,
          preselectionRank: true,
          createdAt: true,
          updatedAt: true,
          opportunity: {
            select: {
              id: true,
              title: true,
              companyName: true,
              city: true,
              deadline: true,
              recruiter: {
                select: { id: true, email: true, recruiterProfile: { select: { companyName: true } } },
              },
            },
          },
        },
      }),
    ])

    const summary = buildSummary(candidate, activity)
    const p = details?.candidateProfile ?? null
    const today = startOfUtcDay(new Date())

    res.json({
      candidate: summary,
      profile: p && details ? toAdminCandidateProfile(p, details) : null,
      /** Libellés des éléments manquants pour atteindre 100 % de complétion. */
      completionMissing: p ? candidateCompletionChecks(p).flatMap((c) => (c.done ? [] : [c.label])) : [],
      cv: {
        url: p?.cvUrl ?? null,
        submittedAt: summary.cv.submittedAt,
        attestedAt: p?.cvAttestedAt ? p.cvAttestedAt.toISOString() : null,
        verificationStatus: summary.cv.verificationStatus,
        verifiedAt: p?.cvUrl && p.cvVerifiedAt ? p.cvVerifiedAt.toISOString() : null,
        verificationNote: p?.cvUrl ? p.cvVerificationNote : null,
        flags: p?.cvUrl ? parseCvFlags(p.cvFlags) : [],
        /** Dépôts successifs, du plus récent au plus ancien (sans lien : seul le CV en vigueur s'ouvre). */
        submissions: (details?.cvSubmissions ?? []).map((s) => ({
          submittedAt: s.createdAt.toISOString(),
          current: Boolean(p?.cvUrl) && s.fileUrl === p?.cvUrl,
          flagCount: parseCvFlags(s.flags).length,
        })),
        /** Décisions de vérification (historique jamais écrasé), la plus récente d'abord. */
        history: (details?.cvVerifications ?? []).map((v) => ({
          decision: v.decision,
          note: v.note,
          verifierName: cvVerifierName(v.verifier),
          createdAt: v.createdAt.toISOString(),
        })),
      },
      /** Suggestions extraites du CV, NON confirmées : jamais appliquées au profil ni utilisées dans un score. */
      extracted: p?.cvUrl ? toExtractedCvSuggestions(p) : null,
      dossiersTotal: dossiers.length,
      dossiers: dossiers.slice(0, DETAIL_DOSSIER_LIMIT).map((d) => ({
        id: d.id,
        status: d.status,
        score: d.score,
        origin: d.origin,
        reasons: d.reasons,
        preselectionRank: d.preselectionRank,
        createdAt: d.createdAt.toISOString(),
        updatedAt: d.updatedAt.toISOString(),
        opportunity: {
          id: d.opportunity.id,
          title: d.opportunity.title,
          companyName: d.opportunity.companyName,
          city: d.opportunity.city,
          deadline: d.opportunity.deadline.toISOString(),
          expired: d.opportunity.deadline < today,
        },
        recruiter: {
          id: d.opportunity.recruiter.id,
          email: d.opportunity.recruiter.email,
          displayName: d.opportunity.recruiter.recruiterProfile?.companyName || d.opportunity.recruiter.email,
        },
      })),
    })
  } catch (err) {
    next(err)
  }
})

export default router
