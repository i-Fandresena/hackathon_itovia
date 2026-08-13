import { Bell } from 'lucide-react'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { useApp } from '../../context/AppContext'
import { formatDate } from '../../lib/format'

export function CandidateNotifications() {
  const { notifications, currentUserId, markNotificationRead } = useApp()
  const mine = notifications.filter((n) => n.userId === currentUserId)

  return (
    <div className="page">
      <div className="container" style={{ maxWidth: 560 }}>
        <header className="page-header">
          <h1>Notifications</h1>
          <p>Suivi de vos candidatures et alertes.</p>
        </header>
        {mine.length === 0 ? (
          <EmptyState
            icon={Bell}
            title="Aucune notification"
            description="Vous serez informé·e lorsque vous postulerez à une offre."
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {mine.map((n) => (
              <Card
                key={n.id}
                className={n.read ? '' : 'notif-unread'}
                onClick={() => markNotificationRead(n.id)}
                hover
              >
                <strong>{n.title}</strong>
                <p style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)', margin: '0.35rem 0' }}>
                  {n.message}
                </p>
                <time style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                  {formatDate(n.createdAt)}
                </time>
              </Card>
            ))}
          </div>
        )}
      </div>
      <style>{`
        .notif-unread { border-left: 3px solid var(--color-accent); }
      `}</style>
    </div>
  )
}
