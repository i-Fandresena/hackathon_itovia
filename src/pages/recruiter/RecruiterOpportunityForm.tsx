import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Field, Input, Select, Textarea } from '../../components/ui/Form'
import {
  ACTIVE_SECTORS,
  CATEGORIES,
  COMMON_SKILLS,
  EXPERIENCE_LABELS,
  OPPORTUNITY_TYPE_LABELS,
  PROVINCES,
  SECTOR_LABELS,
  SECTORS,
} from '../../data/constants'
import { useApp } from '../../context/AppContext'
import type { ExperienceLevel, OpportunityType, Sector } from '../../types'

type SectorDetails = Record<string, string | boolean>

const defaultForm: {
  title: string
  category: string
  sector: Sector
  sectorDetails: SectorDetails
  description: string
  province: string
  city: string
  opportunityType: OpportunityType
  requiredSkills: string[]
  level: ExperienceLevel
  deadline: string
} = {
  title: '',
  category: CATEGORIES[0],
  sector: ACTIVE_SECTORS[0],
  sectorDetails: {},
  description: '',
  province: PROVINCES[0],
  city: PROVINCES[0],
  opportunityType: 'emploi',
  requiredSkills: [],
  level: 'junior',
  deadline: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().split('T')[0],
}

export function RecruiterOpportunityForm() {
  const { id } = useParams<{ id: string }>()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const { opportunities, addOpportunity, updateOpportunity } = useApp()
  const [form, setForm] = useState(defaultForm)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!id) return
    const existing = opportunities.find((o) => o.id === id)
    if (existing) {
      setForm({
        title: existing.title,
        category: existing.category,
        sector: existing.sector,
        sectorDetails: existing.sectorDetails ?? {},
        description: existing.description,
        province: existing.province,
        city: existing.city,
        opportunityType: existing.opportunityType,
        requiredSkills: existing.requiredSkills,
        level: existing.level,
        deadline: existing.deadline,
      })
    }
  }, [id, opportunities])

  const setDetail = (key: string, value: string | boolean) => {
    setForm((f) => ({ ...f, sectorDetails: { ...f.sectorDetails, [key]: value } }))
  }

  const toggleSkill = (skill: string) => {
    setForm((f) => ({
      ...f,
      requiredSkills: f.requiredSkills.includes(skill)
        ? f.requiredSkills.filter((s) => s !== skill)
        : [...f.requiredSkills, skill],
    }))
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    const result = isEdit && id ? await updateOpportunity(id, form) : await addOpportunity(form)
    if (!result.ok) {
      setError(result.error ?? 'Enregistrement impossible.')
      return
    }
    navigate('/recruteur/offres')
  }

  return (
    <div className="page">
      <div className="container" style={{ maxWidth: 640 }}>
        <header className="page-header">
          <h1>{isEdit ? 'Modifier l’offre' : 'Publier une offre'}</h1>
          <p>Décrivez clairement le poste pour attirer les bons profils.</p>
        </header>
        <Card>
          <form onSubmit={handleSubmit}>
            <Field label="Titre du poste">
              <Input
                required
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </Field>
            <Field label="Catégorie">
              <Select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Secteur" hint="Sert de filtre transversal pour les candidats — pas une section séparée.">
              <Select
                value={form.sector}
                onChange={(e) => setForm({ ...form, sector: e.target.value as Sector })}
              >
                {SECTORS.map((s) => (
                  <option key={s} value={s}>
                    {SECTOR_LABELS[s]}
                  </option>
                ))}
              </Select>
            </Field>
            {form.sector === 'btp' && (
              <>
                <Field label="Outils requis" hint="Optionnel — ex. bétonnière, niveau laser fourni par l'entreprise.">
                  <Input
                    value={(form.sectorDetails.outils as string) ?? ''}
                    onChange={(e) => setDetail('outils', e.target.value)}
                  />
                </Field>
                <Field label="Infos chantier" hint="Optionnel — localisation du chantier, durée, conditions.">
                  <Input
                    value={(form.sectorDetails.chantier as string) ?? ''}
                    onChange={(e) => setDetail('chantier', e.target.value)}
                  />
                </Field>
                <Field label="Transport / logement" hint="Optionnel — précisez si transport ou logement est fourni.">
                  <Input
                    value={(form.sectorDetails.transport as string) ?? ''}
                    onChange={(e) => setDetail('transport', e.target.value)}
                  />
                </Field>
              </>
            )}
            {form.sector === 'digital' && (
              <>
                <Field label="Stack technique" hint="Optionnel — ex. React, TypeScript, PostgreSQL.">
                  <Input
                    value={(form.sectorDetails.stackTechnique as string) ?? ''}
                    onChange={(e) => setDetail('stackTechnique', e.target.value)}
                  />
                </Field>
                <Field label="Télétravail">
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
                    <input
                      type="checkbox"
                      checked={Boolean(form.sectorDetails.teletravail)}
                      onChange={(e) => setDetail('teletravail', e.target.checked)}
                    />
                    Télétravail possible
                  </label>
                </Field>
              </>
            )}
            <Field label="Description" hint="Détaillez le poste, les responsabilités et les prérequis (au moins 10 caractères).">
              <Textarea
                required
                minLength={10}
                placeholder="Ex. Nous recrutons un développeur React/TypeScript motivé pour rejoindre notre équipe à Antananarivo..."
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </Field>
            <Field label="Province">
              <Select
                value={form.province}
                onChange={(e) => setForm({ ...form, province: e.target.value })}
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
                required
                placeholder="Ex. Antananarivo, Tamatave..."
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
              />
            </Field>
            <Field label="Type d’opportunité">
              <Select
                value={form.opportunityType}
                onChange={(e) =>
                  setForm({
                    ...form,
                    opportunityType: e.target.value as OpportunityType,
                  })
                }
              >
                {(Object.keys(OPPORTUNITY_TYPE_LABELS) as OpportunityType[]).map((t) => (
                  <option key={t} value={t}>
                    {OPPORTUNITY_TYPE_LABELS[t]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Niveau requis">
              <Select
                value={form.level}
                onChange={(e) =>
                  setForm({ ...form, level: e.target.value as ExperienceLevel })
                }
              >
                {(Object.keys(EXPERIENCE_LABELS) as ExperienceLevel[]).map((l) => (
                  <option key={l} value={l}>
                    {EXPERIENCE_LABELS[l]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Compétences requises">
              <div className="skill-chips">
                {COMMON_SKILLS.map((skill) => (
                  <button
                    key={skill}
                    type="button"
                    className={`chip ${form.requiredSkills.includes(skill) ? 'active' : ''}`}
                    onClick={() => toggleSkill(skill)}
                  >
                    {skill}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Date limite de candidature">
              <Input
                type="date"
                required
                value={form.deadline}
                onChange={(e) => setForm({ ...form, deadline: e.target.value })}
              />
            </Field>
            {error && (
              <div
                style={{
                  color: 'var(--color-danger, #dc2626)',
                  background: 'var(--color-danger-bg, #fef2f2)',
                  border: '1px solid #fecaca',
                  padding: '0.75rem 1rem',
                  borderRadius: 'var(--radius-md, 8px)',
                  marginBottom: '1rem',
                  fontSize: '0.875rem',
                  lineHeight: 1.4,
                }}
              >
                {error}
              </div>
            )}
            <Button type="submit" fullWidth>
              {isEdit ? 'Enregistrer' : 'Publier l’offre'}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  )
}
