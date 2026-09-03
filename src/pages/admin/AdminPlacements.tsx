import { useEffect, useState } from 'react'
import { ClipboardCheck } from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { Select } from '../../components/ui/Form'
import { Loading } from '../../components/ui/Loading'
import { apiAdminPlacements, apiUpdatePlacementStage, type AdminPlacement } from '../../lib/api'
import { formatDate } from '../../lib/format'
import type { PlacementStage } from '../../types'

const STAGE_LABELS: Record<PlacementStage, string> = {
  etape1_due: 'Étape 1 due (signature)',
  etape1_payee: 'Étape 1 payée',
  etape2_due: 'Étape 2 due (confirmation)',
  etape2_payee: 'Étape 2 payée',
  annule: 'Annulé',
}

/**
 * Vue d'ensemble de tous les placements, tous recruteurs confondus — le
 * recruteur autodéclare et fait avancer ses propres placements sans
 * validation ; jusqu'ici, le seul écho côté admin était le compteur agrégé
 * du tableau de bord. Une correction faite ici est journalisée (voir
 * `admin_corrected_placement_stage` dans l'activité récente).
 */
export function AdminPlacements() {
  const [placements, setPlacements] = useState<AdminPlacement[] | null>(null)
  const [error, setError] = useState('')

  const load = () => {
    setError('')
    apiAdminPlacements()
      .then(setPlacements)
      .catch(() => setError('Impossible de charger les placements.'))
  }

  useEffect(load, [])

  const handleStageChange = async (id: string, stage: PlacementStage) => {
    setPlacements((list) => list?.map((p) => (p.id === id ? { ...p, stage } : p)) ?? null)
    await apiUpdatePlacementStage(id, stage)
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
          <p className="eyebrow">Back-office OffRec</p>
          <h1>Placements</h1>
          <p>
            Tous les placements déclarés par les recruteurs, toutes offres confondues.
            Le recruteur fait avancer ses étapes lui-même — une correction faite ici est
            journalisée dans l’activité récente du tableau de bord.
          </p>
        </header>

        {placements.length === 0 ? (
          <EmptyState
            icon={ClipboardCheck}
            title="Aucun placement déclaré"
            description="Les placements déclarés par les recruteurs depuis une shortlist apparaîtront ici."
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {placements.map((p) => (
              <Card key={p.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem' }}>
                      <strong>
                        {p.candidate?.candidateProfile?.fullName ?? p.talent?.fullName ?? 'Profil supprimé'}
                      </strong>
                      <Badge variant={p.talentId ? 'success' : 'primary'}>
                        {p.talentId ? 'Talent vérifié' : 'Candidat diplômé'}
                      </Badge>
                    </div>
                    <p style={{ fontSize: '0.85rem', color: 'var(--color-ink-muted)' }}>
                      {p.opportunity?.title ?? 'Offre supprimée'} — {p.recruiter.recruiterProfile?.companyName ?? p.recruiter.email}
                    </p>
                    <p style={{ fontSize: '0.85rem', color: 'var(--color-ink-muted)' }}>
                      {p.monthlySalaryAr ? `${p.monthlySalaryAr.toLocaleString('fr-FR')} Ar / mois` : 'Salaire non précisé'}
                      {' · '}
                      <time>{formatDate(p.createdAt)}</time>
                    </p>
                  </div>
                  <div style={{ minWidth: 210 }}>
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
