import { useEffect, useRef, useState } from 'react'
import { NavLink, Navigate, Outlet, useLocation } from 'react-router-dom'
import { Building2, ListChecks, Sparkles, Store, type LucideIcon } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { TALENT_RECOMMENDER_ROLES } from '../../lib/roles'
import './DirectoryTabs.css'

interface DirectoryTab {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
}

const PUBLIC_TABS: DirectoryTab[] = [
  { to: '/annuaire', label: 'Professionnels', icon: Store, end: true },
  { to: '/annuaire/talents', label: 'Talents recommandés', icon: Sparkles },
  { to: '/annuaire/entreprises', label: 'Entreprises recommandées', icon: Building2 },
]

const MINE_TAB: DirectoryTab = { to: '/annuaire/mes-recommandations', label: 'Mes recommandations', icon: ListChecks }

/**
 * L'Annuaire est le point d'entrée unique de l'affichage des
 * recommandations : professionnels de la construction, talents et
 * entreprises recommandés, et — pour les rôles qui peuvent recommander —
 * leurs propres recommandations. Chaque onglet est une sous-route
 * (`/annuaire/talents`…) : partageable, rechargeable, et le retour arrière
 * du navigateur revient à l'onglet précédent. Les fiches et les formulaires
 * restent des pages à part, sous `/annuaire/...`.
 */
export function DirectoryTabs() {
  const { currentUser } = useApp()
  const { pathname } = useLocation()
  const navRef = useRef<HTMLElement>(null)
  // Sur mobile la rangée défile : un fondu signale les onglets hors champ.
  const [edges, setEdges] = useState({ left: false, right: false })
  const tabs =
    currentUser && TALENT_RECOMMENDER_ROLES.includes(currentUser.role) ? [...PUBLIC_TABS, MINE_TAB] : PUBLIC_TABS

  const updateEdges = () => {
    const nav = navRef.current
    if (!nav) return
    const left = nav.scrollLeft > 2
    const right = nav.scrollLeft + nav.clientWidth < nav.scrollWidth - 2
    setEdges((e) => (e.left === left && e.right === right ? e : { left, right }))
  }

  // L'onglet actif reste visible quand la rangée défile (URL partagée ou
  // rechargée sur « Mes recommandations », retour arrière…).
  useEffect(() => {
    const nav = navRef.current
    const active = nav?.querySelector<HTMLElement>('.dtabs-tab.active')
    if (nav && active && nav.scrollWidth > nav.clientWidth) {
      nav.scrollLeft = active.offsetLeft - (nav.clientWidth - active.offsetWidth) / 2
    }
    updateEdges()
  }, [pathname, tabs.length])

  useEffect(() => {
    window.addEventListener('resize', updateEdges)
    return () => window.removeEventListener('resize', updateEdges)
  }, [])

  return (
    <div className="page">
      <div className="container dtabs-page">
        <header className="dtabs-head">
          <p className="eyebrow">Confiance communautaire</p>
          <h1>Annuaire</h1>
          <p>
            Des professionnels, des talents et des entreprises recommandés par celles et ceux qui ont réellement
            travaillé avec eux.
          </p>
        </header>

        <nav
          ref={navRef}
          className={`dtabs-nav ${edges.left ? 'dtabs-fade-left' : ''} ${edges.right ? 'dtabs-fade-right' : ''}`.trim()}
          aria-label="Rubriques de l’annuaire"
          onScroll={updateEdges}
        >
          {tabs.map((t) => (
            <NavLink key={t.to} to={t.to} end={t.end} className="dtabs-tab">
              <t.icon size={16} strokeWidth={1.9} aria-hidden />
              <span>{t.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="dtabs-panel">
          <Outlet />
        </div>
      </div>
    </div>
  )
}

/**
 * Anciennes adresses (`/talents`, `/talents/:ref`, `/entreprises`,
 * `/entreprises/:id`, `/mes-recommandations`, `/recommander-un-talent`,
 * `/recommander-une-entreprise`) : elles vivent désormais sous `/annuaire`
 * avec le même chemin. Filtres (`?metier=…`) et ancre (`#mes-demandes`,
 * lien des notifications) sont conservés.
 */
export function LegacyDirectoryRedirect() {
  const { pathname, search, hash } = useLocation()
  return <Navigate to={{ pathname: `/annuaire${pathname}`, search, hash }} replace />
}
