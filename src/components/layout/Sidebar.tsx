import { useMemo } from 'react'
import { NavLink } from 'react-router-dom'
import {
  Bell,
  Bookmark,
  Briefcase,
  FilePlus2,
  LayoutDashboard,
  LogOut,
  Store,
  UserRound,
  Users,
  Wrench,
} from 'lucide-react'
import { useApp } from '../../context/AppContext'
import './Sidebar.css'

interface SidebarProps {
  onNavigate?: () => void
  onLogout: () => void
}

/**
 * Rail de navigation. Il porte aussi la carte de profil et les raccourcis
 * métiers : ce sont les deux entrées les plus utilisées de l'annuaire.
 */
export function Sidebar({ onNavigate, onLogout }: SidebarProps) {
  const {
    currentUser,
    currentMemberId,
    recommendations,
    providers,
    opportunities,
    bookmarks,
    unreadCount,
  } = useApp()

  const isRecruiter = currentUser?.role === 'recruiter'
  const displayName =
    currentUser?.candidateProfile?.fullName ??
    currentUser?.recruiterProfile?.companyName ??
    'Membre'

  const contributions = useMemo(
    () => recommendations.filter((r) => r.authorMemberId === currentMemberId).length,
    [recommendations, currentMemberId],
  )

  /** Les métiers les mieux fournis, pour entrer dans l'annuaire en un clic. */
  const topTrades = useMemo(() => {
    const counts = new Map<string, number>()
    for (const p of providers) counts.set(p.trade, (counts.get(p.trade) ?? 0) + 1)
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
  }, [providers])

  const links = isRecruiter
    ? [
        { to: '/recruteur', label: 'Tableau de bord', icon: LayoutDashboard, end: true },
        { to: '/recruteur/publier', label: 'Publier une offre', icon: FilePlus2 },
        { to: '/recruteur/offres', label: 'Mes offres', icon: Briefcase },
        { to: '/recruteur/candidatures', label: 'Candidatures', icon: Users },
        { to: '/annuaire', label: 'Annuaire', icon: Store },
      ]
    : [
        { to: '/candidat', label: 'Tableau de bord', icon: LayoutDashboard, end: true },
        { to: '/annuaire', label: 'Annuaire', icon: Store },
        { to: '/candidat/offres', label: 'Offres', icon: Briefcase },
        { to: '/candidat/favoris', label: 'Favoris', icon: Bookmark },
        {
          to: '/candidat/notifications',
          label: 'Notifications',
          icon: Bell,
          badge: unreadCount,
        },
        { to: '/candidat/profil', label: 'Profil', icon: UserRound },
      ]

  return (
    <div className="side">
      <div className="side-profile">
        <span className="side-avatar" aria-hidden>
          {displayName.charAt(0)}
        </span>
        <p className="side-name">{displayName}</p>
        <p className="side-role">
          {isRecruiter ? 'Recruteur' : 'Membre'}
          {currentUser?.candidateProfile?.city
            ? ` · ${currentUser.candidateProfile.city}`
            : ''}
        </p>
        <div className="side-stats">
          <div>
            <strong>{contributions}</strong>
            <span>retours</span>
          </div>
          <div>
            <strong>{isRecruiter ? opportunities.length : bookmarks.length}</strong>
            <span>{isRecruiter ? 'offres' : 'favoris'}</span>
          </div>
          <div>
            <strong>{providers.length}</strong>
            <span>fiches</span>
          </div>
        </div>
      </div>

      <nav className="side-nav">
        {links.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            end={'end' in l ? l.end : undefined}
            onClick={onNavigate}
          >
            <l.icon size={18} aria-hidden />
            <span>{l.label}</span>
            {'badge' in l && l.badge ? (
              <span className="side-badge">{l.badge}</span>
            ) : null}
          </NavLink>
        ))}
      </nav>

      {topTrades.length > 0 && (
        <div className="side-section">
          <p className="side-section-title">Métiers</p>
          {topTrades.map(([trade, count]) => (
            <NavLink
              key={trade}
              to={`/annuaire?trade=${encodeURIComponent(trade)}`}
              className="side-trade"
              onClick={onNavigate}
            >
              <Wrench size={14} aria-hidden />
              <span>{trade}</span>
              <span className="side-trade-count">{count}</span>
            </NavLink>
          ))}
        </div>
      )}

      <button type="button" className="side-logout" onClick={onLogout}>
        <LogOut size={16} aria-hidden />
        Déconnexion
      </button>
    </div>
  )
}
