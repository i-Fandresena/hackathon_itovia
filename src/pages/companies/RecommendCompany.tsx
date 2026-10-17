import { useEffect, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Building2, CheckCircle2, EyeOff, FilePlus2, Plus } from 'lucide-react'
import { FadeUp } from '../../components/motion/Motion'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Field, Input, Select, Textarea } from '../../components/ui/Form'
import { DISTRICTS, PROVINCES, SECTORS, SECTOR_LABELS } from '../../data/constants'
import { COMPANY_HIGHLIGHTS, COMPANY_RELATIONS, RELATION_LABELS } from '../../data/endorsements'
import { apiPublicCompanies, apiPublicCompany, apiRecommendCompany, type CompanyEndorsementPayload } from '../../lib/api'
import type { CompanyRelation, PublicCompany, Sector } from '../../types'
import '../endorsements/RecommendTalent.css'
import './Companies.css'

const MAX_PROOF_BYTES = 5 * 1024 * 1024
const PROOF_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']

const RELATION_SENTENCES: Record<CompanyRelation, string> = {
  salarie: 'J’y ai travaillé comme salarié·e',
  stagiaire: 'J’y ai fait un stage',
  prestataire: 'J’ai travaillé pour elle en prestation',
}

function today(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

interface NewCompany {
  name: string
  sector: Sector
  province: string
  city: string
}

const emptyNew: NewCompany = { name: '', sector: 'autre', province: PROVINCES[0], city: PROVINCES[0] }

/**
 * « Recommander une entreprise » : un ancien salarié, stagiaire ou
 * prestataire dit ce que l'employeur fait bien. Positif seulement ; l'auteur
 * n'est jamais affiché ; le document éventuel est vérifié par OffRec puis
 * supprimé.
 */
export function RecommendCompany() {
  const [params] = useSearchParams()
  const presetId = params.get('entreprise')
  const [selected, setSelected] = useState<PublicCompany | null>(null)
  const [creating, setCreating] = useState(false)
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<PublicCompany[] | null>(null)
  const [newCompany, setNewCompany] = useState<NewCompany>(emptyNew)
  const [relation, setRelation] = useState<CompanyRelation | ''>('')
  const [jobLabel, setJobLabel] = useState('')
  const [jobDate, setJobDate] = useState('')
  const [highlights, setHighlights] = useState<string[]>([])
  const [comment, setComment] = useState('')
  const [authorDistrict, setAuthorDistrict] = useState('')
  const [proof, setProof] = useState<File | null>(null)
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState('')

  // Arrivée depuis une fiche : entreprise déjà choisie.
  useEffect(() => {
    if (!presetId) return
    apiPublicCompany(presetId)
      .then(setSelected)
      .catch(() => setSelected(null))
  }, [presetId])

  // Recherche des fiches existantes pour éviter les doublons.
  useEffect(() => {
    const q = search.trim()
    if (q.length < 2) {
      setResults(null)
      return
    }
    const t = window.setTimeout(() => {
      apiPublicCompanies({ q, limit: 8 })
        .then((r) => setResults(r.companies))
        .catch(() => setResults([]))
    }, 300)
    return () => window.clearTimeout(t)
  }, [search])

  const startCreating = () => {
    setCreating(true)
    setSelected(null)
    setNewCompany((c) => ({ ...c, name: c.name || search.trim() }))
  }

  const toggleHighlight = (h: string) => {
    setHighlights((list) => (list.includes(h) ? list.filter((x) => x !== h) : list.length >= 5 ? list : [...list, h]))
  }

  const onProof = (file: File | null) => {
    setError('')
    if (file && !PROOF_TYPES.includes(file.type)) {
      setError('Le document doit être une photo (JPEG, PNG, WebP) ou un PDF.')
      setProof(null)
      return
    }
    if (file && file.size > MAX_PROOF_BYTES) {
      setError('Le document dépasse 5 Mo.')
      setProof(null)
      return
    }
    setProof(file)
  }

  const reset = () => {
    setSelected(null)
    setCreating(false)
    setSearch('')
    setResults(null)
    setNewCompany(emptyNew)
    setRelation('')
    setJobLabel('')
    setJobDate('')
    setHighlights([])
    setComment('')
    setAuthorDistrict('')
    setProof(null)
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (!selected && !creating) return setError('Choisissez l’entreprise dans la liste, ou ajoutez-la.')
    if (creating && newCompany.name.trim().length < 2) return setError('Indiquez le nom de l’entreprise.')
    if (creating && newCompany.city.trim().length < 2) return setError('Indiquez la ville de l’entreprise.')
    if (!relation) return setError('Dites-nous comment vous avez travaillé avec cette entreprise.')
    if (jobLabel.trim().length < 3) return setError('Indiquez votre poste ou votre mission.')
    if (!jobDate) return setError('Indiquez jusqu’à quand vous y avez travaillé.')
    if (highlights.length === 0) return setError('Choisissez au moins un point fort.')

    const payload: CompanyEndorsementPayload = {
      ...(selected
        ? { companyId: selected.id }
        : {
            company: {
              name: newCompany.name.trim(),
              sector: newCompany.sector,
              province: newCompany.province,
              city: newCompany.city.trim(),
            },
          }),
      relation,
      jobLabel: jobLabel.trim(),
      jobDate,
      highlights,
      comment: comment.trim() || undefined,
      authorDistrict: authorDistrict.trim() || undefined,
    }
    setSending(true)
    try {
      const res = await apiRecommendCompany(payload, proof)
      setDone(res.message)
      reset()
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
              <Button onClick={() => setDone('')}>Recommander une autre entreprise</Button>
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
        <Link to="/annuaire/entreprises" className="rt-back">
          <ArrowLeft size={16} aria-hidden /> Annuaire · Entreprises recommandées
        </Link>
        <FadeUp eager>
          <header className="page-header">
            <p className="eyebrow">Recommander une entreprise</p>
            <h1>Vous avez travaillé dans une entreprise qui traite bien ses équipes ?</h1>
            <p>
              Salaire payé à l’heure, contrat respecté, formation… Dites-le : les candidats et les talents pourront
              choisir leur employeur en connaissance de cause.
            </p>
          </header>
        </FadeUp>

        <p className="rt-private">
          <EyeOff size={16} aria-hidden />
          <span>
            <strong>Votre nom n’est jamais montré</strong>, ni au public ni à l’entreprise. Aucun commentaire n’est
            publié : seuls le niveau, le nombre de recommandations et les points forts apparaissent.
          </span>
        </p>

        <form onSubmit={handleSubmit} className="rt-form" noValidate>
          <Card className="rt-section">
            <h2 className="rt-section-title">
              <span className="rt-step">1</span> Quelle entreprise ?
            </h2>
            {selected ? (
              <div className="cmp-selected">
                <span className="cmp-selected-name">
                  <Building2 size={18} aria-hidden />
                  {selected.name} · {selected.city}
                </span>
                <button type="button" className="rt-link" onClick={() => setSelected(null)}>
                  Changer
                </button>
              </div>
            ) : creating ? (
              <>
                <Field label="Nom de l’entreprise">
                  <Input
                    required
                    maxLength={120}
                    value={newCompany.name}
                    onChange={(e) => setNewCompany((c) => ({ ...c, name: e.target.value }))}
                  />
                </Field>
                <Field label="Secteur">
                  <Select
                    value={newCompany.sector}
                    onChange={(e) => setNewCompany((c) => ({ ...c, sector: e.target.value as Sector }))}
                  >
                    {SECTORS.map((s) => (
                      <option key={s} value={s}>
                        {SECTOR_LABELS[s]}
                      </option>
                    ))}
                  </Select>
                </Field>
                <div className="rt-row">
                  <Field label="Province">
                    <Select
                      value={newCompany.province}
                      onChange={(e) => setNewCompany((c) => ({ ...c, province: e.target.value, city: e.target.value }))}
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
                      maxLength={80}
                      value={newCompany.city}
                      onChange={(e) => setNewCompany((c) => ({ ...c, city: e.target.value }))}
                    />
                  </Field>
                </div>
                <button type="button" className="rt-link" onClick={() => setCreating(false)}>
                  Revenir à la recherche
                </button>
              </>
            ) : (
              <>
                <Field label="Rechercher l’entreprise" hint="Tapez au moins 2 lettres de son nom.">
                  <Input
                    type="search"
                    maxLength={80}
                    placeholder="Ex. Bâtisseurs du Lac"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </Field>
                {results && results.length > 0 && (
                  <ul className="cmp-search-results" aria-label="Entreprises déjà sur OffRec">
                    {results.map((c) => (
                      <li key={c.id}>
                        <button type="button" className="cmp-result" onClick={() => setSelected(c)}>
                          <Building2 size={18} aria-hidden />
                          <span className="cmp-result-text">
                            <strong>{c.name}</strong>
                            <span>
                              {c.city} · {SECTOR_LABELS[c.sector]}
                            </span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {results && results.length === 0 && (
                  <p className="rt-help">Aucune entreprise de ce nom sur OffRec pour l’instant.</p>
                )}
                <Button type="button" variant="outline" size="sm" onClick={startCreating}>
                  <Plus size={16} aria-hidden /> Elle n’est pas dans la liste : l’ajouter
                </Button>
              </>
            )}
          </Card>

          <Card className="rt-section">
            <h2 className="rt-section-title">
              <span className="rt-step">2</span> Votre expérience
            </h2>
            <div className="rt-relations" role="radiogroup" aria-label="Votre lien avec cette entreprise">
              {COMPANY_RELATIONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  role="radio"
                  aria-checked={relation === r}
                  className={`rt-relation ${relation === r ? 'active' : ''}`}
                  onClick={() => setRelation(r)}
                >
                  <strong>{RELATION_LABELS[r]}</strong>
                  <span>{RELATION_SENTENCES[r]}</span>
                </button>
              ))}
            </div>
            <Field label="Votre poste ou votre mission" hint="Ex. aide-maçon, stage en comptabilité. Jamais publié.">
              <Input required minLength={3} maxLength={120} value={jobLabel} onChange={(e) => setJobLabel(e.target.value)} />
            </Field>
            <Field label="Jusqu’à quand y avez-vous travaillé ?" hint="La date approximative suffit. Jamais publiée.">
              <Input required type="date" max={today()} value={jobDate} onChange={(e) => setJobDate(e.target.value)} />
            </Field>
            <Field label="Ce qu’elle fait bien" hint="Choisissez de 1 à 5 réponses.">
              <div className="skill-chips">
                {COMPANY_HIGHLIGHTS.map((h) => (
                  <button
                    key={h}
                    type="button"
                    aria-pressed={highlights.includes(h)}
                    className={`chip ${highlights.includes(h) ? 'active' : ''}`}
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
              <span className="rt-step">3</span> Pour aller plus loin <span className="rt-optional">(facultatif)</span>
            </h2>
            <div className="field">
              <span className="field-label">Un document qui prouve que vous y avez travaillé</span>
              <label className="rt-photo">
                <FilePlus2 size={20} aria-hidden />
                <span>{proof ? proof.name : 'Contrat, bulletin de paie, attestation… (photo ou PDF, 5 Mo au plus)'}</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  onChange={(e) => onProof(e.target.files?.[0] ?? null)}
                />
              </label>
              {proof && (
                <button type="button" className="rt-link rt-photo-remove" onClick={() => setProof(null)}>
                  Retirer le document
                </button>
              )}
              <span className="field-hint">
                Vu seulement par un administrateur OffRec, jamais par l’entreprise. Il est supprimé dès qu’il a été
                vérifié.
              </span>
            </div>
            <Field label="Un mot pour OffRec" hint="Jamais publié, jamais transmis à l’entreprise.">
              <Textarea maxLength={1000} value={comment} onChange={(e) => setComment(e.target.value)} />
            </Field>
            <Field label="Votre quartier" hint="Par défaut : celui de votre dernière contribution.">
              <Input maxLength={80} list="cmp-districts" value={authorDistrict} onChange={(e) => setAuthorDistrict(e.target.value)} />
            </Field>
            <datalist id="cmp-districts">
              {DISTRICTS.map((d) => (
                <option key={d} value={d} />
              ))}
            </datalist>
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
            Seules les recommandations positives sont acceptées. Pour un problème grave (salaire impayé, harcèlement…),
            utilisez « Signaler » sur la fiche de l’entreprise : le signalement reste privé.
          </p>
        </form>
      </div>
    </div>
  )
}
