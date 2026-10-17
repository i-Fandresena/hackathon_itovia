import { createHash } from 'node:crypto'
import { prisma } from './prisma.js'
import { phoneKeyOf } from './validation.js'
import { evaluateSubject } from '../../../src/lib/trust.js'
import type { AuthorStats, ProofType, SubjectTrust, TrustEvidence } from '../../../src/types/index.js'

/**
 * Construction des `TrustEvidence` (moteur `evaluateSubject`) à partir des
 * lignes `Endorsement` — réutilisable pour toute recommandation de talent ou
 * d'entreprise (file des agents, puis fiche talent et shortlist).
 *
 * `authorLinkKey` est une empreinte du téléphone normalisé de l'auteur,
 * calculée ici et JAMAIS envoyée au client : appelez `evaluateSubject` côté
 * serveur et ne renvoyez que le `SubjectTrust`.
 */

/** Empreinte opaque d'un téléphone normalisé (9 chiffres). */
export function authorLinkKey(phoneKey: string | null): string | null {
  if (!phoneKey) return null
  return createHash('sha256').update(`offrec-author:${phoneKey}`).digest('hex')
}

/** Téléphone déclaré par le compte, quel que soit son rôle (profil du rôle). */
export async function userPhoneKeys(userIds: string[]): Promise<Map<string, string | null>> {
  const ids = [...new Set(userIds)]
  const users = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      candidateProfile: { select: { phone: true } },
      individualProfile: { select: { phone: true } },
      recruiterProfile: { select: { phone: true } },
      talentAccountProfile: { select: { phone: true } },
      agentProfile: { select: { phone: true } },
    },
  })
  const out = new Map<string, string | null>()
  for (const u of users) {
    const phone =
      u.candidateProfile?.phone ??
      u.individualProfile?.phone ??
      u.recruiterProfile?.phone ??
      u.talentAccountProfile?.phone ??
      u.agentProfile?.phone ??
      null
    out.set(u.id, phoneKeyOf(phone))
  }
  return out
}

/** Champs d'`Endorsement` nécessaires au moteur. */
export interface EndorsementEvidenceRow {
  id: string
  authorMemberId: string
  authorDistrict: string
  proof: ProofType
  proofAccepted: boolean | null
  jobDate: Date
  createdAt: Date
  excludedAt: Date | null
}

/**
 * Charge en lot ce qu'il faut savoir des auteurs (membre, nombre de retours
 * publiés — avis de l'annuaire ET recommandations —, confirmations reçues sur
 * l'annuaire, téléphone) et renvoie une `TrustEvidence` par ligne, dans
 * l'ordre d'entrée. Confirmations par recommandation : 0 en v1.
 */
export async function buildTrustEvidence(rows: EndorsementEvidenceRow[]): Promise<TrustEvidence[]> {
  if (rows.length === 0) return []
  const memberIds = [...new Set(rows.map((r) => r.authorMemberId))]
  const [members, directoryCounts, endorsementCounts, confirmations] = await Promise.all([
    prisma.member.findMany({
      where: { id: { in: memberIds } },
      select: { id: true, userId: true, phoneVerified: true, joinedAt: true },
    }),
    prisma.recommendation.groupBy({
      by: ['authorMemberId'],
      where: { authorMemberId: { in: memberIds } },
      _count: { _all: true },
    }),
    prisma.endorsement.groupBy({
      by: ['authorMemberId'],
      where: { authorMemberId: { in: memberIds } },
      _count: { _all: true },
    }),
    prisma.recommendationConfirmation.findMany({
      where: { recommendation: { authorMemberId: { in: memberIds } } },
      select: { recommendation: { select: { authorMemberId: true } } },
    }),
  ])
  const phoneKeys = await userPhoneKeys(members.map((m) => m.userId))

  const authored = new Map<string, number>()
  for (const c of directoryCounts) authored.set(c.authorMemberId, (authored.get(c.authorMemberId) ?? 0) + c._count._all)
  for (const c of endorsementCounts) authored.set(c.authorMemberId, (authored.get(c.authorMemberId) ?? 0) + c._count._all)
  const confirmed = new Map<string, number>()
  for (const c of confirmations) {
    const id = c.recommendation.authorMemberId
    confirmed.set(id, (confirmed.get(id) ?? 0) + 1)
  }
  const memberById = new Map(members.map((m) => [m.id, m]))

  return rows.map((r) => {
    const m = memberById.get(r.authorMemberId)
    const author: AuthorStats | null = m
      ? {
          phoneVerified: m.phoneVerified,
          joinedAt: m.joinedAt.toISOString(),
          authoredCount: authored.get(m.id) ?? 0,
          confirmationsReceived: confirmed.get(m.id) ?? 0,
        }
      : null
    return {
      id: r.id,
      authorMemberId: r.authorMemberId,
      authorLinkKey: m ? authorLinkKey(phoneKeys.get(m.userId) ?? null) : null,
      authorDistrict: r.authorDistrict,
      author,
      proof: r.proof,
      proofAccepted: r.proofAccepted,
      jobDate: r.jobDate.toISOString(),
      createdAt: r.createdAt.toISOString(),
      confirmations: 0,
      excludedAt: r.excludedAt ? r.excludedAt.toISOString() : null,
    }
  })
}

/** Raccourci : confiance d'un ensemble de recommandations (calcul serveur). */
export async function evaluateEndorsements(rows: EndorsementEvidenceRow[], now = Date.now()): Promise<SubjectTrust> {
  return evaluateSubject(await buildTrustEvidence(rows), now)
}
