import { useEffect, useMemo, useState } from 'react'
import { matchPath } from 'react-router-dom'
import { BellOff, CheckCheck } from 'lucide-react'
import { NotificationList } from '../../components/notifications/NotificationList'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { useApp } from '../../context/AppContext'
import { NOTIFICATIONS_PAGE_SIZE } from '../../lib/api'
import { NOTIFICATION_CATEGORIES, type NotificationCategory } from '../../types'
import './AdminNotifications.css'

/** Libellés des origines — l'ordre des filtres suit `NOTIFICATION_CATEGORIES`. */
const CATEGORY_LABELS: Record<NotificationCategory, string> = {
  candidat: 'Candidat',
  recruteur: 'Recruteur',
  agent: 'Agent de terrain',
  systeme: 'Système',
  moderation: 'Modération',
  annuaire: 'Annuaire',
}

/** Notifications sans catégorie : antérieures aux catégories, ou personnelles. */
const UNCATEGORIZED_LABEL = 'Autre'

type Filter = 'all' | 'none' | NotificationCategory

/**
 * Écrans vers lesquels une notification de l'admin peut mener — à garder
 * aligné sur les routes de `App.tsx` accessibles au rôle `admin`. Un lien
 * hors de cette liste (ancienne notification, espace d'un autre rôle) ou
 * vide rend la notification non cliquable.
 */
const ADMIN_LINK_PATTERNS = [
  '/admin',
  '/admin/mise-en-relation',
  '/admin/placements',
  '/admin/moderation',
  '/admin/agents',
  '/admin/notifications',
  '/verification-cv',
  '/messages',
  '/annuaire',
  '/annuaire/:id',
  '/offres/:id',
]

function isAdminLink(link: string): boolean {
  if (!link.startsWith('/') || link.startsWith('//')) return false
  const pathname = link.split(/[?#]/)[0]
  return ADMIN_LINK_PATTERNS.some((pattern) => matchPath({ path: pattern, end: true }, pathname) !== null)
}

/**
 * Notifications de l'administrateur : l'activité de la plateforme (candidats,
 * recruteurs, agents de terrain, moteur de matching, signalements) telle que
 * `notifyAdmins()` la sélectionne côté serveur. Filtres appliqués sur la
 * liste déjà chargée par `AppContext` — les compteurs restent ceux de
 * l'ensemble, quel que soit le filtre affiché.
 */
export function AdminNotifications() {
  const { notifications, markNotificationRead, markAllNotificationsRead, refreshNotifications } = useApp()
  const [filter, setFilter] = useState<Filter>('all')
  const [unreadOnly, setUnreadOnly] = useState(false)

  // La liste du contexte date de la connexion ou du dernier retour sur
  // l'onglet : on la rafraîchit à l'ouverture de la page.
  useEffect(() => {
    void refreshNotifications()
  }, [refreshNotifications])

  const unreadByFilter = useMemo(() => {
    const counts: Record<Filter, number> = {
      all: 0,
      none: 0,
      candidat: 0,
      recruteur: 0,
      agent: 0,
      systeme: 0,
      moderation: 0,
      annuaire: 0,
    }
    for (const n of notifications) {
      if (n.read) continue
      counts.all += 1
      counts[n.category ?? 'none'] += 1
    }
    return counts
  }, [notifications])

  const hasUncategorized = useMemo(() => notifications.some((n) => !n.category), [notifications])

  const filters: { key: Filter; label: string }[] = [
    { key: 'all', label: 'Toutes' },
    ...NOTIFICATION_CATEGORIES.map((category) => ({ key: category as Filter, label: CATEGORY_LABELS[category] })),
    // Affiché seulement s'il y a quelque chose à y trouver.
    ...(hasUncategorized ? [{ key: 'none' as Filter, label: UNCATEGORIZED_LABEL }] : []),
  ]
  // Le filtre « Autre » peut disparaître après un rechargement : on retombe sur « Toutes ».
  const activeFilter: Filter = filter === 'none' && !hasUncategorized ? 'all' : filter

  const visible = notifications.filter(
    (n) =>
      (activeFilter === 'all' || (activeFilter === 'none' ? !n.category : n.category === activeFilter)) &&
      (!unreadOnly || !n.read),
  )

  const totalUnread = unreadByFilter.all
  const filtered = activeFilter !== 'all' || unreadOnly

  return (
    <div className="page">
      <div className="container">
        <header className="page-header">
          <p className="eyebrow">Administration</p>
          <h1>Notifications</h1>
          <p>
            L’activité de la plateforme qui demande votre attention : candidats, recruteurs, agents de terrain,
            moteur de matching et signalements. Chaque notification ouvre l’écran où agir.
          </p>
        </header>

        {notifications.length === 0 ? (
          <EmptyState
            icon={BellOff}
            title="Aucune notification"
            description="Vous serez prévenu ici dès qu’un candidat, un recruteur ou un agent de terrain agira sur la plateforme, ou que le moteur de matching aura des suggestions à valider."
          />
        ) : (
          <>
            <div className="anotif-bar">
              <span className="anotif-count" aria-live="polite">
                {totalUnread === 0 ? 'Tout est lu' : `${totalUnread} non lue${totalUnread > 1 ? 's' : ''}`}
              </span>
              <div className="anotif-actions">
                <label className="anotif-toggle">
                  <input type="checkbox" checked={unreadOnly} onChange={(e) => setUnreadOnly(e.target.checked)} />
                  Non lues uniquement
                </label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void markAllNotificationsRead()}
                  disabled={totalUnread === 0}
                >
                  <CheckCheck size={16} aria-hidden />
                  Tout marquer comme lu
                </Button>
              </div>
            </div>

            <div className="anotif-filters" role="group" aria-label="Filtrer par origine">
              {filters.map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  className={`chip anotif-filter ${activeFilter === key ? 'active' : ''}`.trim()}
                  aria-pressed={activeFilter === key}
                  onClick={() => setFilter(key)}
                >
                  {label}
                  {unreadByFilter[key] > 0 && (
                    <span
                      className="anotif-filter-count"
                      aria-label={`${unreadByFilter[key]} non lue${unreadByFilter[key] > 1 ? 's' : ''}`}
                    >
                      {unreadByFilter[key]}
                    </span>
                  )}
                </button>
              ))}
            </div>

            <NotificationList
              notifications={visible}
              onRead={markNotificationRead}
              isKnownLink={isAdminLink}
              categoryLabels={CATEGORY_LABELS}
              uncategorizedLabel={UNCATEGORIZED_LABEL}
              withTime
              emptyTitle={unreadOnly ? 'Aucune notification non lue' : 'Aucune notification dans cette catégorie'}
              emptyDescription={
                filtered
                  ? 'Rien ne correspond aux filtres choisis. Élargissez la sélection pour retrouver les autres notifications.'
                  : 'Aucune notification pour l’instant.'
              }
            />

            {notifications.length >= NOTIFICATIONS_PAGE_SIZE && (
              <p className="anotif-limit">
                Les {NOTIFICATIONS_PAGE_SIZE} notifications les plus récentes sont affichées.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
