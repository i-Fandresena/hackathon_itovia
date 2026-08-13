import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Bell, HelpCircle, TrendingUp } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { formatAriary, formatMonth } from '../../lib/format'
import './RightRail.css'

/**
 * Rail droit. Il ne sert pas de décoration : chaque panneau pousse vers
 * l'action qui manque le plus au produit à ce stade — vérifier les fiches
 * fragiles et alimenter les prix constatés.
 */
export function RightRail() {
  const { notifications, currentUserId, providers, recommendations } = useApp()

  const recentNotifications = useMemo(
    () =>
      notifications
        .filter((n) => n.userId === currentUserId)
        .slice(0, 3),
    [notifications, currentUserId],
  )

  /** Fiches reposant sur 0 ou 1 retour : ce sont les trous de l'annuaire. */
  const toConfirm = useMemo(() => {
    const authorsByProvider = new Map<string, Set<string>>()
    for (const rec of recommendations) {
      const set = authorsByProvider.get(rec.providerId) ?? new Set()
      set.add(rec.authorMemberId)
      authorsByProvider.set(rec.providerId, set)
    }
    return providers
      .map((p) => ({ provider: p, count: authorsByProvider.get(p.id)?.size ?? 0 }))
      .filter((p) => p.count <= 1)
      .sort((a, b) => b.count - a.count)
      .slice(0, 4)
  }, [providers, recommendations])

  const recentPrices = useMemo(() => {
    const byId = new Map(providers.map((p) => [p.id, p]))
    return recommendations
      .filter((r) => typeof r.pricePaid === 'number' && r.priceUnit)
      .sort((a, b) => Date.parse(b.jobDate) - Date.parse(a.jobDate))
      .slice(0, 4)
      .map((r) => ({ rec: r, provider: byId.get(r.providerId) }))
      .filter((x) => x.provider)
  }, [providers, recommendations])

  return (
    <aside className="rail">
      <section className="rail-card">
        <header className="rail-head">
          <Bell size={15} aria-hidden />
          <h2>Notifications</h2>
        </header>
        {recentNotifications.length === 0 ? (
          <p className="rail-empty">Rien de nouveau.</p>
        ) : (
          <ul className="rail-notifs">
            {recentNotifications.map((n) => (
              <li key={n.id} className={n.read ? '' : 'unread'}>
                <strong>{n.title}</strong>
                <span>{n.message}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rail-card">
        <header className="rail-head">
          <HelpCircle size={15} aria-hidden />
          <h2>À confirmer</h2>
        </header>
        <p className="rail-note">
          Ces fiches reposent sur un seul avis, ou aucun. Un deuxième retour les
          rend exploitables.
        </p>
        {toConfirm.length === 0 ? (
          <p className="rail-empty">Toutes les fiches sont confirmées.</p>
        ) : (
          <ul className="rail-list">
            {toConfirm.map(({ provider, count }) => (
              <li key={provider.id}>
                <Link to={`/annuaire/${provider.id}`}>
                  <span className="rail-item-name">{provider.name}</span>
                  <span className="rail-item-sub">
                    {provider.trade} · {provider.district}
                  </span>
                </Link>
                <span className={`rail-tag ${count === 0 ? 'rail-tag-empty' : ''}`}>
                  {count === 0 ? 'aucun avis' : '1 avis'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {recentPrices.length > 0 && (
        <section className="rail-card">
          <header className="rail-head">
            <TrendingUp size={15} aria-hidden />
            <h2>Derniers prix constatés</h2>
          </header>
          <ul className="rail-list">
            {recentPrices.map(({ rec, provider }) => (
              <li key={rec.id}>
                <Link to={`/annuaire/${rec.providerId}`}>
                  <span className="rail-item-name">
                    {formatAriary(rec.pricePaid!)} {rec.priceUnit}
                  </span>
                  <span className="rail-item-sub">
                    {provider!.name} · {formatMonth(rec.jobDate)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </aside>
  )
}
