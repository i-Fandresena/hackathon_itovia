import { randomInt } from 'node:crypto'
import type { Prisma, TalentProfile } from '@prisma/client'
import { prisma } from './prisma.js'
import { loadTalentTrust, retainedEndorsements, type TalentTrustEntry } from './talent-trust.js'
import { compareSubjectTrust } from '../../../src/lib/trust.js'
import { TALENT_HIGHLIGHTS } from '../../../src/data/endorsements.js'
import type { PublicTalent } from '../../../src/types/index.js'

/**
 * Vitrine « Talents recommandés » : ce qui sort d'ici est PUBLIC (aucune
 * authentification). La réponse est construite par LISTE BLANCHE explicite
 * (`toPublicTalent`) — jamais un spread d'objet Prisma : ni nom (même
 * partiel), ni téléphone, ni id interne, ni agent, ni commentaire, ni libellé
 * de travail, ni auteur.
 */

/** Comptes qui ont perdu l'accès (même définition que `isAccountBlocked()`). */
const BLOCKED_STATUSES = ['suspended', 'banned'] as const

/**
 * Seule définition de « fiche publique visible » :
 * - accord public explicite (`publicConsentAt`) et `publicRef` présents ;
 * - accord de création du profil tracé (`consentAt`) — un profil antérieur
 *   sans accord tracé n'est JAMAIS public, même avec un accord public ;
 * - au moins une vérification par un agent (« Vérifié par un agent OffRec ») ;
 * - l'agent qui suit le talent peut traiter les demandes de contact (compte
 *   ni suspendu ni banni) ;
 * - le compte de suivi du talent, s'il existe, n'est ni suspendu ni banni.
 * `TalentStatus` n'a pas d'état « désactivé » ou « archivé » : tous les
 * statuts (y compris `place`) restent publiables tant que l'accord tient.
 */
export const PUBLIC_TALENT_WHERE = {
  publicConsentAt: { not: null },
  publicRef: { not: null },
  consentAt: { not: null },
  verifications: { some: {} },
  agent: { status: { notIn: [...BLOCKED_STATUSES] } },
  NOT: { accountProfile: { is: { user: { status: { in: [...BLOCKED_STATUSES] } } } } },
} satisfies Prisma.TalentProfileWhereInput

const REF_ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789'

/** Identifiant public aléatoire (10 caractères, sans caractères ambigus), vérifié unique. */
export async function newPublicRef(): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    let ref = ''
    for (let i = 0; i < 10; i++) ref += REF_ALPHABET[randomInt(REF_ALPHABET.length)]
    const taken = await prisma.talentProfile.findUnique({ where: { publicRef: ref }, select: { id: true } })
    if (!taken) return ref
  }
  throw new Error('Impossible de générer un identifiant public unique.')
}

/** Les 3 points forts les plus cités (recommandations retenues), ex aequo dans l'ordre de la liste fermée. */
export function topHighlights(entry: TalentTrustEntry | undefined, max = 3): string[] {
  const order = new Map<string, number>(TALENT_HIGHLIGHTS.map((h, i) => [h, i]))
  const counts = new Map<string, number>()
  for (const r of retainedEndorsements(entry?.rows ?? [])) {
    for (const h of new Set(r.highlights)) {
      if (order.has(h)) counts.set(h, (counts.get(h) ?? 0) + 1)
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || order.get(a[0])! - order.get(b[0])!)
    .slice(0, max)
    .map(([h]) => h)
}

/** Mois `AAAA-MM` à Madagascar (UTC+3 fixe, comme le moteur de confiance). */
export function madagascarMonth(date: Date): string {
  return new Date(date.getTime() + 3 * 3600 * 1000).toISOString().slice(0, 7)
}

type PublicSource = Pick<TalentProfile, 'trade' | 'sector' | 'city' | 'district'> & {
  publicRef: string | null
  lastVerifiedAt: Date | null
}

/** LISTE BLANCHE des champs publics — tout ajout ici est une décision de confidentialité. */
export function toPublicTalent(t: PublicSource, entry: TalentTrustEntry | undefined): PublicTalent {
  return {
    publicRef: t.publicRef ?? '',
    trade: t.trade,
    sector: t.sector,
    city: t.city,
    district: t.district ?? null,
    level: entry?.trust.level ?? 'nouveau',
    independentSources: entry?.trust.independentSources ?? 0,
    highlights: topHighlights(entry),
    verifiedMonth: t.lastVerifiedAt ? madagascarMonth(t.lastVerifiedAt) : null,
  }
}

const publicSelect = {
  id: true,
  trade: true,
  sector: true,
  city: true,
  district: true,
  publicRef: true,
  publicConsentAt: true,
  verifications: { select: { verifiedAt: true }, orderBy: { verifiedAt: 'desc' }, take: 1 },
} as const

export interface PublicTalentFilters {
  trade?: string
  city?: string
  limit: number
}

/**
 * Liste publique, triée par confiance seule (`compareSubjectTrust`), puis
 * ordre stable et déterministe : accord public le plus ancien d'abord, puis
 * `publicRef`. Les talents « Nouveau » forment une section à part (jamais
 * pénalisés, jamais mêlés aux recommandés).
 */
export async function listPublicTalents(filters: PublicTalentFilters) {
  const where: Prisma.TalentProfileWhereInput = {
    ...PUBLIC_TALENT_WHERE,
    ...(filters.trade ? { trade: { equals: filters.trade, mode: 'insensitive' } } : {}),
    ...(filters.city ? { city: { equals: filters.city, mode: 'insensitive' } } : {}),
  }
  const [talents, facets] = await Promise.all([
    prisma.talentProfile.findMany({ where, select: publicSelect }),
    prisma.talentProfile.findMany({ where: PUBLIC_TALENT_WHERE, select: { trade: true, city: true } }),
  ])
  const trust = await loadTalentTrust(talents.map((t) => t.id))
  const ranked = talents
    .map((t) => ({ t, entry: trust.get(t.id)! }))
    .sort(
      (a, b) =>
        compareSubjectTrust(a.entry.trust, b.entry.trust) ||
        a.t.publicConsentAt!.getTime() - b.t.publicConsentAt!.getTime() ||
        a.t.publicRef!.localeCompare(b.t.publicRef!),
    )
    .map(({ t, entry }) => toPublicTalent({ ...t, lastVerifiedAt: t.verifications[0]?.verifiedAt ?? null }, entry))
  const recommended = ranked.filter((p) => p.level !== 'nouveau')
  const newcomers = ranked.filter((p) => p.level === 'nouveau')
  const uniqueSorted = (values: string[]) =>
    [...new Map(values.filter(Boolean).map((v) => [v.toLocaleLowerCase('fr'), v])).values()].sort((a, b) =>
      a.localeCompare(b, 'fr'),
    )
  return {
    recommended: recommended.slice(0, filters.limit),
    newcomers: newcomers.slice(0, filters.limit),
    total: { recommended: recommended.length, newcomers: newcomers.length },
    filters: { trades: uniqueSorted(facets.map((f) => f.trade)), cities: uniqueSorted(facets.map((f) => f.city)) },
  }
}

/** Talent public par `publicRef` (id interne + agent pour le serveur seulement), `null` sinon. */
export async function findPublicTalent(publicRef: string) {
  return prisma.talentProfile.findFirst({
    where: { ...PUBLIC_TALENT_WHERE, publicRef },
    select: { ...publicSelect, agentId: true, accountProfile: { select: { userId: true } } },
  })
}

/** Vue publique d'un talent par `publicRef`, `null` si la fiche n'est pas (ou plus) publique. */
export async function getPublicTalent(publicRef: string): Promise<PublicTalent | null> {
  const t = await findPublicTalent(publicRef)
  if (!t) return null
  const entry = (await loadTalentTrust([t.id])).get(t.id)
  return toPublicTalent({ ...t, lastVerifiedAt: t.verifications[0]?.verifiedAt ?? null }, entry)
}

/**
 * Pour l'agent (aperçu) et le compte talent : la fiche est-elle visible, et
 * sinon pourquoi. Mêmes règles que `PUBLIC_TALENT_WHERE`.
 */
export async function publicVisibilityState(talentId: string) {
  const t = await prisma.talentProfile.findUnique({
    where: { id: talentId },
    select: {
      consentAt: true,
      publicConsentAt: true,
      publicRef: true,
      agent: { select: { status: true } },
      accountProfile: { select: { user: { select: { status: true } } } },
      _count: { select: { verifications: true } },
    },
  })
  if (!t) return null
  const blocked = (s: string | undefined) => s !== undefined && (BLOCKED_STATUSES as readonly string[]).includes(s)
  const blockers: string[] = []
  if (!t.consentAt) blockers.push('L’accord de création du profil n’est pas tracé (profil antérieur).')
  if (t._count.verifications === 0) blockers.push('Aucune vérification enregistrée par un agent.')
  if (blocked(t.agent.status)) blockers.push('Le compte de l’agent qui suit ce talent est suspendu.')
  if (blocked(t.accountProfile?.user.status)) blockers.push('Le compte de suivi du talent est suspendu.')
  const granted = t.publicConsentAt !== null && t.publicRef !== null
  return {
    granted,
    publicConsentAt: t.publicConsentAt?.toISOString() ?? null,
    publicRef: granted ? t.publicRef : null,
    /** Accord donné ET toutes les conditions réunies : la fiche est en ligne. */
    visible: granted && blockers.length === 0,
    /** Conditions manquantes pour pouvoir (ou continuer à) publier. */
    blockers,
  }
}
