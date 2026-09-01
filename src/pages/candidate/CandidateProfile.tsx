import { useEffect, useState, type FormEvent } from 'react'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Field, Input, Select } from '../../components/ui/Form'
import {
  AVAILABILITY_LABELS,
  COMMON_SKILLS,
  EDUCATION_LABELS,
  EXPERIENCE_LABELS,
  OPPORTUNITY_TYPE_LABELS,
  PROVINCES,
} from '../../data/constants'
import { useApp } from '../../context/AppContext'
import type {
  Availability,
  CandidateProfile,
  EducationLevel,
  ExperienceLevel,
  OpportunityType,
} from '../../types'

const emptyProfile: CandidateProfile = {
  fullName: '',
  email: '',
  phone: '',
  province: PROVINCES[0],
  city: PROVINCES[0],
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

  useEffect(() => {
    if (currentUser?.candidateProfile) {
      setProfile(currentUser.candidateProfile)
    }
  }, [currentUser?.candidateProfile])

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

  return (
    <div className="page">
      <div className="container" style={{ maxWidth: 640 }}>
        <header className="page-header">
          <h1>Mon profil candidat</h1>
          <p>Ces informations alimentent le moteur de recommandation OffRec.</p>
        </header>
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
