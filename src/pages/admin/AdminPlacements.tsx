import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ClipboardCheck, ExternalLink } from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { Select } from '../../components/ui/Form'
import { Loading } from '../../components/ui/Loading'
import { PLACEMENT_ORIGIN_LABELS } from '../../components/hiring/hiringState'
import { ApiError, apiAdminPlacements, apiUpdatePlacementStage, type AdminPlacement } from '../../lib/api'
import { formatAriary, formatDate } from '../../lib/format'
import { CONTRACT_TYPE_LABELS, formatCivilDate } from '../../lib/hiring'
import type { PlacementStage } from '../../types'
import './AdminPlacements.css'

const STAGE_LABELS: Record<PlacementStage, string> = {
  etape1_due: 'Étape 1 due (signature)',
  etape1_payee: 'Étape 1 payée',
  etape2_due: 'Étape 2 due (confirmation)',
  etape2_payee: 'Étape 2 payée',
  annule: 'Annulé',
}

/** Dossier d'un candidat diplômé : ses propositions dans « Mise en relation ». */
function dossierPath(p: AdminPlacement): string | null {
  if (!p.suggestionId) return null
  return `/admin/mise-en-relation?onglet=propositions&dossier=${encodeURIComponent(p.suggestionId)}`
}

/**
 * Vue d'ensemble de tous les placements, tous recruteurs confondus. Un
 * candidat diplômé est placé automatiquement à l'acceptation de la
 * proposition d'embauche (« Proposition acceptée », poste, date de début et
 * contrat repris de la proposition, lien vers le dossier) ; un talent est
 * déclaré par le recruteur (« Déclaré »). Les étapes du success fee restent
 * déclaratives ; une correction faite ici est journalisée (voir
 * `admin_corrected_placement_stage` dans le journal d'activité, `/admin/activite`).
 */
export function AdminPlacements() {
  const [placements, setPlacements] = useState<AdminPlacement[] | null>(null)
  const [error, setError] = useState('')
  const [stageError, setStageError] = useState('')

  const load = () => {
    setError('')
    apiAdminPlacements()
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
          <p className="eyebrow">Back-office OffRec</p>
          <h1>Placements</h1>
          <p>
            Tous les placements, toutes offres confondues : créés automatiquement quand un candidat diplômé accepte une
            proposition d’embauche, ou déclarés par le recruteur pour un talent. Le recruteur fait avancer ses étapes
            lui-même — une correction faite ici est journalisée dans le journal d’activité.
          </p>
        </header>

        {stageError && (
          <p className="apl-error" role="alert">
            {stageError}
          </p>
        )}

        {placements.length === 0 ? (
          <EmptyState
            icon={ClipboardCheck}
            title="Aucun placement"
            description="Un placement apparaît ici quand un candidat accepte une proposition d’embauche, ou quand un recruteur déclare un talent depuis une shortlist."
          />
        ) : (
          <div className="apl-list">
            {placements.map((p) => {
              const origin = p.origin ?? 'declaration'
              const path = dossierPath(p)
              const person = p.candidate?.candidateProfile?.fullName ?? p.talent?.fullName ?? 'Profil supprimé'
              return (
                <Card key={p.id} className="apl-card">
                  <div className="apl-main">
                    <div className="apl-head">
                      <strong>{person}</strong>
                      <Badge variant={p.talentId ? 'success' : 'primary'}>
                        {p.talentId ? 'Talent vérifié' : 'Candidat diplômé'}
                      </Badge>
                      <Badge variant={origin === 'proposition_acceptee' ? 'success' : 'muted'}>
                        {PLACEMENT_ORIGIN_LABELS[origin]}
                      </Badge>
                    </div>
                    <p className="apl-muted">
                      {p.opportunity?.title ?? 'Offre supprimée'} —{' '}
                      {p.recruiter.recruiterProfile?.companyName ?? p.recruiter.email}
                    </p>
                    <dl className="apl-facts">
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
                      {p.contractType && (
                        <div>
                          <dt>Contrat</dt>
                          <dd>{CONTRACT_TYPE_LABELS[p.contractType]}</dd>
                        </div>
                      )}
                    </dl>
                    <p className="apl-muted">
                      {origin === 'proposition_acceptee' ? 'Créé le ' : 'Déclaré le '}
                      <time dateTime={p.createdAt}>{formatDate(p.createdAt)}</time>
                      {path && (
                        <>
                          {' · '}
                          <Link to={path} className="apl-link">
                            Voir le dossier
                            <ExternalLink size={13} aria-hidden />
                          </Link>
                        </>
                      )}
                    </p>
                  </div>
                  <div className="apl-stage">
                    <Select
                      value={p.stage}
                      aria-label={`Étape du success fee pour ${person}`}
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
