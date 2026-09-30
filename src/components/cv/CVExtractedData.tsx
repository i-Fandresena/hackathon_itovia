import { ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'
import { Card } from '../ui/Card'
import type { CandidateProfile } from '../../types'
import './CVExtractedData.css'

interface CVExtractedDataProps {
  profile: CandidateProfile
}

export function CVExtractedData({ profile }: CVExtractedDataProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    info: true,
    experiences: false,
    education: false,
    projects: false,
    certifications: false,
    languages: false,
  })

  const toggleSection = (section: string) => {
    setExpanded((prev) => ({ ...prev, [section]: !prev[section] }))
  }

  if (
    !profile.cvExtractionDate ||
    profile.cvExtractionConfidence === 'low'
  ) {
    return null
  }

  const confidenceBadgeColor = {
    high: '#10b981',
    medium: '#f59e0b',
    low: '#ef4444',
  }

  return (
    <Card className="cv-extracted-data">
      <div className="cv-extracted-header">
        <div>
          <h2>Données extraites de votre CV</h2>
          <p className="cv-extracted-subtitle">
            Extraites le {new Date(profile.cvExtractionDate).toLocaleDateString('fr-FR')}
          </p>
        </div>
        <div
          className="cv-confidence-badge"
          style={{
            backgroundColor: confidenceBadgeColor[profile.cvExtractionConfidence || 'low'],
          }}
        >
          {profile.cvExtractionConfidence === 'high'
            ? 'Haute confiance'
            : profile.cvExtractionConfidence === 'medium'
              ? 'Confiance moyenne'
              : 'Faible confiance'}
        </div>
      </div>

      {/* Informations personnelles */}
      {profile.cvExtractedInfo && (
        <ExpandableSection
          title="Informations personnelles"
          section="info"
          expanded={expanded.info}
          onToggle={toggleSection}
        >
          <div className="cv-info-grid">
            {profile.cvExtractedInfo.firstName && (
              <div className="cv-info-item">
                <span className="cv-info-label">Prénom :</span>
                <span>{profile.cvExtractedInfo.firstName}</span>
              </div>
            )}
            {profile.cvExtractedInfo.lastName && (
              <div className="cv-info-item">
                <span className="cv-info-label">Nom :</span>
                <span>{profile.cvExtractedInfo.lastName}</span>
              </div>
            )}
            {profile.cvExtractedInfo.email && (
              <div className="cv-info-item">
                <span className="cv-info-label">Email :</span>
                <span>{profile.cvExtractedInfo.email}</span>
              </div>
            )}
            {profile.cvExtractedInfo.phone && (
              <div className="cv-info-item">
                <span className="cv-info-label">Téléphone :</span>
                <span>{profile.cvExtractedInfo.phone}</span>
              </div>
            )}
            {profile.cvExtractedInfo.city && (
              <div className="cv-info-item">
                <span className="cv-info-label">Ville :</span>
                <span>{profile.cvExtractedInfo.city}</span>
              </div>
            )}
            {profile.cvExtractedInfo.country && (
              <div className="cv-info-item">
                <span className="cv-info-label">Pays :</span>
                <span>{profile.cvExtractedInfo.country}</span>
              </div>
            )}
            {profile.cvExtractedInfo.linkedin && (
              <div className="cv-info-item">
                <span className="cv-info-label">LinkedIn :</span>
                <a href={profile.cvExtractedInfo.linkedin} target="_blank" rel="noreferrer">
                  Profil
                </a>
              </div>
            )}
            {profile.cvExtractedInfo.github && (
              <div className="cv-info-item">
                <span className="cv-info-label">GitHub :</span>
                <a href={profile.cvExtractedInfo.github} target="_blank" rel="noreferrer">
                  Profil
                </a>
              </div>
            )}
            {profile.cvExtractedInfo.portfolio && (
              <div className="cv-info-item">
                <span className="cv-info-label">Portfolio :</span>
                <a href={profile.cvExtractedInfo.portfolio} target="_blank" rel="noreferrer">
                  Voir
                </a>
              </div>
            )}
          </div>
        </ExpandableSection>
      )}

      {/* Titre professionnel et résumé */}
      {(profile.cvProfessionalTitle || profile.cvProfessionalSummary) && (
        <div className="cv-section-item">
          {profile.cvProfessionalTitle && (
            <div>
              <h3 className="cv-section-title">Titre professionnel</h3>
              <p>{profile.cvProfessionalTitle}</p>
            </div>
          )}
          {profile.cvProfessionalSummary && (
            <div>
              <h3 className="cv-section-title">Résumé professionnel</h3>
              <p>{profile.cvProfessionalSummary}</p>
            </div>
          )}
        </div>
      )}

      {/* Expériences */}
      {profile.cvExperiences && profile.cvExperiences.length > 0 && (
        <ExpandableSection
          title={`Expériences (${profile.cvExperiences.length})`}
          section="experiences"
          expanded={expanded.experiences}
          onToggle={toggleSection}
        >
          <div className="cv-experiences-list">
            {profile.cvExperiences.map((exp, idx) => (
              <div key={idx} className="cv-experience-item">
                <h4 className="cv-item-title">
                  {exp.jobTitle} {exp.isCurrent && <span className="cv-badge">En cours</span>}
                </h4>
                <p className="cv-item-meta">{exp.company}</p>
                {exp.startDate && (
                  <p className="cv-item-dates">
                    {new Date(exp.startDate).toLocaleDateString('fr-FR', {
                      year: 'numeric',
                      month: 'long',
                    })}{' '}
                    {exp.endDate
                      ? `- ${new Date(exp.endDate).toLocaleDateString('fr-FR', {
                          year: 'numeric',
                          month: 'long',
                        })}`
                      : '- Aujourd\'hui'}
                  </p>
                )}
                {exp.location && <p className="cv-item-location">{exp.location}</p>}
                {exp.description && (
                  <p className="cv-item-description">{exp.description}</p>
                )}
                {exp.technologies.length > 0 && (
                  <div className="cv-tech-tags">
                    {exp.technologies.map((tech) => (
                      <span key={tech} className="cv-tag">
                        {tech}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </ExpandableSection>
      )}

      {/* Formation */}
      {profile.cvEducation && profile.cvEducation.length > 0 && (
        <ExpandableSection
          title={`Formation (${profile.cvEducation.length})`}
          section="education"
          expanded={expanded.education}
          onToggle={toggleSection}
        >
          <div className="cv-education-list">
            {profile.cvEducation.map((edu, idx) => (
              <div key={idx} className="cv-education-item">
                <h4 className="cv-item-title">{edu.degree}</h4>
                <p className="cv-item-meta">{edu.school}</p>
                {edu.field && <p className="cv-item-field">Domaine : {edu.field}</p>}
                {edu.graduationDate && (
                  <p className="cv-item-date">
                    Graduation :{' '}
                    {new Date(edu.graduationDate).toLocaleDateString('fr-FR', {
                      year: 'numeric',
                      month: 'long',
                    })}
                  </p>
                )}
              </div>
            ))}
          </div>
        </ExpandableSection>
      )}

      {/* Projets */}
      {profile.cvProjects && profile.cvProjects.length > 0 && (
        <ExpandableSection
          title={`Projets (${profile.cvProjects.length})`}
          section="projects"
          expanded={expanded.projects}
          onToggle={toggleSection}
        >
          <div className="cv-projects-list">
            {profile.cvProjects.map((proj, idx) => (
              <div key={idx} className="cv-project-item">
                <h4 className="cv-item-title">{proj.name}</h4>
                {proj.role && <p className="cv-item-meta">Rôle : {proj.role}</p>}
                {proj.description && (
                  <p className="cv-item-description">{proj.description}</p>
                )}
                {proj.technologies.length > 0 && (
                  <div className="cv-tech-tags">
                    {proj.technologies.map((tech) => (
                      <span key={tech} className="cv-tag">
                        {tech}
                      </span>
                    ))}
                  </div>
                )}
                {proj.url && (
                  <a href={proj.url} target="_blank" rel="noreferrer" className="cv-link">
                    Voir le projet →
                  </a>
                )}
              </div>
            ))}
          </div>
        </ExpandableSection>
      )}

      {/* Certifications */}
      {profile.cvCertifications && profile.cvCertifications.length > 0 && (
        <ExpandableSection
          title={`Certifications (${profile.cvCertifications.length})`}
          section="certifications"
          expanded={expanded.certifications}
          onToggle={toggleSection}
        >
          <div className="cv-certifications-list">
            {profile.cvCertifications.map((cert, idx) => (
              <div key={idx} className="cv-certification-item">
                <h4 className="cv-item-title">{cert.name}</h4>
                <p className="cv-item-meta">Émetteur : {cert.issuer}</p>
                {cert.issueDate && (
                  <p className="cv-item-date">
                    Obtenu : {new Date(cert.issueDate).toLocaleDateString('fr-FR')}
                  </p>
                )}
                {cert.credentialUrl && (
                  <a href={cert.credentialUrl} target="_blank" rel="noreferrer" className="cv-link">
                    Voir la certification →
                  </a>
                )}
              </div>
            ))}
          </div>
        </ExpandableSection>
      )}

      {/* Langues */}
      {profile.cvLanguages && profile.cvLanguages.length > 0 && (
        <ExpandableSection
          title={`Langues (${profile.cvLanguages.length})`}
          section="languages"
          expanded={expanded.languages}
          onToggle={toggleSection}
        >
          <div className="cv-languages-list">
            {profile.cvLanguages.map((lang, idx) => (
              <div key={idx} className="cv-language-item">
                <span className="cv-language-name">{lang.name}</span>
                {lang.level && <span className="cv-language-level">{lang.level}</span>}
              </div>
            ))}
          </div>
        </ExpandableSection>
      )}

      {/* Technologies principales */}
      {profile.cvTechnologies && profile.cvTechnologies.length > 0 && (
        <div className="cv-section-item">
          <h3 className="cv-section-title">Technologies principales</h3>
          <div className="cv-tech-tags">
            {profile.cvTechnologies.map((tech) => (
              <span key={tech} className="cv-tag">
                {tech}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Années d'expérience et localisation */}
      {(profile.cvYearsOfExperience || profile.cvAvailability || profile.cvDesiredLocations?.length) && (
        <div className="cv-summary-info">
          {profile.cvYearsOfExperience !== null && profile.cvYearsOfExperience !== undefined && (
            <div className="cv-summary-item">
              <span className="cv-summary-label">Années d'expérience :</span>
              <strong>{profile.cvYearsOfExperience} ans</strong>
            </div>
          )}
          {profile.cvAvailability && (
            <div className="cv-summary-item">
              <span className="cv-summary-label">Disponibilité :</span>
              <strong>{profile.cvAvailability}</strong>
            </div>
          )}
          {profile.cvDesiredLocations && profile.cvDesiredLocations.length > 0 && (
            <div className="cv-summary-item">
              <span className="cv-summary-label">Localisations souhaitées :</span>
              <strong>{profile.cvDesiredLocations.join(', ')}</strong>
            </div>
          )}
        </div>
      )}
    </Card>
  )
}

interface ExpandableSectionProps {
  title: string
  section: string
  expanded: boolean
  onToggle: (section: string) => void
  children: React.ReactNode
}

function ExpandableSection({
  title,
  section,
  expanded,
  onToggle,
  children,
}: ExpandableSectionProps) {
  return (
    <div className="cv-expandable-section">
      <button
        className="cv-section-header"
        onClick={() => onToggle(section)}
        type="button"
      >
        <h3>{title}</h3>
        {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </button>
      {expanded && <div className="cv-section-content">{children}</div>}
    </div>
  )
}
