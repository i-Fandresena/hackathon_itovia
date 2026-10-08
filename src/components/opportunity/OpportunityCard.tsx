import { MapPin } from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  OPPORTUNITY_TYPE_LABELS,
} from '../../data/constants'
import type { Opportunity } from '../../types'
import { Badge } from '../ui/Badge'
import { Card } from '../ui/Card'
import './OpportunityCard.css'

interface OpportunityCardProps {
  opportunity: Opportunity
  detailPath: string
}

/** Carte d'offre du catalogue public (landing). L'espace candidat n'affiche
 *  pas d'offres mais des dossiers, sans le nom de l'entreprise. */
export function OpportunityCard({ opportunity, detailPath }: OpportunityCardProps) {
  return (
    <Card className="opp-card">
      <div>
        <h3>
          <Link to={detailPath}>{opportunity.title}</Link>
        </h3>
        <p className="opp-company">{opportunity.companyName}</p>
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
      <Link to={detailPath} className="opp-link">
        Voir le détail →
      </Link>
    </Card>
  )
}
