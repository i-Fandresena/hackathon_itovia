import { Link } from 'react-router-dom'
import './Logo.css'

interface LogoProps {
  variant?: 'full' | 'mark'
  to?: string
  className?: string
}

/** Ratio hauteur/largeur des fichiers sources — évite toute déformation
 *  quand on ne fixe qu'une seule dimension. */
const MARK_RATIO = 199 / 320
const FULL_RATIO = 135 / 640

export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <img
      src="/logo-mark.png"
      alt=""
      aria-hidden
      width={size}
      height={Math.round(size * MARK_RATIO)}
      className="logo-mark-img"
    />
  )
}

export function Logo({ variant = 'full', to = '/', className = '' }: LogoProps) {
  const content =
    variant === 'mark' ? (
      <span className={`logo-brand ${className}`.trim()}>
        <LogoMark size={36} />
      </span>
    ) : (
      <span className={`logo-brand ${className}`.trim()}>
        <img
          src="/logo.png"
          alt="OffRec"
          height={32}
          width={Math.round(32 / FULL_RATIO)}
          className="logo-full-img"
        />
      </span>
    )

  if (to) {
    return (
      <Link to={to} className="logo-link" aria-label="OffRec — Accueil">
        {content}
      </Link>
    )
  }

  return content
}
