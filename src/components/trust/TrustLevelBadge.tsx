import { ShieldCheck } from 'lucide-react'
import { TRUST_LEVEL_LABELS } from '../../data/endorsements'
import type { TrustLevel } from '../../types'
import './TrustLevelBadge.css'

interface TrustLevelBadgeProps {
  level: TrustLevel
  /** Indice 0–100 ; jamais affiché pour « Nouveau ». */
  index?: number | null
  /** Préfixe « Confiance : » — utile quand l'adéquation est affichée à côté. */
  withLabel?: boolean
}

/**
 * Niveau de confiance d'un talent ou d'une entreprise. « Nouveau » reste un
 * badge neutre : un profil récent n'est jamais présenté comme suspect.
 */
export function TrustLevelBadge({ level, index, withLabel }: TrustLevelBadgeProps) {
  return (
    <span className={`trust-badge trust-badge-${level}`}>
      <ShieldCheck size={14} aria-hidden />
      {withLabel && <span className="trust-badge-prefix">Confiance :</span>}
      <span>{TRUST_LEVEL_LABELS[level]}</span>
      {level !== 'nouveau' && index != null && <span className="trust-badge-index">· {index}/100</span>}
    </span>
  )
}
