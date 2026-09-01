import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Field, Input, Select } from '../../components/ui/Form'
import { AVAILABILITY_LABELS, COMMON_SKILLS, GENDER_LABELS, PROVINCES } from '../../data/constants'
import { apiCreateTalent, apiTalentDetail, apiUpdateTalent, type TalentInput } from '../../lib/api'
import type { Availability, Gender } from '../../types'

const defaultForm: TalentInput = {
  fullName: '',
  phone: '',
  province: PROVINCES[0],
  city: PROVINCES[0],
  gender: 'femme',
  skills: [],
  availability: 'immediate',
}

export function TalentForm() {
  const { id } = useParams<{ id: string }>()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const [form, setForm] = useState<TalentInput>(defaultForm)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(isEdit)

  useEffect(() => {
    if (!id) return
    apiTalentDetail(id).then((t) => {
      setForm({
        fullName: t.fullName,
        phone: t.phone,
        province: t.province,
        city: t.city,
        gender: t.gender,
        skills: t.skills,
        availability: t.availability,
      })
      setLoading(false)
    })
  }, [id])

  const toggleSkill = (skill: string) => {
    setForm((f) => ({
      ...f,
      skills: f.skills.includes(skill) ? f.skills.filter((s) => s !== skill) : [...f.skills, skill],
    }))
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      const talent = isEdit && id ? await apiUpdateTalent(id, form) : await apiCreateTalent(form)
      navigate(`/agent/talents/${talent.id}`)
    } catch {
      setError('Enregistrement impossible.')
    }
  }

  if (loading) return null

  return (
    <div className="page">
      <div className="container" style={{ maxWidth: 640 }}>
        <header className="page-header">
          <h1>{isEdit ? 'Modifier le talent' : 'Nouveau talent'}</h1>
          <p>Renseignez les informations déclarées par la personne rencontrée sur le terrain.</p>
        </header>
        <Card>
          <form onSubmit={handleSubmit}>
            <Field label="Nom complet">
              <Input required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
            </Field>
            <Field label="Téléphone">
              <Input required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </Field>
            <Field label="Genre" hint="Obligatoire pour suivre le KPI d'inclusion féminine du pilote.">
              <Select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value as Gender })}>
                {(Object.keys(GENDER_LABELS) as Gender[]).map((k) => (
                  <option key={k} value={k}>
                    {GENDER_LABELS[k]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Province">
              <Select
                value={form.province}
                onChange={(e) => setForm({ ...form, province: e.target.value, city: e.target.value })}
              >
                {PROVINCES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Ville / quartier">
              <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            </Field>
            <Field label="Compétences déclarées">
              <div className="skill-chips">
                {COMMON_SKILLS.map((skill) => (
                  <button
                    key={skill}
                    type="button"
                    className={`chip ${form.skills.includes(skill) ? 'active' : ''}`}
                    onClick={() => toggleSkill(skill)}
                  >
                    {skill}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Disponibilité">
              <Select
                value={form.availability}
                onChange={(e) => setForm({ ...form, availability: e.target.value as Availability })}
              >
                {(Object.keys(AVAILABILITY_LABELS) as Availability[]).map((k) => (
                  <option key={k} value={k}>
                    {AVAILABILITY_LABELS[k]}
                  </option>
                ))}
              </Select>
            </Field>
            {error && <p style={{ color: 'var(--color-danger, #c0392b)' }}>{error}</p>}
            <Button type="submit" fullWidth>
              {isEdit ? 'Enregistrer' : 'Créer le profil'}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  )
}
