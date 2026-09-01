import { ArrowLeft, Bookmark, MapPin, MessageCircle } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Field, Textarea } from '../components/ui/Form'
import { MatchScore } from '../components/ui/MatchScore'
import {
  EXPERIENCE_LABELS,
  OPPORTUNITY_TYPE_LABELS,
} from '../data/constants'
import { useApp } from '../context/AppContext'
import { apiStartConversation } from '../lib/api'
import { ReportButton } from '../components/ui/ReportButton'
import { formatDate } from '../lib/format'
import { scoreOpportunity } from '../lib/recommendation'

interface OpportunityDetailProps {
  basePath: string
  backLabel: string
  backTo: string
  canApply?: boolean
  canBookmark?: boolean
}

export function OpportunityDetail({
  basePath: _basePath,
  backLabel,
  backTo,
  canApply,
  canBookmark,
}: OpportunityDetailProps) {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const {
    opportunities,
    currentUser,
    isBookmarked,
    toggleBookmark,
    applyToOpportunity,
    hasApplied,
  } = useApp()
  const [message, setMessage] = useState('')
  const [feedback, setFeedback] = useState('')

  const opportunity = opportunities.find((o) => o.id === id)
  const profile = currentUser?.candidateProfile
  const match =
    profile && opportunity ? scoreOpportunity(profile, opportunity) : null

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
    const result = await applyToOpportunity(opportunity.id, message)
    if (result.ok) {
      setFeedback('Votre intérêt a été envoyé au recruteur.')
    } else {
      setFeedback(result.error ?? 'Erreur')
    }
  }

  const handleContact = async () => {
    const { conversationId } = await apiStartConversation(
      opportunity.recruiterId,
      `Bonjour, je vous contacte au sujet de l’offre « ${opportunity.title} ».`,
      opportunity.id,
    )
    navigate(`/messages?c=${conversationId}`)
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
              <p>{opportunity.companyName}</p>
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
        </Card>

        {canApply && currentUser?.role === 'candidate' && (
          <Card>
            <h2 style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>
              Manifester mon intérêt
            </h2>
            {hasApplied(opportunity.id) ? (
              <>
                <p style={{ color: 'var(--color-accent)', fontWeight: 600, marginBottom: '0.75rem' }}>
                  Vous avez déjà postulé à cette offre.
                </p>
                <Button variant="outline" size="sm" onClick={handleContact}>
                  <MessageCircle size={16} />
                  Contacter le recruteur
                </Button>
              </>
            ) : (
              <>
                <Field label="Message (optionnel)">
                  <Textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Présentez-vous en quelques lignes…"
                  />
                </Field>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <Button onClick={handleApply}>Envoyer ma candidature</Button>
                  <Button variant="outline" onClick={handleContact}>
                    <MessageCircle size={16} />
                    Contacter le recruteur
                  </Button>
                </div>
              </>
            )}
            {feedback && (
              <p style={{ marginTop: '0.75rem', fontSize: '0.9rem' }}>{feedback}</p>
            )}
          </Card>
        )}

        {!canApply && (
          <Link to="/inscription">
            <Button>Créer un compte pour postuler</Button>
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
