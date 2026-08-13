import { Users } from 'lucide-react'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { useApp } from '../../context/AppContext'
import { formatDate } from '../../lib/format'

export function RecruiterApplications() {
  const { currentUser, opportunities, getApplicationsForRecruiter } = useApp()
  const apps = getApplicationsForRecruiter(currentUser?.id ?? '')

  return (
    <div className="page">
      <div className="container">
        <header className="page-header">
          <h1>Candidatures reçues</h1>
          <p>Profils ayant manifesté leur intérêt pour vos offres.</p>
        </header>

        {apps.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Aucune candidature"
            description="Les candidatures apparaîtront ici lorsqu’un profil postulera à vos offres."
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {apps.map((a) => {
              const opp = opportunities.find((o) => o.id === a.opportunityId)
              return (
                <Card key={a.id}>
                  <strong>{a.candidateName}</strong>
                  <p className="app-offer-title">
                    Offre : {opp?.title ?? '—'}
                  </p>
                  <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                    {a.candidateEmail} · {a.candidatePhone} · {a.candidateProvince}
                  </p>
                  {a.message && (
                    <p style={{ marginTop: '0.5rem', fontSize: '0.9rem' }}>« {a.message} »</p>
                  )}
                  <time style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                    {formatDate(a.createdAt)}
                  </time>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
