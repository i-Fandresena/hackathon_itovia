import { useEffect, useState } from 'react'
import { Eye, Handshake } from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Select } from '../../components/ui/Form'
import { Loading } from '../../components/ui/Loading'
import { Modal } from '../../components/ui/Modal'
import {
  apiAdminCandidateDetail,
  apiAdminCandidatePool,
  apiAdminCreateSuggestion,
  apiAdminMatchSuggestions,
  apiAdminUpdateSuggestionStatus,
  apiListOpportunities,
  type AdminCandidateDetail,
  type AdminMatchSuggestion,
  type CandidatePoolEntry,
} from '../../lib/api'
import {
  AVAILABILITY_LABELS,
  EDUCATION_LABELS,
  EXPERIENCE_LABELS,
  GENDER_LABELS,
  OPPORTUNITY_TYPE_LABELS,
  SECTOR_LABELS,
} from '../../data/constants'
import type { MatchSuggestionStatus, Opportunity } from '../../types'
import { formatDate } from '../../lib/format'

const STATUS_LABELS: Record<MatchSuggestionStatus, string> = {
  proposee_candidat: 'Proposé au candidat',
  interet_candidat: 'Candidat intéressé',
  proposee_recruteur: 'Transmis au recruteur',
  interet_recruteur: 'Recruteur intéressé',
  mise_en_relation: 'Mis en relation',
  ecartee: 'Écarté',
}

/** Statuts qu'un admin peut ramener à "ecartee" — jamais depuis
 *  `mise_en_relation` (état terminal, cf. `ADMIN_ALLOWED_TRANSITIONS` côté
 *  serveur, qui reste la source de vérité et revalide de toute façon). */
const CANCELLABLE: MatchSuggestionStatus[] = [
  'proposee_candidat',
  'interet_candidat',
  'proposee_recruteur',
  'interet_recruteur',
]

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
  const [poolError, setPoolError] = useState('')
  const [queue, setQueue] = useState<AdminMatchSuggestion[] | null>(null)
  const [feedback, setFeedback] = useState('')

  const [viewingCandidateId, setViewingCandidateId] = useState<string | null>(null)
  const [candidateDetail, setCandidateDetail] = useState<AdminCandidateDetail | null>(null)
  const [candidateDetailError, setCandidateDetailError] = useState('')

  useEffect(() => {
    apiListOpportunities()
      .then((opps) => {
        setOpportunities(opps)
        if (opps.length > 0) setSelectedOpp(opps[0].id)
      })
      .catch(() => setFeedback('Impossible de charger les offres.'))
    loadQueue()
  }, [])

  const loadQueue = () => {
    apiAdminMatchSuggestions()
      .then(setQueue)
      .catch(() => setFeedback('Impossible de charger la file de suggestions.'))
  }

  const loadPool = () => {
    if (!selectedOpp) return
    setPool(null)
    setPoolError('')
    apiAdminCandidatePool(selectedOpp)
      .then(setPool)
      .catch(() => setPoolError('Impossible de charger le vivier de candidats.'))
  }

  useEffect(loadPool, [selectedOpp])

  const handlePropose = async (candidateId: string) => {
    await apiAdminCreateSuggestion(selectedOpp, candidateId)
    setFeedback('Suggestion envoyée au candidat.')
    loadPool()
    loadQueue()
  }

  const handleTransition = async (id: string, status: MatchSuggestionStatus) => {
    await apiAdminUpdateSuggestionStatus(id, status)
    loadQueue()
    loadPool()
  }

  const openCandidateDetail = (candidateId: string) => {
    setViewingCandidateId(candidateId)
    setCandidateDetail(null)
    setCandidateDetailError('')
    apiAdminCandidateDetail(candidateId)
      .then(setCandidateDetail)
      .catch(() => setCandidateDetailError('Impossible de charger ce profil.'))
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
          {poolError ? (
            <div>
              <p style={{ marginBottom: '0.75rem' }}>{poolError}</p>
              <Button size="sm" onClick={loadPool}>
                Réessayer
              </Button>
            </div>
          ) : !pool ? (
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
                  <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                    <Button variant="ghost" size="sm" onClick={() => openCandidateDetail(c.candidateId)}>
                      <Eye size={14} />
                      Voir le profil
                    </Button>
                    {!c.suggestionId ? (
                      <Button size="sm" onClick={() => handlePropose(c.candidateId)}>
                        Proposer
                      </Button>
                    ) : c.status && CANCELLABLE.includes(c.status) ? (
                      <Button size="sm" variant="outline" onClick={() => handleTransition(c.suggestionId!, 'ecartee')}>
                        Annuler
                      </Button>
                    ) : (
                      <Button size="sm" disabled>
                        Déjà proposé
                      </Button>
                    )}
                  </div>
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <strong>{s.candidate.candidateProfile?.fullName ?? s.candidate.email}</strong>
                      <Button variant="ghost" size="sm" onClick={() => openCandidateDetail(s.candidate.id)}>
                        <Eye size={14} />
                      </Button>
                    </div>
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <strong>{s.candidate.candidateProfile?.fullName ?? s.candidate.email}</strong>
                      <Button variant="ghost" size="sm" onClick={() => openCandidateDetail(s.candidate.id)}>
                        <Eye size={14} />
                      </Button>
                    </div>
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

        {viewingCandidateId && (
          <Modal title="Profil candidat" onClose={() => setViewingCandidateId(null)}>
            {candidateDetailError ? (
              <p>{candidateDetailError}</p>
            ) : !candidateDetail ? (
              <Loading />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', fontSize: '0.9rem' }}>
                <div>
                  <strong style={{ fontSize: '1.05rem' }}>{candidateDetail.fullName}</strong>
                  <p style={{ color: 'var(--color-ink-muted)', margin: '0.15rem 0 0' }}>
                    {candidateDetail.email} · {candidateDetail.phone}
                  </p>
                </div>
                <dl style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <Row label="Localisation" value={`${candidateDetail.city}, ${candidateDetail.province}`} />
                  <Row label="Genre" value={GENDER_LABELS[candidateDetail.gender]} />
                  <Row label="Niveau d’études" value={EDUCATION_LABELS[candidateDetail.educationLevel]} />
                  <Row label="Expérience" value={EXPERIENCE_LABELS[candidateDetail.experienceLevel]} />
                  <Row label="Disponibilité" value={AVAILABILITY_LABELS[candidateDetail.availability]} />
                  {candidateDetail.sector && <Row label="Secteur" value={SECTOR_LABELS[candidateDetail.sector]} />}
                  <Row
                    label="Types recherchés"
                    value={candidateDetail.desiredOpportunityTypes.map((t) => OPPORTUNITY_TYPE_LABELS[t]).join(', ') || '—'}
                  />
                  <Row label="Membre depuis" value={formatDate(candidateDetail.memberSince)} />
                </dl>
                {candidateDetail.skills.length > 0 && (
                  <div>
                    <p style={{ fontWeight: 600, marginBottom: '0.35rem' }}>Compétences</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                      {candidateDetail.skills.map((s) => (
                        <Badge key={s} variant="primary">
                          {s}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                {candidateDetail.cvUrl && (
                  <a
                    href={`${(import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/api$/, '') ?? 'http://localhost:4000'}${candidateDetail.cvUrl}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Voir le CV
                  </a>
                )}
              </div>
            )}
          </Modal>
        )}
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', gap: '0.5rem' }}>
      <dt style={{ color: 'var(--color-ink-muted)', minWidth: 140 }}>{label}</dt>
      <dd style={{ margin: 0 }}>{value}</dd>
    </div>
  )
}
