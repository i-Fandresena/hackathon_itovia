import { ShieldAlert, ShieldCheck, ShieldQuestion } from 'lucide-react'
import { CONFIDENCE_LABELS } from '../../data/constants'
import type { TrustResult } from '../../types'
import './TrustBadge.css'

const ICONS = {
  forte: ShieldCheck,
  moyenne: ShieldQuestion,
  faible: ShieldAlert,
}

interface TrustBadgeProps {
  trust: TrustResult
  compact?: boolean
}

/**
 * Affiche la note *et* le niveau de confiance. Montrer l'un sans l'autre
 * serait trompeur : 5/5 sur un seul avis ne vaut pas 4,4/5 sur huit.
 */
export function TrustBadge({ trust, compact }: TrustBadgeProps) {
  if (trust.recommendationCount === 0) {
    return (
      <div className="trust-badge trust-empty">
        <ShieldAlert size={compact ? 16 : 18} aria-hidden />
        <span className="trust-none">Aucune recommandation</span>
      </div>
    )
  }

  const Icon = ICONS[trust.confidence]

  return (
    <div className={`trust-badge trust-${trust.confidence} ${compact ? 'trust-compact' : ''}`}>
      <Icon size={compact ? 16 : 18} aria-hidden />
      <span className="trust-score">
        {trust.score.toLocaleString('fr-FR', { minimumFractionDigits: 1 })}
        <span className="trust-max">/5</span>
      </span>
      <span className="trust-sep" aria-hidden />
      <span className="trust-level">{CONFIDENCE_LABELS[trust.confidence]}</span>
      <span className="trust-count">
        · {trust.recommendationCount} membre{trust.recommendationCount > 1 ? 's' : ''}
      </span>
    </div>
  )
}
