import { Link } from 'react-router-dom'
import { PlusCircle, Users } from 'lucide-react'
import { FadeUp } from '../../components/motion/Motion'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { useApp } from '../../context/AppContext'
import { formatDate } from '../../lib/format'
import { OPPORTUNITY_TYPE_LABELS } from '../../data/constants'

export function RecruiterDashboard() {
  const { currentUser, opportunities, getApplicationsForRecruiter, notifications } = useApp()
  const recruiterId = currentUser?.id ?? ''
  const myOpps = opportunities.filter((o) => o.recruiterId === recruiterId)
  const apps = getApplicationsForRecruiter(recruiterId)
  const unread = notifications.filter((n) => !n.read).length

  return (
    <div className="page">
      <div className="container">
        <FadeUp>
          <header className="page-header">
            <p className="eyebrow">Espace recruteur</p>
            <h1>
              {currentUser?.recruiterProfile?.companyName ?? 'Espace recruteur'}
            </h1>
            <p>Gérez vos offres et suivez les candidatures reçues.</p>
          </header>
        </FadeUp>

        <div className="grid-3" style={{ marginBottom: '1.5rem' }}>
          <FadeUp index={0}>
            <Card className="stat-card">
              <strong>{myOpps.length}</strong>
              <span>Offres publiées</span>
            </Card>
          </FadeUp>
          <FadeUp index={1}>
            <Card className="stat-card">
              <strong>{apps.length}</strong>
              <span>Candidatures reçues</span>
            </Card>
          </FadeUp>
          <FadeUp index={2}>
            <Card className="stat-card">
              <strong>{unread}</strong>
              <span>Notifications non lues</span>
            </Card>
          </FadeUp>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
          <Link to="/recruteur/publier">
            <Button>
              <PlusCircle size={18} />
              Publier une offre
            </Button>
          </Link>
          <Link to="/recruteur/candidatures">
            <Button variant="outline">
              <Users size={18} />
              Voir les candidatures
            </Button>
          </Link>
        </div>

        <h2 style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>Dernières offres</h2>
        {myOpps.length === 0 ? (
          <Card>
            <p style={{ color: 'var(--color-text-muted)' }}>
              Vous n’avez pas encore publié d’offre. Commencez dès maintenant.
            </p>
          </Card>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {myOpps.slice(0, 5).map((o) => (
              <Card key={o.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <div>
                    <strong>{o.title}</strong>
                    <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                      {o.province} · limite {formatDate(o.deadline)}
                    </p>
                  </div>
                  <Badge variant="muted">{OPPORTUNITY_TYPE_LABELS[o.opportunityType]}</Badge>
                </div>
                <Link to={`/recruteur/offres/${o.id}/modifier`} style={{ fontSize: '0.9rem', fontWeight: 600 }}>
                  Modifier →
                </Link>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
