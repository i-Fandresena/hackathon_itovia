import { safeGenerate } from './gemini.js'
import type {
  ExtractedCVData,
  ExtractedCandidateInfo,
  ExtractedExperience,
  ExtractedEducation,
  ExtractedCertification,
  ExtractedProject,
  ExtractedLanguage,
} from '../types/cv-extraction.js'

/**
 * Extrait le texte brut d'un PDF et le nettoie
 */
function cleanPdfText(text: string): string {
  return text
    .replace(/\r\n/g, '\n') // Normaliser les retours à la ligne
    .replace(/\s+/g, ' ') // Normaliser les espaces multiples
    .trim()
}

/**
 * Extrait les données structurées d'un CV via Gemini API
 * Utilise le modèle vision pour analyser le contenu du PDF
 *
 * @param extractedText - Texte brut extrait du PDF
 * @returns Données structurées du CV ou null en cas d'erreur
 */
export async function extractCVDataWithAI(extractedText: string): Promise<ExtractedCVData | null> {
  const cleanedText = cleanPdfText(extractedText)

  if (!cleanedText || cleanedText.length < 50) {
    return null // CV trop court pour être valide
  }

  const systemPrompt = `Tu es un expert en analyse de CV et extraction de données structurées.
Tu dois analyser le texte d'un CV et extraire les informations de manière structurée en JSON.
Réponds UNIQUEMENT avec un objet JSON valide, sans aucun texte avant ou après.

Les dates doivent être au format ISO (YYYY-MM-DD) ou null si non disponibles.
Les tableaux doivent toujours être des listes, jamais null.
Les valeurs manquantes doivent être null, pas une chaîne vide.

Le JSON doit suivre exactement cette structure (complète tous les champs) :

{
  "candidateInfo": {
    "firstName": string | null,
    "lastName": string | null,
    "email": string | null (email format),
    "phone": string | null,
    "city": string | null,
    "country": string | null,
    "linkedin": string | null (URL complète ou null),
    "github": string | null (URL complète ou null),
    "portfolio": string | null (URL complète ou null)
  },
  "professionalTitle": string | null (ex: "Senior Developer", "Product Manager"),
  "professionalSummary": string | null (résumé professionnel en max 500 caractères),
  "experiences": [
    {
      "jobTitle": string,
      "company": string,
      "location": string | null,
      "startDate": string (YYYY-MM-DD) | null,
      "endDate": string (YYYY-MM-DD) | null,
      "isCurrent": boolean (true si "currently working" ou "present"),
      "description": string (description complète du rôle),
      "technologies": string[] (technologies/outils utilisés)
    }
  ],
  "education": [
    {
      "degree": string (ex: "Bachelor", "Master", "Diploma"),
      "school": string (nom de l'établissement),
      "field": string | null (domaine d'étude),
      "graduationDate": string (YYYY-MM-DD) | null,
      "description": string | null
    }
  ],
  "certifications": [
    {
      "name": string,
      "issuer": string,
      "issueDate": string (YYYY-MM-DD) | null,
      "expiryDate": string (YYYY-MM-DD) | null,
      "credentialUrl": string | null
    }
  ],
  "projects": [
    {
      "name": string,
      "description": string,
      "role": string | null,
      "startDate": string (YYYY-MM-DD) | null,
      "endDate": string (YYYY-MM-DD) | null,
      "technologies": string[],
      "url": string | null
    }
  ],
  "languages": [
    {
      "name": string,
      "level": "A1" | "A2" | "B1" | "B2" | "C1" | "C2" | "Natif" | null
    }
  ],
  "skills": string[] (liste plate des compétences/mots-clés),
  "technologies": string[] (liste plate des technologies principales),
  "yearsOfExperience": number | null,
  "availability": string | null (ex: "Immediate", "2 weeks notice"),
  "desiredLocations": string[] (lieux de travail souhaités)
}

Règles d'extraction :
- Sois rigoureux et extrait TOUTES les informations pertinentes
- Pour les dates, préfère le format YYYY-MM-DD, sinon null
- Pour les URLs, extrais l'URL complète avec https://
- Identifie les années d'expérience en comptant les rôles et leurs durées
- Les compétences = tous les outils, langages, frameworks mentionnés
- Les technologies = les technologies principales (max 10-15 items)
- Sois conservateur : si une information n'est pas claire, mets null
- Ne fais pas d'hypothèses sur les données manquantes`

  const userPrompt = `Analyse ce texte de CV et extrais toutes les données structurées.
Réponds avec UNIQUEMENT l'objet JSON, pas d'explications.

TEXTE DU CV:
${cleanedText}`

  const result = await safeGenerate({
    system: systemPrompt,
    userInput: userPrompt,
    maxOutputChars: 15000, // Augmenté car JSON structuré plus long
    timeoutMs: 45000, // Plus de temps pour l'analyse
  })

  if (!result.text || result.blocked) {
    console.error('CV extraction blocked or failed:', result.reason)
    return null
  }

  try {
    // Nettoyer la réponse : supprimer les backticks markdown s'il y en a
    let jsonText = result.text.trim()
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.slice(7) // Enlever ```json
    }
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.slice(3) // Enlever ```
    }
    if (jsonText.endsWith('```')) {
      jsonText = jsonText.slice(0, -3) // Enlever ```
    }
    jsonText = jsonText.trim()

    const parsed = JSON.parse(jsonText)

    // Valider et normaliser les données
    const validated = validateExtractedData(parsed, cleanedText)
    return validated
  } catch (err) {
    console.error('CV extraction JSON parsing error:', err, 'Response:', result.text?.slice(0, 500))
    return null
  }
}

/**
 * Valide et normalise les données extraites
 */
function validateExtractedData(data: any, rawText: string): ExtractedCVData {
  const now = new Date().toISOString()

  // Déterminer le niveau de confiance
  const confidence = calculateConfidence(data)

  // Valider les données avec des valeurs par défaut
  const validated: ExtractedCVData = {
    candidateInfo: validateCandidateInfo(data.candidateInfo),
    professionalTitle: data.professionalTitle || null,
    professionalSummary: data.professionalSummary || null,
    experiences: validateArray(data.experiences, validateExperience),
    education: validateArray(data.education, validateEducation),
    certifications: validateArray(data.certifications, validateCertification),
    projects: validateArray(data.projects, validateProject),
    languages: validateArray(data.languages, validateLanguage),
    skills: Array.isArray(data.skills) ? data.skills.filter((s: any) => typeof s === 'string') : [],
    technologies: Array.isArray(data.technologies)
      ? data.technologies.filter((t: any) => typeof t === 'string')
      : [],
    yearsOfExperience: typeof data.yearsOfExperience === 'number' ? data.yearsOfExperience : null,
    availability: data.availability || null,
    desiredLocations: Array.isArray(data.desiredLocations)
      ? data.desiredLocations.filter((l: any) => typeof l === 'string')
      : [],
    extractionConfidence: confidence,
    rawText,
    extractionDate: now,
  }

  return validated
}

function calculateConfidence(data: any): 'high' | 'medium' | 'low' {
  let score = 0
  let maxScore = 0

  // Contact info
  maxScore += 3
  if (data.candidateInfo?.email) score += 1
  if (data.candidateInfo?.phone) score += 1
  if (data.candidateInfo?.firstName && data.candidateInfo?.lastName) score += 1

  // Professional info
  maxScore += 2
  if (data.professionalTitle) score += 1
  if (data.professionalSummary) score += 1

  // Structured content
  maxScore += 5
  if (Array.isArray(data.experiences) && data.experiences.length > 0) score += 2
  if (Array.isArray(data.education) && data.education.length > 0) score += 1
  if (Array.isArray(data.skills) && data.skills.length > 0) score += 1
  if (Array.isArray(data.languages) && data.languages.length > 0) score += 1

  const percentage = (score / maxScore) * 100
  if (percentage >= 70) return 'high'
  if (percentage >= 40) return 'medium'
  return 'low'
}

function validateCandidateInfo(info: any): ExtractedCandidateInfo {
  return {
    firstName: info?.firstName || null,
    lastName: info?.lastName || null,
    email: info?.email || null,
    phone: info?.phone || null,
    city: info?.city || null,
    country: info?.country || null,
    linkedin: info?.linkedin || null,
    github: info?.github || null,
    portfolio: info?.portfolio || null,
  }
}

function validateArray<T>(
  arr: any,
  validator: (item: any) => T,
): T[] {
  if (!Array.isArray(arr)) return []
  return arr.map(validator).filter((item) => item !== null)
}

function validateExperience(exp: any): ExtractedExperience {
  return {
    jobTitle: exp?.jobTitle || 'N/A',
    company: exp?.company || 'N/A',
    location: exp?.location || null,
    startDate: exp?.startDate || null,
    endDate: exp?.endDate || null,
    isCurrent: Boolean(exp?.isCurrent),
    description: exp?.description || '',
    technologies: Array.isArray(exp?.technologies)
      ? exp.technologies.filter((t: any) => typeof t === 'string')
      : [],
  }
}

function validateEducation(edu: any): ExtractedEducation {
  return {
    degree: edu?.degree || 'N/A',
    school: edu?.school || 'N/A',
    field: edu?.field || null,
    graduationDate: edu?.graduationDate || null,
    description: edu?.description || null,
  }
}

function validateCertification(cert: any): ExtractedCertification {
  return {
    name: cert?.name || 'N/A',
    issuer: cert?.issuer || 'N/A',
    issueDate: cert?.issueDate || null,
    expiryDate: cert?.expiryDate || null,
    credentialUrl: cert?.credentialUrl || null,
  }
}

function validateProject(proj: any): ExtractedProject {
  return {
    name: proj?.name || 'N/A',
    description: proj?.description || '',
    role: proj?.role || null,
    startDate: proj?.startDate || null,
    endDate: proj?.endDate || null,
    technologies: Array.isArray(proj?.technologies)
      ? proj.technologies.filter((t: any) => typeof t === 'string')
      : [],
    url: proj?.url || null,
  }
}

function validateLanguage(lang: any): ExtractedLanguage {
  const validLevels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'Natif']
  return {
    name: lang?.name || 'N/A',
    level: validLevels.includes(lang?.level) ? lang.level : null,
  }
}

/**
 * Calcule les années d'expérience à partir des expériences listées
 */
export function calculateYearsOfExperience(experiences: ExtractedExperience[]): number {
  if (!experiences || experiences.length === 0) return 0

  let totalMonths = 0
  const now = new Date()

  for (const exp of experiences) {
    const start = exp.startDate ? new Date(exp.startDate) : null
    const end = exp.endDate ? new Date(exp.endDate) : exp.isCurrent ? now : null

    if (start && end && end > start) {
      const months =
        (end.getFullYear() - start.getFullYear()) * 12 +
        (end.getMonth() - start.getMonth())
      totalMonths += months
    }
  }

  return Math.round(totalMonths / 12)
}
