import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { MissionsEditor } from '../../components/opportunity/MissionsEditor'
import { RequiredSkillsPicker } from '../../components/opportunity/RequiredSkillsPicker'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Field, Input, Select, Textarea } from '../../components/ui/Form'
import {
  ACTIVE_SECTORS,
  CATEGORIES,
  EXPERIENCE_LABELS,
  OPPORTUNITY_TYPE_LABELS,
  PROVINCES,
  SECTOR_LABELS,
  SECTORS,
} from '../../data/constants'
import { useApp } from '../../context/AppContext'
import { apiMyOpportunities } from '../../lib/api'
import { OPPORTUNITY_POSITIONS_MAX, OPPORTUNITY_POSITIONS_MIN, positionsUpdateError } from '../../lib/hiring'
import { checkMissions, normalizeRequiredSkills } from '../../lib/opportunityFields'
import type { ExperienceLevel, Opportunity, OpportunityType, Sector } from '../../types'

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
  /** Lignes saisies (vides comprises) : nettoyées à l'envoi. */
  missions: string[]
  level: ExperienceLevel
  deadline: string
  /** Nombre de postes (D1) — saisi en texte, contrôlé à l'envoi. */
  positions: string
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
  missions: [''],
  level: 'junior',
  deadline: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().split('T')[0],
  positions: '1',
}

export function RecruiterOpportunityForm() {
  const { id } = useParams<{ id: string }>()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const { opportunities, addOpportunity, updateOpportunity } = useApp()
  const [form, setForm] = useState(defaultForm)
  const [error, setError] = useState('')
  const [showMissionErrors, setShowMissionErrors] = useState(false)
  /** Modification : postes déjà pourvus et offre pourvue, lus dans « Mes offres »
   *  (`GET /opportunities/mine`, qui fait foi ; le catalogue sert de repli). */
  const [mine, setMine] = useState<(Opportunity & { activePlacements: number }) | null>(null)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    apiMyOpportunities()
      .then((list) => {
        if (!cancelled) setMine(list.find((o) => o.id === id) ?? null)
      })
      .catch(() => {
        // Repli sur le catalogue : le serveur contrôle de toute façon le nombre de postes.
      })
    return () => {
      cancelled = true
    }
  }, [id])

  useEffect(() => {
    if (!id) return
    const existing = mine ?? opportunities.find((o) => o.id === id)
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
        missions: existing.missions?.length ? [...existing.missions] : [''],
        level: existing.level,
        deadline: existing.deadline.slice(0, 10),
        positions: String(existing.positions ?? 1),
      })
    }
  }, [id, opportunities, mine])

  const activePlacements = mine?.activePlacements ?? 0
  const positionsNumber = Number(form.positions)
  const positionsError = form.positions === '' ? 'Indiquez le nombre de postes.' : positionsUpdateError(positionsNumber, activePlacements)
  // Le nombre de postes atteint les embauches : l'offre passera pourvue (D1).
  const willFill = isEdit && !mine?.filledAt && activePlacements > 0 && positionsError === null && positionsNumber === activePlacements

  const setDetail = (key: string, value: string | boolean) => {
    setForm((f) => ({ ...f, sectorDetails: { ...f.sectorDetails, [key]: value } }))
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    // Mêmes règles que le serveur (src/lib/opportunityFields.ts), qui fait foi.
    const { missions, errors } = checkMissions(form.missions)
    if (errors.length > 0) {
      setShowMissionErrors(true)
      setError(errors.map((err) => err.message).join(' '))
      return
    }
    setShowMissionErrors(false)
    if (positionsError) {
      setError(positionsError)
      return
    }
    const payload = {
      ...form,
      missions,
      requiredSkills: normalizeRequiredSkills(form.requiredSkills),
      positions: positionsNumber,
    }
    const result = isEdit && id ? await updateOpportunity(id, payload) : await addOpportunity(payload)
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
            <MissionsEditor
              rows={form.missions}
              onChange={(missions) => setForm((f) => ({ ...f, missions }))}
              showErrors={showMissionErrors}
            />
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
            <RequiredSkillsPicker
              value={form.requiredSkills}
              onChange={(requiredSkills) => setForm((f) => ({ ...f, requiredSkills }))}
            />
            <Field
              label="Nombre de postes"
              hint={
                isEdit && activePlacements > 0
                  ? `${activePlacements} poste${activePlacements > 1 ? 's' : ''} déjà pourvu${activePlacements > 1 ? 's' : ''} : au moins ${activePlacements}, au plus ${OPPORTUNITY_POSITIONS_MAX}. L’offre passe « pourvue » quand tous les postes le sont.`
                  : `De ${OPPORTUNITY_POSITIONS_MIN} à ${OPPORTUNITY_POSITIONS_MAX}. L’offre passe « pourvue » quand tous les postes le sont.`
              }
              error={form.positions !== '' && positionsError ? positionsError : undefined}
            >
              <Input
                type="number"
                inputMode="numeric"
                min={Math.max(OPPORTUNITY_POSITIONS_MIN, activePlacements)}
                max={OPPORTUNITY_POSITIONS_MAX}
                step={1}
                required
                value={form.positions}
                aria-invalid={form.positions !== '' && positionsError ? true : undefined}
                onChange={(e) => setForm({ ...form, positions: e.target.value.replace(/\D/g, '').slice(0, 2) })}
              />
            </Field>
            {willFill && (
              <p className="field-hint" role="note" style={{ marginTop: '-0.5rem', marginBottom: '1rem', color: 'var(--color-warning)' }}>
                Avec ce nombre, tous les postes sont pourvus : l’offre passera « pourvue » à l’enregistrement et ses
                autres dossiers seront clos (chaque candidat concerné reçoit un message neutre d’OffRec).
              </p>
            )}
            <Field label="Date limite de l’offre">
              <Input
                type="date"
                required
                value={form.deadline}
                onChange={(e) => setForm({ ...form, deadline: e.target.value })}
              />
            </Field>
            {error && (
              <div
                role="alert"
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
