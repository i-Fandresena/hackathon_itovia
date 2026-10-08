import { matchPath } from 'react-router-dom'
import { NotificationList } from '../../components/notifications/NotificationList'
import { useApp } from '../../context/AppContext'

/**
 * Écrans vers lesquels une notification du recruteur peut mener — à garder
 * aligné sur les routes de `App.tsx` accessibles au rôle `recruiter`. Un lien
 * hors de cette liste (ancienne notification, espace d'un autre rôle) rend la
 * notification non cliquable.
 */
const RECRUITER_LINK_PATTERNS = [
  '/recruteur',
  '/recruteur/publier',
  '/recruteur/offres',
  '/recruteur/offres/:id/modifier',
  '/recruteur/offres/:id/shortlist',
  '/recruteur/candidatures',
  '/recruteur/placements',
  '/recruteur/abonnement',
  '/messages',
  '/annuaire',
  '/annuaire/:id',
  '/offres/:id',
]

function isRecruiterLink(link: string): boolean {
  if (!link.startsWith('/') || link.startsWith('//')) return false
  const pathname = link.split(/[?#]/)[0]
  return RECRUITER_LINK_PATTERNS.some((pattern) => matchPath({ path: pattern, end: true }, pathname) !== null)
}

export function RecruiterNotifications() {
  const { notifications, markNotificationRead } = useApp()

  const markAllRead = () => {
    notifications.filter((n) => !n.read).forEach((n) => markNotificationRead(n.id))
  }

  return (
    <div className="page">
      <div className="container">
        <header className="page-header">
          <h1>Notifications</h1>
          <p>
            Profils proposés par OffRec, mises en relation confirmées et messages de l’équipe : chaque
            notification ouvre l’écran concerné.
          </p>
        </header>
        <NotificationList
          notifications={notifications}
          onRead={markNotificationRead}
          isKnownLink={isRecruiterLink}
          onMarkAllRead={markAllRead}
          emptyTitle="Aucune notification"
          emptyDescription="Vous serez prévenu ici dès qu’OffRec vous proposera un profil, confirmera une mise en relation ou répondra à vos messages."
        />
      </div>
    </div>
  )
}
