import { ArrowLeft, Bookmark, MapPin, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { MatchScore } from '../components/ui/MatchScore'
import {
  EXPERIENCE_LABELS,
  OPPORTUNITY_TYPE_LABELS,
  SECTOR_DETAIL_LABELS,
} from '../data/constants'
import { useApp } from '../context/AppContext'
import { ReportButton } from '../components/ui/ReportButton'
import { formatDate } from '../lib/format'

interface OpportunityDetailProps {
  basePath: string
  backLabel: string
  backTo: string
  canApply?: boolean
  canBookmark?: boolean
  /** Espace candidat : jamais l'identité de l'entreprise avant une mise en
   *  relation confirmée par OffRec (décision produit 2026-09-02). */
  hideCompany?: boolean
}

export function OpportunityDetail({
  basePath: _basePath,
  backLabel,
  backTo,
  canApply,
  canBookmark,
  hideCompany,
}: OpportunityDetailProps) {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const {
    opportunities,
    currentUser,
    isBookmarked,
    toggleBookmark,
    getSuggestionForOpportunity,
    expressInterest,
    declineSuggestion,
  } = useApp()
  const [feedback, setFeedback] = useState('')

  const opportunity = opportunities.find((o) => o.id === id)
  const suggestion = opportunity ? getSuggestionForOpportunity(opportunity.id) : undefined
  const match = suggestion ? { score: suggestion.score, reasons: suggestion.reasons } : null

  if (!opportunity) {
    return (
      <div className="page">
        <div className="container">
          <p>Offre introuvable.</p>
          <Link to={backTo}>{backLabel}</Link>
        </div>
      </div>
    )
  }

  const handleApply = async () => {
    if (!suggestion) return
    const result = await expressInterest(suggestion.id)
    setFeedback(result.ok ? 'Votre candidature a été transmise à OffRec.' : result.error ?? 'Erreur')
  }

  const handleCancel = async () => {
    if (!suggestion) return
    const result = await declineSuggestion(suggestion.id)
    setFeedback(result.ok ? 'Votre candidature a été annulée.' : result.error ?? 'Erreur')
  }

  return (
    <div className="page">
      <div className="container" style={{ maxWidth: 720 }}>
        <button type="button" className="back-link" onClick={() => navigate(backTo)}>
          <ArrowLeft size={18} />
          {backLabel}
        </button>

        <header className="page-header" style={{ marginTop: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
            <div>
              <h1>{opportunity.title}</h1>
              {!hideCompany && <p>{opportunity.companyName}</p>}
            </div>
            {canBookmark && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => toggleBookmark(opportunity.id)}
              >
                <Bookmark
                  size={16}
                  fill={isBookmarked(opportunity.id) ? 'currentColor' : 'none'}
                />
                {isBookmarked(opportunity.id) ? 'Enregistré' : 'Favoris'}
              </Button>
            )}
          </div>
        </header>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '1rem' }}>
          <Badge variant="primary">{opportunity.category}</Badge>
          <Badge variant="muted">
            {OPPORTUNITY_TYPE_LABELS[opportunity.opportunityType]}
          </Badge>
          <Badge variant="muted">
            {EXPERIENCE_LABELS[opportunity.level]}
          </Badge>
        </div>

        <p className="opp-location" style={{ marginBottom: '1rem' }}>
          <MapPin size={16} />
          {opportunity.city}, {opportunity.province} · Date limite :{' '}
          {formatDate(opportunity.deadline)}
        </p>

        <div style={{ marginBottom: '1rem' }}>
          <ReportButton targetType="opportunity" targetId={opportunity.id} />
        </div>

        {match && canApply && (
          <div style={{ marginBottom: '1.25rem' }}>
            <p className="detail-rec-label">Recommandé pour votre profil</p>
            <MatchScore match={match} />
          </div>
        )}

        <Card style={{ marginBottom: '1.25rem' }}>
          <h2 style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>Description</h2>
          <p style={{ lineHeight: 1.6, color: 'var(--color-text-muted)' }}>
            {opportunity.description}
          </p>
          <h3 style={{ fontSize: '1rem', margin: '1rem 0 0.5rem' }}>Compétences recherchées</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
            {opportunity.requiredSkills.map((s) => (
              <Badge key={s} variant="primary">
                {s}
              </Badge>
            ))}
          </div>
          {opportunity.sectorDetails && Object.keys(opportunity.sectorDetails).length > 0 && (
            <>
              <h3 style={{ fontSize: '1rem', margin: '1rem 0 0.5rem' }}>Détails</h3>
              <dl style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {Object.entries(opportunity.sectorDetails).map(([key, value]) => {
                  if (value === '' || value === false) return null
                  return (
                    <div key={key} style={{ display: 'flex', gap: '0.5rem', fontSize: '0.9rem' }}>
                      <dt style={{ color: 'var(--color-ink-muted)', minWidth: 160 }}>
                        {SECTOR_DETAIL_LABELS[key] ?? key}
                      </dt>
                      <dd style={{ margin: 0 }}>{value === true ? 'Oui' : value}</dd>
                    </div>
                  )
                })}
              </dl>
            </>
          )}
        </Card>

        {canApply && currentUser?.role === 'candidate' && suggestion && (
          <Card>
            <h2 style={{ fontSize: '1.1rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Sparkles size={18} />
              {suggestion.status === 'proposee_candidat' ? 'Postuler à cette offre' : 'Votre candidature'}
            </h2>
            {suggestion.status === 'proposee_candidat' ? (
              <>
                <p style={{ color: 'var(--color-ink-muted)', fontSize: '0.9rem', marginBottom: '0.75rem' }}>
                  OffRec s’occupe de la mise en relation si l’entreprise est
                  intéressée elle aussi — pas de message à rédiger.
                </p>
                <Button onClick={handleApply}>Postuler</Button>
              </>
            ) : (
              <>
                <p style={{ color: 'var(--color-accent)', fontWeight: 600, marginBottom: suggestion.status !== 'mise_en_relation' && suggestion.status !== 'ecartee' ? '0.75rem' : 0 }}>
                  {suggestion.status === 'interet_candidat' && 'Votre candidature a été transmise à OffRec.'}
                  {suggestion.status === 'proposee_recruteur' && 'OffRec a transmis votre candidature à l’entreprise.'}
                  {suggestion.status === 'interet_recruteur' && "L'entreprise est intéressée — OffRec finalise la mise en relation."}
                  {suggestion.status === 'mise_en_relation' && 'Vous êtes mis en relation — OffRec vous recontacte avec les prochaines étapes.'}
                  {suggestion.status === 'ecartee' && 'Cette candidature a été annulée.'}
                </p>
                {suggestion.status !== 'mise_en_relation' && suggestion.status !== 'ecartee' && (
                  <Button variant="outline" onClick={handleCancel}>
                    Annuler ma candidature
                  </Button>
                )}
              </>
            )}
            {feedback && (
              <p style={{ marginTop: '0.75rem', fontSize: '0.9rem' }}>{feedback}</p>
            )}
          </Card>
        )}

        {!canApply && (
          <Link to="/inscription">
            <Button>Créer un compte pour être recommandé·e</Button>
          </Link>
        )}
      </div>
      <style>{`
        .back-link {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          background: none;
          border: none;
          color: var(--color-accent-hover);
          font-weight: 600;
          cursor: pointer;
          padding: 0;
        }
      `}</style>
    </div>
  )
}
