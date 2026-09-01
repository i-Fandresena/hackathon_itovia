import { useEffect, useState } from 'react'
import { Briefcase } from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { Select } from '../../components/ui/Form'
import { Loading } from '../../components/ui/Loading'
import { apiMyPlacements, apiUpdatePlacementStage } from '../../lib/api'
import { formatDate } from '../../lib/format'
import type { Placement, PlacementStage } from '../../types'

const STAGE_LABELS: Record<PlacementStage, string> = {
  etape1_due: 'Étape 1 due (signature)',
  etape1_payee: 'Étape 1 payée',
  etape2_due: 'Étape 2 due (confirmation)',
  etape2_payee: 'Étape 2 payée',
  annule: 'Annulé',
}

export function RecruiterPlacements() {
  const [placements, setPlacements] = useState<Placement[] | null>(null)

  useEffect(() => {
    apiMyPlacements().then(setPlacements)
  }, [])

  const handleStageChange = async (id: string, stage: PlacementStage) => {
    setPlacements((list) => list?.map((p) => (p.id === id ? { ...p, stage } : p)) ?? null)
    await apiUpdatePlacementStage(id, stage)
  }

  if (!placements) {
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
          <h1>Placements</h1>
          <p>Suivi déclaratif du success fee — aucun paiement automatisé au MVP.</p>
        </header>

        {placements.length === 0 ? (
          <EmptyState
            icon={Briefcase}
            title="Aucun placement"
            description="Déclarez un placement depuis la shortlist d’une offre pour le suivre ici."
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {placements.map((p) => (
              <Card key={p.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  <div>
                    <Badge variant={p.talentId ? 'success' : 'primary'}>
                      {p.talentId ? 'Talent vérifié' : 'Candidat diplômé'}
                    </Badge>
                    <p style={{ marginTop: '0.4rem' }}>
                      {p.monthlySalaryAr ? `${p.monthlySalaryAr.toLocaleString('fr-FR')} Ar / mois` : 'Salaire non précisé'}
                    </p>
                    <time style={{ fontSize: '0.8rem', color: 'var(--color-ink-muted)' }}>{formatDate(p.createdAt)}</time>
                  </div>
                  <div style={{ minWidth: 200 }}>
                    <Select value={p.stage} onChange={(e) => handleStageChange(p.id, e.target.value as PlacementStage)}>
                      {(Object.keys(STAGE_LABELS) as PlacementStage[]).map((s) => (
                        <option key={s} value={s}>
                          {STAGE_LABELS[s]}
                        </option>
                      ))}
                    </Select>
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
