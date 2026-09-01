import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PlusCircle, UserRound } from 'lucide-react'
import { FadeUp } from '../../components/motion/Motion'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { Loading } from '../../components/ui/Loading'
import { apiAgentStats, apiMyTalents } from '../../lib/api'
import type { TalentProfile, TalentStatus } from '../../types'

const STATUS_LABELS: Record<TalentStatus, string> = {
  en_attente: 'En attente de vérification',
  verifie: 'Vérifié',
  recommande: 'Recommandé',
  place: 'Placé',
}

const STATUS_VARIANT: Record<TalentStatus, 'muted' | 'primary' | 'success'> = {
  en_attente: 'muted',
  verifie: 'primary',
  recommande: 'primary',
  place: 'success',
}

export function AgentDashboard() {
  const [talents, setTalents] = useState<TalentProfile[] | null>(null)
  const [stats, setStats] = useState<{ profilesCreated: number; verificationRate: number; placements: number } | null>(
    null,
  )

  useEffect(() => {
    Promise.all([apiMyTalents(), apiAgentStats()]).then(([t, s]) => {
      setTalents(t)
      setStats(s)
    })
  }, [])

  if (!talents || !stats) {
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
          <header
            className="page-header"
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}
          >
            <div>
              <p className="eyebrow">Espace agent de terrain</p>
              <h1>Mes talents</h1>
              <p>Créez et vérifiez des profils de talents non-diplômés.</p>
            </div>
            <Link to="/agent/talents/nouveau">
              <Button size="sm">
                <PlusCircle size={16} />
                Nouveau talent
              </Button>
            </Link>
          </header>
        </FadeUp>

        <div className="grid-3" style={{ marginBottom: '1.5rem' }}>
          <FadeUp eager index={0}>
            <Card className="stat-card">
              <strong>{stats.profilesCreated}</strong>
              <span>Profils créés</span>
            </Card>
          </FadeUp>
          <FadeUp eager index={1}>
            <Card className="stat-card">
              <strong>{Math.round(stats.verificationRate * 100)}%</strong>
              <span>Taux de vérification</span>
            </Card>
          </FadeUp>
          <FadeUp eager index={2}>
            <Card className="stat-card">
              <strong>{stats.placements}</strong>
              <span>Placements</span>
            </Card>
          </FadeUp>
        </div>

        {talents.length === 0 ? (
          <EmptyState
            icon={UserRound}
            title="Aucun talent suivi"
            description="Créez le premier profil pour commencer la vérification."
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {talents.map((t) => (
              <Link key={t.id} to={`/agent/talents/${t.id}`} style={{ textDecoration: 'none' }}>
                <Card>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <div>
                      <strong style={{ color: 'var(--color-ink)' }}>{t.fullName}</strong>
                      <p style={{ fontSize: '0.85rem', color: 'var(--color-ink-muted)' }}>
                        {t.skills.slice(0, 3).join(', ')} · {t.city}
                      </p>
                    </div>
                    <Badge variant={STATUS_VARIANT[t.status]}>{STATUS_LABELS[t.status]}</Badge>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
