import { Bell, CheckCheck } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { EmptyState } from '../ui/EmptyState'
import { formatDate } from '../../lib/format'
import type { Notification } from '../../types'
import './NotificationList.css'

interface NotificationListProps {
  notifications: Notification[]
  onRead: (id: string) => void
  emptyTitle: string
  emptyDescription: string
  /**
   * Filtre des liens : renvoie `false` pour un lien qui ne mène à aucun écran
   * de l'espace courant (ancienne notification, lien d'un autre rôle). La
   * notification est alors affichée sans être cliquable, plutôt que de mener
   * à une redirection. Absent : tout lien renseigné est suivi et chaque
   * notification reste cliquable (un clic la marque comme lue).
   */
  isKnownLink?: (link: string) => boolean
  /** Présent : affiche le compteur de non lus et « Tout marquer comme lu ». */
  onMarkAllRead?: () => void
}

/**
 * Liste de notifications partagée par les espaces candidat et recruteur :
 * état lu / non lu, date, clic qui marque comme lu puis navigue vers `link`.
 */
export function NotificationList({
  notifications,
  onRead,
  emptyTitle,
  emptyDescription,
  isKnownLink,
  onMarkAllRead,
}: NotificationListProps) {
  const navigate = useNavigate()

  if (notifications.length === 0) {
    return <EmptyState icon={Bell} title={emptyTitle} description={emptyDescription} />
  }

  const unread = notifications.filter((n) => !n.read).length

  return (
    <>
      {onMarkAllRead && (
        <div className="notif-toolbar">
          <span>
            {unread === 0
              ? 'Tout est lu'
              : `${unread} non lue${unread > 1 ? 's' : ''}`}
          </span>
          {unread > 0 && (
            <Button variant="ghost" size="sm" onClick={onMarkAllRead}>
              <CheckCheck size={16} aria-hidden />
              Tout marquer comme lu
            </Button>
          )}
        </div>
      )}
      <div className="notif-list">
        {notifications.map((n) => {
          const link = n.link && (!isKnownLink || isKnownLink(n.link)) ? n.link : null
          const clickable = !isKnownLink || link !== null
          const handleClick = () => {
            onRead(n.id)
            if (link) navigate(link)
          }
          return (
            <Card
              key={n.id}
              className={`${n.read ? '' : 'notif-unread'} ${link ? 'notif-clickable' : ''}`.trim()}
              onClick={clickable ? handleClick : undefined}
              hover={clickable}
            >
              <strong>{n.title}</strong>
              <p className="notif-message">{n.message}</p>
              <time className="notif-time">{formatDate(n.createdAt)}</time>
            </Card>
          )
        })}
      </div>
    </>
  )
}
