import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, ImagePlus, Lock } from 'lucide-react'
import { FadeUp } from '../../components/motion/Motion'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Field, Input, Select, Textarea } from '../../components/ui/Form'
import { DISTRICTS, PROVINCES, SECTORS, SECTOR_LABELS, TRADES, TRADE_SECTOR } from '../../data/constants'
import { RELATION_LABELS, TALENT_HIGHLIGHTS, TALENT_RELATIONS } from '../../data/endorsements'
import { apiRecommendTalent, talentEndorsementForm, type TalentEndorsementPayload } from '../../lib/api'
import type { Sector } from '../../types'
import './RecommendTalent.css'

const OTHER_TRADE = '__autre__'
const MAX_PHOTO_BYTES = 5 * 1024 * 1024

const RELATION_SENTENCES: Record<(typeof TALENT_RELATIONS)[number], string> = {
  client: 'J’ai fait appel à cette personne',
  employeur: 'Cette personne a travaillé pour moi',
  collegue: 'J’ai travaillé avec cette personne',
}

/** Aujourd'hui au format `YYYY-MM-DD`, en heure locale. */
function today(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

interface FormState {
  tradeChoice: string
  otherTrade: string
  sector: Sector
  province: string
  city: string
  district: string
  subjectName: string
  contactPhone: string
  contactHint: string
  relation: (typeof TALENT_RELATIONS)[number] | ''
  jobLabel: string
  jobDate: string
  highlights: string[]
  comment: string
  authorDistrict: string
}

const emptyForm: FormState = {
  tradeChoice: '',
  otherTrade: '',
  sector: 'autre',
  province: PROVINCES[0],
  city: PROVINCES[0],
  district: '',
  subjectName: '',
  contactPhone: '',
  contactHint: '',
  relation: '',
  jobLabel: '',
  jobDate: '',
  highlights: [],
  comment: '',
  authorDistrict: '',
}

/**
 * « Recommander un talent » : une personne qu'on a vue travailler, sans
 * diplôme et sans profil OffRec. Le formulaire ne crée aucun profil : un
 * agent reçoit la recommandation, rencontre la personne et décide.
 */
export function RecommendTalent() {
  const [form, setForm] = useState<FormState>(emptyForm)
  const [photo, setPhoto] = useState<File | null>(null)
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState('')

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }))

  const chooseTrade = (choice: string) => {
    setForm((f) => ({
      ...f,
      tradeChoice: choice,
      sector: choice && choice !== OTHER_TRADE ? TRADE_SECTOR[choice as (typeof TRADES)[number]] : f.sector,
    }))
  }

  const toggleHighlight = (h: string) => {
    setForm((f) => {
      if (f.highlights.includes(h)) return { ...f, highlights: f.highlights.filter((x) => x !== h) }
      if (f.highlights.length >= 5) return f
      return { ...f, highlights: [...f.highlights, h] }
    })
  }

  const onPhoto = (file: File | null) => {
    setError('')
    if (file && !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('La photo doit être au format JPEG, PNG ou WebP.')
      setPhoto(null)
      return
    }
    if (file && file.size > MAX_PHOTO_BYTES) {
      setError('La photo dépasse 5 Mo.')
      setPhoto(null)
      return
    }
    setPhoto(file)
  }

  const trade = form.tradeChoice === OTHER_TRADE ? form.otherTrade.trim() : form.tradeChoice

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (!trade) return setError('Indiquez le métier de la personne.')
    if (!form.relation) return setError('Dites-nous comment vous connaissez cette personne.')
    if (!form.subjectName.trim() && !form.contactPhone.trim() && !form.contactHint.trim()) {
      return setError('Donnez au moins un moyen de retrouver cette personne : nom, téléphone ou lieu.')
    }
    if (form.highlights.length === 0) return setError('Choisissez au moins un point fort.')

    const payload: TalentEndorsementPayload = {
      trade,
      sector: form.sector,
      province: form.province,
      city: form.city.trim(),
      district: form.district.trim(),
      subjectName: form.subjectName.trim() || undefined,
      contactPhone: form.contactPhone.trim() || undefined,
      contactHint: form.contactHint.trim() || undefined,
      relation: form.relation,
      jobLabel: form.jobLabel.trim(),
      jobDate: form.jobDate,
      highlights: form.highlights,
      comment: form.comment.trim() || undefined,
      authorDistrict: form.authorDistrict.trim() || undefined,
    }
    setSending(true)
    try {
      const res = await apiRecommendTalent(talentEndorsementForm(payload, photo))
      setDone(res.message)
      setForm(emptyForm)
      setPhoto(null)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Envoi impossible. Réessayez.')
    } finally {
      setSending(false)
    }
  }

  if (done) {
    return (
      <div className="page">
        <div className="container rt-page">
          <Card className="rt-done">
            <CheckCircle2 size={36} strokeWidth={1.75} className="rt-done-icon" aria-hidden />
            <h1>Recommandation envoyée</h1>
            <p>{done}</p>
            <div className="rt-done-actions">
              <Button onClick={() => setDone('')}>Recommander une autre personne</Button>
              <Link to="/annuaire/mes-recommandations" className="rt-link">
                Voir mes recommandations
              </Link>
            </div>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <div className="container rt-page">
        <Link to="/annuaire/talents" className="rt-back">
          <ArrowLeft size={16} aria-hidden /> Annuaire · Talents recommandés
        </Link>
        <FadeUp eager>
          <header className="page-header">
            <p className="eyebrow">Recommander un talent</p>
            <h1>Vous connaissez quelqu’un qui travaille bien ?</h1>
            <p>
              Un artisan, une couturière, un mécanicien… sans diplôme mais avec un vrai savoir-faire. Dites-le
              nous : un agent OffRec ira le rencontrer.
            </p>
          </header>
        </FadeUp>

        <form onSubmit={handleSubmit} className="rt-form" noValidate>
          <Card className="rt-section">
            <h2 className="rt-section-title">
              <span className="rt-step">1</span> Quel est son métier ?
            </h2>
            <Field label="Métier">
              <Select required value={form.tradeChoice} onChange={(e) => chooseTrade(e.target.value)}>
                <option value="">Choisir un métier…</option>
                {TRADES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
                <option value={OTHER_TRADE}>Autre métier…</option>
              </Select>
            </Field>
            {form.tradeChoice === OTHER_TRADE && (
              <div className="rt-row">
                <Field label="Lequel ?">
                  <Input
                    required
                    maxLength={80}
                    placeholder="Ex. Mécanicien"
                    value={form.otherTrade}
                    onChange={(e) => set('otherTrade', e.target.value)}
                  />
                </Field>
                <Field label="Domaine">
                  <Select value={form.sector} onChange={(e) => set('sector', e.target.value as Sector)}>
                    {SECTORS.map((s) => (
                      <option key={s} value={s}>
                        {SECTOR_LABELS[s]}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
            )}
            <div className="rt-row">
              <Field label="Province">
                <Select
                  value={form.province}
                  onChange={(e) => setForm((f) => ({ ...f, province: e.target.value, city: e.target.value }))}
                >
                  {PROVINCES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Ville">
                <Input required maxLength={80} value={form.city} onChange={(e) => set('city', e.target.value)} />
              </Field>
            </div>
            <Field label="Quartier où elle travaille">
              <Input
                required
                maxLength={80}
                list="rt-districts"
                placeholder="Ex. Ambohimangakely"
                value={form.district}
                onChange={(e) => set('district', e.target.value)}
              />
            </Field>
            <datalist id="rt-districts">
              {DISTRICTS.map((d) => (
                <option key={d} value={d} />
              ))}
            </datalist>
          </Card>

          <Card className="rt-section">
            <h2 className="rt-section-title">
              <span className="rt-step">2</span> Comment la retrouver ?
            </h2>
            <p className="rt-private">
              <Lock size={16} aria-hidden />
              <span>
                <strong>Le contact ne sera jamais publié.</strong> Seul un agent OffRec le verra, pour appeler la
                personne et lui demander son accord.
              </span>
            </p>
            <p className="rt-help">Remplissez au moins une des trois cases.</p>
            <Field label="Son nom ou surnom">
              <Input
                maxLength={80}
                placeholder="Ex. Rado"
                value={form.subjectName}
                onChange={(e) => set('subjectName', e.target.value)}
              />
            </Field>
            <Field label="Son téléphone" hint="Ex. 034 12 345 67">
              <Input
                type="tel"
                inputMode="tel"
                maxLength={30}
                value={form.contactPhone}
                onChange={(e) => set('contactPhone', e.target.value)}
              />
            </Field>
            <Field label="Où la trouver ?" hint="Ex. atelier près du marché, à côté de l’église…">
              <Input maxLength={300} value={form.contactHint} onChange={(e) => set('contactHint', e.target.value)} />
            </Field>
          </Card>

          <Card className="rt-section">
            <h2 className="rt-section-title">
              <span className="rt-step">3</span> Votre expérience
            </h2>
            <div className="rt-relations" role="radiogroup" aria-label="Votre lien avec cette personne">
              {TALENT_RELATIONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  role="radio"
                  aria-checked={form.relation === r}
                  className={`rt-relation ${form.relation === r ? 'active' : ''}`}
                  onClick={() => set('relation', r)}
                >
                  <strong>{RELATION_LABELS[r]}</strong>
                  <span>{RELATION_SENTENCES[r]}</span>
                </button>
              ))}
            </div>
            <Field label="Quel travail a-t-elle fait ?" hint="Ex. réparation de l’embrayage de ma moto">
              <Input
                required
                minLength={8}
                maxLength={200}
                value={form.jobLabel}
                onChange={(e) => set('jobLabel', e.target.value)}
              />
            </Field>
            <Field label="Quand ?" hint="La date approximative suffit.">
              <Input
                required
                type="date"
                max={today()}
                value={form.jobDate}
                onChange={(e) => set('jobDate', e.target.value)}
              />
            </Field>
            <Field label="Ses points forts" hint="Choisissez de 1 à 5 réponses.">
              <div className="skill-chips">
                {TALENT_HIGHLIGHTS.map((h) => (
                  <button
                    key={h}
                    type="button"
                    aria-pressed={form.highlights.includes(h)}
                    className={`chip ${form.highlights.includes(h) ? 'active' : ''}`}
                    onClick={() => toggleHighlight(h)}
                  >
                    {h}
                  </button>
                ))}
              </div>
            </Field>
          </Card>

          <Card className="rt-section">
            <h2 className="rt-section-title">
              <span className="rt-step">4</span> Pour aller plus loin <span className="rt-optional">(facultatif)</span>
            </h2>
            <div className="field">
              <span className="field-label">Une photo du travail</span>
              <label className="rt-photo">
                <ImagePlus size={20} aria-hidden />
                <span>{photo ? photo.name : 'Ajouter une photo (JPEG, PNG ou WebP, 5 Mo au plus)'}</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => onPhoto(e.target.files?.[0] ?? null)}
                />
              </label>
              {photo && (
                <button type="button" className="rt-link rt-photo-remove" onClick={() => setPhoto(null)}>
                  Retirer la photo
                </button>
              )}
              <span className="field-hint">Vue seulement par l’agent. Elle aide à vérifier le travail.</span>
            </div>
            <Field label="Un mot pour l’agent" hint="Vu seulement par l’agent OffRec.">
              <Textarea maxLength={1000} value={form.comment} onChange={(e) => set('comment', e.target.value)} />
            </Field>
            <Field label="Votre quartier" hint="Par défaut : celui de votre dernière contribution.">
              <Input
                maxLength={80}
                list="rt-districts"
                value={form.authorDistrict}
                onChange={(e) => set('authorDistrict', e.target.value)}
              />
            </Field>
          </Card>

          {error && (
            <p className="rt-error" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" size="lg" fullWidth disabled={sending}>
            {sending ? 'Envoi…' : 'Envoyer ma recommandation'}
          </Button>
          <p className="rt-footnote">
            Seules les recommandations positives sont acceptées. Pour un problème grave, utilisez « Signaler ».
          </p>
        </form>
      </div>
    </div>
  )
}
