import type {
  ConfidenceLevel,
  Member,
  PriceStat,
  Provider,
  ProofType,
  Recommendation,
  ScoredProvider,
  SubjectTrust,
  TrustEvidence,
  TrustLevel,
  TrustResult,
} from '../types/index.js'

/**
 * Moteur de confiance de l'annuaire.
 *
 * Principe : toutes les recommandations ne se valent pas. Un retour appuyé
 * par une facture, publié par un membre ancien dont les avis ont été
 * confirmés par d'autres, et portant sur un chantier récent, pèse plusieurs
 * fois plus lourd qu'un avis anonyme de 2023 sans preuve.
 *
 * Le score n'est donc pas une moyenne d'étoiles : c'est une moyenne
 * pondérée, accompagnée d'un niveau de confiance et — c'est le point
 * important — d'alertes explicites quand l'information est trop mince pour
 * qu'on s'y fie.
 */

const MONTH_MS = 1000 * 60 * 60 * 24 * 30.44

/** Une preuve vérifiable vaut plus qu'une parole. */
const PROOF_FACTOR: Record<ProofType, number> = {
  facture: 1.3,
  photo: 1.15,
  aucune: 0.85,
}

export function monthsSince(iso: string, now: number): number {
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return 0
  return Math.max(0, (now - t) / MONTH_MS)
}

/** Un chantier de 2023 ne dit plus grand-chose du prestataire d'aujourd'hui. */
function recencyFactor(jobDate: string, now: number): number {
  const months = monthsSince(jobDate, now)
  if (months <= 6) return 1
  if (months >= 24) return 0.4
  return 1 - ((months - 6) / 18) * 0.6
}

/**
 * Fiabilité d'un membre (0 → 1). C'est le verrou anti-faux-avis : créer
 * 50 faux comptes ne sert à rien, car un compte neuf, non vérifié et sans
 * historique confirmé pèse presque rien.
 */
export function memberReliability(
  member: Member | undefined,
  authored: Recommendation[],
  now: number,
): number {
  const confirmations = authored.reduce((n, rec) => n + rec.confirmations.length, 0)
  return reliabilityFrom(member, authored.length, confirmations, now)
}

/**
 * Cœur de la fiabilité, indépendant du type de recommandation : il suffit de
 * savoir combien de retours l'auteur a publiés (toutes sources confondues) et
 * combien de confirmations ils ont reçues au total. Sans membre connu : 0,3.
 */
export function reliabilityFrom(
  member: Pick<Member, 'phoneVerified' | 'joinedAt'> | undefined | null,
  authoredCount: number,
  confirmationsReceived: number,
  now: number,
): number {
  if (!member) return 0.3

  let r = 0
  if (member.phoneVerified) r += 0.25
  r += Math.min(monthsSince(member.joinedAt, now) / 12, 1) * 0.2
  r += Math.min(authoredCount / 5, 1) * 0.2

  const confirmationRate = authoredCount ? confirmationsReceived / authoredCount : 0
  r += Math.min(confirmationRate / 2, 1) * 0.35

  return Math.min(r, 1)
}

/**
 * Poids d'un retour : preuve × récence × fiabilité de l'auteur × confirmations.
 * Partagé par l'annuaire et par `evaluateSubject`.
 */
export function weightOf(
  proof: ProofType,
  jobDate: string,
  reliability: number,
  confirmations: number,
  now: number,
): number {
  const author = 0.7 + reliability * 0.7
  const confirmed = 1 + Math.min(confirmations, 10) * 0.03
  return PROOF_FACTOR[proof] * recencyFactor(jobDate, now) * author * confirmed
}

function recommendationWeight(
  rec: Recommendation,
  authorReliability: number,
  now: number,
): number {
  return weightOf(rec.proof, rec.jobDate, authorReliability, rec.confirmations.length, now)
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
    : sorted[mid]
}

/**
 * Prix constaté : on prend l'unité la plus fréquente puis la médiane des
 * prix pour cette unité. La médiane, pas la moyenne — un seul prix aberrant
 * ne doit pas déplacer le repère.
 */
function priceStat(recs: Recommendation[]): PriceStat | null {
  const priced = recs.filter(
    (r) => typeof r.pricePaid === 'number' && r.pricePaid > 0 && r.priceUnit,
  )
  if (priced.length === 0) return null

  const byUnit = new Map<string, number[]>()
  for (const rec of priced) {
    const list = byUnit.get(rec.priceUnit!) ?? []
    list.push(rec.pricePaid!)
    byUnit.set(rec.priceUnit!, list)
  }

  let bestUnit = ''
  let bestValues: number[] = []
  for (const [unit, values] of byUnit) {
    if (values.length > bestValues.length) {
      bestUnit = unit
      bestValues = values
    }
  }

  return { median: median(bestValues), unit: bestUnit, sampleSize: bestValues.length }
}

function confidenceOf(distinctAuthors: number, totalWeight: number): ConfidenceLevel {
  if (distinctAuthors >= 5 && totalWeight >= 5) return 'forte'
  if (distinctAuthors >= 3 && totalWeight >= 2.5) return 'moyenne'
  return 'faible'
}

function relativeMonths(months: number): string {
  if (months < 1) return 'ce mois-ci'
  if (months < 2) return 'il y a 1 mois'
  if (months < 12) return `il y a ${Math.round(months)} mois`
  const years = Math.floor(months / 12)
  return years === 1 ? 'il y a plus d’un an' : `il y a plus de ${years} ans`
}

/**
 * Retient les recommandations recevables pour un prestataire :
 * — pas d'auto-recommandation si la fiche a été revendiquée ;
 * — un seul retour par membre (le plus récent), pour qu'on ne puisse pas
 *   gonfler un score en publiant dix fois.
 */
export function eligibleRecommendations(
  provider: Provider,
  recommendations: Recommendation[],
): Recommendation[] {
  const mine = recommendations
    .filter((r) => r.providerId === provider.id)
    .filter((r) => r.authorMemberId !== provider.claimedByMemberId)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))

  const seen = new Set<string>()
  return mine.filter((r) => {
    if (seen.has(r.authorMemberId)) return false
    seen.add(r.authorMemberId)
    return true
  })
}

interface EvaluateOptions {
  /** Quartier de la personne qui consulte, pour la mise en avant locale. */
  viewerDistrict?: string
  now?: number
}

export function evaluateProvider(
  provider: Provider,
  recommendations: Recommendation[],
  members: Map<string, Member>,
  options: EvaluateOptions = {},
): TrustResult {
  const now = options.now ?? Date.now()
  const recs = eligibleRecommendations(provider, recommendations)

  const empty: TrustResult = {
    score: 0,
    confidence: 'faible',
    evidenceWeight: 0,
    recommendationCount: 0,
    distinctAuthors: 0,
    wouldUseAgainRate: 0,
    lastRecommendedAt: null,
    price: null,
    reasons: [],
    warnings: ['Fiche sans recommandation : contactez à vos risques.'],
  }
  if (recs.length === 0) return empty

  // Historique par auteur, nécessaire au calcul de sa fiabilité.
  const authoredBy = new Map<string, Recommendation[]>()
  for (const rec of recommendations) {
    const list = authoredBy.get(rec.authorMemberId) ?? []
    list.push(rec)
    authoredBy.set(rec.authorMemberId, list)
  }

  let totalWeight = 0
  let weightedRating = 0
  let weightedReuse = 0

  for (const rec of recs) {
    const reliability = memberReliability(
      members.get(rec.authorMemberId),
      authoredBy.get(rec.authorMemberId) ?? [],
      now,
    )
    const w = recommendationWeight(rec, reliability, now)
    totalWeight += w
    weightedRating += rec.rating * w
    if (rec.wouldUseAgain) weightedReuse += w
  }

  const score = Math.round((weightedRating / totalWeight) * 10) / 10
  const distinctAuthors = recs.length
  const wouldUseAgainRate = weightedReuse / totalWeight
  const lastRecommendedAt = recs
    .map((r) => r.jobDate)
    .sort((a, b) => Date.parse(b) - Date.parse(a))[0]
  const monthsSinceLast = monthsSince(lastRecommendedAt, now)
  const withProof = recs.filter((r) => r.proof !== 'aucune')
  const price = priceStat(recs)

  const reasons: string[] = []
  if (distinctAuthors >= 2) {
    reasons.push(`${distinctAuthors} membres différents l’ont recommandé`)
  }
  if (options.viewerDistrict) {
    const neighbours = recs.filter((r) => r.authorDistrict === options.viewerDistrict)
    if (neighbours.length > 0) {
      reasons.push(
        `${neighbours.length} retour${neighbours.length > 1 ? 's' : ''} depuis ${options.viewerDistrict}`,
      )
    }
  }
  if (withProof.length > 0) {
    reasons.push(
      `${withProof.length} retour${withProof.length > 1 ? 's' : ''} appuyé${withProof.length > 1 ? 's' : ''} par une facture ou une photo`,
    )
  }
  if (price) {
    reasons.push(
      `Prix constaté : ${price.median.toLocaleString('fr-FR')} Ar ${price.unit} (médiane sur ${price.sampleSize})`,
    )
  }
  if (wouldUseAgainRate >= 0.75 && distinctAuthors >= 2) {
    reasons.push(`${Math.round(wouldUseAgainRate * 100)} % referaient appel à lui`)
  }
  reasons.push(`Dernier chantier connu ${relativeMonths(monthsSinceLast)}`)

  const warnings: string[] = []
  if (distinctAuthors === 1) {
    warnings.push('Une seule recommandation : information encore à confirmer.')
  }
  if (monthsSinceLast >= 18) {
    warnings.push('Aucun retour depuis plus de 18 mois.')
  }
  if (withProof.length === 0) {
    warnings.push('Aucun retour appuyé par une facture ou une photo.')
  }
  if (wouldUseAgainRate < 0.5 && distinctAuthors >= 2) {
    warnings.push('Moins de la moitié des membres referaient appel à lui.')
  }

  return {
    score,
    confidence: confidenceOf(distinctAuthors, totalWeight),
    evidenceWeight: totalWeight,
    recommendationCount: distinctAuthors,
    distinctAuthors,
    wouldUseAgainRate,
    lastRecommendedAt,
    price,
    reasons: reasons.slice(0, 4),
    warnings,
  }
}

/** Note attribuée d'office à un prestataire dont on ne sait rien. */
const PRIOR_SCORE = 3.8
/** Quantité de preuve qu'il faut réunir pour s'écarter franchement du prior. */
const PRIOR_WEIGHT = 3

/**
 * Classement de l'annuaire. Un prestataire noté 5/5 par un seul inconnu ne
 * doit pas passer devant un 4,4/5 confirmé par huit membres.
 *
 * On classe donc sur une moyenne bayésienne : la note affichée est tirée
 * vers une note « par défaut » tant que la preuve accumulée est mince, et
 * s'en libère à mesure que les retours s'accumulent. Le score montré à
 * l'utilisateur, lui, reste la moyenne pondérée réelle — on ne truque pas
 * l'affichage, on ordonne seulement avec prudence.
 */
export function rankProviders(
  providers: Provider[],
  recommendations: Recommendation[],
  members: Map<string, Member>,
  options: EvaluateOptions = {},
): ScoredProvider[] {
  const now = options.now ?? Date.now()

  return providers
    .map((provider) => ({
      provider,
      trust: evaluateProvider(provider, recommendations, members, { ...options, now }),
    }))
    .sort((a, b) => rankScore(b, now) - rankScore(a, now))
}

function rankScore({ trust }: ScoredProvider, now: number): number {
  if (trust.recommendationCount === 0) return -1
  const adjusted =
    (trust.evidenceWeight * trust.score + PRIOR_WEIGHT * PRIOR_SCORE) /
    (trust.evidenceWeight + PRIOR_WEIGHT)
  const freshness = trust.lastRecommendedAt
    ? Math.max(0, 1 - monthsSince(trust.lastRecommendedAt, now) / 24)
    : 0
  return (adjusted / 5) * 0.85 + freshness * 0.15
}

/**
 * Règles anti-abus à l'écriture : un membre ne peut pas recommander deux
 * fois le même prestataire, ni sa propre fiche.
 */
export function canRecommend(
  memberId: string,
  provider: Provider,
  recommendations: Recommendation[],
): { ok: boolean; error?: string } {
  if (provider.claimedByMemberId === memberId) {
    return { ok: false, error: 'Vous ne pouvez pas recommander votre propre fiche.' }
  }
  const already = recommendations.some(
    (r) => r.providerId === provider.id && r.authorMemberId === memberId,
  )
  if (already) {
    return { ok: false, error: 'Vous avez déjà publié une recommandation sur ce prestataire.' }
  }
  return { ok: true }
}

/* -------------------------------------------------------------------------
 * Talents et entreprises : confiance par niveaux
 * ---------------------------------------------------------------------- */

/**
 * Pour un talent ou une entreprise, les recommandations sont positives et
 * sans note : ce qui compte est la quantité de preuve réunie (E) et surtout
 * le nombre de sources indépendantes. Cinq comptes créés le même jour dans
 * le même quartier ne valent pas cinq personnes qui ne se connaissent pas.
 *
 * Mêmes poids que l'annuaire (preuve × récence × fiabilité × confirmations),
 * plus un facteur de diversité. L'annuaire (`evaluateProvider`) n'applique
 * pas cette règle : ses données de collecte terrain la fausseraient.
 */

/** Dans une même source, chaque recommandation après la plus forte ne compte qu'au quart. */
export const LINKED_SOURCE_FACTOR = 0.25

/** Constante de l'indice affiché : 100 × E / (E + 3), rendements décroissants. */
const INDEX_PRIOR = 3

export const TRUST_THRESHOLDS = {
  recommande: { sources: 2, evidence: 1.2 },
  tres_recommande: { sources: 4, evidence: 2.8, sourcesWithProof: 1, maxMonthsSinceLastJob: 12 },
} as const

/** Madagascar vit en UTC+3 toute l'année : pas besoin d'`Intl`. */
const MADAGASCAR_OFFSET_MS = 3 * 60 * 60 * 1000
const DAY_MS = 1000 * 60 * 60 * 24

function madagascarDay(iso: string): number | null {
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return null
  return Math.floor((t + MADAGASCAR_OFFSET_MS) / DAY_MS)
}

function districtKey(district: string): string {
  return district.trim().toLowerCase()
}

/** Groupe de recommandations considérées comme une seule source. */
export interface SourceGroup {
  /** Dans l'ordre d'entrée. */
  evidence: TrustEvidence[]
  /** Vrai si au moins un lien vient d'une même empreinte d'auteur ; sinon le
   *  groupe ne tient qu'à « même jour et même quartier ». */
  linkedByAuthor: boolean
}

/**
 * Regroupe les recommandations en sources indépendantes (union-find, donc
 * transitif). Deux recommandations sont liées si elles ont la même empreinte
 * d'auteur, ou si elles ont été créées le même jour calendaire à Madagascar
 * par des auteurs déclarant le même quartier. Groupes dans l'ordre de leur
 * première recommandation.
 */
export function independentSourceGroups(evidence: TrustEvidence[]): SourceGroup[] {
  const parent = evidence.map((_, i) => i)
  const find = (i: number): number => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]]
      i = parent[i]
    }
    return i
  }
  const union = (a: number, b: number) => {
    const ra = find(a)
    const rb = find(b)
    // La racine reste le plus petit indice : ordre des groupes stable.
    if (ra !== rb) parent[Math.max(ra, rb)] = Math.min(ra, rb)
  }

  const days = evidence.map((e) => madagascarDay(e.createdAt))
  const districts = evidence.map((e) => districtKey(e.authorDistrict))
  const linkedByAuthor = new Set<number>()

  for (let i = 0; i < evidence.length; i++) {
    for (let j = i + 1; j < evidence.length; j++) {
      const keyA = evidence[i].authorLinkKey
      const sameAuthor = keyA !== null && keyA !== '' && keyA === evidence[j].authorLinkKey
      const sameDayAndDistrict =
        days[i] !== null && days[i] === days[j] && districts[i] !== '' && districts[i] === districts[j]
      if (sameAuthor) {
        linkedByAuthor.add(i)
        linkedByAuthor.add(j)
      }
      if (sameAuthor || sameDayAndDistrict) union(i, j)
    }
  }

  const groups = new Map<number, SourceGroup>()
  evidence.forEach((e, i) => {
    const root = find(i)
    const group = groups.get(root) ?? { evidence: [], linkedByAuthor: false }
    group.evidence.push(e)
    if (linkedByAuthor.has(i)) group.linkedByAuthor = true
    groups.set(root, group)
  })
  return [...groups.values()]
}

/**
 * Niveau affiché. « Nouveau » est un badge neutre : un profil récent n'est
 * jamais présenté comme suspect.
 */
export function trustLevel(input: {
  independentSources: number
  evidenceWeight: number
  sourcesWithProof: number
  /** `null` si aucune date de travail exploitable. */
  monthsSinceLastJob: number | null
}): TrustLevel {
  const { recommande, tres_recommande } = TRUST_THRESHOLDS
  if (input.independentSources < recommande.sources || input.evidenceWeight < recommande.evidence) {
    return 'nouveau'
  }
  if (
    input.independentSources >= tres_recommande.sources &&
    input.evidenceWeight >= tres_recommande.evidence &&
    input.sourcesWithProof >= tres_recommande.sourcesWithProof &&
    input.monthsSinceLastJob !== null &&
    input.monthsSinceLastJob <= tres_recommande.maxMonthsSinceLastJob
  ) {
    return 'tres_recommande'
  }
  return 'recommande'
}

function proofWording(photos: number, documents: number): string {
  if (documents === 0) return 'photo du travail'
  if (photos === 0) return 'facture ou document à l’appui'
  return 'photo ou document à l’appui'
}

function linkedWarning(recs: number, groups: number, what: string): string {
  return groups === 1
    ? `${recs} recommandations ${what} comptées comme une seule source.`
    : `${recs} recommandations ${what} comptées comme ${groups} sources.`
}

/**
 * Confiance d'un talent ou d'une entreprise.
 * — les recommandations écartées par un agent (`excludedAt`) ne comptent pas ;
 * — une seule par auteur, la plus récente (comme `eligibleRecommendations`) ;
 * — seule une preuve acceptée par un agent pèse, sinon elle vaut `aucune` ;
 * — dans chaque source, la recommandation la plus forte compte entière et
 *   chacune des autres au quart (`LINKED_SOURCE_FACTOR`).
 */
export function evaluateSubject(evidence: TrustEvidence[], now: number): SubjectTrust {
  const seen = new Set<string>()
  const retained = evidence
    .filter((e) => !e.excludedAt)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .filter((e) => {
      if (seen.has(e.authorMemberId)) return false
      seen.add(e.authorMemberId)
      return true
    })

  if (retained.length === 0) {
    return {
      index: null,
      level: 'nouveau',
      recommendationCount: 0,
      independentSources: 0,
      sourcesWithProof: 0,
      evidenceWeight: 0,
      lastJobAt: null,
      reasons: ['Pas encore de recommandation'],
      warnings: [],
    }
  }

  const baseWeight = new Map<TrustEvidence, number>()
  for (const e of retained) {
    const reliability = reliabilityFrom(
      e.author,
      e.author?.authoredCount ?? 0,
      e.author?.confirmationsReceived ?? 0,
      now,
    )
    const proof: ProofType = e.proofAccepted === true ? e.proof : 'aucune'
    baseWeight.set(e, weightOf(proof, e.jobDate, reliability, e.confirmations, now))
  }

  const groups = independentSourceGroups(retained)
  let evidenceWeight = 0
  let photoSources = 0
  let documentSources = 0
  const linkedByDay = { recs: 0, groups: 0 }
  const linkedByAuthor = { recs: 0, groups: 0 }

  for (const group of groups) {
    const weights = group.evidence
      .map((e) => baseWeight.get(e) ?? 0)
      .sort((a, b) => b - a)
    weights.forEach((w, i) => {
      evidenceWeight += i === 0 ? w : w * LINKED_SOURCE_FACTOR
    })

    const accepted = group.evidence.filter((e) => e.proofAccepted === true && e.proof !== 'aucune')
    if (accepted.some((e) => e.proof === 'facture')) documentSources++
    else if (accepted.length > 0) photoSources++

    if (group.evidence.length > 1) {
      const bucket = group.linkedByAuthor ? linkedByAuthor : linkedByDay
      bucket.recs += group.evidence.length
      bucket.groups++
    }
  }

  const independentSources = groups.length
  const sourcesWithProof = photoSources + documentSources
  const recommendationCount = retained.length
  const dated = retained.filter((e) => !Number.isNaN(Date.parse(e.jobDate)))
  const lastJobAt = dated.length
    ? dated.map((e) => e.jobDate).sort((a, b) => Date.parse(b) - Date.parse(a))[0]
    : null
  const monthsSinceLastJob = lastJobAt ? monthsSince(lastJobAt, now) : null

  const level = trustLevel({ independentSources, evidenceWeight, sourcesWithProof, monthsSinceLastJob })

  const reasons: string[] = []
  const proofPart =
    sourcesWithProof === 0
      ? ''
      : independentSources > 1
        ? `, dont ${sourcesWithProof} avec ${proofWording(photoSources, documentSources)}`
        : `, avec ${proofWording(photoSources, documentSources)}`
  reasons.push(
    independentSources > 1
      ? `${independentSources} personnes différentes l’ont recommandée${proofPart}`
      : `1 personne l’a recommandée${proofPart}`,
  )
  if (level === 'nouveau') {
    if (recommendationCount > independentSources) {
      const plural = independentSources > 1 ? 's' : ''
      reasons.push(
        `${recommendationCount} recommandations reçues, comptées pour l’instant comme ${independentSources} source${plural} indépendante${plural}`,
      )
    }
    reasons.push('Profil récent : la confiance se construit avec des recommandations de personnes différentes')
  }
  if (monthsSinceLastJob !== null) {
    reasons.push(`Dernier travail recommandé ${relativeMonths(monthsSinceLastJob)}`)
  }

  // Un profil « Nouveau » ne reçoit jamais d'avertissement.
  const warnings: string[] = []
  if (level !== 'nouveau') {
    if (linkedByDay.groups > 0) {
      warnings.push(linkedWarning(linkedByDay.recs, linkedByDay.groups, 'du même jour et du même quartier'))
    }
    if (linkedByAuthor.groups > 0) {
      warnings.push(linkedWarning(linkedByAuthor.recs, linkedByAuthor.groups, 'de personnes liées entre elles'))
    }
    if (sourcesWithProof === 0) {
      warnings.push('Aucune recommandation appuyée par une preuve vérifiée par un agent.')
    }
    if (
      monthsSinceLastJob !== null &&
      monthsSinceLastJob > TRUST_THRESHOLDS.tres_recommande.maxMonthsSinceLastJob
    ) {
      warnings.push('Aucun travail recommandé depuis plus de 12 mois.')
    }
  }

  return {
    index: level === 'nouveau' ? null : Math.round((100 * evidenceWeight) / (evidenceWeight + INDEX_PRIOR)),
    level,
    recommendationCount,
    independentSources,
    sourcesWithProof,
    evidenceWeight,
    lastJobAt,
    reasons: reasons.slice(0, 4),
    warnings,
  }
}

const LEVEL_RANK: Record<TrustLevel, number> = { nouveau: 0, recommande: 1, tres_recommande: 2 }

/**
 * Ordre de confiance décroissant, pour départager à adéquation égale :
 * niveau, puis E, puis nombre de sources indépendantes. Renvoie 0 en cas
 * d'égalité complète : l'appelant ajoute ses propres critères (date, id).
 */
export function compareSubjectTrust(
  a: Pick<SubjectTrust, 'level' | 'evidenceWeight' | 'independentSources'>,
  b: Pick<SubjectTrust, 'level' | 'evidenceWeight' | 'independentSources'>,
): number {
  return (
    LEVEL_RANK[b.level] - LEVEL_RANK[a.level] ||
    b.evidenceWeight - a.evidenceWeight ||
    b.independentSources - a.independentSources
  )
}
