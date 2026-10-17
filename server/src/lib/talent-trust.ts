import { prisma } from './prisma.js'
import { buildTrustEvidence } from './endorsement-evidence.js'
import { roleLabel } from './notify.js'
import { evaluateSubject } from '../../../src/lib/trust.js'
import type { EndorsementRelation, SubjectTrust, TrustEvidence } from '../../../src/types/index.js'

/**
 * Confiance des talents (profils créés par un agent), calculée TOUJOURS côté
 * serveur : l'empreinte d'auteur (`authorLinkKey`) ne quitte jamais ce
 * module. Les recommandations d'un talent sont celles de tous les signaux
 * rattachés à son profil (`TalentSignal.talentId`), signaux fusionnés compris
 * (ils reçoivent le `talentId` à la conversion).
 *
 * Réutilisable pour les entreprises (lot 5) : seul le chargement des lignes
 * change, le moteur (`evaluateSubject`) et les vues restent les mêmes.
 */

const endorsementSelect = {
  id: true,
  talentSignalId: true,
  authorMemberId: true,
  authorDistrict: true,
  relation: true,
  jobLabel: true,
  jobDate: true,
  highlights: true,
  comment: true,
  proof: true,
  proofFileUrl: true,
  proofAccepted: true,
  reviewedAt: true,
  hiddenJobLabel: true,
  excludedAt: true,
  excludedReason: true,
  createdAt: true,
  authorMember: { select: { displayName: true, user: { select: { role: true } } } },
  talentSignal: { select: { talentId: true } },
} as const

async function loadRows(talentIds: string[]) {
  return prisma.endorsement.findMany({
    where: { talentSignal: { talentId: { in: talentIds } } },
    select: endorsementSelect,
    orderBy: { createdAt: 'asc' },
  })
}

export type TalentEndorsementRow = Awaited<ReturnType<typeof loadRows>>[number]

export interface TalentTrustEntry {
  trust: SubjectTrust
  /** Toutes les recommandations rattachées (écartées comprises), plus anciennes d'abord. */
  rows: TalentEndorsementRow[]
}

/**
 * Confiance de plusieurs talents en une passe groupée (pas de N+1) : une
 * requête pour les recommandations, puis `buildTrustEvidence` (membres, nombre
 * d'avis par auteur — annuaire + recommandations —, confirmations, téléphones)
 * en requêtes groupées. Chaque id demandé a une entrée, même sans
 * recommandation (niveau « Nouveau »).
 */
export async function loadTalentTrust(talentIds: string[], now = Date.now()): Promise<Map<string, TalentTrustEntry>> {
  const ids = [...new Set(talentIds)]
  const out = new Map<string, TalentTrustEntry>()
  if (ids.length === 0) return out
  const rows = await loadRows(ids)
  const evidence = await buildTrustEvidence(rows)
  const byTalent = new Map<string, number[]>(ids.map((id) => [id, []]))
  rows.forEach((r, i) => {
    const talentId = r.talentSignal?.talentId
    if (talentId) byTalent.get(talentId)?.push(i)
  })
  for (const id of ids) {
    const idx = byTalent.get(id) ?? []
    out.set(id, {
      trust: evaluateSubject(
        idx.map((i) => evidence[i]),
        now,
      ),
      rows: idx.map((i) => rows[i]),
    })
  }
  return out
}

/** Mêmes règles que `evaluateSubject` : écartées retirées, une par auteur (la plus récente). */
export function retainedEndorsements(rows: TalentEndorsementRow[]): TalentEndorsementRow[] {
  const seen = new Set<string>()
  return rows
    .filter((r) => !r.excludedAt)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .filter((r) => {
      if (seen.has(r.authorMemberId)) return false
      seen.add(r.authorMemberId)
      return true
    })
}

/** Vue agent (suivi du talent) / admin : tout, y compris commentaire et photo (servie avec contrôle d'accès). */
export function agentEndorsementView(r: TalentEndorsementRow) {
  return {
    id: r.id,
    signalId: r.talentSignalId,
    relation: r.relation,
    jobLabel: r.jobLabel,
    jobDate: r.jobDate.toISOString(),
    highlights: r.highlights,
    comment: r.comment,
    proof: r.proof,
    proofFileUrl: r.proofFileUrl,
    proofAccepted: r.proofAccepted,
    reviewedAt: r.reviewedAt?.toISOString() ?? null,
    hiddenJobLabel: r.hiddenJobLabel,
    excludedAt: r.excludedAt?.toISOString() ?? null,
    excludedReason: r.excludedReason,
    createdAt: r.createdAt.toISOString(),
    authorDistrict: r.authorDistrict,
    authorName: r.authorMember.displayName,
    authorRoleLabel: roleLabel(r.authorMember.user.role),
  }
}

const RELATION_AUTHOR: Record<EndorsementRelation, string> = {
  client: 'Un client',
  employeur: 'Un employeur',
  collegue: 'Un collègue',
  salarie: 'Un salarié',
  stagiaire: 'Un stagiaire',
  prestataire: 'Un prestataire',
}

/**
 * Vue recruteur (shortlist) : jamais de commentaire, de nom d'auteur, de
 * photo ni d'URL de preuve, de contact ni d'empreinte. Le libellé du travail
 * n'apparaît que s'il a été revu par l'agent et n'est pas masqué.
 */
export function recruiterEndorsementView(r: TalentEndorsementRow) {
  return {
    id: r.id,
    authorLabel: `${RELATION_AUTHOR[r.relation]} · ${r.authorDistrict}`,
    relation: r.relation,
    jobLabel: r.reviewedAt && !r.hiddenJobLabel ? r.jobLabel : null,
    jobDate: r.jobDate.toISOString(),
    highlights: r.highlights,
    proofVerified: r.proofAccepted === true && r.proof !== 'aucune',
    createdAt: r.createdAt.toISOString(),
  }
}

/** Résumé d'une vérification de grille : date et points validés / total. */
export function verificationSummary(v: { verifiedAt: Date; trade: string; checklist: unknown } | null | undefined) {
  if (!v) return null
  const checklist = v.checklist && typeof v.checklist === 'object' ? (v.checklist as Record<string, unknown>) : {}
  const values = Object.values(checklist)
  return {
    verifiedAt: v.verifiedAt.toISOString(),
    trade: v.trade,
    validated: values.filter((x) => x === true).length,
    total: values.length,
  }
}

/* ------------------------------------------------------------------ */
/* Signaux (avant création du profil)                                  */
/* ------------------------------------------------------------------ */

/** Pour chaque racine, ses signaux fusionnés (récursivement), elle comprise. */
async function familiesOf(rootIds: string[]): Promise<Map<string, string[]>> {
  const rootOfId = new Map(rootIds.map((id) => [id, id]))
  let frontier = rootIds
  while (frontier.length > 0) {
    const children = await prisma.talentSignal.findMany({
      where: { mergedIntoId: { in: frontier } },
      select: { id: true, mergedIntoId: true },
    })
    frontier = []
    for (const c of children) {
      if (rootOfId.has(c.id)) continue
      rootOfId.set(c.id, rootOfId.get(c.mergedIntoId!)!)
      frontier.push(c.id)
    }
  }
  const families = new Map<string, string[]>(rootIds.map((id) => [id, []]))
  for (const [id, root] of rootOfId) families.get(root)!.push(id)
  return families
}

const signalEndorsementSelect = {
  id: true,
  talentSignalId: true,
  authorMemberId: true,
  authorDistrict: true,
  relation: true,
  jobLabel: true,
  jobDate: true,
  highlights: true,
  comment: true,
  proof: true,
  proofFileUrl: true,
  proofAccepted: true,
  reviewedAt: true,
  hiddenJobLabel: true,
  excludedAt: true,
  excludedReason: true,
  createdAt: true,
  authorMember: { select: { displayName: true, user: { select: { role: true } } } },
} as const

/**
 * Confiance d'un signal (file des agents, vue admin) : pour chaque racine,
 * ses recommandations et celles des signaux fusionnés dedans, avec un seul
 * chargement des auteurs.
 */
export async function loadSignalTrust(rootIds: string[]) {
  const families = await familiesOf(rootIds)
  const allIds = [...families.values()].flat()
  const rows = await prisma.endorsement.findMany({
    where: { talentSignalId: { in: allIds } },
    select: signalEndorsementSelect,
    orderBy: { createdAt: 'asc' },
  })
  const evidence = await buildTrustEvidence(rows)
  const evidenceById = new Map<string, TrustEvidence>(evidence.map((e) => [e.id, e]))
  const now = Date.now()
  const out = new Map<string, { trust: SubjectTrust; rows: typeof rows; familyIds: string[] }>()
  for (const [root, ids] of families) {
    const idSet = new Set(ids)
    const own = rows.filter((r) => r.talentSignalId && idSet.has(r.talentSignalId))
    out.set(root, {
      trust: evaluateSubject(
        own.map((r) => evidenceById.get(r.id)!),
        now,
      ),
      rows: own,
      familyIds: ids,
    })
  }
  return out
}

