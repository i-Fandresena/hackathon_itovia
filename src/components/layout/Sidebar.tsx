import { useMemo, useState } from 'react'
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
  Radar,
  Search,
  ShieldCheck,
  Store,
  UserPlus,
  UserRound,
  Users,
  Wrench,
} from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { ACTIVE_SECTORS, SECTOR_DESCRIPTIONS, SECTOR_LABELS, SECTORS, TRADE_SECTOR } from '../../data/constants'
import type { Sector, UserRole } from '../../types'
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
      { to: '/messages', label: 'Discuter avec OffRec', icon: MessageCircle },
      { to: '/recruteur/abonnement', label: 'Abonnement', icon: CreditCard },
      { to: '/annuaire', label: 'Annuaire', icon: Store },
    ],
    candidate: [
      { to: '/candidat', label: 'Tableau de bord', icon: LayoutDashboard, end: true },
      { to: '/annuaire', label: 'Annuaire', icon: Store },
      { to: '/candidat/offres', label: 'Offres', icon: Briefcase },
      { to: '/candidat/favoris', label: 'Favoris', icon: Bookmark },
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
      { to: '/admin/placements', label: 'Placements', icon: ClipboardCheck },
      { to: '/admin/moderation', label: 'Modération', icon: AlertTriangle },
      { to: '/admin/agents', label: 'Agents de terrain', icon: UserPlus },
      { to: '/annuaire', label: 'Annuaire', icon: Store },
      { to: '/messages', label: 'Messages', icon: MessageCircle },
    ],
    agent: [
      { to: '/agent', label: 'Tableau de bord', icon: LayoutDashboard, end: true },
      { to: '/agent/leads', label: 'Demandes de contact', icon: Inbox },
      { to: '/agent/veille', label: 'Veille', icon: Radar },
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

  const mySector: Sector | undefined =
    currentUser?.candidateProfile?.sector ?? currentUser?.recruiterProfile?.sector

  /** Secteurs ciblés par OffRec, affichage contextuel : le secteur propre
   *  au candidat/à l'entreprise en tête, puis les secteurs pilotes — pas la
   *  même liste figée pour tout le monde. */
  const sectorInsights = useMemo(() => {
    const ordered = [mySector, ...ACTIVE_SECTORS, ...SECTORS].filter((s): s is Sector => Boolean(s))
    const seen = new Set<Sector>()
    const unique = ordered.filter((s) => (seen.has(s) ? false : (seen.add(s), true)))
    return unique.slice(0, 5).map((sector) => ({
      sector,
      offersCount: opportunities.filter((o) => o.sector === sector).length,
      providersCount: providers.filter((p) => TRADE_SECTOR[p.trade as keyof typeof TRADE_SECTOR] === sector).length,
    }))
  }, [mySector, opportunities, providers])

  const [expandedSector, setExpandedSector] = useState<Sector | null>(null)

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

      {sectorInsights.length > 0 && (
        <div className="side-section">
          <p className="side-section-title">Secteurs d’activité</p>
          {sectorInsights.map(({ sector, offersCount, providersCount }) => (
            <div key={sector}>
              <button
                type="button"
                className="side-trade"
                onClick={() => setExpandedSector((s) => (s === sector ? null : sector))}
                aria-expanded={expandedSector === sector}
              >
                <Wrench size={14} aria-hidden />
                <span>
                  {SECTOR_LABELS[sector]}
                  {sector === mySector ? ' · votre secteur' : ''}
                </span>
                <span className="side-trade-count">{offersCount + providersCount}</span>
              </button>
              {expandedSector === sector && (
                <div className="side-sector-detail">
                  <p>{SECTOR_DESCRIPTIONS[sector]}</p>
                  <p className="side-sector-stats">
                    {offersCount} offre{offersCount > 1 ? 's' : ''} · {providersCount} prestataire
                    {providersCount > 1 ? 's' : ''} dans l’annuaire
                  </p>
                </div>
              )}
            </div>
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
