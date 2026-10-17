import { useMemo, useState, type FormEvent } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { Menu as MenuIcon, Search, X } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { PageMotion } from '../motion/Motion'
import { Logo } from '../brand/Logo'
import { ThemeToggle } from '../ui/ThemeToggle'
import { Sidebar, countInterviewBadge, getLinksByRole } from './Sidebar'
import { TabBar, type TabBarItem } from './TabBar'
import './AppShell.css'

/**
 * Coquille de l'espace connecté : barre haute (logo, recherche, bascule de
 * thème), puis un conteneur centré en deux colonnes — carte latérale de
 * navigation et contenu. Sous 1024 px la carte latérale devient un panneau
 * coulissant ouvert par l'onglet « Menu » de la barre d'onglets.
 */
export function AppShell() {
  const { logout, currentUser, unreadCount, receivedSuggestions, mySuggestions } = useApp()
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
  const canVerifyCv = currentUser?.canVerifyCv === true
  const interviewsToHandle = countInterviewBadge(role, receivedSuggestions, mySuggestions)
  const tabItems: TabBarItem[] = useMemo(() => {
    const allLinks = getLinksByRole(role, unreadCount, canVerifyCv, interviewsToHandle)
    // Les entrées `menuOnly` restent sous « Menu » (leur pastille compte dans la sienne).
    const primary = allLinks.filter((l) => !l.menuOnly).slice(0, 4)
    const hiddenBadgeTotal = allLinks
      .filter((l) => !primary.includes(l))
      .reduce((sum, l) => sum + (l.badge ?? 0), 0)
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
  }, [role, unreadCount, menuOpen, canVerifyCv, interviewsToHandle])

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

          <ThemeToggle className="shell-theme-toggle" />
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
      </div>

      <TabBar items={tabItems} />
    </div>
  )
}
