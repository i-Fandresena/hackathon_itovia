import { Link, NavLink } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  AlertTriangle,
  Bell,
  Briefcase,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  ClipboardCheck,
  CreditCard,
  FileCheck2,
  FilePlus2,
  GraduationCap,
  Handshake,
  HeartHandshake,
  History,
  Inbox,
  LayoutDashboard,
  LogOut,
  MessageCircle,
  Radar,
  ShieldCheck,
  MessageSquareLock,
  Store,
  UserPlus,
  UserRound,
  Users,
  UsersRound,
} from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { interviewAwaitsCandidateReply } from '../../lib/interview'
import { candidateProfileCompletion } from '../../lib/recommendation'
import { ROLE_LABELS } from '../../lib/roles'
import type { CandidateProfile, InterviewStatus, User, UserRole } from '../../types'
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
  /** Entrée de la carte latérale seulement : la barre d'onglets mobile la
   *  saute (elle reste sous « Menu »), pour ne pas déplacer ses 4 onglets. */
  menuOnly?: boolean
}

/** Entretiens à traiter par le recruteur (empêchement signalé par le
 *  candidat) — pastille de l'entrée « Entretiens », calculée sur les dossiers
 *  déjà chargés (`receivedSuggestions`), sans requête de plus. */
export function countInterviewsToHandle(
  received: { status: string; interview?: { status: string } | null }[],
): number {
  return received.filter((s) => s.status === 'mise_en_relation' && s.interview?.status === 'empechement').length
}

/** Entretiens qui attendent la réponse du candidat (planifiés ou
 *  reprogrammés, pas encore commencés) — pastille de son entrée
 *  « Entretiens », calculée sur `mySuggestions`, sans requête de plus. */
export function countInterviewsAwaitingReply(
  dossiers: { status: string; interview?: { status: InterviewStatus; scheduledAt: string } | null }[],
): number {
  return dossiers.filter(
    (s) => s.status === 'mise_en_relation' && s.interview && interviewAwaitsCandidateReply(s.interview),
  ).length
}

/** Pastille « Entretiens » du rôle (recruteur : empêchements à traiter ;
 *  candidat : réponses attendues). */
export function countInterviewBadge(
  role: UserRole,
  received: Parameters<typeof countInterviewsToHandle>[0],
  mine: Parameters<typeof countInterviewsAwaitingReply>[0],
): number {
  if (role === 'recruiter') return countInterviewsToHandle(received)
  if (role === 'candidate') return countInterviewsAwaitingReply(mine)
  return 0
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
export function getLinksByRole(
  role: UserRole,
  unreadCount: number,
  canVerifyCv = false,
  interviewsToHandle = 0,
): RoleLink[] {
  const LINKS_BY_ROLE: Record<UserRole, RoleLink[]> = {
    // Les 4 premières entrées forment la barre d'onglets mobile : le suivi
    // (offres, candidats proposés, notifications) y passe avant « Publier une
    // offre », qui reste à un geste depuis le tableau de bord et « Mes offres ».
    recruiter: [
      { to: '/recruteur', label: 'Tableau de bord', icon: LayoutDashboard, end: true },
      { to: '/recruteur/offres', label: 'Mes offres', icon: Briefcase },
      { to: '/recruteur/candidatures', label: 'Candidats proposés', icon: Users },
      // Juste après « Candidats proposés », d'où les entretiens se créent ;
      // hors barre d'onglets mobile (`menuOnly`) pour y garder les notifications.
      { to: '/recruteur/entretiens', label: 'Entretiens', icon: CalendarDays, badge: interviewsToHandle, menuOnly: true },
      { to: '/recruteur/notifications', label: 'Notifications', icon: Bell, badge: unreadCount },
      { to: '/recruteur/publier', label: 'Publier une offre', icon: FilePlus2 },
      { to: '/recruteur/placements', label: 'Placements', icon: ClipboardCheck },
      { to: '/messages', label: 'Discuter avec OffRec', icon: MessageCircle },
      { to: '/recruteur/abonnement', label: 'Abonnement', icon: CreditCard, account: true },
      // Point d'entrée unique des recommandations (onglets Professionnels,
      // Talents, Entreprises, Mes recommandations ; « Recommander un
      // talent » depuis l'onglet Talents) — à un geste via « Menu ».
      { to: '/annuaire', label: 'Annuaire', icon: Store },
    ],
    candidate: [
      { to: '/candidat', label: 'Tableau de bord', icon: LayoutDashboard, end: true },
      // Juste après le tableau de bord, d'où l'on suit ses dossiers ; hors
      // barre d'onglets mobile (`menuOnly`), déjà pleine (Tableau de bord,
      // Annuaire, Notifications, Profil) : sa pastille passe sur « Menu ».
      { to: '/candidat/entretiens', label: 'Entretiens', icon: CalendarDays, badge: interviewsToHandle, menuOnly: true },
      { to: '/annuaire', label: 'Annuaire', icon: Store },
      { to: '/candidat/notifications', label: 'Notifications', icon: Bell, badge: unreadCount },
      { to: '/candidat/profil', label: 'Profil', icon: UserRound, account: true },
      // Talents et entreprises recommandés, « Mes recommandations » et les
      // formulaires pour recommander sont des onglets de l'Annuaire.
    ],
    particulier: [
      { to: '/particulier', label: 'Tableau de bord', icon: LayoutDashboard, end: true },
      // L'Annuaire regroupe désormais professionnels, talents, entreprises
      // et « Mes recommandations » : le libellé « Rechercher un pro » n'en
      // décrivait plus qu'un onglet.
      { to: '/annuaire', label: 'Annuaire', icon: Store },
      { to: '/messages', label: 'Messages', icon: MessageCircle },
    ],
    admin: [
      { to: '/admin', label: 'Tableau de bord', icon: ShieldCheck, end: true },
      { to: '/admin/mise-en-relation', label: 'Mise en relation', icon: Handshake },
      // Suivi de tous les entretiens, à côté des dossiers ; hors barre
      // d'onglets mobile (`menuOnly`) : ses 4 onglets ne bougent pas.
      { to: '/admin/entretiens', label: 'Entretiens', icon: CalendarDays, menuOnly: true },
      // 3e position : avec « Vérification des CV » insérée en 4e (l'admin
      // peut toujours vérifier), les notifications restent dans la barre
      // d'onglets mobile, pastille de non lus visible sans ouvrir « Menu ».
      { to: '/admin/notifications', label: 'Notifications', icon: Bell, badge: unreadCount },
      // Journal d'activité, juste après les notifications. « Vérification des
      // CV » (toujours accordée à l'admin) s'insère avant lui en 4e position :
      // la barre d'onglets mobile reste Tableau de bord, Mise en relation,
      // Notifications, Vérification des CV ; « Activité » est sous « Menu ».
      { to: '/admin/activite', label: 'Activité', icon: History },
      { to: '/admin/placements', label: 'Placements', icon: ClipboardCheck },
      { to: '/admin/moderation', label: 'Modération', icon: AlertTriangle },
      { to: '/admin/agents', label: 'Agents de terrain', icon: UserPlus },
      // Après « Agents de terrain » : hors barre d'onglets mobile (4 premiers).
      { to: '/admin/talents', label: 'Talents', icon: UsersRound },
      // Comptes candidats (profil, CV, dossiers) puis comptes recruteurs et
      // leurs offres — consultation seule ; « Recruteurs » reste à côté des
      // fiches « Entreprises » auxquelles ils peuvent être liés.
      { to: '/admin/candidats', label: 'Candidats', icon: GraduationCap },
      { to: '/admin/recruteurs', label: 'Recruteurs', icon: BriefcaseBusiness },
      { to: '/admin/entreprises', label: 'Entreprises', icon: Building2 },
      { to: '/annuaire', label: 'Annuaire', icon: Store },
      { to: '/messages', label: 'Messages', icon: MessageCircle },
    ],
    agent: [
      { to: '/agent', label: 'Tableau de bord', icon: LayoutDashboard, end: true },
      { to: '/agent/leads', label: 'Demandes de contact', icon: Inbox },
      // File de TRAITEMENT des recommandations reçues (signaux) — distincte de
      // l'onglet d'affichage « Talents recommandés » de l'Annuaire.
      { to: '/agent/recommandations', label: 'Signaux à traiter', icon: HeartHandshake },
      { to: '/agent/veille', label: 'Veille', icon: Radar },
      // 5e position : hors barre d'onglets mobile (4 premiers) ; les
      // notifications y mènent directement à chaque nouvelle demande.
      { to: '/agent/demandes-talents', label: 'Demandes pour mes talents', icon: MessageSquareLock },
      { to: '/agent/talents/nouveau', label: 'Nouveau talent', icon: ClipboardCheck },
      // Affichage seulement (Professionnels, Talents, Entreprises) : l'agent
      // ne recommande pas, il n'a ni « Mes recommandations » ni les boutons.
      { to: '/annuaire', label: 'Annuaire', icon: Store },
      { to: '/messages', label: 'Messages', icon: MessageCircle },
      { to: '/agent/notifications', label: 'Notifications', icon: Bell, badge: unreadCount },
    ],
    talent: [
      { to: '/mon-espace', label: 'Mon espace', icon: LayoutDashboard, end: true },
      { to: '/messages', label: 'Messages', icon: MessageCircle },
      // Recommander (talent, entreprise) et « Mes recommandations » : onglets
      // de l'Annuaire, ici dans la barre d'onglets mobile.
      { to: '/annuaire', label: 'Annuaire', icon: Store },
    ],
  }
  const links = LINKS_BY_ROLE[role]
  if (!canVerifyCv) return links
  // En 4e position : la barre d'onglets mobile n'affiche que les 4 premiers
  // liens, l'entrée y reste donc visible sans passer par « Menu », et ne
  // déplace qu'un seul lien du rôle.
  // Position comptée hors entrées `menuOnly`, pour garder la même barre
  // d'onglets mobile qu'avant leur ajout.
  const cvLink: RoleLink = { to: '/verification-cv', label: 'Vérification des CV', icon: FileCheck2 }
  let seen = 0
  const at = links.findIndex((l) => !l.menuOnly && ++seen > 3)
  const index = at === -1 ? links.length : at
  return [...links.slice(0, index), cvLink, ...links.slice(index)]
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
 * Taux de complétion du profil candidat — règle partagée avec l'espace admin
 * (`candidateProfileCompletion()` dans lib/recommendation.ts). Les autres
 * rôles n'ont pas de page d'édition de profil : pas de taux pour eux.
 */
function candidateCompletion(profile: CandidateProfile): number {
  return candidateProfileCompletion(profile)
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
  const { currentUser, unreadCount, receivedSuggestions, mySuggestions } = useApp()

  const role = currentUser?.role ?? 'candidate'
  const identity = getAccountIdentity(currentUser)
  const links = getLinksByRole(
    role,
    unreadCount,
    currentUser?.canVerifyCv === true,
    countInterviewBadge(role, receivedSuggestions, mySuggestions),
  )
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
