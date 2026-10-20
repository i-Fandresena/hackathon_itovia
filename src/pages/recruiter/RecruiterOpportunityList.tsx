import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Briefcase, CheckCircle2, Eye, Pencil, RotateCcw, Trash2, Users2 } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { EmptyState } from '../../components/ui/EmptyState'
import { Field, Input } from '../../components/ui/Form'
import { Loading } from '../../components/ui/Loading'
import { Modal } from '../../components/ui/Modal'
import { dossierGroup } from '../../components/hiring/hiringState'
import { useApp } from '../../context/AppContext'
import {
  ApiError,
  apiMarkOpportunityFilled,
  apiMyOpportunities,
  apiReopenOpportunity,
  type RecruiterOpportunity,
} from '../../lib/api'
import { formatDate } from '../../lib/format'
import {
  OPPORTUNITY_POSITIONS_MAX,
  checkOpportunityFillAction,
  positionsFillLabel,
  positionsUpdateError,
} from '../../lib/hiring'
import { OPPORTUNITY_TYPE_LABELS } from '../../data/constants'
import './RecruiterOpportunityList.css'

type Dialog = { kind: 'fill' | 'reopen'; id: string }

const fillState = (o: RecruiterOpportunity) => ({
  positions: o.positions ?? 1,
  activePlacements: o.activePlacements,
  filledAt: o.filledAt ?? null,
})

const plural = (count: number, singular: string, pluralForm: string) => `${count} ${count > 1 ? pluralForm : singular}`

/**
 * « Mes offres » : les offres du recruteur (`GET /opportunities/mine`,
 * pourvues comprises) avec « n / positions pourvus », le badge « Pourvue »,
 * « Marquer comme pourvue » (embauche faite hors OffRec : les autres dossiers
 * de l'offre sont clos, chaque candidat reçoit un message neutre) et
 * « Rouvrir » (nombre de postes facultatif ; les dossiers clos ne sont pas
 * réactivés). Règles : `checkOpportunityFillAction` / `positionsUpdateError`
 * (src/lib/hiring.ts) ; le serveur reste juge.
 */
export function RecruiterOpportunityList() {
  const navigate = useNavigate()
  const { deleteOpportunity, receivedSuggestions, refreshDossiers } = useApp()
  const [offers, setOffers] = useState<RecruiterOpportunity[] | null>(null)
  const [loadError, setLoadError] = useState('')
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null)
  const [dialog, setDialog] = useState<Dialog | null>(null)
  const [busy, setBusy] = useState(false)
  const [dialogError, setDialogError] = useState('')
  const [positionsInput, setPositionsInput] = useState('')

  const load = useCallback(async () => {
    setLoadError('')
    try {
      setOffers(await apiMyOpportunities())
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Impossible de charger vos offres.')
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const handleDelete = async (id: string, title: string) => {
    if (window.confirm(`Supprimer l’offre « ${title} » ?`)) {
      const result = await deleteOpportunity(id)
      if (!result.ok) setFeedback({ ok: false, text: result.error ?? 'Suppression impossible.' })
      await load()
    }
  }

  const openDialog = (kind: Dialog['kind'], id: string) => {
    setFeedback(null)
    setDialogError('')
    setPositionsInput('')
    setDialog({ kind, id })
  }

  const closeDialog = () => {
    if (!busy) setDialog(null)
  }

  const target = dialog && offers ? offers.find((o) => o.id === dialog.id) ?? null : null

  /** Ce que la clôture fera aux autres dossiers de l'offre (dossiers déjà chargés). */
  const closureImpact = (opportunityId: string) => {
    const dossiers = receivedSuggestions.filter((s) => s.opportunity.id === opportunityId)
    return {
      transmitted: dossiers.filter((s) => s.status === 'proposee_recruteur' || s.status === 'interet_recruteur').length,
      inProgress: dossiers.filter((s) => s.status === 'mise_en_relation' && dossierGroup(s.phase) === 'en_cours').length,
    }
  }

  const confirmFill = async () => {
    if (!target) return
    setBusy(true)
    setDialogError('')
    try {
      await apiMarkOpportunityFilled(target.id)
      setBusy(false)
      setDialog(null)
      setFeedback({
        ok: true,
        text: `« ${target.title} » est marquée comme pourvue. Les autres dossiers de l’offre sont clos et OffRec informe chaque candidat concerné avec un message neutre.`,
      })
      await Promise.all([load(), refreshDossiers()])
    } catch (err) {
      setDialogError(err instanceof ApiError ? err.message : 'Action impossible. Réessayez.')
      setBusy(false)
      if (err instanceof ApiError && err.status === 409) await load()
    }
  }

  const confirmReopen = async (event: FormEvent) => {
    event.preventDefault()
    if (!target) return
    const requested = positionsInput.trim() === '' ? undefined : Number(positionsInput)
    const check = checkOpportunityFillAction({ action: 'reopen', state: fillState(target), requestedPositions: requested })
    if (!check.ok) {
      setDialogError(check.error)
      return
    }
    setBusy(true)
    setDialogError('')
    try {
      const reopened = await apiReopenOpportunity(target.id, requested)
      setBusy(false)
      setDialog(null)
      setFeedback({
        ok: true,
        text: `« ${target.title} » est rouverte (${plural(reopened.positions ?? check.positions, 'poste', 'postes')} au total). Les dossiers clos ne sont pas réactivés ; OffRec recherche de nouveaux profils.`,
      })
      await Promise.all([load(), refreshDossiers()])
    } catch (err) {
      setDialogError(err instanceof ApiError ? err.message : 'Réouverture impossible. Réessayez.')
      setBusy(false)
      if (err instanceof ApiError && err.status === 409) await load()
    }
  }

  const header = (
    <header className="page-header rol-header">
      <div>
        <h1>Mes offres</h1>
        <p>Gérez vos publications, leurs postes à pourvoir et leur clôture.</p>
      </div>
      <Link to="/recruteur/publier" className="btn btn-primary btn-sm">
        Nouvelle offre
      </Link>
    </header>
  )

  if (loadError && !offers) {
    return (
      <div className="page">
        <div className="container">
          {header}
          <div className="rol-error" role="alert">
            <span>{loadError}</span>
            <Button variant="outline" size="sm" onClick={() => void load()}>
              <RotateCcw size={14} aria-hidden />
              Réessayer
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (!offers) {
    return (
      <div className="page">
        <div className="container">
          {header}
          <Loading label="Chargement de vos offres…" />
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <div className="container">
        {header}

        {feedback && (
          <p className={`rol-feedback ${feedback.ok ? 'is-ok' : 'is-error'}`} role="status">
            {feedback.text}
          </p>
        )}

        {offers.length === 0 ? (
          <EmptyState
            icon={Briefcase}
            title="Aucune offre publiée"
            description="Publiez votre première opportunité pour recevoir des profils proposés par OffRec."
            actionLabel="Publier une offre"
            onAction={() => navigate('/recruteur/publier')}
          />
        ) : (
          <div className="rol-list">
            {offers.map((o) => {
              const count = receivedSuggestions.filter((s) => s.opportunity.id === o.id).length
              const state = fillState(o)
              const filled = Boolean(o.filledAt)
              return (
                <Card key={o.id} className={`rol-card${filled ? ' is-filled' : ''}`}>
                  <div className="rol-head">
                    <div className="rol-title">
                      <h2>{o.title}</h2>
                      <p className="rol-meta">
                        {o.province} · date limite {formatDate(o.deadline)} ·{' '}
                        {plural(count, 'candidat proposé', 'candidats proposés')}
                      </p>
                    </div>
                    <div className="rol-badges">
                      {filled && <Badge variant="success">Pourvue</Badge>}
                      <Badge variant="muted">{OPPORTUNITY_TYPE_LABELS[o.opportunityType]}</Badge>
                    </div>
                  </div>

                  <p className={`rol-fill${filled ? ' is-filled' : ''}`}>
                    <CheckCircle2 size={14} aria-hidden />
                    {filled ? positionsFillLabel(state) : `${Math.min(state.activePlacements, state.positions)} / ${plural(state.positions, 'poste pourvu', 'postes pourvus')}`}
                    {filled && o.filledAt && <span className="rol-fill-date"> · depuis le {formatDate(o.filledAt)}</span>}
                  </p>

                  <div className="rol-actions">
                    <Link to={`/offres/${o.id}`} className="btn btn-outline btn-sm">
                      <Eye size={14} aria-hidden />
                      Voir l’offre
                    </Link>
                    <Link to={`/recruteur/offres/${o.id}/shortlist`} className="btn btn-outline btn-sm">
                      <Users2 size={14} aria-hidden />
                      Shortlist
                    </Link>
                    <Link to={`/recruteur/offres/${o.id}/modifier`} className="btn btn-outline btn-sm">
                      <Pencil size={14} aria-hidden />
                      Modifier
                    </Link>
                    {filled ? (
                      <Button size="sm" variant="outline" aria-haspopup="dialog" onClick={() => openDialog('reopen', o.id)}>
                        <RotateCcw size={14} aria-hidden />
                        Rouvrir
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" aria-haspopup="dialog" onClick={() => openDialog('fill', o.id)}>
                        <CheckCircle2 size={14} aria-hidden />
                        Marquer comme pourvue
                      </Button>
                    )}
                    <Button variant="danger" size="sm" onClick={() => void handleDelete(o.id, o.title)}>
                      <Trash2 size={14} aria-hidden />
                      Supprimer
                    </Button>
                  </div>
                </Card>
              )
            })}
          </div>
        )}

        {dialog?.kind === 'fill' && target && (
          <Modal key="fill" title="Marquer l’offre comme pourvue ?" onClose={closeDialog}>
            <FillDialogBody
              offer={target}
              impact={closureImpact(target.id)}
              busy={busy}
              error={dialogError}
              onCancel={closeDialog}
              onConfirm={() => void confirmFill()}
            />
          </Modal>
        )}

        {dialog?.kind === 'reopen' && target && (
          <Modal key="reopen" title="Rouvrir l’offre" onClose={closeDialog}>
            <form className="rol-dialog" onSubmit={confirmReopen} noValidate>
              <p className="rol-dialog-offer">{target.title}</p>
              <p className="rol-text">
                {positionsFillLabel(fillState(target))}. L’offre doit garder au moins un poste libre : sans précision, elle
                passe à{' '}
                {plural(Math.max(target.positions ?? 1, target.activePlacements + 1), 'poste', 'postes')}. Les dossiers
                clos ne sont pas réactivés ; OffRec recherche de nouveaux profils.
              </p>
              <Field
                label="Nombre de postes (facultatif)"
                hint={`Au moins ${target.activePlacements + 1}, au plus ${OPPORTUNITY_POSITIONS_MAX}.`}
              >
                <Input
                  type="number"
                  inputMode="numeric"
                  min={target.activePlacements + 1}
                  max={OPPORTUNITY_POSITIONS_MAX}
                  step={1}
                  value={positionsInput}
                  disabled={busy}
                  placeholder={String(Math.max(target.positions ?? 1, target.activePlacements + 1))}
                  aria-invalid={
                    positionsInput !== '' &&
                    positionsUpdateError(Number(positionsInput), target.activePlacements + 1) !== null
                      ? true
                      : undefined
                  }
                  onChange={(e) => setPositionsInput(e.target.value.replace(/\D/g, '').slice(0, 2))}
                />
              </Field>
              {dialogError && (
                <p className="rol-dialog-error" role="alert">
                  {dialogError}
                </p>
              )}
              <div className="rol-dialog-actions">
                <Button variant="ghost" size="sm" disabled={busy} onClick={closeDialog}>
                  Annuler
                </Button>
                <Button type="submit" size="sm" disabled={busy} aria-busy={busy}>
                  <RotateCcw size={14} aria-hidden />
                  {busy ? 'Réouverture…' : 'Rouvrir l’offre'}
                </Button>
              </div>
            </form>
          </Modal>
        )}
      </div>
    </div>
  )
}

function FillDialogBody({
  offer,
  impact,
  busy,
  error,
  onCancel,
  onConfirm,
}: {
  offer: RecruiterOpportunity
  impact: { transmitted: number; inProgress: number }
  busy: boolean
  error: string
  onCancel: () => void
  onConfirm: () => void
}) {
  const nothingToClose = impact.transmitted === 0 && impact.inProgress === 0
  return (
    <div className="rol-dialog">
      <p className="rol-dialog-offer">{offer.title}</p>
      <p className="rol-text">
        À utiliser quand le poste a été pourvu hors d’OffRec. L’offre sera fermée : OffRec n’y proposera plus de
        profils et aucune nouvelle proposition d’embauche ne pourra y être faite.
      </p>
      {nothingToClose ? (
        <p className="rol-text">Aucun autre dossier en cours sur cette offre.</p>
      ) : (
        <ul className="rol-impact">
          {impact.transmitted > 0 && (
            <li>
              {plural(impact.transmitted, 'profil transmis, non mis en relation, sera écarté', 'profils transmis, non mis en relation, seront écartés')}.
            </li>
          )}
          {impact.inProgress > 0 && (
            <li>
              {plural(impact.inProgress, 'dossier mis en relation en cours sera clos', 'dossiers mis en relation en cours seront clos')} :
              entretien à venir annulé, proposition en attente retirée.
            </li>
          )}
        </ul>
      )}
      <p className="rol-text">
        Chaque candidat concerné reçoit un message neutre d’OffRec. Les embauches déjà faites ne changent pas. Vous
        pourrez rouvrir l’offre, mais les dossiers clos ne seront pas réactivés.
      </p>
      {error && (
        <p className="rol-dialog-error" role="alert">
          {error}
        </p>
      )}
      <div className="rol-dialog-actions">
        <Button variant="ghost" size="sm" disabled={busy} onClick={onCancel}>
          Annuler
        </Button>
        <Button size="sm" disabled={busy} aria-busy={busy} onClick={onConfirm}>
          <CheckCircle2 size={14} aria-hidden />
          {busy ? 'Clôture…' : 'Marquer comme pourvue'}
        </Button>
      </div>
    </div>
  )
}
