import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CircleCheck,
  Download,
  Minus,
  RefreshCw,
  type LucideIcon,
} from 'lucide-react'
import { Sparkline } from '../charts/Sparkline'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { formatDateTime } from '../../lib/format'
import { fmt, plural, type WeekCounts } from './dashboardFormat'
import './Dashboard.css'

/**
 * Briques communes des tableaux de bord (admin, recruteur), préfixe CSS
 * `odash-` : en-tête « Calculé le … » + Actualiser / Exporter en CSV, cartes
 * indicateurs (pastille teintée, grand chiffre, tendance 7 jours, sparkline
 * 30 jours), liste « À traiter », squelettes et états d'erreur. La grille
 * suit la largeur de la colonne de contenu (requêtes de conteneur sur la
 * racine `.odash`).
 */

export type Tone = 'accent' | 'success' | 'warning' | 'danger' | 'violet' | 'neutral'
export type ChipTone = 'up' | 'down' | 'flat' | 'warning' | 'info'

export interface Kpi {
  id: string
  label: string
  /** Valeur brute (export CSV). */
  value: number | null
  /** Valeur affichée. */
  display: string
  /** Unité de la colonne CSV (« Ar », « % », vide pour un effectif). */
  unit?: string
  icon: LucideIcon
  tone: Tone
  to?: string
  /** Lien d'ancre dans la page (`#…`). */
  anchor?: string
  /** Tendance 7 jours glissants ; `noun` = [singulier, pluriel]. */
  trend?: { counts: WeekCounts; noun: [string, string] }
  chip?: { text: string; tone: ChipTone; label?: string }
  sub?: string
  series?: number[]
  seriesLabel?: string
}

/** Bloc titré de cartes indicateurs. */
export interface KpiSection {
  id: string
  title: string
  subtitle?: string
  kpis: Kpi[]
}

export interface TodoItem {
  id: string
  label: string
  hint: string
  count: number
  icon: LucideIcon
  to?: string
}

export function TrendChip({ counts, noun: [one, many] }: { counts: WeekCounts; noun: [string, string] }) {
  const diff = counts.last7 - counts.prev7
  const tone: ChipTone = diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat'
  const Icon = diff > 0 ? ArrowUpRight : diff < 0 ? ArrowDownRight : Minus
  const signed = diff > 0 ? `+${fmt(diff)}` : diff < 0 ? `−${fmt(-diff)}` : '0'
  const label =
    diff === 0
      ? `Stable : ${fmt(counts.last7)} sur les 7 derniers jours comme les 7 précédents`
      : `${diff > 0 ? 'Hausse' : 'Baisse'} de ${fmt(Math.abs(diff))} : ${fmt(counts.last7)} sur les 7 derniers jours contre ${fmt(counts.prev7)} les 7 précédents`
  return (
    <span className="odash-trend" title={label}>
      <span className={`odash-chip odash-chip-${tone}`} aria-hidden="true">
        <Icon size={13} strokeWidth={2.5} />
        {signed}
      </span>
      <span className="odash-trend-text" aria-hidden="true">
        {plural(counts.last7, one, many)} sur 7 jours
      </span>
      <span className="odash-sr">{label}</span>
    </span>
  )
}

export function KpiCard({ kpi }: { kpi: Kpi }) {
  const Icon = kpi.icon
  const body = (
    <Card className={`odash-kpi odash-tone-${kpi.tone}`} hover={Boolean(kpi.to || kpi.anchor)}>
      <div className="odash-kpi-head">
        <span className="odash-pastille" aria-hidden="true">
          <Icon size={18} strokeWidth={2} />
        </span>
        <span className="odash-kpi-label">{kpi.label}</span>
      </div>
      <div className="odash-kpi-main">
        <strong className={`odash-kpi-value ${kpi.display.length > 7 ? 'is-long' : ''}`.trim()}>{kpi.display}</strong>
        {kpi.series && kpi.seriesLabel && <Sparkline className="odash-kpi-spark" values={kpi.series} label={kpi.seriesLabel} />}
      </div>
      {(kpi.trend || kpi.chip) && (
        <div className="odash-kpi-meta">
          {kpi.trend && <TrendChip counts={kpi.trend.counts} noun={kpi.trend.noun} />}
          {kpi.chip && <span className={`odash-chip odash-chip-${kpi.chip.tone}`}>{kpi.chip.text}</span>}
        </div>
      )}
      {kpi.sub && <p className="odash-kpi-sub">{kpi.sub}</p>}
    </Card>
  )
  if (kpi.to) {
    return (
      <Link to={kpi.to} className="odash-kpi-link">
        {body}
      </Link>
    )
  }
  if (kpi.anchor) {
    return (
      <a href={kpi.anchor} className="odash-kpi-link">
        {body}
      </a>
    )
  }
  return <div className="odash-kpi-static">{body}</div>
}

export function TodoRow({ item }: { item: TodoItem }) {
  const Icon = item.icon
  const content = (
    <>
      <span className={`odash-todo-icon ${item.count > 0 ? 'is-pending' : ''}`} aria-hidden="true">
        {item.count > 0 ? <Icon size={16} /> : <CircleCheck size={16} />}
      </span>
      <span className="odash-todo-text">
        <span className="odash-todo-label">{item.label}</span>
        <span className="odash-todo-hint">{item.hint}</span>
      </span>
      <span className={`odash-todo-count ${item.count > 0 ? 'is-pending' : ''}`}>{fmt(item.count)}</span>
      {item.to && <ArrowRight className="odash-todo-arrow" size={16} aria-hidden />}
    </>
  )
  return (
    <li>
      {item.to ? (
        <Link to={item.to} className="odash-todo-row">
          {content}
        </Link>
      ) : (
        <div className="odash-todo-row">{content}</div>
      )}
    </li>
  )
}

/** Squelette : une grille de `cards` cartes par bloc (`grids` blocs) puis deux panneaux. */
export function DashboardSkeleton({ grids = 2, cards = 6 }: { grids?: number; cards?: number }) {
  return (
    <div className="odash-skeleton" role="status" aria-live="polite">
      <span className="odash-sr">Chargement du tableau de bord…</span>
      {Array.from({ length: grids }, (_, g) => (
        <div key={g} className="odash-skeleton">
          {g > 0 && <div className="odash-skel odash-skel-title" />}
          <div className="odash-grid">
            {Array.from({ length: cards }, (_, i) => (
              <div key={i} className="odash-skel odash-skel-card" />
            ))}
          </div>
        </div>
      ))}
      <div className="odash-charts">
        <div className="odash-skel odash-skel-chart" />
        <div className="odash-skel odash-skel-chart" />
      </div>
    </div>
  )
}

/**
 * En-tête : surtitre, titre, ligne « Calculé le … » (`computed`), puis
 * Actualiser / Exporter en CSV (et d'éventuelles actions en tête, `actions`).
 */
export function DashboardHeader(props: {
  eyebrow: string
  title: string
  computed: ReactNode
  loading: boolean
  hasData: boolean
  onRefresh: () => void
  onExport: () => void
  actions?: ReactNode
}) {
  const { eyebrow, title, computed, loading, hasData, onRefresh, onExport, actions } = props
  return (
    <header className="odash-head">
      <div className="odash-head-text">
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="odash-computed">{computed}</p>
      </div>
      <div className="odash-actions">
        {actions}
        <Button variant="outline" size="sm" onClick={onRefresh} disabled={loading} aria-busy={loading}>
          <RefreshCw size={15} className={loading ? 'odash-spin' : ''} aria-hidden />
          {loading && hasData ? 'Actualisation…' : 'Actualiser'}
        </Button>
        <Button variant="secondary" size="sm" onClick={onExport} disabled={!hasData}>
          <Download size={15} aria-hidden />
          Exporter en CSV
        </Button>
      </div>
    </header>
  )
}

/**
 * Erreurs : carte « Réessayer » tant que rien n'est chargé, bandeau
 * « Actualisation impossible » quand des chiffres plus anciens restent affichés.
 */
export function DashboardErrors({
  error,
  computedAt,
  loading,
  onRetry,
}: {
  error: string
  computedAt: string | null
  loading: boolean
  onRetry: () => void
}) {
  if (!error) return null
  if (!computedAt) {
    return (
      <Card className="odash-error">
        <span className="odash-error-text" role="alert">
          <AlertTriangle size={18} aria-hidden />
          {error}
        </span>
        <Button size="sm" onClick={onRetry} disabled={loading}>
          Réessayer
        </Button>
      </Card>
    )
  }
  return (
    <p className="odash-refresh-error" role="alert">
      <AlertTriangle size={16} aria-hidden />
      Actualisation impossible : les chiffres affichés datent du {formatDateTime(computedAt)}.
      <button type="button" onClick={onRetry}>
        Réessayer
      </button>
    </p>
  )
}

/**
 * Chargement d'indicateurs calculés côté serveur : seule la dernière requête
 * compte (clics répétés sur Actualiser), les chiffres précédents restent
 * affichés si l'actualisation échoue. `validate` renvoie un message quand la
 * réponse ne porte pas les champs attendus (serveur plus ancien que le client).
 */
export function useDashboardData<T>(fetcher: () => Promise<T>, validate: (data: T) => string | null, failure: string) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const request = useRef(0)
  // Fonctions passées en ligne par la page : on garde la dernière sans relancer.
  const deps = useRef({ fetcher, validate, failure })
  deps.current = { fetcher, validate, failure }

  const load = useCallback(() => {
    const id = ++request.current
    setLoading(true)
    setError('')
    deps.current
      .fetcher()
      .then((d) => {
        if (id !== request.current) return
        const invalid = deps.current.validate(d)
        if (invalid) {
          setError(invalid)
          return
        }
        setData(d)
      })
      .catch(() => {
        if (id === request.current) setError(deps.current.failure)
      })
      .finally(() => {
        if (id === request.current) setLoading(false)
      })
  }, [])

  useEffect(load, [load])

  return { data, error, loading, load }
}
