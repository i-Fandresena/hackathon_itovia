import { useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { Loading } from '../../components/ui/Loading'
import { apiAdminReports, apiAdminResolveReport, type AdminReport, type ModerationActionType } from '../../lib/api'
import { formatDate } from '../../lib/format'

const TARGET_LABELS: Record<string, string> = {
  opportunity: 'Offre',
  provider: 'Prestataire',
  recommendation: 'Recommandation',
  user: 'Compte',
}

const ACTIONS: { action: ModerationActionType; label: string; variant: 'ghost' | 'outline' | 'danger' }[] = [
  { action: 'dismiss', label: 'Classer sans suite', variant: 'ghost' },
  { action: 'warning', label: 'Avertissement', variant: 'outline' },
  { action: 'restriction', label: 'Restriction', variant: 'outline' },
  { action: 'suspension', label: 'Suspension', variant: 'danger' },
  { action: 'ban', label: 'Bannissement', variant: 'danger' },
]

export function AdminModeration() {
  const [reports, setReports] = useState<AdminReport[] | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = () => {
    apiAdminReports().then(setReports)
  }

  useEffect(load, [])

  const resolve = async (id: string, action: ModerationActionType) => {
    setBusyId(id)
    try {
      await apiAdminResolveReport(id, action)
      setReports((r) => r?.filter((rep) => rep.id !== id) ?? null)
    } finally {
      setBusyId(null)
    }
  }

  if (!reports) {
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
          <h1>Modération</h1>
          <p>Signalements en attente de traitement.</p>
        </header>

        {reports.length === 0 ? (
          <EmptyState
            icon={AlertTriangle}
            title="Aucun signalement en attente"
            description="Tout est traité pour le moment."
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {reports.map((r) => (
              <Card key={r.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <div>
                    <Badge variant="muted">{TARGET_LABELS[r.targetType] ?? r.targetType}</Badge>
                    <p style={{ margin: '0.5rem 0 0.25rem', fontWeight: 600 }}>{r.reason}</p>
                    <p style={{ fontSize: '0.85rem', color: 'var(--color-ink-muted)' }}>
                      Signalé par {r.reporterEmail}
                      {r.targetUser ? ` — cible : ${r.targetUser.email} (${r.targetUser.role}, statut ${r.targetUser.status})` : ''}
                    </p>
                  </div>
                  <time style={{ fontSize: '0.8rem', color: 'var(--color-ink-muted)' }}>{formatDate(r.createdAt)}</time>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.75rem' }}>
                  {ACTIONS.map((a) => (
                    <Button
                      key={a.action}
                      variant={a.variant}
                      size="sm"
                      disabled={busyId === r.id}
                      onClick={() => resolve(r.id, a.action)}
                    >
                      {a.label}
                    </Button>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
