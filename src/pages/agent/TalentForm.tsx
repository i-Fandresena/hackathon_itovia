import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Field, Input, Select } from '../../components/ui/Form'
import { AVAILABILITY_LABELS, COMMON_SKILLS, GENDER_LABELS, PROVINCES, SECTOR_LABELS, TRADES, TRADE_SECTOR } from '../../data/constants'
import {
  apiAgentTalentSignal,
  apiCreateTalent,
  apiLeadDetail,
  apiSourcingLeadDetail,
  apiTalentDetail,
  apiUpdateTalent,
  ApiError,
  type TalentInput,
} from '../../lib/api'
import type { Availability, Gender } from '../../types'
import './TalentForm.css'

const defaultForm: TalentInput = {
  fullName: '',
  phone: '',
  province: PROVINCES[0],
  city: PROVINCES[0],
  gender: 'femme',
  trade: TRADES[0],
  sector: TRADE_SECTOR[TRADES[0]],
  skills: [],
  availability: 'immediate',
}

export function TalentForm() {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const fromLead = searchParams.get('fromLead')
  const fromSourcingLead = searchParams.get('fromSourcingLead')
  // Signal de talent recommandé : préremplissage, puis à la création le
  // serveur rattache le signal (et ses recommandations) au nouveau profil.
  const fromSignal = searchParams.get('fromSignal')
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const [form, setForm] = useState<TalentInput>(defaultForm)
  const [error, setError] = useState('')
  const [consent, setConsent] = useState(false)
  const [loading, setLoading] = useState(isEdit || Boolean(fromLead) || Boolean(fromSourcingLead) || Boolean(fromSignal))

  useEffect(() => {
    if (id) {
      apiTalentDetail(id).then((t) => {
        setForm({
          fullName: t.fullName,
          phone: t.phone,
          province: t.province,
          city: t.city,
          gender: t.gender,
          trade: t.trade || TRADES[0],
          sector: t.sector,
          skills: t.skills,
          availability: t.availability,
          district: t.district ?? '',
        })
        setLoading(false)
      })
      return
    }
    if (fromLead) {
      apiLeadDetail(fromLead).then((lead) => {
        setForm((f) => ({
          ...f,
          fullName: lead.fullName,
          phone: lead.phone,
          province: lead.province,
          city: lead.city,
          gender: lead.gender,
          trade: lead.trade,
          sector: lead.sector,
          fromLeadId: lead.id,
        }))
        setLoading(false)
      })
      return
    }
    if (fromSourcingLead) {
      // La piste de veille ne connaît pas encore l'identité de la personne
      // (c'est justement ce que le contact réel de l'agent doit établir) —
      // seuls le métier/secteur/lieu sont repris, nom/téléphone restent à
      // saisir après vérification.
      apiSourcingLeadDetail(fromSourcingLead).then((lead) => {
        setForm((f) => ({
          ...f,
          province: lead.province,
          city: lead.city,
          trade: lead.trade,
          sector: lead.sector,
          fromSourcingLeadId: lead.id,
        }))
        setLoading(false)
      })
      return
    }
    if (fromSignal) {
      // Métier, lieu et nom donné par le recommandeur ; le téléphone et le
      // reste sont confirmés par l'agent avec la personne elle-même.
      apiAgentTalentSignal(fromSignal)
        .then((signal) => {
          setForm((f) => ({
            ...f,
            fullName: signal.subjectName ?? '',
            province: signal.province,
            city: signal.city,
            district: signal.district,
            trade: signal.trade,
            sector: signal.sector,
            fromSignalId: signal.id,
          }))
        })
        .catch(() => setError('Signal introuvable : formulaire vide.'))
        .finally(() => setLoading(false))
    }
  }, [id, fromLead, fromSourcingLead, fromSignal])

  const setTrade = (trade: string) => {
    setForm((f) => ({ ...f, trade, sector: TRADE_SECTOR[trade as (typeof TRADES)[number]] ?? f.sector }))
  }

  const toggleSkill = (skill: string) => {
    setForm((f) => ({
      ...f,
      skills: f.skills.includes(skill) ? f.skills.filter((s) => s !== skill) : [...f.skills, skill],
    }))
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (!isEdit && !consent) {
      setError('Cochez la case d’accord : un profil ne se crée qu’avec l’accord de la personne.')
      return
    }
    try {
      const talent = isEdit && id ? await apiUpdateTalent(id, form) : await apiCreateTalent({ ...form, consent: true })
      navigate(`/agent/talents/${talent.id}`)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Enregistrement impossible.')
    }
  }

  if (loading) return null

  return (
    <div className="page">
      <div className="container" style={{ maxWidth: 640 }}>
        <header className="page-header">
          <h1>{isEdit ? 'Modifier le talent' : 'Nouveau talent'}</h1>
          <p>
            {fromSourcingLead
              ? 'Métier, secteur et lieu repris de la piste de veille — complétez avec les informations de la personne une fois le contact établi.'
              : fromSignal
                ? 'Métier, lieu et nom repris de la recommandation — vérifiez-les avec la personne et complétez le reste. À la création, ses recommandations sont rattachées au profil.'
                : 'Renseignez les informations déclarées par la personne rencontrée sur le terrain.'}
          </p>
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
            <Field label="Ville">
              <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            </Field>
            <Field label="Quartier" hint="Facultatif.">
              <Input value={form.district ?? ''} onChange={(e) => setForm({ ...form, district: e.target.value })} />
            </Field>
            <Field
              label="Métier"
              hint={`Détermine la grille de vérification standardisée à suivre. Secteur : ${SECTOR_LABELS[form.sector]}.`}
            >
              <Select value={form.trade} onChange={(e) => setTrade(e.target.value)}>
                {/* Métier hors liste (ex. repris d'une recommandation). */}
                {!(TRADES as readonly string[]).includes(form.trade) && form.trade && (
                  <option value={form.trade}>{form.trade}</option>
                )}
                {TRADES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
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
            {!isEdit && (
              <label className="talent-consent">
                <input type="checkbox" required checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                <span>
                  La personne a accepté d’avoir un profil OffRec et d’être proposée à des entreprises.
                  <small>Obligatoire. L’accord est daté et conservé dans le journal.</small>
                </span>
              </label>
            )}
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
