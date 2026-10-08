import { Link, NavLink } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  AlertTriangle,
  Bell,
  Briefcase,
  ClipboardCheck,
  CreditCard,
  FileCheck2,
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
} from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { ROLE_LABELS } from '../../lib/roles'
import type { CandidateProfile, User, UserRole } from '../../types'
import './Sidebar.css'

interface SidebarProps {
  onNavigate?: () => void
  onLogout: () => void
}

export interface RoleLink {
  to: string
  label: string
  icon: typeof LayoutDashboard
  end?: boolean
  badge?: number
  /** Entrée rangée sous « Compte » dans la carte latérale plutôt que dans
   *  la navigation principale. */
  account?: boolean
}

/**
 * Source unique des liens de nav par rôle — utilisée par la carte latérale
 * (`Sidebar`) et la barre d'onglets
 * mobile (`TabBar` dans `AppShell`, qui n'en affiche que les 4 premiers + un
 * onglet « Menu » ouvrant cette même carte). Ne pas dupliquer cette liste
 * ailleurs.
 *
 * `canVerifyCv` ajoute « Vérification des CV » quel que soit le rôle :
 * c'est une capacité accordée par l'admin, pas un rôle.
 */
export function getLinksByRole(role: UserRole, unreadCount: number, canVerifyCv = false): RoleLink[] {
  const LINKS_BY_ROLE: Record<UserRole, RoleLink[]> = {
    // Les 4 premières entrées forment la barre d'onglets mobile : le suivi
    // (offres, candidats proposés, notifications) y passe avant « Publier une
    // offre », qui reste à un geste depuis le tableau de bord et « Mes offres ».
    recruiter: [
      { to: '/recruteur', label: 'Tableau de bord', icon: LayoutDashboard, end: true },
      { to: '/recruteur/offres', label: 'Mes offres', icon: Briefcase },
      { to: '/recruteur/candidatures', label: 'Candidats proposés', icon: Users },
      { to: '/recruteur/notifications', label: 'Notifications', icon: Bell, badge: unreadCount },
      { to: '/recruteur/publier', label: 'Publier une offre', icon: FilePlus2 },
      { to: '/recruteur/placements', label: 'Placements', icon: ClipboardCheck },
      { to: '/messages', label: 'Discuter avec OffRec', icon: MessageCircle },
      { to: '/recruteur/abonnement', label: 'Abonnement', icon: CreditCard, account: true },
      { to: '/annuaire', label: 'Annuaire', icon: Store },
    ],
    candidate: [
      { to: '/candidat', label: 'Tableau de bord', icon: LayoutDashboard, end: true },
      { to: '/annuaire', label: 'Annuaire', icon: Store },
      { to: '/candidat/notifications', label: 'Notifications', icon: Bell, badge: unreadCount },
      { to: '/candidat/profil', label: 'Profil', icon: UserRound, account: true },
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
  const links = LINKS_BY_ROLE[role]
  if (!canVerifyCv) return links
  // En 4e position : la barre d'onglets mobile n'affiche que les 4 premiers
  // liens, l'entrée y reste donc visible sans passer par « Menu », et ne
  // déplace qu'un seul lien du rôle.
  const cvLink: RoleLink = { to: '/verification-cv', label: 'Vérification des CV', icon: FileCheck2 }
  return [...links.slice(0, 3), cvLink, ...links.slice(3)]
}

/** Identité affichée dans l'en-tête de la carte latérale : nom du profil
 *  du rôle, à défaut le libellé du rôle (l'admin n'a pas de profil). */
export function getAccountIdentity(user: User | null) {
  const role = user?.role ?? 'candidate'
  const profile =
    user?.candidateProfile ??
    user?.individualProfile ??
    user?.agentProfile ??
    user?.talentAccountProfile
  const name = user?.recruiterProfile?.companyName || profile?.fullName || ROLE_LABELS[role]
  return {
    name,
    initial: name.trim().charAt(0).toUpperCase(),
    email: user?.email ?? '',
  }
}

/**
 * Taux de complétion du profil candidat, calculé uniquement sur les champs
 * que le candidat peut réellement laisser vides puis renseigner depuis
 * `/candidat/profil` (les listes déroulantes ont toujours une valeur et ne
 * comptent donc pas). Les autres rôles n'ont pas de page d'édition de
 * profil : pas de taux pour eux.
 */
function candidateCompletion(profile: CandidateProfile): number {
  const checks = [
    profile.fullName.trim() !== '',
    profile.phone.trim() !== '',
    profile.province.trim() !== '',
    profile.city.trim() !== '',
    profile.skills.length > 0,
    profile.desiredOpportunityTypes.length > 0,
    Boolean(profile.cvUrl),
  ]
  return Math.round((checks.filter(Boolean).length / checks.length) * 100)
}

const RING_SIZE = 60
const RING_STROKE = 4
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2
const RING_LENGTH = 2 * Math.PI * RING_RADIUS

function ProfileCompletionCard({ percent, onNavigate }: { percent: number; onNavigate?: () => void }) {
  return (
    <Link to="/candidat/profil" className="side-completion" onClick={onNavigate}>
      <span className="side-ring">
        <svg width={RING_SIZE} height={RING_SIZE} viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`} aria-hidden>
          <circle
            className="side-ring-track"
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RING_RADIUS}
            strokeWidth={RING_STROKE}
            fill="none"
          />
          <circle
            className="side-ring-progress"
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RING_RADIUS}
            strokeWidth={RING_STROKE}
            fill="none"
            strokeLinecap="round"
            transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
            strokeDasharray={RING_LENGTH}
            strokeDashoffset={RING_LENGTH * (1 - percent / 100)}
          />
        </svg>
        <span className="side-ring-value">{percent}%</span>
      </span>
      <strong>Complétez votre profil</strong>
      <span className="side-completion-sub">
        Un profil complet améliore vos recommandations.
      </span>
    </Link>
  )
}

/**
 * Carte latérale flottante : identité, navigation du rôle, section
 * « Compte ». Pour le candidat, une seconde carte indique le taux de
 * complétion du profil tant qu'il n'est pas à 100 %.
 */
export function Sidebar({ onNavigate, onLogout }: SidebarProps) {
  const { currentUser, unreadCount } = useApp()

  const role = currentUser?.role ?? 'candidate'
  const identity = getAccountIdentity(currentUser)
  const links = getLinksByRole(role, unreadCount, currentUser?.canVerifyCv === true)
  const mainLinks = links.filter((l) => !l.account)
  const accountLinks = links.filter((l) => l.account)

  const completion =
    role === 'candidate' && currentUser?.candidateProfile
      ? candidateCompletion(currentUser.candidateProfile)
      : null

  const renderLink = (l: RoleLink) => (
    <NavLink key={l.to} to={l.to} end={l.end} onClick={onNavigate} className="side-link">
      {({ isActive }) => (
        <>
          {isActive && (
            <motion.span
              layoutId="sidebar-active-pill"
              className="side-nav-pill"
              transition={{ type: 'spring', stiffness: 500, damping: 40 }}
            />
          )}
          <l.icon size={18} strokeWidth={1.75} aria-hidden />
          <span className="side-link-label">{l.label}</span>
          {l.badge ? <span className="side-badge">{l.badge}</span> : null}
        </>
      )}
    </NavLink>
  )

  return (
    <div className="side">
      <div className="side-card">
        <div className="side-user">
          <span className="side-avatar" aria-hidden>
            {identity.initial}
          </span>
          <div className="side-user-text">
            <p className="side-name" title={identity.name}>
              {identity.name}
            </p>
            <p className="side-email" title={identity.email}>
              {identity.email}
            </p>
          </div>
        </div>

        <hr className="side-sep" />

        <p className="side-label">Mon espace</p>
        <nav className="side-nav" aria-label="Navigation de l’espace">
          {mainLinks.map(renderLink)}
        </nav>

        <hr className="side-sep" />

        <p className="side-label">Compte</p>
        <nav className="side-nav" aria-label="Compte">
          {accountLinks.map(renderLink)}
          <button type="button" className="side-link side-logout" onClick={onLogout}>
            <LogOut size={18} strokeWidth={1.75} aria-hidden />
            <span className="side-link-label">Déconnexion</span>
          </button>
        </nav>
      </div>

      {completion !== null && completion < 100 && (
        <ProfileCompletionCard percent={completion} onNavigate={onNavigate} />
      )}
    </div>
  )
}
