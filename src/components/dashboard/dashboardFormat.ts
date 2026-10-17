import { formatShare } from '../charts/DonutChart'
import { formatAriary, formatDateTime } from '../../lib/format'

/**
 * Formatage et export communs aux tableaux de bord (admin, recruteur).
 * Jours : clés `AAAA-MM-JJ` du calendrier de Madagascar (UTC+3) fournies par
 * le serveur (`seriesDays`) ; on les affiche à midi UTC pour qu'aucun fuseau
 * du navigateur ne décale la date.
 */

/** Effectifs sur les 7 derniers jours glissants et les 7 précédents. */
export interface WeekCounts {
  last7: number
  prev7: number
}

/** Espace fine insécable (U+202F, séparateur de milliers fr-FR) → espace
 *  insécable classique : la police n'a pas toujours le glyphe U+202F. */
export const nbsp = (text: string) => text.replace(/ /g, ' ')
export const fmt = (n: number) => nbsp(n.toLocaleString('fr-FR'))
export const ariary = (n: number) => nbsp(formatAriary(n))
export const plural = (n: number, one: string, many: string) => `${fmt(n)} ${n > 1 ? many : one}`

/** « 12,5 % », ou « — » sans valeur. */
export const formatPercent = (value: number | null) => (value === null ? '—' : `${value.toLocaleString('fr-FR')} %`)

/** Part lisible d'un total (« 37 % »), « — » quand le total est nul. */
export function percent(part: number, total: number): string {
  return total > 0 ? formatShare(part, total) : '—'
}

function dayDate(key: string) {
  return new Date(`${key}T12:00:00Z`)
}
export function shortDay(key: string) {
  return dayDate(key).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', timeZone: 'UTC' })
}
export function longDay(key: string) {
  return dayDate(key).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
}

/**
 * Résumé d'une série quotidienne pour les lecteurs d'écran
 * (`[singulier, pluriel]`, `feminine` accorde « Aucun(e) »).
 */
export function seriesLabel(values: number[], [one, many]: [string, string], days: string[], feminine = true) {
  const total = values.reduce((s, v) => s + v, 0)
  if (total === 0) return `${feminine ? 'Aucune' : 'Aucun'} ${one} sur les ${values.length} derniers jours.`
  const max = Math.max(...values)
  return `${plural(total, one, many)} sur les ${values.length} derniers jours, au plus ${fmt(max)} le ${longDay(days[values.lastIndexOf(max)])}.`
}

/* ------------------------------------------------------------------ */
/* Export CSV (Excel en français : `;`, BOM UTF-8, virgule décimale)    */
/* ------------------------------------------------------------------ */

export type CsvRow = (string | number | null)[]

export function csvCell(value: string | number | null): string {
  if (value === null) return ''
  const text = typeof value === 'number' ? String(value).replace('.', ',') : value
  return /[;"\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/** Document CSV complet : BOM UTF-8, `;`, fins de ligne CRLF. */
export function csvDocument(rows: CsvRow[]): string {
  return '﻿' + rows.map((r) => r.map(csvCell).join(';')).join('\r\n') + '\r\n'
}

/** En-tête commun : titre, « Calculé le … », rappel du calendrier. */
export function csvPreamble(title: string, computedAt: string, note: string): CsvRow[] {
  return [[title, `Calculé le ${formatDateTime(computedAt)}`], [note], []]
}

/** Télécharge `rows` sous `<prefix>-AAAA-MM-JJ_HHhMM.csv` (heure locale du calcul). */
export function downloadCsv(rows: CsvRow[], prefix: string, computedAt: string) {
  const blob = new Blob([csvDocument(rows)], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  // Date et heure locales du calcul (comme « Calculé le … »), pas l'heure UTC.
  const d = new Date(computedAt)
  const pad = (n: number) => String(n).padStart(2, '0')
  const stamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}h${pad(d.getMinutes())}`
  a.href = url
  a.download = `${prefix}-${stamp}.csv`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
