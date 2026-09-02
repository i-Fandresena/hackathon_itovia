import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, ShieldCheck, Sparkles, X } from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Input } from '../../components/ui/Form'
import { Loading } from '../../components/ui/Loading'
import { VerificationBadge } from '../../components/ui/VerificationBadge'
import { apiCreatePlacement, apiDeclineSuggestion, apiExpressInterest, apiShortlist, type ShortlistMatched, type ShortlistProposed } from '../../lib/api'
import type { MatchSuggestionStatus } from '../../types'

const SUGGESTION_STATUS_LABELS: Record<MatchSuggestionStatus, string> = {
  proposee_candidat: 'Proposé au candidat',
  interet_candidat: 'Candidat intéressé',
  proposee_recruteur: 'Proposé par OffRec',
  interet_recruteur: 'Intérêt transmis à OffRec',
  mise_en_relation: 'Mis en relation',
  ecartee: 'Écarté',
}

/**
 * Combine les candidats diplômés matchés par IA et les talents non-diplômés
 * proposés par un agent, avec un badge de provenance toujours visible —
 * les deux ne sont jamais présentés comme équivalents (cahier §7.3 règle 17).
 */
export function RecruiterShortlist() {
  const { id = '' } = useParams()
  const [data, setData] = useState<{ matched: ShortlistMatched[]; proposed: ShortlistProposed[] } | null>(null)
  const [salary, setSalary] = useState<Record<string, string>>({})
  const [feedback, setFeedback] = useState('')

  const load = () => {
    apiShortlist(id).then(setData)
  }

  useEffect(load, [id])

  if (!data) {
    return (
      <div className="page">
        <div className="container">
          <Loading />
        </div>
      </div>
    )
  }

  const handleExpressInterest = async (suggestionId: string) => {
    await apiExpressInterest(suggestionId)
    setFeedback('Votre intérêt a été transmis à OffRec.')
    load()
  }

  const handleDecline = async (suggestionId: string) => {
    await apiDeclineSuggestion(suggestionId)
    setFeedback('Profil écarté.')
    load()
  }

  const handlePlaceCandidate = async (candidateId: string) => {
    await apiCreatePlacement({
      opportunityId: id,
      candidateId,
      monthlySalaryAr: salary[candidateId] ? Number(salary[candidateId]) : undefined,
    })
    setFeedback('Placement enregistré. Suivez le success fee depuis « Placements ».')
  }

  const handlePlaceTalent = async (talentId: string) => {
    await apiCreatePlacement({
      opportunityId: id,
      talentId,
      monthlySalaryAr: salary[talentId] ? Number(salary[talentId]) : undefined,
    })
    setFeedback('Placement enregistré. Suivez le success fee depuis « Placements ».')
  }

  return (
    <div className="page">
      <div className="container">
        <Link to="/recruteur/offres" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', marginBottom: '1rem' }}>
          <ArrowLeft size={16} aria-hidden />
          Retour à mes offres
        </Link>
        <header className="page-header">
          <h1>Shortlist</h1>
          <p>Profils vérifiés humainement par un agent et profils proposés par OffRec — jamais de contact direct, jamais confondus.</p>
        </header>

        {feedback && <p className="save-ok" style={{ marginBottom: '1rem' }}>{feedback}</p>}

        <h2 style={{ fontSize: '1.05rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <ShieldCheck size={18} />
          Vérifiés humainement ({data.proposed.length})
        </h2>
        {data.proposed.length === 0 ? (
          <p style={{ color: 'var(--color-ink-muted)', marginBottom: '1.5rem' }}>
            Aucun talent proposé par un agent pour cette offre pour l’instant.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
            {data.proposed.map((p) => (
              <Card key={p.talentId}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <strong>{p.fullName}</strong>
                    <VerificationBadge kind="human" subtitle="par un agent de terrain" />
                    <p style={{ fontSize: '0.85rem', color: 'var(--color-ink-muted)' }}>
                      {p.trade}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                    <div style={{ width: 130 }}>
                      <Input
                        type="number"
                        placeholder="Salaire Ar"
                        value={salary[p.talentId] ?? ''}
                        onChange={(e) => setSalary((s) => ({ ...s, [p.talentId]: e.target.value }))}
                      />
                    </div>
                    <Button size="sm" onClick={() => handlePlaceTalent(p.talentId)}>
                      Déclarer un placement
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        <h2 style={{ fontSize: '1.05rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Sparkles size={18} />
          Proposés par OffRec ({data.matched.length})
        </h2>
        {data.matched.length === 0 ? (
          <p style={{ color: 'var(--color-ink-muted)' }}>Aucun candidat diplômé proposé pour l’instant.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {data.matched.map((m) => (
              <Card key={m.candidateId}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <strong>{m.fullName}</strong>
                    <VerificationBadge kind="ai" subtitle={`${m.match.score}% de compatibilité`} />
                    <p style={{ fontSize: '0.85rem', color: 'var(--color-ink-muted)' }}>
                      {m.match.reasons.slice(0, 2).join(' · ')}
                    </p>
                    <Badge variant="muted">{SUGGESTION_STATUS_LABELS[m.status]}</Badge>
                  </div>
                  <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                    <div style={{ width: 130 }}>
                      <Input
                        type="number"
                        placeholder="Salaire Ar"
                        value={salary[m.candidateId] ?? ''}
                        onChange={(e) => setSalary((s) => ({ ...s, [m.candidateId]: e.target.value }))}
                      />
                    </div>
                    {m.status === 'proposee_recruteur' && (
                      <Button variant="outline" size="sm" onClick={() => handleExpressInterest(m.suggestionId)}>
                        Ce profil m’intéresse
                      </Button>
                    )}
                    {(m.status === 'proposee_recruteur' || m.status === 'interet_recruteur') && (
                      <Button variant="outline" size="sm" onClick={() => handleDecline(m.suggestionId)}>
                        <X size={14} />
                        Écarter
                      </Button>
                    )}
                    <Button size="sm" onClick={() => handlePlaceCandidate(m.candidateId)}>
                      Déclarer un placement
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
