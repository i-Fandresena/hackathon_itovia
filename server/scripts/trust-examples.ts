/**
 * Script de contrôle du moteur de confiance des talents et entreprises
 * (`evaluateSubject`). Aucune base, aucun serveur : des cas figés au
 * 2026-10-11, dont l'exemple chiffré du plan.
 *
 *   cd server && npx tsx scripts/trust-examples.ts
 *
 * Affiche OK / ÉCHEC par vérification et sort en code 1 en cas d'échec.
 */
import {
  compareSubjectTrust,
  evaluateSubject,
  reliabilityFrom,
  trustLevel,
} from '../../src/lib/trust.js'
import type { AuthorStats, ProofType, SubjectTrust, TrustEvidence } from '../../src/types/index.js'

const NOW = Date.parse('2026-10-11T00:00:00.000Z')

let failures = 0
function check(label: string, ok: boolean, detail = '') {
  if (!ok) failures++
  console.log(`${ok ? 'OK    ' : 'ÉCHEC '} ${label}${detail ? ` — ${detail}` : ''}`)
}
function near(a: number, b: number, eps: number) {
  return Math.abs(a - b) <= eps
}

let seq = 0
function ev(partial: {
  author: AuthorStats | null
  district: string
  createdAt: string
  jobDate: string
  proof?: ProofType
  proofAccepted?: boolean | null
  linkKey?: string | null
  excludedAt?: string | null
  authorMemberId?: string
}): TrustEvidence {
  seq++
  return {
    id: `e${seq}`,
    authorMemberId: partial.authorMemberId ?? `m${seq}`,
    authorLinkKey: partial.linkKey ?? `k${seq}`,
    authorDistrict: partial.district,
    author: partial.author,
    proof: partial.proof ?? 'aucune',
    proofAccepted: partial.proofAccepted ?? (partial.proof && partial.proof !== 'aucune' ? true : null),
    jobDate: partial.jobDate,
    createdAt: partial.createdAt,
    confirmations: 0,
    excludedAt: partial.excludedAt ?? null,
  }
}

const neuf = (joinedAt = '2026-10-11'): AuthorStats => ({
  phoneVerified: false, joinedAt, authoredCount: 1, confirmationsReceived: 0,
})
const solide: AuthorStats = {
  phoneVerified: true, joinedAt: '2024-01-01', authoredCount: 5, confirmationsReceived: 10,
}

function show(t: SubjectTrust) {
  return `niveau=${t.level} E=${t.evidenceWeight.toFixed(4)} indice=${t.index} sources=${t.independentSources} preuves=${t.sourcesWithProof} n=${t.recommendationCount}`
}

/* ---------- 1. Exemple chiffré du plan ---------- */
console.log('\n1. Exemple du plan (A, B, C, D, E au 2026-10-11)')
// Auteurs reconstruits pour retrouver les fiabilités du plan.
const authorA: AuthorStats = { phoneVerified: false, joinedAt: '2026-02-10', authoredCount: 3, confirmationsReceived: 0 } // particulier, 8 mois, 3 avis
const authorB = neuf('2026-10-11') // compte neuf
const authorC: AuthorStats = { phoneVerified: false, joinedAt: '2025-08-11', authoredCount: 1, confirmationsReceived: 0 } // recruteur, 14 mois
const authorD = neuf('2026-10-04') // compte neuf (une semaine)
const authorE = neuf('2026-10-04')
console.log(`   fiabilités : A=${reliabilityFrom(authorA, 3, 0, NOW).toFixed(3)} B=${reliabilityFrom(authorB, 1, 0, NOW).toFixed(3)} C=${reliabilityFrom(authorC, 1, 0, NOW).toFixed(3)} D=${reliabilityFrom(authorD, 1, 0, NOW).toFixed(3)}`)

const example = [
  ev({ author: authorA, district: 'Ambohimangakely', createdAt: '2026-09-20T08:00:00Z', jobDate: '2026-09-15', proof: 'photo' }),
  ev({ author: authorB, district: 'Itaosy', createdAt: '2026-10-02T10:00:00Z', jobDate: '2026-07-10', proof: 'photo' }),
  ev({ author: authorC, district: 'Andraharo', createdAt: '2026-10-05T09:00:00Z', jobDate: '2026-03-01' }),
  // D et E : même quartier, même jour à Madagascar (10:00 et 18:00 heure locale).
  ev({ author: authorD, district: 'Alasora', createdAt: '2026-10-08T07:00:00Z', jobDate: '2026-09-01' }),
  ev({ author: authorE, district: 'Alasora', createdAt: '2026-10-08T15:00:00Z', jobDate: '2026-09-01' }),
]
const t1 = evaluateSubject(example, NOW)
console.log(`   ${show(t1)}`)
check('E ≈ 3,33', near(t1.evidenceWeight, 3.33, 0.01), t1.evidenceWeight.toFixed(4))
check('indice 53', t1.index === 53, String(t1.index))
check('niveau tres_recommande', t1.level === 'tres_recommande', t1.level)
check('4 sources indépendantes', t1.independentSources === 4)
check('2 sources avec preuve', t1.sourcesWithProof === 2)
check('5 recommandations retenues', t1.recommendationCount === 5)
const reason = '4 personnes différentes l’ont recommandée, dont 2 avec photo du travail'
check('raison attendue', t1.reasons.includes(reason), JSON.stringify(t1.reasons))
const warning = '2 recommandations du même jour et du même quartier comptées comme une seule source.'
check('avertissement attendu', t1.warnings.includes(warning), JSON.stringify(t1.warnings))

/* ---------- 2. Cinq comptes neufs, même quartier, même jour ---------- */
console.log('\n2. Cinq comptes neufs du même quartier le même jour')
const five = Array.from({ length: 5 }, (_, i) =>
  ev({ author: neuf(), district: 'Isotry', createdAt: `2026-10-10T0${5 + i}:00:00Z`, jobDate: '2026-10-01' }),
)
const t2 = evaluateSubject(five, NOW)
console.log(`   ${show(t2)}`)
check('niveau nouveau', t2.level === 'nouveau')
check('1 source indépendante', t2.independentSources === 1)
check('indice non affiché (null)', t2.index === null)
check('aucun avertissement pour un profil Nouveau', t2.warnings.length === 0, JSON.stringify(t2.warnings))
console.log(`   raisons : ${JSON.stringify(t2.reasons)}`)

/* ---------- 3. Cas limites de seuils ---------- */
console.log('\n3. Seuils')
check('trustLevel : 2 sources, E = 1,2 exactement -> recommande',
  trustLevel({ independentSources: 2, evidenceWeight: 1.2, sourcesWithProof: 0, monthsSinceLastJob: 1 }) === 'recommande')
check('trustLevel : 2 sources, E = 1,1999 -> nouveau',
  trustLevel({ independentSources: 2, evidenceWeight: 1.1999, sourcesWithProof: 0, monthsSinceLastJob: 1 }) === 'nouveau')
check('trustLevel : 1 source, E = 5 -> nouveau',
  trustLevel({ independentSources: 1, evidenceWeight: 5, sourcesWithProof: 1, monthsSinceLastJob: 1 }) === 'nouveau')
check('trustLevel : 4 sources, E = 2,8, 1 preuve, 12 mois -> tres_recommande',
  trustLevel({ independentSources: 4, evidenceWeight: 2.8, sourcesWithProof: 1, monthsSinceLastJob: 12 }) === 'tres_recommande')

// Deux comptes neufs, quartiers différents, travail récent sans preuve : 2 × 0,6188 ≥ 1,2.
const two = [
  ev({ author: neuf(), district: 'Analakely', createdAt: '2026-10-09T08:00:00Z', jobDate: '2026-10-01' }),
  ev({ author: neuf(), district: 'Ivandry', createdAt: '2026-10-09T09:00:00Z', jobDate: '2026-10-01' }),
]
const t3 = evaluateSubject(two, NOW)
console.log(`   deux comptes neufs : ${show(t3)}`)
check('2 sources indépendantes, E ≥ 1,2 -> recommande', t3.level === 'recommande' && t3.independentSources === 2)
check('indice affiché pour Recommandé', t3.index !== null, String(t3.index))

// Même jour en UTC mais pas à Madagascar (22:00 UTC = 01:00 le lendemain).
const midnight = [
  ev({ author: neuf(), district: 'Alasora', createdAt: '2026-10-08T07:00:00Z', jobDate: '2026-10-01' }),
  ev({ author: neuf(), district: 'Alasora', createdAt: '2026-10-08T22:00:00Z', jobDate: '2026-10-01' }),
]
check('jour calendaire de Madagascar (UTC+3) : 2 sources', evaluateSubject(midnight, NOW).independentSources === 2)

// Même empreinte d'auteur, jours et quartiers différents -> une seule source.
const linked = [
  ev({ author: neuf(), district: 'Alasora', createdAt: '2026-10-01T07:00:00Z', jobDate: '2026-10-01', linkKey: 'meme' }),
  ev({ author: neuf(), district: 'Itaosy', createdAt: '2026-10-05T07:00:00Z', jobDate: '2026-10-01', linkKey: 'meme' }),
]
check('même empreinte d’auteur : 1 source', evaluateSubject(linked, NOW).independentSources === 1)

// Preuve non acceptée : pèse comme « aucune » et ne compte pas comme source avec preuve.
const notAccepted = example.map((e) => ({ ...e, proofAccepted: e.proof === 'aucune' ? null : false }))
const t4 = evaluateSubject(notAccepted, NOW)
console.log(`   preuves non acceptées : ${show(t4)}`)
check('preuve non acceptée : 0 source avec preuve', t4.sourcesWithProof === 0)
check('preuve non acceptée : pas Très recommandé', t4.level === 'recommande', t4.level)
check('preuve non acceptée : E plus faible', t4.evidenceWeight < t1.evidenceWeight)
check('preuve non acceptée : avertissement preuve',
  t4.warnings.includes('Aucune recommandation appuyée par une preuve vérifiée par un agent.'))

// Recommandation exclue : résultat identique à son absence.
const withExcluded = [
  ...example,
  ev({ author: solide, district: 'Ivato', createdAt: '2026-10-09T08:00:00Z', jobDate: '2026-10-01', proof: 'facture', excludedAt: '2026-10-10T08:00:00Z' }),
]
const t5 = evaluateSubject(withExcluded, NOW)
check('recommandation exclue ignorée', JSON.stringify(t5) === JSON.stringify(t1))

// Doublon d'auteur : seule la plus récente compte.
const dup = [
  ...example,
  ev({ author: authorC, district: 'Andraharo', createdAt: '2026-09-01T09:00:00Z', jobDate: '2025-01-01', authorMemberId: example[2].authorMemberId }),
]
check('un seul retour par auteur (le plus récent)', JSON.stringify(evaluateSubject(dup, NOW)) === JSON.stringify(t1))

// Dernier travail à plus de 12 mois : beaucoup de preuve, mais pas « Très recommandé ».
const old = Array.from({ length: 4 }, (_, i) =>
  ev({ author: solide, district: `Quartier ${i}`, createdAt: `2026-10-0${i + 1}T08:00:00Z`, jobDate: '2025-09-01', proof: 'facture' }),
)
const t6 = evaluateSubject(old, NOW)
console.log(`   dernier travail à 13 mois : ${show(t6)}`)
check('dernier travail > 12 mois : recommande', t6.level === 'recommande' && t6.evidenceWeight >= 2.8 && t6.independentSources === 4)
check('dernier travail > 12 mois : avertissement', t6.warnings.includes('Aucun travail recommandé depuis plus de 12 mois.'))

// Aucune recommandation.
const t7 = evaluateSubject([], NOW)
check('sans recommandation : nouveau, aucun avertissement', t7.level === 'nouveau' && t7.warnings.length === 0 && t7.index === null)

/* ---------- 4. Départage ---------- */
console.log('\n4. compareSubjectTrust')
const sorted = [t2, t6, t3, t1].sort(compareSubjectTrust)
check('ordre : très recommandé, puis recommandé (E décroissant), puis nouveau',
  sorted[0] === t1 && sorted[1] === t6 && sorted[2] === t3 && sorted[3] === t2,
  sorted.map((t) => `${t.level}/${t.evidenceWeight.toFixed(2)}`).join(' > '))
check('égalité complète -> 0', compareSubjectTrust(t1, { ...t1 }) === 0)
check('à niveau et E égaux, plus de sources d’abord',
  compareSubjectTrust({ level: 'recommande', evidenceWeight: 2, independentSources: 3 },
    { level: 'recommande', evidenceWeight: 2, independentSources: 2 }) < 0)

console.log(failures ? `\n${failures} échec(s).` : '\nTous les contrôles sont OK.')
process.exit(failures ? 1 : 0)
