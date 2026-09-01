import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { FileText, Upload } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Field, Input, Select } from '../../components/ui/Form'
import {
  AVAILABILITY_LABELS,
  COMMON_SKILLS,
  EDUCATION_LABELS,
  EXPERIENCE_LABELS,
  GENDER_LABELS,
  OPPORTUNITY_TYPE_LABELS,
  PROVINCES,
} from '../../data/constants'
import { useApp } from '../../context/AppContext'
import { apiUploadCv } from '../../lib/api'
import type {
  Availability,
  CandidateProfile,
  EducationLevel,
  ExperienceLevel,
  Gender,
  OpportunityType,
} from '../../types'

const emptyProfile: CandidateProfile = {
  fullName: '',
  email: '',
  phone: '',
  province: PROVINCES[0],
  city: PROVINCES[0],
  gender: 'autre',
  educationLevel: 'licence',
  skills: [],
  experienceLevel: 'debutant',
  desiredOpportunityTypes: ['emploi'],
  availability: 'flexible',
}

export function CandidateProfile() {
  const { currentUser, updateCandidateProfile } = useApp()
  const [profile, setProfile] = useState<CandidateProfile>(
    currentUser?.candidateProfile ?? {
      ...emptyProfile,
      email: currentUser?.email ?? '',
    },
  )
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [cvUploading, setCvUploading] = useState(false)
  const [cvSuggested, setCvSuggested] = useState<string[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (currentUser?.candidateProfile) {
      // L'email vit sur le compte (`User`), pas sur `CandidateProfile` en
      // base : on le reporte ici pour que le champ ne s'affiche pas vide.
      setProfile({ ...currentUser.candidateProfile, email: currentUser.candidateProfile.email || currentUser.email })
    }
  }, [currentUser?.candidateProfile, currentUser?.email])

  const toggleSkill = (skill: string) => {
    setProfile((p) => ({
      ...p,
      skills: p.skills.includes(skill)
        ? p.skills.filter((s) => s !== skill)
        : [...p.skills, skill],
    }))
  }

  const toggleType = (type: OpportunityType) => {
    setProfile((p) => ({
      ...p,
      desiredOpportunityTypes: p.desiredOpportunityTypes.includes(type)
        ? p.desiredOpportunityTypes.filter((t) => t !== type)
        : [...p.desiredOpportunityTypes, type],
    }))
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    const result = await updateCandidateProfile({ ...profile, city: profile.city || profile.province })
    if (!result.ok) {
      setError(result.error ?? 'Enregistrement impossible.')
      return
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const handleCvChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setCvUploading(true)
    setError('')
    try {
      const { cvUrl, suggestedSkills } = await apiUploadCv(file)
      setProfile((p) => ({ ...p, cvUrl }))
      setCvSuggested(suggestedSkills)
    } catch {
      setError('Le dépôt du CV a échoué. Vérifiez qu’il s’agit bien d’un fichier PDF.')
    } finally {
      setCvUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const addSuggestedSkill = (skill: string) => {
    setProfile((p) => (p.skills.includes(skill) ? p : { ...p, skills: [...p.skills, skill] }))
    setCvSuggested((s) => s.filter((sk) => sk !== skill))
  }

  return (
    <div className="page">
      <div className="container" style={{ maxWidth: 640 }}>
        <header className="page-header">
          <h1>Mon profil candidat</h1>
          <p>Ces informations alimentent le moteur de recommandation OffRec.</p>
        </header>

        <Card style={{ marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>Mon CV</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--color-ink-muted)', marginBottom: '0.75rem' }}>
            Déposez votre CV (PDF) : nous en extrayons quelques compétences à titre de suggestion,
            que vous choisissez ou non d’ajouter à votre profil.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={cvUploading}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={14} />
              {cvUploading ? 'Analyse en cours…' : 'Déposer un CV (PDF)'}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              hidden
              onChange={handleCvChange}
            />
            {profile.cvUrl && (
              <a
                href={`${(import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/api$/, '') ?? 'http://localhost:4000'}${profile.cvUrl}`}
                target="_blank"
                rel="noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.85rem' }}
              >
                <FileText size={14} />
                Voir le CV déposé
              </a>
            )}
          </div>
          {cvSuggested.length > 0 && (
            <div style={{ marginTop: '0.75rem' }}>
              <p style={{ fontSize: '0.8rem', color: 'var(--color-ink-muted)', marginBottom: '0.4rem' }}>
                Compétences détectées dans le CV — cliquez pour les ajouter :
              </p>
              <div className="skill-chips">
                {cvSuggested.map((skill) => (
                  <button key={skill} type="button" className="chip" onClick={() => addSuggestedSkill(skill)}>
                    + {skill}
                  </button>
                ))}
              </div>
            </div>
          )}
        </Card>

        <Card>
          <form onSubmit={handleSubmit}>
            <Field label="Nom complet">
              <Input
                required
                value={profile.fullName}
                onChange={(e) => setProfile({ ...profile, fullName: e.target.value })}
              />
            </Field>
            <Field label="Email">
              <Input
                type="email"
                required
                value={profile.email}
                onChange={(e) => setProfile({ ...profile, email: e.target.value })}
              />
            </Field>
            <Field label="Téléphone">
              <Input
                required
                value={profile.phone}
                onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
              />
            </Field>
            <Field label="Genre">
              <Select
                value={profile.gender}
                onChange={(e) => setProfile({ ...profile, gender: e.target.value as Gender })}
              >
                {(Object.keys(GENDER_LABELS) as Gender[]).map((k) => (
                  <option key={k} value={k}>
                    {GENDER_LABELS[k]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Province">
              <Select
                value={profile.province}
                onChange={(e) =>
                  setProfile({ ...profile, province: e.target.value, city: e.target.value })
                }
              >
                {PROVINCES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Ville">
              <Input
                value={profile.city}
                onChange={(e) => setProfile({ ...profile, city: e.target.value })}
              />
            </Field>
            <Field label="Niveau d’études">
              <Select
                value={profile.educationLevel}
                onChange={(e) =>
                  setProfile({
                    ...profile,
                    educationLevel: e.target.value as EducationLevel,
                  })
                }
              >
                {(Object.keys(EDUCATION_LABELS) as EducationLevel[]).map((k) => (
                  <option key={k} value={k}>
                    {EDUCATION_LABELS[k]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Niveau d’expérience">
              <Select
                value={profile.experienceLevel}
                onChange={(e) =>
                  setProfile({
                    ...profile,
                    experienceLevel: e.target.value as ExperienceLevel,
                  })
                }
              >
                {(Object.keys(EXPERIENCE_LABELS) as ExperienceLevel[]).map((k) => (
                  <option key={k} value={k}>
                    {EXPERIENCE_LABELS[k]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Compétences">
              <div className="skill-chips">
                {COMMON_SKILLS.map((skill) => (
                  <button
                    key={skill}
                    type="button"
                    className={`chip ${profile.skills.includes(skill) ? 'active' : ''}`}
                    onClick={() => toggleSkill(skill)}
                  >
                    {skill}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Types d’opportunités recherchées">
              <div className="skill-chips">
                {(Object.keys(OPPORTUNITY_TYPE_LABELS) as OpportunityType[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={`chip ${profile.desiredOpportunityTypes.includes(t) ? 'active' : ''}`}
                    onClick={() => toggleType(t)}
                  >
                    {OPPORTUNITY_TYPE_LABELS[t]}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Disponibilité">
              <Select
                value={profile.availability}
                onChange={(e) =>
                  setProfile({
                    ...profile,
                    availability: e.target.value as Availability,
                  })
                }
              >
                {(Object.keys(AVAILABILITY_LABELS) as Availability[]).map((k) => (
                  <option key={k} value={k}>
                    {AVAILABILITY_LABELS[k]}
                  </option>
                ))}
              </Select>
            </Field>
            {saved && <p className="save-ok">Profil enregistré avec succès.</p>}
            {error && <p style={{ color: 'var(--color-danger, #c0392b)' }}>{error}</p>}
            <Button type="submit" fullWidth>
              Enregistrer le profil
            </Button>
          </form>
        </Card>
      </div>
    </div>
  )
}
