import { AlertTriangle, MapPin, Phone } from 'lucide-react'
import { Link } from 'react-router-dom'
import { formatAriary } from '../../lib/format'
import type { ScoredProvider } from '../../types'
import { Badge } from '../ui/Badge'
import { Card } from '../ui/Card'
import { TrustBadge } from './TrustBadge'
import './ProviderCard.css'

export function ProviderCard({ provider, trust }: ScoredProvider) {
  return (
    <Card className="prov-card">
      <div className="prov-card-top">
        <div className="prov-card-id">
          <h3>
            <Link to={`/annuaire/${provider.id}`}>{provider.name}</Link>
          </h3>
          <p className="prov-trade">{provider.trade}</p>
        </div>
        <TrustBadge trust={trust} compact />
      </div>

      <p className="prov-location">
        <MapPin size={14} aria-hidden />
        {provider.district}, {provider.city}
      </p>

      {trust.price && (
        <p className="prov-price">
          <strong>{formatAriary(trust.price.median)}</strong> {trust.price.unit}
          <span className="prov-price-note">
            médiane sur {trust.price.sampleSize} retour
            {trust.price.sampleSize > 1 ? 's' : ''}
          </span>
        </p>
      )}

      {trust.reasons.length > 0 && (
        <ul className="prov-reasons">
          {trust.reasons.slice(0, 3).map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      )}

      {trust.warnings.length > 0 && (
        <p className="prov-warning">
          <AlertTriangle size={14} aria-hidden />
          {trust.warnings[0]}
        </p>
      )}

      <div className="prov-card-foot">
        <Badge variant="muted">
          <Phone size={12} aria-hidden /> {provider.phone}
        </Badge>
        <Link to={`/annuaire/${provider.id}`} className="prov-link">
          Voir les retours →
        </Link>
      </div>
    </Card>
  )
}
