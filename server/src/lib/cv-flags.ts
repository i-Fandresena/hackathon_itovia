import type {
  ExtractedCVData,
  ExtractedCandidateInfo,
  ExtractedEducation,
  ExtractedExperience,
} from '../types/cv-extraction.js'

/**
 * Contrôles automatiques d'un CV déposé — fonctions pures, déterministes.
 *
 * Règle produit : un drapeau ne décide JAMAIS. Il n'entraîne ni rejet ni
 * sanction ; il éclaire seulement la personne qui vérifie le CV (admin ou
 * rôle habilité). Seule l'incompatibilité de nom reste bloquante au dépôt
 * (`checkCvName`), et elle n'est pas un drapeau.
 */

export type CvFlagCode =
  | 'email_different'
  | 'telephone_different'
  | 'doublon_fichier'
  | 'dates_chevauchement'
  | 'experience_incoherente'
  | 'formation_incoherente'
  | 'extraction_ia_indisponible'

export type CvFlagSeverity = 'info' | 'alerte'

export interface CvFlag {
  code: CvFlagCode
  severity: CvFlagSeverity
  message: string
}

export type DeclaredExperienceLevel = 'debutant' | 'junior' | 'intermediaire' | 'senior'
export type DeclaredEducationLevel = 'bac' | 'licence' | 'master' | 'autodidacte' | 'technique'

export interface CvFlagProfile {
  email: string
  phone: string | null
  experienceLevel: DeclaredExperienceLevel
  educationLevel: DeclaredEducationLevel
}

export interface CvFlagInput {
  /** `null` quand l'extraction IA est indisponible. */
  extracted: Pick<ExtractedCVData, 'candidateInfo' | 'experiences' | 'education' | 'yearsOfExperience'> | null
  profile: CvFlagProfile
  /** Le même fichier (sha256) a déjà été déposé par un AUTRE compte. */
  duplicateFile: boolean
  now: Date
}

const CV_FLAG_CODES: readonly CvFlagCode[] = [
  'email_different',
  'telephone_different',
  'doublon_fichier',
  'dates_chevauchement',
  'experience_incoherente',
  'formation_incoherente',
  'extraction_ia_indisponible',
]

const MS_PER_MONTH = (365.25 / 12) * 24 * 60 * 60 * 1000

/** Minuscules, sans accents, espaces normalisés. */
export function normalizeText(value: string | null | undefined): string {
  if (!value) return ''
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Contrôle d'identité BLOQUANT : le nom du CV doit être compatible avec le
 * nom du profil. Retourne le message d'erreur, ou `null` si compatible (ou
 * si le CV ne mentionne aucun nom exploitable).
 */
export function checkCvName(
  cvInfo: Pick<ExtractedCandidateInfo, 'firstName' | 'lastName'>,
  profileFullName: string,
): string | null {
  if (!cvInfo.firstName && !cvInfo.lastName) return null
  const profileName = normalizeText(profileFullName)
  const firstNameMatch = !cvInfo.firstName || profileName.includes(normalizeText(cvInfo.firstName))
  const lastNameMatch = !cvInfo.lastName || profileName.includes(normalizeText(cvInfo.lastName))
  if (firstNameMatch && lastNameMatch) return null
  const cvName = `${cvInfo.firstName ?? ''} ${cvInfo.lastName ?? ''}`.trim()
  return `Le nom dans le CV (${cvName}) ne correspond pas au nom du profil (${profileFullName}).`
}

/** Email / téléphone différents du profil : simples drapeaux, jamais un rejet. */
export function identityFlags(
  cvInfo: Pick<ExtractedCandidateInfo, 'email' | 'phone'>,
  profile: Pick<CvFlagProfile, 'email' | 'phone'>,
): CvFlag[] {
  const flags: CvFlag[] = []

  const cvEmail = normalizeText(cvInfo.email)
  if (cvEmail && cvEmail !== normalizeText(profile.email)) {
    flags.push({
      code: 'email_different',
      severity: 'info',
      message: `L'email du CV (${cvInfo.email}) est différent de l'email du compte.`,
    })
  }

  const cvDigits = (cvInfo.phone ?? '').replace(/\D/g, '')
  const profileDigits = (profile.phone ?? '').replace(/\D/g, '')
  if (cvDigits && profileDigits) {
    // Comparaison tolérante aux préfixes (+261 / 0) : on compare les 9
    // derniers chiffres, ou l'inclusion de l'un dans l'autre.
    const tail = (digits: string) => digits.slice(-9)
    const match =
      cvDigits === profileDigits ||
      cvDigits.includes(profileDigits) ||
      profileDigits.includes(cvDigits) ||
      (cvDigits.length >= 9 && profileDigits.length >= 9 && tail(cvDigits) === tail(profileDigits))
    if (!match) {
      flags.push({
        code: 'telephone_different',
        severity: 'info',
        message: `Le téléphone du CV (${cvInfo.phone}) est différent du téléphone du profil.`,
      })
    }
  }

  return flags
}

interface DatedExperience {
  label: string
  company: string
  fullTime: boolean
  start: number
  end: number
}

/** Activités qui se cumulent légitimement avec un autre poste. */
const NON_FULL_TIME_PATTERN =
  /(temps partiel|mi-temps|part[- ]?time|free[- ]?lance|independant|consultant|stage|stagiaire|intern|benevol|volontaire|volontariat|alternan|apprenti|vacataire|vacation|auto[- ]?entrepreneur|fondateur|fondatrice|founder|associatif|projet personnel)/

function parseDate(value: string | null | undefined): number | null {
  if (!value) return null
  const time = Date.parse(value)
  return Number.isNaN(time) ? null : time
}

function toDatedExperiences(experiences: ExtractedExperience[], now: Date): DatedExperience[] {
  const dated: DatedExperience[] = []
  for (const exp of experiences) {
    const start = parseDate(exp.startDate)
    const end = parseDate(exp.endDate) ?? (exp.isCurrent ? now.getTime() : null)
    if (start === null || end === null || end <= start) continue
    dated.push({
      label: `${exp.jobTitle} (${exp.company})`,
      company: normalizeText(exp.company),
      fullTime: !NON_FULL_TIME_PATTERN.test(normalizeText(`${exp.jobTitle} ${exp.description}`)),
      start,
      end: Math.min(end, now.getTime()),
    })
  }
  return dated
}

/** Chevauchement minimal (en mois) pour parler d'incompatibilité manifeste. */
const OVERLAP_MIN_MONTHS = 6

/**
 * Deux postes a priori à temps plein, dans deux structures différentes, qui
 * se recouvrent d'au moins 6 mois.
 */
export function overlapFlag(experiences: ExtractedExperience[], now: Date): CvFlag | null {
  const fullTime = toDatedExperiences(experiences, now).filter((e) => e.fullTime)
  const pairs: Array<{ a: DatedExperience; b: DatedExperience; months: number }> = []
  for (let i = 0; i < fullTime.length; i += 1) {
    for (let j = i + 1; j < fullTime.length; j += 1) {
      const a = fullTime[i]
      const b = fullTime[j]
      if (a.company === b.company) continue
      const months = (Math.min(a.end, b.end) - Math.max(a.start, b.start)) / MS_PER_MONTH
      if (months >= OVERLAP_MIN_MONTHS) pairs.push({ a, b, months })
    }
  }
  if (pairs.length === 0) return null
  pairs.sort((x, y) => y.months - x.months)
  const worst = pairs[0]
  const others = pairs.length > 1 ? ` (${pairs.length} chevauchements au total)` : ''
  return {
    code: 'dates_chevauchement',
    severity: 'alerte',
    message: `Deux expériences à temps plein se chevauchent d'environ ${Math.round(worst.months)} mois : ${worst.a.label} et ${worst.b.label}${others}.`,
  }
}

/**
 * Années d'expérience réellement couvertes par le CV : union des périodes
 * datées (les chevauchements ne comptent qu'une fois). `null` si le CV liste
 * des expériences mais qu'aucune n'est datée et qu'aucun total n'est fourni.
 */
export function computeExperienceYears(
  experiences: ExtractedExperience[],
  fallbackYears: number | null,
  now: Date,
): number | null {
  const intervals = toDatedExperiences(experiences, now)
    .map((e) => [e.start, e.end] as [number, number])
    .sort((a, b) => a[0] - b[0])

  if (intervals.length === 0) {
    if (typeof fallbackYears === 'number' && fallbackYears >= 0) return fallbackYears
    return experiences.length === 0 ? 0 : null
  }

  let total = 0
  let [curStart, curEnd] = intervals[0]
  for (const [start, end] of intervals.slice(1)) {
    if (start <= curEnd) {
      curEnd = Math.max(curEnd, end)
    } else {
      total += curEnd - curStart
      curStart = start
      curEnd = end
    }
  }
  total += curEnd - curStart
  return Math.round((total / MS_PER_MONTH / 12) * 10) / 10
}

/**
 * Fourchettes tolérées (en années) par niveau déclaré — volontairement plus
 * larges que les libellés affichés (Junior 1–2 ans, Intermédiaire 3–5 ans,
 * Senior 5+ ans) pour ne signaler que les écarts nets.
 */
const EXPERIENCE_BOUNDS: Record<DeclaredExperienceLevel, { min: number; max: number; label: string }> = {
  debutant: { min: 0, max: 2, label: 'Débutant' },
  junior: { min: 0, max: 4, label: 'Junior' },
  intermediaire: { min: 2, max: 8, label: 'Intermédiaire' },
  senior: { min: 4, max: Number.POSITIVE_INFINITY, label: 'Senior' },
}

export function experienceFlag(years: number | null, declared: DeclaredExperienceLevel): CvFlag | null {
  if (years === null) return null
  const bounds = EXPERIENCE_BOUNDS[declared]
  const shown = String(years).replace('.', ',')
  if (years < bounds.min) {
    return {
      code: 'experience_incoherente',
      severity: 'alerte',
      message: `Le CV justifie environ ${shown} an(s) d'expérience, ce qui est inférieur au niveau déclaré (${bounds.label}).`,
    }
  }
  if (years > bounds.max) {
    return {
      code: 'experience_incoherente',
      severity: 'info',
      message: `Le CV indique environ ${shown} an(s) d'expérience, ce qui dépasse le niveau déclaré (${bounds.label}).`,
    }
  }
  return null
}

/** Rang académique d'un intitulé de diplôme : 3 = bac+5, 2 = bac+3/4, 1 = bac/bac+2, 0 = non reconnu. */
export function degreeRank(degree: string): number {
  const text = normalizeText(degree)
  if (/\b(master|mastere|m1|m2|mba|ingenieur|ingeniorat|doctorat|phd|dea|dess)\b|bac\s*\+\s*[5-8]/.test(text)) return 3
  if (/\b(licence|license|bachelor|l3|maitrise)\b|bac\s*\+\s*[34]/.test(text)) return 2
  if (/\b(bac|bacc|baccalaureat|bts|dut|dts|deug|l1|l2)\b|bac\s*\+\s*[12]/.test(text)) return 1
  return 0
}

const EDUCATION_RANK: Partial<Record<DeclaredEducationLevel, { rank: number; label: string }>> = {
  bac: { rank: 1, label: 'Baccalauréat' },
  licence: { rank: 2, label: 'Licence' },
  master: { rank: 3, label: 'Master' },
}

/**
 * Seuls les niveaux académiques déclarés (bac / licence / master) sont
 * comparés : « autodidacte » et « technique » ne promettent aucun diplôme.
 */
export function educationFlag(education: ExtractedEducation[], declared: DeclaredEducationLevel): CvFlag | null {
  const expected = EDUCATION_RANK[declared]
  if (!expected) return null

  if (education.length === 0) {
    if (expected.rank < 2) return null
    return {
      code: 'formation_incoherente',
      severity: 'info',
      message: `Le CV ne mentionne aucune formation alors que le niveau déclaré est ${expected.label}.`,
    }
  }

  const ranks = education.map((e) => degreeRank(`${e.degree} ${e.field ?? ''}`)).filter((r) => r > 0)
  // Aucun intitulé reconnu : on ne conclut rien plutôt que de signaler à tort.
  if (ranks.length === 0) return null
  const highest = Math.max(...ranks)
  if (highest >= expected.rank) return null
  return {
    code: 'formation_incoherente',
    severity: 'alerte',
    message: `Le diplôme le plus élevé repéré dans le CV est inférieur au niveau déclaré (${expected.label}).`,
  }
}

/** Assemble tous les drapeaux d'un dépôt. */
export function computeCvFlags(input: CvFlagInput): CvFlag[] {
  const flags: CvFlag[] = []

  if (input.duplicateFile) {
    flags.push({
      code: 'doublon_fichier',
      severity: 'alerte',
      message: 'Ce fichier a déjà été déposé à l’identique par un autre compte.',
    })
  }

  if (!input.extracted) {
    flags.push({
      code: 'extraction_ia_indisponible',
      severity: 'info',
      message:
        'Extraction IA indisponible : les contrôles automatiques (identité, dates, expérience, formation) n’ont pas pu être effectués.',
    })
    return flags
  }

  const { candidateInfo, experiences, education, yearsOfExperience } = input.extracted
  flags.push(...identityFlags(candidateInfo, input.profile))

  const overlap = overlapFlag(experiences, input.now)
  if (overlap) flags.push(overlap)

  const experience = experienceFlag(
    computeExperienceYears(experiences, yearsOfExperience, input.now),
    input.profile.experienceLevel,
  )
  if (experience) flags.push(experience)

  const formation = educationFlag(education, input.profile.educationLevel)
  if (formation) flags.push(formation)

  return flags
}

/** Relit des drapeaux stockés en JSON (colonne `cvFlags`) sans leur faire confiance. */
export function parseCvFlags(value: unknown): CvFlag[] {
  if (!Array.isArray(value)) return []
  const flags: CvFlag[] = []
  for (const item of value) {
    if (!item || typeof item !== 'object') continue
    const { code, severity, message } = item as Record<string, unknown>
    if (typeof code !== 'string' || !CV_FLAG_CODES.includes(code as CvFlagCode)) continue
    if (typeof message !== 'string') continue
    flags.push({
      code: code as CvFlagCode,
      severity: severity === 'alerte' ? 'alerte' : 'info',
      message,
    })
  }
  return flags
}
