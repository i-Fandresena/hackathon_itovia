import { Link } from 'react-router-dom'
import './Logo.css'

interface LogoProps {
  variant?: 'full' | 'mark'
  to?: string
  className?: string
}

export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      className="logo-mark-svg"
    >
      <rect width="40" height="40" rx="10" className="logo-mark-bg" />
      <path
        d="M12 26.5C12 19.596 17.596 14 24.5 14"
        stroke="url(#logoArc)"
        strokeWidth="2.75"
        strokeLinecap="round"
      />
      <path
        d="M28 13.5L28 22.5L19 22.5"
        stroke="url(#logoArrow)"
        strokeWidth="2.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="24.5" cy="14" r="2" className="logo-dot" />
      <circle cx="19" cy="22.5" r="1.5" fill="#fff" fillOpacity="0.9" />
      <defs>
        <linearGradient id="logoArc" x1="12" y1="14" x2="28" y2="26" gradientUnits="userSpaceOnUse">
          <stop stopColor="#5B8CFF" />
          <stop offset="1" stopColor="#1A56FF" />
        </linearGradient>
        <linearGradient id="logoArrow" x1="19" y1="13.5" x2="28" y2="22.5" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fff" />
          <stop offset="1" stopColor="#A8C4FF" />
        </linearGradient>
      </defs>
    </svg>
  )
}

export function Logo({ variant = 'full', to = '/', className = '' }: LogoProps) {
  const content = (
    <span className={`logo-brand ${className}`.trim()}>
      <LogoMark size={variant === 'mark' ? 36 : 32} />
      {variant === 'full' && (
        <span className="logo-wordmark">
          Off<span className="logo-word-accent">Rec</span>
        </span>
      )}
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
