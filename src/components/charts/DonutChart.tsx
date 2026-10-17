import { useState } from 'react'
import './Charts.css'

export interface DonutSegment {
  key: string
  label: string
  value: number
  /** Couleur CSS du segment (ex. `var(--ochart-cat-1)`), dans un ordre fixe. */
  color: string
}

interface DonutChartProps {
  segments: DonutSegment[]
  /** Nom du graphique, repris dans le résumé accessible. */
  title: string
  /** Libellé sous le total au centre (ex. « comptes »). */
  centerLabel: string
}

const SIZE = 176
const STROKE = 22
const R = (SIZE - STROKE) / 2
const C = 2 * Math.PI * R
/** Espace de la couleur de surface entre deux segments (px). */
const GAP = 2

/** Pourcentage lisible : jamais « 0 % » pour une part non nulle. */
export function formatShare(value: number, total: number): string {
  if (total <= 0 || value <= 0) return '0 %'
  const pct = (value / total) * 100
  if (pct < 1) return '< 1 %'
  return `${Math.round(pct)} %`
}

/**
 * Anneau de répartition + légende (effectif et part de chaque segment, y
 * compris les segments vides). La légende porte toutes les valeurs en texte :
 * c'est l'alternative au graphique ; survoler un segment ou une ligne de
 * légende met l'autre en évidence et affiche le détail au centre.
 */
export function DonutChart({ segments, title, centerLabel }: DonutChartProps) {
  const [active, setActive] = useState<string | null>(null)
  const total = segments.reduce((s, x) => s + x.value, 0)
  const visible = segments.filter((s) => s.value > 0)
  const gap = visible.length > 1 ? GAP : 0
  const summary =
    total === 0
      ? `${title} : aucune donnée.`
      : `${title} : ${segments.map((s) => `${s.label} ${s.value} (${formatShare(s.value, total)})`).join(', ')}.`

  let offset = 0
  const arcs = visible.map((s) => {
    const len = (s.value / total) * C
    const arc = { ...s, dash: Math.max(0.5, len - gap), offset }
    offset += len
    return arc
  })

  const activeSeg = segments.find((s) => s.key === active) ?? null

  return (
    <div className={`ochart-donut ${activeSeg ? 'is-active' : ''}`.trim()}>
      <div className="ochart-donut-figure">
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label={summary}>
          <circle className="ochart-donut-track" cx={SIZE / 2} cy={SIZE / 2} r={R} strokeWidth={STROKE} />
          {arcs.map((a) => (
            <circle
              key={a.key}
              className={`ochart-donut-seg ${active === a.key ? 'is-active' : ''}`.trim()}
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={R}
              stroke={a.color}
              strokeWidth={STROKE}
              strokeDasharray={`${a.dash} ${C - a.dash}`}
              strokeDashoffset={-a.offset}
              onPointerEnter={() => setActive(a.key)}
              onPointerLeave={() => setActive(null)}
            />
          ))}
        </svg>
        <div className="ochart-donut-center" aria-hidden="true">
          <strong>{(activeSeg ? activeSeg.value : total).toLocaleString('fr-FR')}</strong>
          <span>{activeSeg ? `${activeSeg.label} · ${formatShare(activeSeg.value, total)}` : centerLabel}</span>
        </div>
      </div>
      <ul className="ochart-legend" aria-label={`Légende : ${title}`}>
        {segments.map((s) => (
          <li
            key={s.key}
            className={`${active === s.key ? 'is-active' : ''} ${s.value === 0 ? 'is-zero' : ''}`.trim()}
            onPointerEnter={() => setActive(s.key)}
            onPointerLeave={() => setActive(null)}
          >
            <span className="ochart-swatch" style={{ ['--ochart-swatch' as string]: s.color }} aria-hidden />
            <span className="ochart-legend-label">{s.label}</span>
            <span className="ochart-legend-value">{s.value.toLocaleString('fr-FR')}</span>
            <span className="ochart-legend-pct">{formatShare(s.value, total)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
