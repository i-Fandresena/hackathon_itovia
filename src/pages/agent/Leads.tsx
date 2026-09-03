import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Inbox } from 'lucide-react'
import { FadeUp } from '../../components/motion/Motion'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { Loading } from '../../components/ui/Loading'
import { apiListLeads, apiUpdateLeadStatus } from '../../lib/api'
import { GENDER_LABELS } from '../../data/constants'
import type { LeadStatus, TalentLead } from '../../types'

const STATUS_LABELS: Record<LeadStatus, string> = {
  nouveau: 'Nouvelle demande',
  contacte: 'Contacté',
  converti: 'Converti en profil',
  ignore: 'Ignoré',
}

const STATUS_VARIANT: Record<LeadStatus, 'muted' | 'primary' | 'success'> = {
  nouveau: 'primary',
  contacte: 'muted',
  converti: 'success',
  ignore: 'muted',
}

export function Leads() {
  const [leads, setLeads] = useState<TalentLead[] | null>(null)
  const [error, setError] = useState('')

  const load = () => {
    setError('')
    apiListLeads()
      .then(setLeads)
      .catch(() => setError('Impossible de charger les demandes.'))
  }

  useEffect(load, [])

  const markContacted = async (id: string) => {
    await apiUpdateLeadStatus(id, 'contacte')
    load()
  }

  const ignore = async (id: string) => {
    await apiUpdateLeadStatus(id, 'ignore')
    load()
  }

  if (error) {
    return (
      <div className="page">
        <div className="container">
          <p style={{ marginBottom: '1rem' }}>{error}</p>
          <Button size="sm" onClick={load}>
            Réessayer
          </Button>
        </div>
      </div>
    )
  }

  if (!leads) {
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
        <FadeUp eager>
          <header className="page-header">
            <p className="eyebrow">Espace agent de terrain</p>
            <h1>Demandes de contact</h1>
            <p>
              Déposées en self-service par des personnes sans diplôme qui savent
              faire un métier — aucun compte n’a été créé, à vous de reprendre
              contact et, si pertinent, de créer le profil talent correspondant.
            </p>
          </header>
        </FadeUp>

        {leads.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title="Aucune demande pour l’instant"
            description="Les demandes envoyées depuis le formulaire d’inscription apparaîtront ici."
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {leads.map((lead) => (
              <Card key={lead.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <div>
                    <strong style={{ color: 'var(--color-ink)' }}>{lead.fullName}</strong>
                    <p style={{ fontSize: '0.85rem', color: 'var(--color-ink-muted)' }}>
                      {lead.trade} · {lead.city} · {GENDER_LABELS[lead.gender]} · {lead.phone}
                    </p>
                    {lead.message && (
                      <p style={{ fontSize: '0.85rem', color: 'var(--color-ink-muted)', fontStyle: 'italic' }}>
                        « {lead.message} »
                      </p>
                    )}
                  </div>
                  <Badge variant={STATUS_VARIANT[lead.status]}>{STATUS_LABELS[lead.status]}</Badge>
                </div>
                {lead.status !== 'converti' && (
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
                    {lead.status === 'nouveau' && (
                      <Button size="sm" variant="ghost" onClick={() => markContacted(lead.id)}>
                        Marquer contacté
                      </Button>
                    )}
                    <Link to={`/agent/talents/nouveau?fromLead=${lead.id}`}>
                      <Button size="sm">Convertir en profil</Button>
                    </Link>
                    {lead.status !== 'ignore' && (
                      <Button size="sm" variant="ghost" onClick={() => ignore(lead.id)}>
                        Ignorer
                      </Button>
                    )}
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
