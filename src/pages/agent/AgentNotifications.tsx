import { NotificationList } from '../../components/notifications/NotificationList'
import { useApp } from '../../context/AppContext'

/** Notifications de l'agent : talents recommandés à prendre en charge,
 *  nouvelles recommandations sur ses signaux et ses talents. */
export function AgentNotifications() {
  const { notifications, markNotificationRead } = useApp()

  return (
    <div className="page">
      <div className="container" style={{ maxWidth: 560 }}>
        <header className="page-header">
          <h1>Notifications</h1>
          <p>Talents recommandés à prendre en charge et nouvelles recommandations sur vos talents.</p>
        </header>
        <NotificationList
          notifications={notifications}
          onRead={markNotificationRead}
          emptyTitle="Aucune notification"
          emptyDescription="Vous serez notifié·e ici quand un talent sera recommandé dans votre province."
        />
      </div>
    </div>
  )
}
