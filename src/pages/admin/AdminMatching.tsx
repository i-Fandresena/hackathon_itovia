import { useEffect, useState } from 'react'
import { Handshake } from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Select } from '../../components/ui/Form'
import { Loading } from '../../components/ui/Loading'
import {
  apiAdminCandidatePool,
  apiAdminCreateSuggestion,
  apiAdminMatchSuggestions,
  apiAdminUpdateSuggestionStatus,
  apiListOpportunities,
  type AdminMatchSuggestion,
  type CandidatePoolEntry,
} from '../../lib/api'
import type { MatchSuggestionStatus, Opportunity } from '../../types'

const STATUS_LABELS: Record<MatchSuggestionStatus, string> = {
  proposee_candidat: 'Proposé au candidat',
  interet_candidat: 'Candidat intéressé',
  proposee_recruteur: 'Transmis au recruteur',
  interet_recruteur: 'Recruteur intéressé',
  mise_en_relation: 'Mis en relation',
  ecartee: 'Écarté',
}

/**
 * Surface admin minimale (Phase 1) : juste assez pour piloter le pipeline
 * de bout en bout — pas d'habillage visuel dédié, ça arrive en Phase 2.
 * OffRec est l'unique intermédiaire (décision produit 2026-09-02) : le
 * candidat et le recruteur ne font qu'exprimer un intérêt, c'est ici que
 * l'admin fait avancer chaque suggestion.
 */
export function AdminMatching() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [selectedOpp, setSelectedOpp] = useState('')
  const [pool, setPool] = useState<CandidatePoolEntry[] | null>(null)
  const [queue, setQueue] = useState<AdminMatchSuggestion[] | null>(null)
  const [feedback, setFeedback] = useState('')

  useEffect(() => {
    apiListOpportunities().then((opps) => {
      setOpportunities(opps)
      if (opps.length > 0) setSelectedOpp(opps[0].id)
    })
    loadQueue()
  }, [])

  const loadQueue = () => {
    apiAdminMatchSuggestions().then(setQueue)
  }

  useEffect(() => {
    if (!selectedOpp) return
    setPool(null)
    apiAdminCandidatePool(selectedOpp).then(setPool)
  }, [selectedOpp])

  const handlePropose = async (candidateId: string) => {
    await apiAdminCreateSuggestion(selectedOpp, candidateId)
    setFeedback('Suggestion envoyée au candidat.')
    apiAdminCandidatePool(selectedOpp).then(setPool)
    loadQueue()
  }

  const handleTransition = async (id: string, status: MatchSuggestionStatus) => {
    await apiAdminUpdateSuggestionStatus(id, status)
    loadQueue()
  }

  const pending = (queue ?? []).filter((s) => s.status === 'interet_candidat' || s.status === 'interet_recruteur')
  const inProgress = (queue ?? []).filter((s) => s.status === 'proposee_candidat' || s.status === 'proposee_recruteur')

  return (
    <div className="page">
      <div className="container">
        <header className="page-header">
          <p className="eyebrow">Back-office OffRec</p>
          <h1>Mise en relation</h1>
          <p>
            OffRec est l’unique intermédiaire : proposez des candidats aux offres,
            transmettez les profils intéressés aux recruteurs, débloquez le contact
            quand les deux parties sont partantes.
          </p>
        </header>

        {feedback && <p className="save-ok" style={{ marginBottom: '1rem' }}>{feedback}</p>}

        <Card style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.05rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Handshake size={18} />
            Proposer un candidat à une offre
          </h2>
          <div style={{ maxWidth: 420, marginBottom: '1rem' }}>
            <Select value={selectedOpp} onChange={(e) => setSelectedOpp(e.target.value)}>
              {opportunities.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.title} — {o.companyName}
                </option>
              ))}
            </Select>
          </div>
          {!pool ? (
            <Loading />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {pool.slice(0, 15).map((c) => (
                <div
                  key={c.candidateId}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0', borderBottom: '1px solid var(--color-border)' }}
                >
                  <div>
                    <strong>{c.fullName}</strong>
                    <p style={{ fontSize: '0.8rem', color: 'var(--color-ink-muted)' }}>
                      {c.match.score}% · {c.match.reasons.slice(0, 2).join(' · ')}
                    </p>
                  </div>
                  <Button size="sm" disabled={c.alreadySuggested} onClick={() => handlePropose(c.candidateId)}>
                    {c.alreadySuggested ? 'Déjà proposé' : 'Proposer'}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Card>

        <h2 style={{ fontSize: '1.05rem', marginBottom: '0.75rem' }}>En attente de décision ({pending.length})</h2>
        {pending.length === 0 ? (
          <p style={{ color: 'var(--color-ink-muted)', marginBottom: '1.5rem' }}>Rien à traiter pour l’instant.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '1.5rem' }}>
            {pending.map((s) => (
              <Card key={s.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  <div>
                    <strong>{s.candidate.candidateProfile?.fullName ?? s.candidate.email}</strong>
                    <p style={{ fontSize: '0.85rem', color: 'var(--color-ink-muted)' }}>
                      {s.opportunity.title} — {s.opportunity.companyName}
                    </p>
                  </div>
                  <Badge variant="primary">{STATUS_LABELS[s.status]}</Badge>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.65rem' }}>
                  {s.status === 'interet_candidat' && (
                    <Button size="sm" onClick={() => handleTransition(s.id, 'proposee_recruteur')}>
                      Transmettre au recruteur
                    </Button>
                  )}
                  {s.status === 'interet_recruteur' && (
                    <Button size="sm" onClick={() => handleTransition(s.id, 'mise_en_relation')}>
                      Débloquer le contact
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => handleTransition(s.id, 'ecartee')}>
                    Écarter
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}

        <h2 style={{ fontSize: '1.05rem', marginBottom: '0.75rem' }}>En cours ({inProgress.length})</h2>
        {inProgress.length === 0 ? (
          <p style={{ color: 'var(--color-ink-muted)' }}>Rien en cours pour l’instant.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {inProgress.map((s) => (
              <Card key={s.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  <div>
                    <strong>{s.candidate.candidateProfile?.fullName ?? s.candidate.email}</strong>
                    <p style={{ fontSize: '0.85rem', color: 'var(--color-ink-muted)' }}>
                      {s.opportunity.title} — {s.opportunity.companyName}
                    </p>
                  </div>
                  <Badge variant="muted">{STATUS_LABELS[s.status]}</Badge>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.65rem' }}>
                  <Button size="sm" variant="ghost" onClick={() => handleTransition(s.id, 'ecartee')}>
                    Annuler la proposition
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
