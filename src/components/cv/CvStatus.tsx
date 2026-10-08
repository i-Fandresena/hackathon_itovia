import { AlertTriangle, Clock, Info, ShieldCheck, XCircle } from 'lucide-react'
import type { CvFlag, CvVerificationStatus } from '../../types'
import './CvStatus.css'

export const CV_STATUS_LABELS: Record<CvVerificationStatus, string> = {
  non_verifie: 'Non vérifié',
  verifie: 'Vérifié par OffRec',
  rejete: 'Rejeté',
}

const STATUS_ICONS = {
  non_verifie: Clock,
  verifie: ShieldCheck,
  rejete: XCircle,
} as const

/**
 * Statut de la vérification humaine d'un CV. Volontairement distinct de
 * `VerificationBadge` (talents vérifiés sur le terrain / matchés par IA) :
 * ce sont deux vérifications différentes, à ne pas confondre à l'écran.
 */
export function CvStatusBadge({ status }: { status: CvVerificationStatus }) {
  const Icon = STATUS_ICONS[status] ?? Clock
  return (
    <span className={`cv-status cv-status-${status}`}>
      <Icon size={13} aria-hidden />
      {CV_STATUS_LABELS[status] ?? status}
    </span>
  )
}

/** Compteur compact pour les listes (file de vérification, vivier). */
export function CvFlagCount({ count }: { count: number }) {
  if (count <= 0) return null
  return (
    <span className="cv-flag-count">
      <AlertTriangle size={12} aria-hidden />
      {count} point{count > 1 ? 's' : ''} à vérifier
    </span>
  )
}

/**
 * Liste des points relevés automatiquement sur un CV. Formulation neutre :
 * un drapeau est un indice à contrôler, jamais une accusation.
 */
export function CvFlagList({ flags }: { flags: CvFlag[] | null | undefined }) {
  if (!flags || flags.length === 0) return null
  return (
    <ul className="cv-flag-list">
      {flags.map((flag, i) => (
        <li key={`${flag.code}-${i}`} className={`cv-flag cv-flag-${flag.severity}`}>
          {flag.severity === 'alerte' ? (
            <AlertTriangle size={15} aria-hidden />
          ) : (
            <Info size={15} aria-hidden />
          )}
          <span>{flag.message}</span>
        </li>
      ))}
    </ul>
  )
}
