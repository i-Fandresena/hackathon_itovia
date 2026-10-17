import type { ReactNode } from 'react'
import type { SubjectTrust } from '../../types'
import { TrustLevelBadge } from './TrustLevelBadge'
import './SubjectTrustPanel.css'

interface SubjectTrustPanelProps {
  trust: SubjectTrust
  title?: string
  /** Masque les raisons et avertissements (affichage resserré). */
  compact?: boolean
  footer?: ReactNode
}

/**
 * Confiance expliquée (niveau, indice, sources indépendantes, raisons en
 * clair). Réutilisable pour les talents et les entreprises. Le calcul est
 * toujours fait par le serveur ; ce composant ne fait qu'afficher.
 */
export function SubjectTrustPanel({ trust, title = 'Confiance', compact, footer }: SubjectTrustPanelProps) {
  const sources = trust.independentSources
  return (
    <section className="trust-panel" aria-label={title}>
      <div className="trust-panel-head">
        <h3 className="trust-panel-title">{title}</h3>
        <TrustLevelBadge level={trust.level} index={trust.index} />
      </div>
      <p className="trust-panel-count">
        {trust.recommendationCount === 0
          ? 'Aucune recommandation pour l’instant'
          : `Recommandé·e ${trust.recommendationCount} fois · ${sources} source${sources > 1 ? 's' : ''} indépendante${sources > 1 ? 's' : ''}`}
      </p>
      {!compact && (trust.reasons.length > 0 || trust.warnings.length > 0) && (
        <ul className="trust-panel-reasons">
          {trust.reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
          {trust.warnings.map((w) => (
            <li key={w} className="trust-panel-warning">
              {w}
            </li>
          ))}
        </ul>
      )}
      {footer && <div className="trust-panel-footer">{footer}</div>}
    </section>
  )
}
