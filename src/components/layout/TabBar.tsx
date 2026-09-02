import { NavLink } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import './TabBar.css'

export interface TabBarItem {
  key: string
  label: string
  icon: LucideIcon
  /** Route SPA : rend un NavLink. */
  to?: string
  end?: boolean
  /** Ancre native (ex. `/#comment-ca-marche`) : rend un `<a>` simple, pas
   *  de routage côté client — nécessaire pour garder le défilement natif
   *  du navigateur vers la section. */
  href?: string
  badge?: number
  /** État actif manuel pour un item bouton. */
  active?: boolean
  onClick?: () => void
}

/**
 * Barre d'onglets fixe en bas de l'écran, mobile/tablette uniquement (voir
 * les points de rupture propres à chaque coquille dans AppShell.css /
 * Header.css) — remplace le hamburger + panneau coulissant : c'est le seul
 * mécanisme de navigation mobile, pas un second en plus du premier.
 */
export function TabBar({ items }: { items: TabBarItem[] }) {
  return (
    <nav className="tab-bar" aria-label="Navigation principale">
      {items.map((item) =>
        item.href ? (
          <a key={item.key} href={item.href} className="tab-bar-item">
            <span className="tab-bar-icon-wrap">
              <item.icon size={20} aria-hidden />
              {!!item.badge && <span className="tab-bar-badge" />}
            </span>
            <span className="tab-bar-label">{item.label}</span>
          </a>
        ) : item.to ? (
          <NavLink key={item.key} to={item.to} end={item.end} className="tab-bar-item">
            {({ isActive }) => (
              <>
                <span className="tab-bar-icon-wrap">
                  <item.icon size={20} aria-hidden />
                  {!!item.badge && <span className="tab-bar-badge" />}
                </span>
                <span className={`tab-bar-label ${isActive ? 'active' : ''}`}>{item.label}</span>
              </>
            )}
          </NavLink>
        ) : (
          <button
            key={item.key}
            type="button"
            className="tab-bar-item"
            onClick={item.onClick}
            aria-pressed={item.active}
          >
            <span className="tab-bar-icon-wrap">
              <item.icon size={20} aria-hidden />
              {!!item.badge && <span className="tab-bar-badge" />}
            </span>
            <span className={`tab-bar-label ${item.active ? 'active' : ''}`}>{item.label}</span>
          </button>
        ),
      )}
    </nav>
  )
}
