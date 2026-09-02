import { ShieldCheck, Sparkles } from 'lucide-react'
import './VerificationBadge.css'

interface VerificationBadgeProps {
  kind: 'human' | 'ai'
  subtitle: string
}

/**
 * Distingue visuellement un profil vérifié humainement (agent) d'un profil
 * matché par IA — les deux ne doivent jamais être présentés comme
 * équivalents (cahier des charges §7.3 règle 17). Icône dans un cercle
 * plein + libellé/sous-titre, volontairement plus affirmé qu'un badge
 * générique en ligne.
 */
export function VerificationBadge({ kind, subtitle }: VerificationBadgeProps) {
  const Icon = kind === 'human' ? ShieldCheck : Sparkles
  return (
    <div className={`verify-badge verify-badge-${kind}`}>
      <span className="verify-badge-icon">
        <Icon size={18} aria-hidden />
      </span>
      <span className="verify-badge-text">
        <strong>{kind === 'human' ? 'Vérifié humain' : 'Profil matché IA'}</strong>
        <span>{subtitle}</span>
      </span>
    </div>
  )
}
