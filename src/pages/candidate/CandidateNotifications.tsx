import { NotificationList } from '../../components/notifications/NotificationList'
import { useApp } from '../../context/AppContext'

export function CandidateNotifications() {
  const { notifications, markNotificationRead } = useApp()

  return (
    <div className="page">
      <div className="container" style={{ maxWidth: 560 }}>
        <header className="page-header">
          <h1>Notifications</h1>
          <p>Les mises en relation confirmées et les informations sur votre CV.</p>
        </header>
        <NotificationList
          notifications={notifications}
          onRead={markNotificationRead}
          emptyTitle="Aucune notification"
          emptyDescription="Vous serez notifié·e ici et par email dès qu’une mise en relation avec une entreprise sera confirmée."
        />
      </div>
    </div>
  )
}
