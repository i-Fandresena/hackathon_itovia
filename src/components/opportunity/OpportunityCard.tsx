import { Bookmark, MapPin } from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  OPPORTUNITY_TYPE_LABELS,
} from '../../data/constants'
import type { MatchResult, Opportunity } from '../../types'
import { Badge } from '../ui/Badge'
import { Card } from '../ui/Card'
import { MatchScore } from '../ui/MatchScore'
import './OpportunityCard.css'

interface OpportunityCardProps {
  opportunity: Opportunity
  match?: MatchResult
  detailPath: string
  bookmarked?: boolean
  onBookmark?: () => void
  showMatch?: boolean
  /** Espace candidat : jamais l'identité de l'entreprise avant une mise en
   *  relation confirmée par OffRec (décision produit 2026-09-02). */
  hideCompany?: boolean
}

export function OpportunityCard({
  opportunity,
  match,
  detailPath,
  bookmarked,
  onBookmark,
  showMatch,
  hideCompany,
}: OpportunityCardProps) {
  return (
    <Card className="opp-card">
      <div className="opp-card-top">
        <div>
          {showMatch && match && (
            <p className="opp-rec-label">Recommandé pour vous</p>
          )}
          <h3>
            <Link to={detailPath}>{opportunity.title}</Link>
          </h3>
          {!hideCompany && <p className="opp-company">{opportunity.companyName}</p>}
        </div>
        {onBookmark && (
          <button
            type="button"
            className={`opp-bookmark ${bookmarked ? 'active' : ''}`}
            onClick={(e) => {
              e.preventDefault()
              onBookmark()
            }}
            aria-label={bookmarked ? 'Retirer des favoris' : 'Enregistrer'}
          >
            <Bookmark size={20} fill={bookmarked ? 'currentColor' : 'none'} />
          </button>
        )}
      </div>
      <div className="opp-meta">
        <Badge variant="primary">{opportunity.category}</Badge>
        <Badge variant="muted">
          {OPPORTUNITY_TYPE_LABELS[opportunity.opportunityType]}
        </Badge>
      </div>
      <p className="opp-location">
        <MapPin size={14} aria-hidden />
        {opportunity.city}, {opportunity.province}
      </p>
      <p className="opp-desc">
        {opportunity.description.slice(0, 120)}
        {opportunity.description.length > 120 ? '…' : ''}
      </p>
      {showMatch && match && <MatchScore match={match} compact />}
      <Link to={detailPath} className="opp-link">
        Voir le détail →
      </Link>
    </Card>
  )
}
