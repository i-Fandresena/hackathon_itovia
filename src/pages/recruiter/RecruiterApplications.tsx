import { MessageCircle, Users } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { useApp } from '../../context/AppContext'
import { apiStartConversation } from '../../lib/api'
import { formatDate } from '../../lib/format'

export function RecruiterApplications() {
  const { currentUser, opportunities, getApplicationsForRecruiter } = useApp()
  const apps = getApplicationsForRecruiter(currentUser?.id ?? '')
  const navigate = useNavigate()

  const handleContact = async (candidateId: string, opportunityId: string, opportunityTitle: string) => {
    const { conversationId } = await apiStartConversation(
      candidateId,
      `Bonjour, nous avons bien reçu votre candidature pour « ${opportunityTitle} ».`,
      opportunityId,
    )
    navigate(`/messages?c=${conversationId}`)
  }

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
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                    <time style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                      {formatDate(a.createdAt)}
                    </time>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleContact(a.candidateId, a.opportunityId, opp?.title ?? '')}
                    >
                      <MessageCircle size={14} />
                      Contacter
                    </Button>
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
