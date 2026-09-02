import { useMemo, useState, type FormEvent } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { Menu as MenuIcon, Search, X } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { PageMotion } from '../motion/Motion'
import { Logo } from '../brand/Logo'
import { RightRail } from './RightRail'
import { Sidebar, getLinksByRole } from './Sidebar'
import { TabBar, type TabBarItem } from './TabBar'
import './AppShell.css'

/**
 * Coquille de l'espace connecté : rail de navigation, colonne centrale, rail
 * contextuel. Sous 1320 px le rail droit disparaît, sous 1024 px le rail
 * gauche devient un panneau coulissant.
 */
export function AppShell() {
  const { logout, currentUser, unreadCount } = useApp()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [query, setQuery] = useState('')

  const handleLogout = async () => {
    await logout()
    setMenuOpen(false)
    navigate('/')
  }

  const handleSearch = (e: FormEvent) => {
    e.preventDefault()
    const q = query.trim()
    navigate(q ? `/annuaire?q=${encodeURIComponent(q)}` : '/annuaire')
    setMenuOpen(false)
  }

  const role = currentUser?.role ?? 'candidate'
  const tabItems: TabBarItem[] = useMemo(() => {
    const allLinks = getLinksByRole(role, unreadCount)
    const primary = allLinks.slice(0, 4)
    const hiddenBadgeTotal = allLinks.slice(4).reduce((sum, l) => sum + (l.badge ?? 0), 0)
    return [
      ...primary.map((l) => ({ key: l.to, label: l.label, icon: l.icon, to: l.to, end: l.end, badge: l.badge })),
      {
        key: 'menu',
        label: 'Menu',
        icon: MenuIcon,
        active: menuOpen,
        badge: hiddenBadgeTotal,
        onClick: () => setMenuOpen(true),
      },
    ]
  }, [role, unreadCount, menuOpen])

  return (
    <div className="shell">
      <header className="shell-top">
        <div className="shell-top-inner">
          <Logo to="/" />

          <form className="shell-search" onSubmit={handleSearch} role="search">
            <Search size={17} aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Chercher un artisan, un fournisseur, un métier…"
              aria-label="Rechercher dans l’annuaire"
            />
          </form>
        </div>
      </header>

      <div className="shell-body">
        <div className={`shell-side ${menuOpen ? 'open' : ''}`}>
          <div className="shell-side-head">
            <span>Navigation</span>
            <button
              type="button"
              onClick={() => setMenuOpen(false)}
              aria-label="Fermer le menu"
            >
              <X size={18} />
            </button>
          </div>
          <Sidebar onNavigate={() => setMenuOpen(false)} onLogout={handleLogout} />
        </div>

        {menuOpen && (
          <button
            type="button"
            className="shell-scrim"
            onClick={() => setMenuOpen(false)}
            aria-label="Fermer le menu"
          />
        )}

        <main className="shell-main">
          <PageMotion>
            <Outlet />
          </PageMotion>
        </main>

        <div className="shell-rail">
          <RightRail />
        </div>
      </div>

      <TabBar items={tabItems} />
    </div>
  )
}
