import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { compactNumber, monotonePath, niceScale, type Point } from './geometry'
import './Charts.css'

export interface AreaPoint {
  /** Identifiant stable (ex. `2026-10-14`). */
  key: string
  /** Libellé court de l'axe (ex. « 14 oct. »). */
  axisLabel: string
  /** Libellé complet de l'infobulle et du tableau (ex. « mardi 14 octobre »). */
  fullLabel: string
  value: number
  /** Décomposition affichée dans l'infobulle et le tableau (ex. par rôle). */
  details?: { key: string; label: string; value: number; color?: string }[]
}

interface AreaChartProps {
  points: AreaPoint[]
  /** Nom du graphique, repris dans les résumés accessibles. */
  title: string
  /** « 3 inscriptions » — accord du nom selon la valeur. */
  formatValue: (n: number) => string
  /** En-tête de la colonne principale du tableau de données. */
  valueHeader: string
  /** Message affiché quand toute la série vaut 0. */
  emptyMessage?: string
  height?: number
}

const M = { top: 12, right: 12, bottom: 28, left: 36 }
const MIN_LABEL_GAP = 64

/**
 * Graphique en aire d'une série quotidienne : grille discrète, courbe
 * monotone (jamais sous zéro), infobulle au survol et au clavier (flèches,
 * Début/Fin), annonce vocale du point courant et tableau des données
 * dépliable. Largeur mesurée pour garder un texte net à toute taille.
 */
export function AreaChart({ points, title, formatValue, valueHeader, emptyMessage, height = 260 }: AreaChartProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(640)
  const [active, setActive] = useState<number | null>(null)
  const gradientId = useId()
  const descId = useId()

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const measure = () => setWidth(Math.max(240, Math.round(el.getBoundingClientRect().width)))
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const n = points.length
  const innerW = Math.max(1, width - M.left - M.right)
  const innerH = height - M.top - M.bottom
  const total = points.reduce((s, p) => s + p.value, 0)
  const maxValue = Math.max(0, ...points.map((p) => p.value))
  const scale = niceScale(maxValue)
  const x = (i: number) => M.left + (n > 1 ? (i / (n - 1)) * innerW : innerW / 2)
  const y = (v: number) => M.top + innerH * (1 - v / scale.max)

  const { line, area } = useMemo(() => {
    const pts: Point[] = points.map((p, i) => [x(i), y(p.value)])
    const l = monotonePath(pts)
    const baseline = M.top + innerH
    return { line: l, area: n > 0 ? `${l} L${x(n - 1)},${baseline} L${x(0)},${baseline} Z` : '' }
    // `x` et `y` ne dépendent que de ces valeurs.
  }, [points, width, height, scale.max])

  // Étiquettes de l'axe des dates : espacées d'au moins MIN_LABEL_GAP px, la
  // dernière (aujourd'hui) toujours affichée, sans chevauchement.
  const labelIdx = useMemo(() => {
    if (n === 0) return []
    const step = Math.max(1, Math.ceil(n / Math.max(1, Math.floor(innerW / MIN_LABEL_GAP))))
    const idx: number[] = []
    for (let i = n - 1; i >= 0; i -= step) idx.unshift(i)
    // Le premier jour (ancré à gauche) n'est ajouté que s'il ne touche pas
    // l'étiquette suivante (centrée) : une étiquette entière + une demie.
    if (idx[0] !== 0 && x(idx[0]) - M.left >= MIN_LABEL_GAP * 1.25) idx.unshift(0)
    return idx
  }, [n, innerW])

  const peakIndex = maxValue > 0 ? points.map((p) => p.value).lastIndexOf(maxValue) : -1
  const summary =
    total === 0
      ? `${title} : aucune valeur sur ${n} jours.`
      : `${title} : ${formatValue(total)} sur ${n} jours, au plus ${formatValue(maxValue)} le ${points[peakIndex].fullLabel}.`

  const indexFromPointer = (e: PointerEvent<SVGRectElement>) => {
    const svg = e.currentTarget.ownerSVGElement
    if (!svg || n === 0) return null
    const rect = svg.getBoundingClientRect()
    const px = ((e.clientX - rect.left) / rect.width) * width
    const i = n > 1 ? Math.round(((px - M.left) / innerW) * (n - 1)) : 0
    return Math.min(n - 1, Math.max(0, i))
  }

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (n === 0) return
    const current = active ?? n - 1
    let next = current
    if (e.key === 'ArrowLeft') next = Math.max(0, current - 1)
    else if (e.key === 'ArrowRight') next = Math.min(n - 1, current + 1)
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = n - 1
    else if (e.key === 'Escape') {
      setActive(null)
      return
    } else return
    e.preventDefault()
    setActive(next)
  }

  const activePoint = active !== null ? points[active] : null
  const tooltipLeft = active !== null ? x(active) : 0
  const flip = active !== null && tooltipLeft > width * 0.6

  return (
    <div>
      <div
        ref={wrapRef}
        className="ochart-area"
        tabIndex={0}
        role="group"
        aria-roledescription="graphique"
        aria-label={`${title}. Flèches gauche et droite pour parcourir les jours.`}
        aria-describedby={descId}
        onKeyDown={onKeyDown}
        onFocus={() => setActive((a) => a ?? (n > 0 ? n - 1 : null))}
        onBlur={() => setActive(null)}
      >
        <p id={descId} className="ochart-sr">
          {summary}
        </p>
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={summary}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" className="ochart-spark-stop-top" />
              <stop offset="100%" className="ochart-spark-stop-bottom" />
            </linearGradient>
          </defs>
          {scale.ticks.map((t) => (
            <g key={t}>
              <line className="ochart-grid-line" x1={M.left} x2={width - M.right} y1={y(t)} y2={y(t)} />
              <text className="ochart-axis-text" x={M.left - 8} y={y(t)} dy="0.32em" textAnchor="end">
                {compactNumber(t)}
              </text>
            </g>
          ))}
          {labelIdx.map((i) => (
            <text
              key={points[i].key}
              className="ochart-axis-text"
              x={x(i)}
              y={height - 8}
              textAnchor={i === n - 1 ? 'end' : i === 0 ? 'start' : 'middle'}
            >
              {points[i].axisLabel}
            </text>
          ))}
          {n > 0 && <path d={area} fill={`url(#${gradientId})`} />}
          {n > 0 && <path d={line} className="ochart-area-line" />}
          {activePoint && active !== null && (
            <g aria-hidden="true">
              <line className="ochart-crosshair" x1={x(active)} x2={x(active)} y1={M.top} y2={M.top + innerH} />
              <circle className="ochart-dot" cx={x(active)} cy={y(activePoint.value)} r={5} />
            </g>
          )}
          <rect
            className="ochart-hit"
            x={M.left - 6}
            y={0}
            width={innerW + 12}
            height={height}
            onPointerMove={(e) => setActive(indexFromPointer(e))}
            onPointerDown={(e) => setActive(indexFromPointer(e))}
            onPointerLeave={() => setActive(null)}
          />
        </svg>
        {total === 0 && emptyMessage && <p className="ochart-empty-note">{emptyMessage}</p>}
        {activePoint && (
          <div
            className="ochart-tooltip"
            style={{
              left: tooltipLeft,
              transform: `translate(${flip ? 'calc(-100% - 12px)' : '12px'}, ${M.top}px)`,
            }}
          >
            <div className="ochart-tooltip-title">{activePoint.fullLabel}</div>
            <div className="ochart-tooltip-value">{formatValue(activePoint.value)}</div>
            {activePoint.details && activePoint.details.some((d) => d.value > 0) && (
              <ul>
                {activePoint.details
                  .filter((d) => d.value > 0)
                  .map((d) => (
                    <li key={d.key}>
                      <span className="ochart-swatch" style={{ ['--ochart-swatch' as string]: d.color }} aria-hidden />
                      {d.label}
                      <strong>{d.value}</strong>
                    </li>
                  ))}
              </ul>
            )}
          </div>
        )}
        <p className="ochart-sr" aria-live="polite">
          {activePoint ? `${activePoint.fullLabel} : ${formatValue(activePoint.value)}` : ''}
        </p>
      </div>

      <details className="ochart-table">
        <summary>Voir les données</summary>
        <div className="ochart-table-scroll">
          <table>
            <caption className="ochart-sr">{title}</caption>
            <thead>
              <tr>
                <th scope="col">Jour</th>
                <th scope="col">{valueHeader}</th>
                {points[0]?.details?.map((d) => (
                  <th key={d.key} scope="col">
                    {d.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...points].reverse().map((p) => (
                <tr key={p.key}>
                  <th scope="row">{p.fullLabel}</th>
                  <td>{p.value}</td>
                  {p.details?.map((d) => (
                    <td key={d.key}>{d.value}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  )
}
