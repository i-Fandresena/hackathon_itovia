/**
 * AnimatedIcon — icônes SVG animées type "draw-on" (stroke dash animation)
 * Effet identique aux Lottie icons mais 100% CSS/SVG, sans dépendances fragiles.
 */
import type { ReactNode } from 'react'
import './AnimatedIcon.css'

interface Props {
  icon: 'check' | 'star' | 'briefcase' | 'search' | 'target' | 'user' | 'shield'
  size?: number
  color?: string
  delay?: number
}

export function AnimatedIcon({ icon, size = 24, color = 'currentColor', delay = 0 }: Props) {
  const style: React.CSSProperties = {
    '--icon-color': color,
    '--icon-delay': `${delay}s`,
  } as React.CSSProperties

  const paths: Record<Props['icon'], ReactNode> = {
    check: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style} className="anim-icon anim-draw">
        <polyline points="4 12 9 17 20 7" stroke="var(--icon-color)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="anim-stroke" />
      </svg>
    ),
    star: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style} className="anim-icon anim-pop">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" stroke="var(--icon-color)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="anim-stroke" />
      </svg>
    ),
    briefcase: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style} className="anim-icon anim-draw">
        <rect x="2" y="7" width="20" height="14" rx="2" stroke="var(--icon-color)" strokeWidth="2" strokeLinejoin="round" className="anim-stroke anim-stroke-rect" />
        <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" stroke="var(--icon-color)" strokeWidth="2" strokeLinecap="round" className="anim-stroke anim-stroke-delay1" />
        <line x1="12" y1="12" x2="12" y2="16" stroke="var(--icon-color)" strokeWidth="2" strokeLinecap="round" className="anim-stroke anim-stroke-delay2" />
      </svg>
    ),
    search: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style} className="anim-icon anim-draw">
        <circle cx="11" cy="11" r="8" stroke="var(--icon-color)" strokeWidth="2" className="anim-stroke anim-stroke-circle" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" stroke="var(--icon-color)" strokeWidth="2.2" strokeLinecap="round" className="anim-stroke anim-stroke-delay1" />
      </svg>
    ),
    target: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style} className="anim-icon anim-draw">
        <circle cx="12" cy="12" r="10" stroke="var(--icon-color)" strokeWidth="2" className="anim-stroke anim-stroke-circle" />
        <circle cx="12" cy="12" r="6" stroke="var(--icon-color)" strokeWidth="2" className="anim-stroke anim-stroke-circle2" />
        <circle cx="12" cy="12" r="2" stroke="var(--icon-color)" strokeWidth="2" className="anim-stroke anim-stroke-delay2" />
      </svg>
    ),
    user: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style} className="anim-icon anim-draw">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke="var(--icon-color)" strokeWidth="2" strokeLinecap="round" className="anim-stroke anim-stroke-delay1" />
        <circle cx="12" cy="7" r="4" stroke="var(--icon-color)" strokeWidth="2" className="anim-stroke anim-stroke-circle" />
      </svg>
    ),
    shield: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style} className="anim-icon anim-draw">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="var(--icon-color)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="anim-stroke anim-stroke-rect" />
        <polyline points="9 12 11 14 15 10" stroke="var(--icon-color)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="anim-stroke anim-stroke-delay2" />
      </svg>
    ),
  }

  return paths[icon]
}
