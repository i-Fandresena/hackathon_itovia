/**
 * Géométrie partagée des graphiques SVG (sans dépendance) : courbe monotone,
 * graduations « rondes ». Aucune donnée ici, uniquement du calcul.
 */

export type Point = [number, number]

/**
 * Chemin SVG d'une courbe monotone (Fritsch–Carlson) passant par `points`
 * (x croissants). Contrairement à une spline classique, elle ne dépasse
 * jamais les valeurs réelles : pas de creux sous zéro entre deux jours à 0.
 */
export function monotonePath(points: Point[]): string {
  const n = points.length
  if (n === 0) return ''
  if (n === 1) return `M${points[0][0]},${points[0][1]}`
  const dx: number[] = []
  const slope: number[] = []
  for (let i = 0; i < n - 1; i++) {
    dx.push(points[i + 1][0] - points[i][0])
    slope.push(dx[i] === 0 ? 0 : (points[i + 1][1] - points[i][1]) / dx[i])
  }
  const tangent: number[] = [slope[0]]
  for (let i = 1; i < n - 1; i++) {
    tangent.push(slope[i - 1] * slope[i] <= 0 ? 0 : (slope[i - 1] + slope[i]) / 2)
  }
  tangent.push(slope[n - 2])
  for (let i = 0; i < n - 1; i++) {
    if (slope[i] === 0) {
      tangent[i] = 0
      tangent[i + 1] = 0
      continue
    }
    const a = tangent[i] / slope[i]
    const b = tangent[i + 1] / slope[i]
    const h = a * a + b * b
    if (h > 9) {
      const t = 3 / Math.sqrt(h)
      tangent[i] = t * a * slope[i]
      tangent[i + 1] = t * b * slope[i]
    }
  }
  let d = `M${points[0][0]},${points[0][1]}`
  for (let i = 0; i < n - 1; i++) {
    const [x0, y0] = points[i]
    const [x1, y1] = points[i + 1]
    const h = dx[i] / 3
    d += ` C${x0 + h},${y0 + tangent[i] * h} ${x1 - h},${y1 - tangent[i + 1] * h} ${x1},${y1}`
  }
  return d
}

/** Plus petite borne « ronde » ≥ `max` pour un axe entier, et ses graduations. */
export function niceScale(max: number, tickCount = 4): { max: number; ticks: number[] } {
  if (max <= 0) return { max: tickCount, ticks: Array.from({ length: tickCount + 1 }, (_, i) => i) }
  const rawStep = max / tickCount
  const magnitude = 10 ** Math.floor(Math.log10(rawStep))
  const step = Math.max(1, [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= rawStep) ?? 10 * magnitude)
  const intStep = Math.ceil(step)
  const top = Math.ceil(max / intStep) * intStep
  const ticks: number[] = []
  for (let v = 0; v <= top; v += intStep) ticks.push(v)
  return { max: top, ticks }
}

/** Format compact des graduations (1 200 → « 1,2 k »). */
export function compactNumber(n: number): string {
  if (Math.abs(n) >= 1000) {
    return new Intl.NumberFormat('fr-FR', { notation: 'compact', maximumFractionDigits: 1 }).format(n)
  }
  return n.toLocaleString('fr-FR')
}
