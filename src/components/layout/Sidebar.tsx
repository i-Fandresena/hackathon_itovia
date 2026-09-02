import { useMemo } from 'react'
import { NavLink } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  AlertTriangle,
  Bell,
  Bookmark,
  Briefcase,
  ClipboardCheck,
  CreditCard,
  FilePlus2,
  Handshake,
  Inbox,
  LayoutDashboard,
  LogOut,
  MessageCircle,
  Search,
  ShieldCheck,
  Store,
  UserPlus,
  UserRound,
  Users,
  Wrench,
} from 'lucide-react'
import { useApp } from '../../context/AppContext'
import type { UserRole } from '../../types'
import './Sidebar.css'

interface SidebarProps {
  onNavigate?: () => void
  onLogout: () => void
}

const ROLE_LABELS: Record<UserRole, string> = {
  candidate: 'Candidat',
  recruiter: 'Recruteur',
  particulier: 'Particulier',
  admin: 'Administrateur',
  agent: 'Agent de terrain',
  talent: 'Compte de suivi',
}

/**
 * Source unique des liens de nav par rôle — utilisée par le rail complet
 * (`Sidebar`) et par la barre d'onglets mobile (`TabBar` dans `AppShell`,
 * qui n'en affiche que les 4 premiers + un onglet « Menu » ouvrant ce même
 * rail). Ne pas dupliquer cette liste ailleurs.
 */
export function getLinksByRole(
  role: UserRole,
  unreadCount: number,
): { to: string; label: string; icon: typeof LayoutDashboard; end?: boolean; badge?: number }[] {
  const LINKS_BY_ROLE: Record<
    UserRole,
    { to: string; label: string; icon: typeof LayoutDashboard; end?: boolean; badge?: number }[]
  > = {
    recruiter: [
      { to: '/recruteur', label: 'Tableau de bord', icon: LayoutDashboard, end: true },
      { to: '/recruteur/publier', label: 'Publier une offre', icon: FilePlus2 },
      { to: '/recruteur/offres', label: 'Mes offres', icon: Briefcase },
      { to: '/recruteur/candidatures', label: 'Candidats proposés', icon: Users },
      { to: '/recruteur/placements', label: 'Placements', icon: ClipboardCheck },
      { to: '/messages', label: 'Messages', icon: MessageCircle },
      { to: '/recruteur/abonnement', label: 'Abonnement', icon: CreditCard },
      { to: '/annuaire', label: 'Annuaire', icon: Store },
    ],
    candidate: [
      { to: '/candidat', label: 'Tableau de bord', icon: LayoutDashboard, end: true },
      { to: '/annuaire', label: 'Annuaire', icon: Store },
      { to: '/candidat/offres', label: 'Offres', icon: Briefcase },
      { to: '/candidat/favoris', label: 'Favoris', icon: Bookmark },
      { to: '/messages', label: 'Messages', icon: MessageCircle },
      { to: '/candidat/notifications', label: 'Notifications', icon: Bell, badge: unreadCount },
      { to: '/candidat/profil', label: 'Profil', icon: UserRound },
    ],
    particulier: [
      { to: '/particulier', label: 'Tableau de bord', icon: LayoutDashboard, end: true },
      { to: '/annuaire', label: 'Rechercher un pro', icon: Search },
      { to: '/messages', label: 'Messages', icon: MessageCircle },
    ],
    admin: [
      { to: '/admin', label: 'Tableau de bord', icon: ShieldCheck, end: true },
      { to: '/admin/mise-en-relation', label: 'Mise en relation', icon: Handshake },
      { to: '/admin/moderation', label: 'Modération', icon: AlertTriangle },
      { to: '/admin/agents', label: 'Agents de terrain', icon: UserPlus },
      { to: '/annuaire', label: 'Annuaire', icon: Store },
      { to: '/messages', label: 'Messages', icon: MessageCircle },
    ],
    agent: [
      { to: '/agent', label: 'Tableau de bord', icon: LayoutDashboard, end: true },
      { to: '/agent/leads', label: 'Demandes de contact', icon: Inbox },
      { to: '/agent/talents/nouveau', label: 'Nouveau talent', icon: ClipboardCheck },
      { to: '/messages', label: 'Messages', icon: MessageCircle },
    ],
    talent: [
      { to: '/mon-espace', label: 'Mon espace', icon: LayoutDashboard, end: true },
      { to: '/messages', label: 'Messages', icon: MessageCircle },
    ],
  }
  return LINKS_BY_ROLE[role]
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
    members,
    opportunities,
    bookmarks,
    unreadCount,
  } = useApp()

  const role = currentUser?.role ?? 'candidate'
  const displayName =
    currentUser?.candidateProfile?.fullName ??
    currentUser?.recruiterProfile?.companyName ??
    currentUser?.individualProfile?.fullName ??
    currentUser?.email ??
    'Membre'
  const city =
    currentUser?.candidateProfile?.city ??
    currentUser?.recruiterProfile?.city ??
    currentUser?.individualProfile?.city

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

  const links = getLinksByRole(role, unreadCount)

  return (
    <div className="side">
      <div className="side-profile">
        <span className="side-avatar" aria-hidden>
          {displayName.charAt(0)}
        </span>
        <p className="side-name">{displayName}</p>
        <p className="side-role">
          {ROLE_LABELS[role]}
          {city ? ` · ${city}` : ''}
        </p>
        <div className="side-stats">
          <div>
            <strong>{contributions}</strong>
            <span>retours</span>
          </div>
          <div>
            <strong>
              {role === 'recruiter'
                ? opportunities.length
                : role === 'candidate'
                  ? bookmarks.length
                  : members.length}
            </strong>
            <span>
              {role === 'recruiter' ? 'offres' : role === 'candidate' ? 'favoris' : 'membres'}
            </span>
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
            {({ isActive }) => (
              <>
                {isActive && (
                  <motion.span
                    layoutId="sidebar-active-pill"
                    className="side-nav-pill"
                    transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                  />
                )}
                <l.icon size={18} aria-hidden />
                <span>{l.label}</span>
                {'badge' in l && l.badge ? (
                  <span className="side-badge">{l.badge}</span>
                ) : null}
              </>
            )}
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
