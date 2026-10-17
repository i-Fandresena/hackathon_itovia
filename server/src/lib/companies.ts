import type { Prisma } from '@prisma/client'
import { prisma } from './prisma.js'
import { buildTrustEvidence } from './endorsement-evidence.js'
import { evaluateSubject, compareSubjectTrust } from '../../../src/lib/trust.js'
import { COMPANY_HIGHLIGHTS, COMPANY_RELATION_MIN, COMPANY_RELATIONS } from '../../../src/data/endorsements.js'
import { PROVINCES } from '../../../src/data/constants.js'
import type {
  CompanyRelation,
  HighlightCount,
  LinkedCompanySummary,
  PublicCompany,
  SubjectTrust,
} from '../../../src/types/index.js'

/**
 * Entreprises recommandées par d'anciens salariés, stagiaires ou
 * prestataires. Tout ce qui sort de `toPublicCompany` / `toLinkedSummary`
 * est construit par LISTE BLANCHE : jamais d'auteur (même pseudonyme), de
 * quartier d'auteur, de commentaire, de libellé de poste, de date de
 * travail, de preuve ni de compte recruteur lié. La confiance est calculée
 * côté serveur (l'empreinte d'auteur ne quitte jamais ce module).
 */

/* ------------------------------------------------------------------ */
/* Normalisation et dédoublonnage                                      */
/* ------------------------------------------------------------------ */

/**
 * Formes juridiques et mots génériques retirés du nom normalisé. « S.A.R.L. »,
 * « S.A. » et « Ets. » sont d'abord recollés (points retirés) puis retirés
 * comme les autres.
 */
const LEGAL_FORMS = new Set([
  'sarl',
  'sarlu',
  'sa',
  'sas',
  'sasu',
  'eurl',
  'suarl',
  'snc',
  'scs',
  'sca',
  'gie',
  'ei',
  'eirl',
  'ets',
  'etablissement',
  'etablissements',
  'ste',
  'societe',
  'cie',
  'ltd',
  'sprl',
])

/**
 * Nom normalisé d'une entreprise (`Company.nameKey`), déterministe :
 * 1. décomposition Unicode et retrait des accents ;
 * 2. minuscules ;
 * 3. retrait des points et apostrophes (« S.A.R.L. » -> « sarl », « L'Atelier » -> « latelier ») ;
 * 4. tout autre caractère non alphanumérique -> espace (« & », tirets, virgules…) ;
 * 5. retrait des mots de `LEGAL_FORMS` (SARL, SA, SARLU, SAS, EURL, Ets, Société…) ;
 * 6. espaces compactés. Si tout a été retiré, on garde le nom sans l'étape 5.
 * Ex. « Bâtisseurs Fictifs du Lac S.A.R.L. » -> « batisseurs fictifs du lac ».
 */
export function companyNameKey(name: string): string {
  const base = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[.'’`]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
  const words = base.split(' ').filter(Boolean)
  const kept = words.filter((w) => !LEGAL_FORMS.has(w))
  return (kept.length > 0 ? kept : words).join(' ')
}

/** Clé de comparaison d'une ville (même normalisation, sans retrait de mots). */
function cityKey(city: string): string {
  return city
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/**
 * Ville canonique enregistrée (`Company.city`, partie de la clé d'unicité) :
 * un chef-lieu de province est ramené à son orthographe de référence
 * (« antananarivo », « ANTANANARIVO » -> « Antananarivo ») ; sinon le texte
 * saisi, espaces compactés, première lettre en majuscule.
 */
export function canonicalCity(city: string): string {
  const key = cityKey(city)
  const province = PROVINCES.find((p) => cityKey(p) === key)
  if (province) return province
  const compact = city.replace(/\s+/g, ' ').trim()
  return compact.charAt(0).toLocaleUpperCase('fr') + compact.slice(1)
}

/** Nom affiché : espaces compactés, tel que saisi par le premier auteur. */
export function cleanCompanyName(name: string): string {
  return name.replace(/\s+/g, ' ').trim()
}

/** Seule définition de « fiche entreprise visible » : non masquée par un admin. */
export const VISIBLE_COMPANY_WHERE = { hiddenAt: null } satisfies Prisma.CompanyWhereInput

/* ------------------------------------------------------------------ */
/* Confiance                                                            */
/* ------------------------------------------------------------------ */

const companyEndorsementSelect = {
  id: true,
  companyId: true,
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
  excludedAt: true,
  excludedReason: true,
  createdAt: true,
  authorMember: { select: { displayName: true, user: { select: { role: true, email: true } } } },
} as const

async function loadRows(companyIds: string[]) {
  return prisma.endorsement.findMany({
    where: { companyId: { in: companyIds }, subjectType: 'entreprise' },
    select: companyEndorsementSelect,
    orderBy: { createdAt: 'asc' },
  })
}

export type CompanyEndorsementRow = Awaited<ReturnType<typeof loadRows>>[number]

export interface CompanyTrustEntry {
  trust: SubjectTrust
  /** Toutes les recommandations (écartées comprises), plus anciennes d'abord. */
  rows: CompanyEndorsementRow[]
}

/**
 * Confiance de plusieurs entreprises en une passe groupée (même moteur que
 * les talents : `buildTrustEvidence` + `evaluateSubject`). Chaque id demandé
 * a une entrée, même sans recommandation (« Nouveau »).
 */
export async function loadCompanyTrust(companyIds: string[], now = Date.now()): Promise<Map<string, CompanyTrustEntry>> {
  const ids = [...new Set(companyIds)]
  const out = new Map<string, CompanyTrustEntry>()
  if (ids.length === 0) return out
  const rows = await loadRows(ids)
  const evidence = await buildTrustEvidence(rows)
  const byCompany = new Map<string, number[]>(ids.map((id) => [id, []]))
  rows.forEach((r, i) => {
    if (r.companyId) byCompany.get(r.companyId)?.push(i)
  })
  for (const id of ids) {
    const idx = byCompany.get(id) ?? []
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
export function retainedCompanyEndorsements(rows: CompanyEndorsementRow[]): CompanyEndorsementRow[] {
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

/** Décompte des points forts (liste fermée), du plus cité au moins cité, ex aequo dans l'ordre de la liste. */
export function highlightCounts(retained: CompanyEndorsementRow[]): HighlightCount[] {
  const order = new Map<string, number>(COMPANY_HIGHLIGHTS.map((h, i) => [h, i]))
  const counts = new Map<string, number>()
  for (const r of retained) {
    for (const h of new Set(r.highlights)) {
      if (order.has(h)) counts.set(h, (counts.get(h) ?? 0) + 1)
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || order.get(a[0])! - order.get(b[0])!)
    .map(([label, count]) => ({ label, count }))
}

/** Répartition par relation, ou `null` sous le seuil `COMPANY_RELATION_MIN`. */
export function relationCounts(retained: CompanyEndorsementRow[]): Record<CompanyRelation, number> | null {
  if (retained.length < COMPANY_RELATION_MIN) return null
  const out = { salarie: 0, stagiaire: 0, prestataire: 0 } as Record<CompanyRelation, number>
  for (const r of retained) {
    if ((COMPANY_RELATIONS as readonly string[]).includes(r.relation)) out[r.relation as CompanyRelation]++
  }
  return out
}

type CompanyBase = { id: string; name: string; sector: PublicCompany['sector']; city: string }

/** LISTE BLANCHE des champs publics — tout ajout ici est une décision de confidentialité. */
export function toPublicCompany(c: CompanyBase, entry: CompanyTrustEntry | undefined): PublicCompany {
  const retained = retainedCompanyEndorsements(entry?.rows ?? [])
  return {
    id: c.id,
    name: c.name,
    sector: c.sector,
    city: c.city,
    level: entry?.trust.level ?? 'nouveau',
    independentSources: entry?.trust.independentSources ?? 0,
    relations: relationCounts(retained),
    highlights: highlightCounts(retained),
  }
}

/** Encart du recruteur lié : niveau, nombre, points forts. */
export function toLinkedSummary(c: CompanyBase, entry: CompanyTrustEntry | undefined): LinkedCompanySummary {
  const retained = retainedCompanyEndorsements(entry?.rows ?? [])
  return {
    id: c.id,
    name: c.name,
    sector: c.sector,
    city: c.city,
    level: entry?.trust.level ?? 'nouveau',
    recommendationCount: entry?.trust.recommendationCount ?? 0,
    independentSources: entry?.trust.independentSources ?? 0,
    highlights: highlightCounts(retained),
  }
}

const baseSelect = { id: true, name: true, sector: true, city: true, createdAt: true } as const

export interface CompanyListFilters {
  q?: string
  city?: string
  sector?: PublicCompany['sector']
  limit: number
}

/**
 * Vitrine et recherche : entreprises visibles, filtrées par nom normalisé
 * (sous-chaîne de `nameKey`), ville et secteur ; triées par confiance
 * (`compareSubjectTrust`), puis nom.
 */
export async function listPublicCompanies(filters: CompanyListFilters) {
  const qKey = filters.q ? companyNameKey(filters.q) : ''
  const where: Prisma.CompanyWhereInput = {
    ...VISIBLE_COMPANY_WHERE,
    ...(qKey ? { nameKey: { contains: qKey } } : {}),
    ...(filters.city ? { city: { equals: canonicalCity(filters.city), mode: 'insensitive' } } : {}),
    ...(filters.sector ? { sector: filters.sector } : {}),
  }
  const [companies, facets] = await Promise.all([
    prisma.company.findMany({ where, select: baseSelect }),
    prisma.company.findMany({ where: VISIBLE_COMPANY_WHERE, select: { city: true } }),
  ])
  const trust = await loadCompanyTrust(companies.map((c) => c.id))
  const ranked = companies
    .map((c) => ({ c, entry: trust.get(c.id)! }))
    .sort(
      (a, b) =>
        compareSubjectTrust(a.entry.trust, b.entry.trust) ||
        a.c.name.localeCompare(b.c.name, 'fr') ||
        a.c.id.localeCompare(b.c.id),
    )
    .map(({ c, entry }) => toPublicCompany(c, entry))
  const cities = [...new Set(facets.map((f) => f.city))].sort((a, b) => a.localeCompare(b, 'fr'))
  return { companies: ranked.slice(0, filters.limit), total: ranked.length, filters: { cities } }
}

/** Fiche publique, `null` si absente ou masquée. */
export async function getPublicCompany(id: string): Promise<PublicCompany | null> {
  const c = await prisma.company.findFirst({ where: { ...VISIBLE_COMPANY_WHERE, id }, select: baseSelect })
  if (!c) return null
  return toPublicCompany(c, (await loadCompanyTrust([c.id])).get(c.id))
}

/** Entreprise liée à un compte recruteur (visible seulement), `null` sinon. */
export async function getLinkedCompany(recruiterUserId: string): Promise<LinkedCompanySummary | null> {
  const c = await prisma.company.findFirst({
    where: { ...VISIBLE_COMPANY_WHERE, recruiterUserId },
    select: baseSelect,
  })
  if (!c) return null
  return toLinkedSummary(c, (await loadCompanyTrust([c.id])).get(c.id))
}
