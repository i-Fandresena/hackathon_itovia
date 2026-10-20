import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Briefcase, ExternalLink } from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { Select } from '../../components/ui/Form'
import { Loading } from '../../components/ui/Loading'
import { ApiError, apiMyPlacements, apiUpdatePlacementStage, type RecruiterPlacement } from '../../lib/api'
import { formatAriary, formatDate } from '../../lib/format'
import { CONTRACT_TYPE_LABELS, formatCivilDate } from '../../lib/hiring'
import { PLACEMENT_ORIGIN_LABELS } from '../../components/hiring/hiringState'
import type { PlacementStage } from '../../types'
import './RecruiterPlacements.css'

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

/** Dossier d'un candidat diplômé dans « Candidats proposés » (détail ouvert). */
function dossierPath(p: RecruiterPlacement): string | null {
  if (!p.suggestionId || !p.opportunity) return null
  return `/recruteur/candidatures?offre=${encodeURIComponent(p.opportunity.id)}&dossier=${encodeURIComponent(p.suggestionId)}`
}

/**
 * Placements du recruteur et suivi déclaratif du success fee. Un candidat
 * diplômé est placé automatiquement quand il accepte la proposition
 * d'embauche (« Proposition acceptée », poste, date de début et contrat
 * repris de la proposition) ; un talent proposé par un agent se déclare
 * depuis la shortlist de l'offre (« Déclaré »). Les étapes du success fee
 * restent manuelles.
 */
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
          <p>
            Suivi déclaratif du success fee — aucun paiement automatisé au MVP. Un candidat diplômé est placé
            automatiquement quand il accepte votre proposition d’embauche ; un talent se déclare depuis la shortlist de
            l’offre.
          </p>
        </header>

        {stageError && (
          <p className="rpl-error" role="alert">
            {stageError}
          </p>
        )}

        {placements.length === 0 ? (
          <EmptyState
            icon={Briefcase}
            title="Aucun placement pour l’instant"
            description="Le placement d’un candidat diplômé apparaît ici dès qu’il accepte votre proposition d’embauche (depuis « Candidats proposés »). Pour un talent proposé par un agent, déclarez-le depuis la shortlist de l’offre."
          />
        ) : (
          <div className="rpl-list">
            {placements.map((p) => {
              const origin = p.origin ?? 'declaration'
              const path = dossierPath(p)
              const contract = p.contractType ? CONTRACT_TYPE_LABELS[p.contractType] : null
              return (
                <Card key={p.id} className="rpl-card">
                  <div className="rpl-main">
                    <div className="rpl-badges">
                      <Badge variant={p.talentId ? 'success' : 'primary'}>
                        {p.talentId ? 'Talent vérifié' : 'Candidat diplômé'}
                      </Badge>
                      <Badge variant={origin === 'proposition_acceptee' ? 'success' : 'muted'}>
                        {PLACEMENT_ORIGIN_LABELS[origin]}
                      </Badge>
                      {p.stage === 'annule' && <Badge variant="muted">Annulé</Badge>}
                    </div>
                    <p className="rpl-name">
                      {personLabel(p)}
                      {p.opportunity && <span className="rpl-offer"> · {p.opportunity.title}</span>}
                    </p>
                    <dl className="rpl-facts">
                      {p.jobTitle && (
                        <div>
                          <dt>Poste</dt>
                          <dd>{p.jobTitle}</dd>
                        </div>
                      )}
                      <div>
                        <dt>Salaire mensuel</dt>
                        <dd>{p.monthlySalaryAr ? formatAriary(p.monthlySalaryAr) : 'Non précisé'}</dd>
                      </div>
                      {p.startDate && (
                        <div>
                          <dt>Début</dt>
                          <dd>{formatCivilDate(p.startDate)}</dd>
                        </div>
                      )}
                      {contract && (
                        <div>
                          <dt>Contrat</dt>
                          <dd>{contract}</dd>
                        </div>
                      )}
                    </dl>
                    <p className="rpl-meta">
                      {origin === 'proposition_acceptee' ? 'Créé le ' : 'Déclaré le '}
                      <time dateTime={p.createdAt}>{formatDate(p.createdAt)}</time>
                      {path && (
                        <>
                          {' · '}
                          <Link to={path} className="rpl-link">
                            Voir le dossier
                            <ExternalLink size={13} aria-hidden />
                          </Link>
                        </>
                      )}
                    </p>
                  </div>
                  <div className="rpl-stage">
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
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
