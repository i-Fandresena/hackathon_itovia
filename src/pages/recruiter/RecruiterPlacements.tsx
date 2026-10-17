import { useEffect, useState } from 'react'
import { Briefcase } from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { Select } from '../../components/ui/Form'
import { Loading } from '../../components/ui/Loading'
import { ApiError, apiMyPlacements, apiUpdatePlacementStage, type RecruiterPlacement } from '../../lib/api'
import { formatDate } from '../../lib/format'
import type { PlacementStage } from '../../types'

const STAGE_LABELS: Record<PlacementStage, string> = {
  etape1_due: 'Étape 1 due (signature)',
  etape1_payee: 'Étape 1 payée',
  etape2_due: 'Étape 2 due (confirmation)',
  etape2_payee: 'Étape 2 payée',
  annule: 'Annulé',
}

/** Nom affiché : celui du candidat ou du talent — jamais une coordonnée. */
function personLabel(p: RecruiterPlacement): string {
  if (p.talent) return p.talent.fullName || 'Talent'
  return p.candidate?.fullName || 'Candidat'
}

export function RecruiterPlacements() {
  const [placements, setPlacements] = useState<RecruiterPlacement[] | null>(null)
  const [error, setError] = useState('')
  const [stageError, setStageError] = useState('')

  const load = () => {
    setError('')
    apiMyPlacements()
      .then(setPlacements)
      .catch(() => setError('Impossible de charger les placements.'))
  }

  useEffect(load, [])

  const handleStageChange = async (id: string, stage: PlacementStage) => {
    const previous = placements
    setStageError('')
    setPlacements((list) => list?.map((p) => (p.id === id ? { ...p, stage } : p)) ?? null)
    try {
      await apiUpdatePlacementStage(id, stage)
    } catch (err) {
      setPlacements(previous)
      setStageError(err instanceof ApiError && err.message ? err.message : 'Mise à jour de l’étape impossible. Réessayez.')
    }
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

        {stageError && (
          <p role="alert" style={{ color: 'var(--color-danger)', fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.75rem' }}>
            {stageError}
          </p>
        )}

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
                  <div style={{ minWidth: 0 }}>
                    <Badge variant={p.talentId ? 'success' : 'primary'}>
                      {p.talentId ? 'Talent vérifié' : 'Candidat diplômé'}
                    </Badge>
                    <p style={{ marginTop: '0.4rem', fontWeight: 600, overflowWrap: 'anywhere' }}>
                      {personLabel(p)}
                      {p.opportunity && (
                        <span style={{ fontWeight: 400, color: 'var(--color-ink-muted)' }}> · {p.opportunity.title}</span>
                      )}
                    </p>
                    <p style={{ marginTop: '0.2rem' }}>
                      {p.monthlySalaryAr ? `${p.monthlySalaryAr.toLocaleString('fr-FR')} Ar / mois` : 'Salaire non précisé'}
                    </p>
                    <time style={{ fontSize: '0.8rem', color: 'var(--color-ink-muted)' }}>{formatDate(p.createdAt)}</time>
                  </div>
                  <div style={{ minWidth: 200 }}>
                    <Select
                      value={p.stage}
                      aria-label={`Étape du success fee pour ${personLabel(p)}`}
                      onChange={(e) => handleStageChange(p.id, e.target.value as PlacementStage)}
                    >
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
