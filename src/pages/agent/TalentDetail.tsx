import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, Send } from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Field, Select, Textarea } from '../../components/ui/Form'
import { Loading } from '../../components/ui/Loading'
import { apiListOpportunities, apiProposeTalent, apiTalentDetail, apiVerifyTalent, type TalentDetail as TalentDetailType } from '../../lib/api'
import { VERIFICATION_GRIDS } from '../../data/verificationGrids'
import { formatDate } from '../../lib/format'
import type { Opportunity, TalentStatus } from '../../types'

const STATUS_LABELS: Record<TalentStatus, string> = {
  en_attente: 'En attente de vérification',
  verifie: 'Vérifié',
  recommande: 'Recommandé',
  place: 'Placé',
}

export function TalentDetail() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const [talent, setTalent] = useState<TalentDetailType | null>(null)
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [checklist, setChecklist] = useState<Record<string, boolean>>({})
  const [note, setNote] = useState('')
  const [selectedOpportunity, setSelectedOpportunity] = useState('')
  const [feedback, setFeedback] = useState('')
  const [error, setError] = useState('')

  const load = () => {
    setError('')
    apiTalentDetail(id)
      .then((t) => {
        setTalent(t)
        const grid = VERIFICATION_GRIDS[t.trade] ?? VERIFICATION_GRIDS.default
        setChecklist(Object.fromEntries(grid.map((item) => [item, false])))
      })
      .catch(() => setError('Impossible de charger ce talent.'))
  }

  useEffect(load, [id])
  useEffect(() => {
    apiListOpportunities().then(setOpportunities)
  }, [])

  if (error) {
    return (
      <div className="page">
        <div className="container">
          <p style={{ marginBottom: '1rem' }}>{error}</p>
          <Button size="sm" onClick={load}>
            Réessayer
          </Button>
        </div>
      </div>
    )
  }

  if (!talent) {
    return (
      <div className="page">
        <div className="container">
          <Loading />
        </div>
      </div>
    )
  }

  const handleVerify = async (e: FormEvent) => {
    e.preventDefault()
    await apiVerifyTalent(id, { trade: talent.trade, checklist, note: note.trim() || undefined })
    setFeedback('Vérification enregistrée.')
    setNote('')
    load()
  }

  const handlePropose = async (e: FormEvent) => {
    e.preventDefault()
    if (!selectedOpportunity) return
    await apiProposeTalent(id, selectedOpportunity)
    setFeedback('Talent proposé pour cette offre.')
    setSelectedOpportunity('')
    load()
  }

  return (
    <div className="page">
      <div className="container" style={{ maxWidth: 720 }}>
        <Link to="/agent" className="dir-back" style={{ marginBottom: '1rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
          <ArrowLeft size={16} aria-hidden />
          Retour à mes talents
        </Link>

        <Card style={{ marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
            <div>
              <h1 style={{ fontSize: '1.3rem' }}>{talent.fullName}</h1>
              <p style={{ color: 'var(--color-ink-muted)' }}>
                {talent.phone} · {talent.city}, {talent.province}
              </p>
            </div>
            <Badge variant="primary">{STATUS_LABELS[talent.status]}</Badge>
          </div>
          <div className="skill-chips" style={{ marginTop: '0.75rem' }}>
            {talent.skills.map((s) => (
              <span key={s} className="chip">
                {s}
              </span>
            ))}
          </div>
          <Button variant="outline" size="sm" style={{ marginTop: '1rem' }} onClick={() => navigate(`/agent/talents/${id}/modifier`)}>
            Modifier les informations
          </Button>
        </Card>

        {feedback && <p className="save-ok" style={{ marginBottom: '1rem' }}>{feedback}</p>}

        <Card style={{ marginBottom: '1.25rem' }}>
          <h2 style={{ fontSize: '1.05rem', marginBottom: '0.5rem' }}>Vérifier les compétences</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--color-ink-muted)', marginBottom: '0.75rem' }}>
            Grille standardisée pour le métier <strong>{talent.trade}</strong> : cochez chaque
            point réellement observé sur le terrain (§7.3 règle 15 — un référentiel commun, pas
            un champ libre).
          </p>
          <form onSubmit={handleVerify}>
            <Field label="Grille de compétences">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {Object.keys(checklist).map((item) => (
                  <label key={item} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
                    <input
                      type="checkbox"
                      checked={checklist[item] ?? false}
                      onChange={(e) => setChecklist((c) => ({ ...c, [item]: e.target.checked }))}
                    />
                    {item}
                  </label>
                ))}
              </div>
            </Field>
            <Field label="Note qualitative (optionnel)">
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
            </Field>
            <Button type="submit">
              <CheckCircle2 size={16} />
              Enregistrer la vérification
            </Button>
          </form>
        </Card>

        <Card style={{ marginBottom: '1.25rem' }}>
          <h2 style={{ fontSize: '1.05rem', marginBottom: '0.5rem' }}>Proposer une opportunité</h2>
          <form onSubmit={handlePropose} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <Field label="Offre">
                <Select value={selectedOpportunity} onChange={(e) => setSelectedOpportunity(e.target.value)}>
                  <option value="">Choisir…</option>
                  {opportunities.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.title} — {o.companyName}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <Button type="submit" disabled={!selectedOpportunity}>
              <Send size={16} />
              Proposer
            </Button>
          </form>
        </Card>

        <Card>
          <h2 style={{ fontSize: '1.05rem', marginBottom: '0.75rem' }}>Historique de vérification</h2>
          {talent.verifications.length === 0 ? (
            <p style={{ color: 'var(--color-ink-muted)' }}>Aucune vérification enregistrée.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {talent.verifications.map((v) => (
                <div key={v.id} style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: '0.5rem' }}>
                  <strong>{v.trade}</strong>
                  <p style={{ fontSize: '0.85rem', color: 'var(--color-ink-muted)' }}>
                    {formatDate(v.verifiedAt)}
                    {v.note ? ` — ${v.note}` : ''}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
