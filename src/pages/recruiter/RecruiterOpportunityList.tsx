import { Link, useNavigate } from 'react-router-dom'
import { Briefcase, Pencil, Trash2 } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { EmptyState } from '../../components/ui/EmptyState'
import { useApp } from '../../context/AppContext'
import { formatDate } from '../../lib/format'
import { OPPORTUNITY_TYPE_LABELS } from '../../data/constants'

export function RecruiterOpportunityList() {
  const navigate = useNavigate()
  const { currentUser, opportunities, deleteOpportunity, getApplicationsForOpportunity } =
    useApp()
  const myOpps = opportunities.filter((o) => o.recruiterId === currentUser?.id)

  const handleDelete = (id: string, title: string) => {
    if (window.confirm(`Supprimer l’offre « ${title} » ?`)) {
      deleteOpportunity(id)
    }
  }

  return (
    <div className="page">
      <div className="container">
        <header
          className="page-header"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
        >
          <div>
            <h1>Mes offres</h1>
            <p>Gérez vos publications actives.</p>
          </div>
          <Link to="/recruteur/publier">
            <Button size="sm">Nouvelle offre</Button>
          </Link>
        </header>

        {myOpps.length === 0 ? (
          <EmptyState
            icon={Briefcase}
            title="Aucune offre publiée"
            description="Publiez votre première opportunité pour recevoir des candidatures."
            actionLabel="Publier une offre"
            onAction={() => navigate('/recruteur/publier')}
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {myOpps.map((o) => {
              const count = getApplicationsForOpportunity(o.id).length
              return (
                <Card key={o.id}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: '0.5rem',
                      flexWrap: 'wrap',
                    }}
                  >
                    <div>
                      <h3 style={{ fontSize: '1.05rem', marginBottom: '0.25rem' }}>
                        {o.title}
                      </h3>
                      <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                        {o.province} · {formatDate(o.deadline)} · {count} candidature(s)
                      </p>
                    </div>
                    <Badge variant="muted">
                      {OPPORTUNITY_TYPE_LABELS[o.opportunityType]}
                    </Badge>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                    <Link to={`/recruteur/offres/${o.id}/modifier`}>
                      <Button variant="outline" size="sm">
                        <Pencil size={14} />
                        Modifier
                      </Button>
                    </Link>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => handleDelete(o.id, o.title)}
                    >
                      <Trash2 size={14} />
                      Supprimer
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
