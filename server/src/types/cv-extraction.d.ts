/**
 * Types pour l'extraction structurée de données depuis un CV
 * Utilise Gemini API pour extraire et structurer les données
 */

/** Contact du candidat extrait du CV */
export interface ExtractedCandidateInfo {
  firstName: string | null
  lastName: string | null
  email: string | null
  phone: string | null
  city: string | null
  country: string | null
  linkedin: string | null
  github: string | null
  portfolio: string | null
}

/** Expérience professionnelle */
export interface ExtractedExperience {
  jobTitle: string
  company: string
  location: string | null
  startDate: string | null
  endDate: string | null
  isCurrent: boolean
  description: string
  technologies: string[]
}

/** Formation académique */
export interface ExtractedEducation {
  degree: string
  school: string
  field: string | null
  graduationDate: string | null
  description: string | null
}

/** Certification ou accréditation */
export interface ExtractedCertification {
  name: string
  issuer: string
  issueDate: string | null
  expiryDate: string | null
  credentialUrl: string | null
}

/** Projet ou réalisation */
export interface ExtractedProject {
  name: string
  description: string
  role: string | null
  startDate: string | null
  endDate: string | null
  technologies: string[]
  url: string | null
}

/** Langue parlée */
export interface ExtractedLanguage {
  name: string
  level: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2' | 'Natif' | null
}

/** Données complètes extraites d'un CV */
export interface ExtractedCVData {
  // Informations personnelles
  candidateInfo: ExtractedCandidateInfo
  
  // Infos professionnelles
  professionalTitle: string | null
  professionalSummary: string | null
  
  // Listes structurées
  experiences: ExtractedExperience[]
  education: ExtractedEducation[]
  certifications: ExtractedCertification[]
  projects: ExtractedProject[]
  languages: ExtractedLanguage[]
  
  // Listes simples
  skills: string[]
  technologies: string[]
  
  // Informations supplémentaires
  yearsOfExperience: number | null
  availability: string | null
  desiredLocations: string[]
  
  // Métadonnées
  extractionConfidence: 'high' | 'medium' | 'low'
  rawText: string
  extractionDate: string
}

/** Réponse API pour le téléversement de CV */
export interface CVUploadResponse {
  cvUrl: string
  suggestedSkills: string[]
  extractedData: Partial<ExtractedCVData>
  validationWarnings: string[]
}
