/**
 * Séries quotidiennes et fenêtres glissantes des tableaux de bord (admin :
 * `lib/admin-dashboard.ts`, recruteur : `lib/recruiter-dashboard.ts`) — une
 * seule définition pour que les deux écrans comptent de la même façon.
 *
 * Jours : calendrier de Madagascar, UTC+3 fixe (pas d'heure d'été — même
 * convention que `independentSourceGroups()` dans `src/lib/trust.ts`).
 * « 30 derniers jours » : aujourd'hui et les 29 jours précédents, jours
 * entiers de ce calendrier (mêmes bornes pour toutes les séries et sommes).
 * Tendances : fenêtres glissantes de 7 × 24 h (les 7 derniers jours contre
 * les 7 précédents), jamais une journée partielle comparée à une pleine.
 */

export const SERIES_DAYS = 30
export const DAY_MS = 86_400_000
const MG_OFFSET_MS = 3 * 3_600_000

/** Clé `AAAA-MM-JJ` du jour de Madagascar contenant l'instant `d`. */
export function mgDayKey(d: Date): string {
  return new Date(d.getTime() + MG_OFFSET_MS).toISOString().slice(0, 10)
}

/** Instant UTC du début (minuit, heure de Madagascar) du jour contenant `now`. */
export function mgStartOfDay(now: Date): Date {
  const shifted = new Date(now.getTime() + MG_OFFSET_MS)
  return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()) - MG_OFFSET_MS)
}

/** Les `SERIES_DAYS` jours de la série, du plus ancien à aujourd'hui inclus. */
export function seriesDays(now: Date): { start: Date; days: string[] } {
  const start = new Date(mgStartOfDay(now).getTime() - (SERIES_DAYS - 1) * DAY_MS)
  const days = Array.from({ length: SERIES_DAYS }, (_, i) => mgDayKey(new Date(start.getTime() + i * DAY_MS + DAY_MS / 2)))
  return { start, days }
}

/** Compte par jour (jours sans événement = 0) des dates fournies. */
export function bucketByDay(dates: Date[], days: string[]): number[] {
  const index = new Map(days.map((d, i) => [d, i]))
  const out = new Array<number>(days.length).fill(0)
  for (const d of dates) {
    const i = index.get(mgDayKey(d))
    if (i !== undefined) out[i]++
  }
  return out
}

/** Dates dans les 7 derniers jours glissants / les 7 jours précédents. */
export function rollingWeeks(dates: Date[], now: Date): { last7: number; prev7: number } {
  const t7 = now.getTime() - 7 * DAY_MS
  const t14 = now.getTime() - 14 * DAY_MS
  let last7 = 0
  let prev7 = 0
  for (const d of dates) {
    const t = d.getTime()
    if (t > now.getTime()) continue
    if (t >= t7) last7++
    else if (t >= t14) prev7++
  }
  return { last7, prev7 }
}

/** Dates dans la fenêtre de la série (`start` → `now`, bornes incluses). */
export function inSeries(dates: Date[], start: Date, now: Date): Date[] {
  return dates.filter((d) => d.getTime() >= start.getTime() && d.getTime() <= now.getTime())
}

export function zeroRecord<K extends string>(keys: readonly K[]): Record<K, number> {
  return Object.fromEntries(keys.map((k) => [k, 0])) as Record<K, number>
}

/** Part en %, une décimale ; `null` quand le total est nul. */
export function percentOrNull(part: number, total: number): number | null {
  return total > 0 ? Math.round((part / total) * 1000) / 10 : null
}
