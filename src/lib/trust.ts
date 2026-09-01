import type {
  ConfidenceLevel,
  Member,
  PriceStat,
  Provider,
  ProofType,
  Recommendation,
  ScoredProvider,
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
  if (!member) return 0.3

  let r = 0
  if (member.phoneVerified) r += 0.25
  r += Math.min(monthsSince(member.joinedAt, now) / 12, 1) * 0.2
  r += Math.min(authored.length / 5, 1) * 0.2

  const confirmations = authored.reduce((n, rec) => n + rec.confirmations.length, 0)
  const confirmationRate = authored.length ? confirmations / authored.length : 0
  r += Math.min(confirmationRate / 2, 1) * 0.35

  return Math.min(r, 1)
}

function recommendationWeight(
  rec: Recommendation,
  authorReliability: number,
  now: number,
): number {
  const author = 0.7 + authorReliability * 0.7
  const confirmed = 1 + Math.min(rec.confirmations.length, 10) * 0.03
  return PROOF_FACTOR[rec.proof] * recencyFactor(rec.jobDate, now) * author * confirmed
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
