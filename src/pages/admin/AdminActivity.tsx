import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowRight, History, Search, X } from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { Input, Select } from '../../components/ui/Form'
import { Loading } from '../../components/ui/Loading'
import {
  apiAdminActivity,
  type AdminActivityFamily,
  type AdminActivityItem,
  type AdminActivityPage,
} from '../../lib/api'
import { ROLE_LABELS } from '../../lib/roles'
import type { UserRole } from '../../types'
import './AdminActivity.css'

const PAGE_SIZE = 50

const FAMILY_KEYS: AdminActivityFamily[] = [
  'comptes',
  'candidats',
  'matching',
  'recruteurs',
  'talents',
  'recommandations',
  'entreprises',
  'moderation',
  'placements',
  'administration',
  'autre',
]

const ROLES = Object.keys(ROLE_LABELS) as UserRole[]

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

/** `YYYY-MM-DD` (jour local) → minuit local du jour, décalé de `addDays`, en ISO. */
function localDayIso(value: string, addDays = 0): string | null {
  const m = DATE_PATTERN.exec(value)
  if (!m) return null
  const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + addDays)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}

function dayLabel(date: Date): string {
  const today = new Date()
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1)
  if (dayKey(date) === dayKey(today)) return 'Aujourd’hui'
  if (dayKey(date) === dayKey(yesterday)) return 'Hier'
  const text = date.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: date.getFullYear() === today.getFullYear() ? undefined : 'numeric',
  })
  // « jeudi 1 janvier » → « jeudi 1er janvier ».
  const ordinal = text.replace(/ 1 (?=\D)/, ' 1er ')
  return ordinal.charAt(0).toUpperCase() + ordinal.slice(1)
}

function timeLabel(date: Date): string {
  return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

/** Regroupe les lignes (déjà triées, plus récentes d'abord) par jour local. */
function groupByDay(items: AdminActivityItem[]) {
  const groups: { key: string; label: string; items: AdminActivityItem[] }[] = []
  for (const item of items) {
    const date = new Date(item.createdAt)
    const key = dayKey(date)
    const last = groups[groups.length - 1]
    if (last && last.key === key) last.items.push(item)
    else groups.push({ key, label: dayLabel(date), items: [item] })
  }
  return groups
}

/**
 * Journal d'activité de la plateforme (consultation) : toutes les actions
 * journalisées, groupées par jour, avec filtres reflétés dans l'URL
 * (`?famille=&role=&acteur=&du=&au=&systeme=1`) pour être partagées et
 * conservées au rechargement. Libellés et phrases viennent du serveur
 * (`server/src/lib/activity.ts`) — aucune table de libellés ici. Chaque
 * ligne renvoie vers l'écran admin concerné quand il existe.
 */
export function AdminActivity() {
  const [searchParams, setSearchParams] = useSearchParams()

  const familyParam = searchParams.get('famille')
  const family = FAMILY_KEYS.includes(familyParam as AdminActivityFamily) ? (familyParam as AdminActivityFamily) : null
  const roleParam = searchParams.get('role')
  const role = ROLES.includes(roleParam as UserRole) ? (roleParam as UserRole) : null
  const actor = (searchParams.get('acteur') ?? '').trim().slice(0, 80)
  const du = searchParams.get('du') ?? ''
  const au = searchParams.get('au') ?? ''
  const system = searchParams.get('systeme') === '1'

  const from = du ? localDayIso(du) : null
  // « au » est inclusif côté écran : la borne envoyée est le lendemain à minuit (exclue).
  const to = au ? localDayIso(au, 1) : null
  const periodError =
    (du && !from) || (au && !to)
      ? 'Date invalide.'
      : from && to && Date.parse(from) >= Date.parse(to)
        ? 'La date de début doit précéder la date de fin.'
        : ''

  const [search, setSearch] = useState(actor)
  const [page, setPage] = useState<AdminActivityPage | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [moreLoading, setMoreLoading] = useState(false)
  const [moreError, setMoreError] = useState('')
  const request = useRef(0)

  /** Met à jour un paramètre de l'URL (vide = retiré), sans empiler l'historique pour la saisie. */
  const setParam = useCallback(
    (key: string, value: string | null, replace = false) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          if (value) next.set(key, value)
          else next.delete(key)
          return next
        },
        { replace },
      )
    },
    [setSearchParams],
  )

  /** Dernière valeur écrite dans l'URL par la saisie (pour ne pas écraser une frappe en cours). */
  const pushedActor = useRef(actor)

  // Recherche différée : l'URL (donc la requête) suit la saisie quand elle s'arrête.
  useEffect(() => {
    const value = search.trim()
    if (value === actor) return
    const timer = window.setTimeout(() => {
      pushedActor.current = value
      setParam('acteur', value || null, true)
    }, 300)
    return () => window.clearTimeout(timer)
  }, [search, actor, setParam])

  // URL modifiée de l'extérieur (retour arrière, lien partagé, réinitialisation) : le champ suit.
  useEffect(() => {
    if (actor === pushedActor.current) return
    pushedActor.current = actor
    setSearch(actor)
  }, [actor])

  const query = useMemo(
    () => ({
      family: family ?? undefined,
      role: role ?? undefined,
      q: actor || undefined,
      from: from ?? undefined,
      to: to ?? undefined,
      system,
      limit: PAGE_SIZE,
    }),
    [family, role, actor, from, to, system],
  )

  const load = useCallback(() => {
    const id = ++request.current
    setMoreError('')
    if (periodError) {
      setLoading(false)
      setError('')
      return
    }
    setLoading(true)
    setError('')
    apiAdminActivity(query)
      .then((result) => {
        if (id === request.current) setPage(result)
      })
      .catch(() => {
        if (id === request.current) setError('Impossible de charger le journal d’activité.')
      })
      .finally(() => {
        if (id === request.current) setLoading(false)
      })
  }, [query, periodError])

  useEffect(load, [load])

  const loadMore = async () => {
    if (!page?.nextCursor) return
    const id = request.current
    setMoreLoading(true)
    setMoreError('')
    try {
      const next = await apiAdminActivity({ ...query, cursor: page.nextCursor })
      if (id !== request.current) return
      setPage({ ...next, items: [...page.items, ...next.items] })
    } catch {
      if (id === request.current) setMoreError('Impossible de charger la suite du journal.')
    } finally {
      setMoreLoading(false)
    }
  }

  const hasFilters = Boolean(family || role || actor || du || au || system)
  const resetFilters = () => {
    pushedActor.current = ''
    setSearch('')
    setSearchParams({})
  }

  const familyLabel = (key: AdminActivityFamily) => page?.families.find((f) => f.key === key)?.label ?? ''
  const groups = page ? groupByDay(page.items) : []

  return (
    <div className="page">
      <div className="container">
        <header className="page-header">
          <p className="eyebrow">Administration</p>
          <h1>Activité</h1>
          <p>
            Journal des actions enregistrées sur la plateforme : comptes, candidats, mise en relation, talents,
            recommandations, entreprises, modération… Page de consultation : chaque ligne mène à l’écran concerné.
          </p>
        </header>

        <section className="aact-filters" aria-label="Filtres du journal">
          <div className="aact-toolbar">
            <label className="aact-search">
              <Search size={16} aria-hidden />
              <Input
                type="search"
                placeholder="Acteur : nom, entreprise ou email"
                aria-label="Rechercher un acteur"
                value={search}
                maxLength={80}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            <Select
              aria-label="Rôle de l’acteur"
              value={role ?? ''}
              onChange={(e) => setParam('role', e.target.value || null)}
            >
              <option value="">Tous les rôles</option>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </Select>
            <div className="aact-period" role="group" aria-label="Période">
              <label className="aact-date">
                <span>Du</span>
                <Input
                  type="date"
                  value={du}
                  max={au || undefined}
                  onChange={(e) => setParam('du', e.target.value || null)}
                />
              </label>
              <label className="aact-date">
                <span>au</span>
                <Input
                  type="date"
                  value={au}
                  min={du || undefined}
                  onChange={(e) => setParam('au', e.target.value || null)}
                />
              </label>
            </div>
          </div>

          <div className="aact-options">
            <label className="aact-toggle">
              <input type="checkbox" checked={system} onChange={(e) => setParam('systeme', e.target.checked ? '1' : null)} />
              Inclure les événements système (matching automatique, envois de notifications, purges)
            </label>
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={resetFilters}>
                <X size={16} aria-hidden />
                Réinitialiser les filtres
              </Button>
            )}
          </div>

          <div className="aact-families" role="group" aria-label="Famille d’activité">
            <button
              type="button"
              className={`chip aact-family-chip ${family === null ? 'active' : ''}`}
              aria-pressed={family === null}
              onClick={() => setParam('famille', null)}
            >
              Toutes
              {page && <span className="aact-count">{page.allCount}</span>}
            </button>
            {page?.families.map((f) => (
              <button
                key={f.key}
                type="button"
                className={`chip aact-family-chip ${family === f.key ? 'active' : ''}`}
                aria-pressed={family === f.key}
                onClick={() => setParam('famille', family === f.key ? null : f.key)}
              >
                {f.label}
                <span className="aact-count">{f.count}</span>
              </button>
            ))}
          </div>
        </section>

        {periodError ? (
          <p className="aact-error-line" role="alert">
            {periodError}
          </p>
        ) : error && !page ? (
          <div className="aact-error">
            <p>{error}</p>
            <Button size="sm" onClick={load}>
              Réessayer
            </Button>
          </div>
        ) : !page ? (
          <Loading />
        ) : page.items.length === 0 ? (
          <EmptyState
            icon={History}
            title={hasFilters ? 'Aucun résultat' : 'Aucune activité journalisée'}
            description={
              hasFilters
                ? 'Aucune action ne correspond à ces filtres. Élargissez la période ou retirez un filtre.'
                : 'Les actions des comptes, des agents et de l’administration apparaîtront ici.'
            }
          />
        ) : (
          <>
            <p className="aact-result-line" aria-live="polite">
              {page.total} action{page.total > 1 ? 's' : ''}
              {page.items.length < page.total ? ` · ${page.items.length} affichée${page.items.length > 1 ? 's' : ''}` : ''}
              {loading ? ' · mise à jour…' : ''}
            </p>
            {error && <p className="aact-error-line">{error}</p>}
            <div className={`aact-feed${loading ? ' aact-feed-loading' : ''}`} aria-busy={loading}>
              {groups.map((g) => (
                <section key={g.key} className="aact-day" aria-label={g.label}>
                  <h2 className="aact-day-title">{g.label}</h2>
                  <ol className="aact-list">
                    {g.items.map((item) => (
                      <ActivityRow key={item.id} item={item} familyLabel={familyLabel(item.family)} />
                    ))}
                  </ol>
                </section>
              ))}
            </div>
            {moreError && <p className="aact-error-line">{moreError}</p>}
            {page.nextCursor && (
              <div className="aact-more">
                <Button variant="outline" size="sm" disabled={moreLoading || loading} onClick={loadMore}>
                  {moreLoading ? 'Chargement…' : `Afficher plus (${page.total - page.items.length} restantes)`}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function ActivityRow({ item, familyLabel }: { item: AdminActivityItem; familyLabel: string }) {
  const date = new Date(item.createdAt)
  return (
    <li className="aact-item">
      <time className="aact-time" dateTime={item.createdAt} title={date.toLocaleString('fr-FR')}>
        {timeLabel(date)}
      </time>
      <div className="aact-body">
        <p className="aact-line">
          <strong className="aact-label">{item.label}</strong>
          {item.detail && <span className="aact-detail"> — {item.detail}</span>}
        </p>
        <p className="aact-meta">
          <span className={`aact-tag aact-tag-${item.family}`}>{familyLabel}</span>
          {item.system && <Badge variant="muted">Système</Badge>}
          <span className="aact-actor">
            {item.actor ? (
              <>
                par{' '}
                {item.actor.link ? (
                  <Link to={item.actor.link}>{item.actor.displayName}</Link>
                ) : (
                  <span className="aact-actor-name">{item.actor.displayName}</span>
                )}
                <span className="aact-sep"> · </span>
                {ROLE_LABELS[item.actor.role] ?? item.actor.role}
                <span className="aact-sep"> · </span>
                <span className="aact-email">{item.actor.email}</span>
              </>
            ) : item.actorMasked ? (
              'Auteur protégé'
            ) : (
              'Plateforme (automatique)'
            )}
          </span>
        </p>
        {(item.target || item.link) && (
          <p className="aact-target">
            {item.target && <span className="aact-target-label">{item.target.label}</span>}
            {item.link && (
              <Link to={item.link} className="aact-open">
                Ouvrir
                <ArrowRight size={14} aria-hidden />
              </Link>
            )}
          </p>
        )}
      </div>
    </li>
  )
}
