import { useEffect, useState } from 'react'
import { MessageCircle, Users } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { Select } from '../../components/ui/Form'
import { Loading } from '../../components/ui/Loading'
import { apiReceivedApplications, apiStartConversation, apiUpdateApplicationStatus } from '../../lib/api'
import { formatDate } from '../../lib/format'
import type { Application, ApplicationStatus } from '../../types'

const STATUS_LABELS: Record<ApplicationStatus, string> = {
  envoyee: 'Envoyée',
  vue: 'Vue',
  contactee: 'Contactée',
  refusee: 'Refusée',
}

export function RecruiterApplications() {
  const [apps, setApps] = useState<(Application & { opportunityTitle?: string })[] | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    apiReceivedApplications().then((a) => setApps(a as (Application & { opportunityTitle?: string })[]))
  }, [])

  const handleContact = async (candidateId: string, opportunityId: string, opportunityTitle: string) => {
    const { conversationId } = await apiStartConversation(
      candidateId,
      `Bonjour, nous avons bien reçu votre candidature pour « ${opportunityTitle} ».`,
      opportunityId,
    )
    navigate(`/messages?c=${conversationId}`)
  }

  const handleStatusChange = async (id: string, status: ApplicationStatus) => {
    setApps((list) => list?.map((a) => (a.id === id ? { ...a, status } : a)) ?? null)
    await apiUpdateApplicationStatus(id, status)
  }

  if (!apps) {
    return (
      <div className="page">
        <div className="container">
          <Loading />
        </div>
      </div>
    )
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
            {apps.map((a) => (
              <Card key={a.id}>
                <strong>{a.candidateName}</strong>
                <p className="app-offer-title">Offre : {a.opportunityTitle ?? '—'}</p>
                <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                  {a.candidateEmail} · {a.candidatePhone} · {a.candidateProvince}
                </p>
                {a.message && <p style={{ marginTop: '0.5rem', fontSize: '0.9rem' }}>« {a.message} »</p>}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                  <time style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{formatDate(a.createdAt)}</time>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <div style={{ minWidth: 150 }}>
                      <Select
                        value={a.status}
                        onChange={(e) => handleStatusChange(a.id, e.target.value as ApplicationStatus)}
                      >
                        {(Object.keys(STATUS_LABELS) as ApplicationStatus[]).map((s) => (
                          <option key={s} value={s}>
                            {STATUS_LABELS[s]}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleContact(a.candidateId, a.opportunityId, a.opportunityTitle ?? '')}
                    >
                      <MessageCircle size={14} />
                      Contacter
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
