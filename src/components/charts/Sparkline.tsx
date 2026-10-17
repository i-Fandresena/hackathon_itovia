import { useId } from 'react'
import { monotonePath, type Point } from './geometry'
import './Charts.css'

interface SparklineProps {
  /** Valeurs dans l'ordre chronologique (une par jour, par exemple). */
  values: number[]
  /** Résumé lu par les lecteurs d'écran (les valeurs, pas la forme). */
  label: string
  className?: string
}

const W = 120
const H = 36
const PAD = 3

/**
 * Mini-courbe d'une carte indicateur : tendance d'ensemble, sans axe. Les
 * chiffres exacts restent dans la carte (et dans l'export CSV) ; la courbe
 * n'est qu'un repère visuel, résumé en texte pour les lecteurs d'écran.
 */
export function Sparkline({ values, label, className = '' }: SparklineProps) {
  const gradientId = useId()
  if (values.length === 0) return null
  const max = Math.max(1, ...values)
  const n = values.length
  const points: Point[] = values.map((v, i) => [n > 1 ? (i / (n - 1)) * W : W / 2, PAD + (H - 2 * PAD) * (1 - v / max)])
  const line = monotonePath(points)
  const area = `${line} L${W},${H} L0,${H} Z`
  return (
    <svg
      className={`ochart-spark ${className}`.trim()}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={label}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" className="ochart-spark-stop-top" />
          <stop offset="100%" className="ochart-spark-stop-bottom" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradientId})`} />
      <path d={line} className="ochart-spark-line" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}
