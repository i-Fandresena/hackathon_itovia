import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarClock, CalendarPlus, CalendarX, ClipboardCheck, ExternalLink, Pencil, Send, Undo2 } from 'lucide-react'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import { HiringPhaseBadge } from '../hiring/HiringPhaseBadge'
import { HireProposalModal } from '../hiring/HireProposalModal'
import { HireProposalSummary, stateText } from '../hiring/HireProposalSummary'
import { connectedDossierState, latestProposal, pendingProposal } from '../hiring/hiringState'
import { InterviewOutcomeModal } from './InterviewOutcomeModal'
import { InterviewRounds } from './InterviewRounds'
import { InterviewScheduleModal } from './InterviewScheduleModal'
import { InterviewSummary } from './InterviewSummary'
import { useApp } from '../../context/AppContext'
import {
  ApiError,
  apiCancelInterview,
  apiWithdrawHireProposal,
  type DossierPlacement,
  type RecruiterInterview,
} from '../../lib/api'
import {
  HIRE_PROPOSAL_STATUS_LABELS,
  MAX_PROPOSAL_VERSIONS,
  activeRoundOf,
  allowedHiringActions,
  checkHiringAction,
  hiringPhase,
  nextProposalVersion,
  nextRoundNumber,
  proposalWithdrawnNotice,
  sortRounds,
  type HireProposalView,
  type HiringPhase,
} from '../../lib/hiring'
import { formatMadagascarDateTime } from '../../lib/interview'
import './RecruiterInterviewDetail.css'

/** Suivi du success fee : le placement créé par l'acceptation y apparaît. */
const PLACEMENTS_PATH = '/recruteur/placements'

export interface RecruiterInterviewTarget {
  suggestionId: string
  candidateName: string
  opportunityTitle: string
  /** Tour affiché : le tour actif, sinon le dernier. */
  interview: RecruiterInterview
  /** Tous les tours du dossier, avec leur issue (par défaut : le tour affiché seul). */
  rounds?: RecruiterInterview[]
  /** Phase dérivée par le serveur (`hiringPhase`), qui fait foi pour le badge. */
  phase?: HiringPhase | null
  /** Propositions d'embauche du dossier, toutes versions (sous-lot 6 ; vue recruteur). */
  proposals?: HireProposalView[]
  /** Placement lié au dossier (embauche), ou `null`. */
  placement?: DossierPlacement | null
  /** `Opportunity.filledAt` s'il est connu (sinon déduit de la phase `poste_pourvu`). */
  filledAt?: string | null
  /** Dossier `mise_en_relation` : les actions sur les tours sont permises
   *  (`allowedHiringActions`, le serveur reste juge). */
  canManage: boolean
}

/** Étape ouverte directement depuis une carte (« Renseigner l'issue », « Planifier le tour n », « Faire une proposition »). */
export type RecruiterInterviewEntry = 'detail' | 'outcome' | 'next_round' | 'proposal'

interface RecruiterInterviewDetailProps {
  /** Relu par le parent à chaque rendu (par identifiant de dossier) : la
   *  modale revient à jour après chaque action enregistrée. */
  target: RecruiterInterviewTarget
  /** Étape d'ouverture ; annuler cette étape referme tout (retour au bouton d'origine). */
  initialStep?: RecruiterInterviewEntry
  onClose: () => void
  /** Appelé après une action enregistrée, avec le message de confirmation :
   *  le parent recharge ses données. */
  onChanged: (feedback: string) => Promise<void> | void
  /** Recharge les données du parent sans message (proposition changée
   *  entre-temps : 409 sur une révision périmée). Par défaut : rien. */
  onRefresh?: () => Promise<void> | void
}

type Step = 'detail' | 'reschedule' | 'cancel' | 'outcome' | 'next_round' | 'proposal' | 'revise' | 'withdraw'

/**
 * Détail d'un entretien côté recruteur, partagé par « Candidats proposés »
 * et « Entretiens » : récapitulatif du tour (`InterviewSummary`), phase du
 * dossier, proposition d'embauche, historique des tours (`InterviewRounds`),
 * puis les actions que permettent les règles de src/lib/hiring.ts :
 * « Renseigner l'issue » une fois l'heure de fin passée (« Reprogrammer » en
 * secondaire), « Planifier le tour n » après « Second entretien » ou une
 * absence (3 tours au plus), « Modifier la date » et « Annuler l'entretien »
 * sur le tour actif (jamais de nouvelle date sur une offre pourvue),
 * « Faire une proposition » après « Retenu », « Modifier » / « Retirer » une
 * proposition en attente (sous-lot 6).
 *
 * Une seule modale à la fois : chaque étape (issue, tour suivant,
 * reprogrammation, annulation, proposition, retrait) remplace le détail,
 * puis le détail revient avec le message de confirmation ; Échap ne ferme
 * qu'un niveau.
 */
export function RecruiterInterviewDetail({
  target,
  initialStep = 'detail',
  onClose,
  onChanged,
  onRefresh,
}: RecruiterInterviewDetailProps) {
  const { currentUser } = useApp()
  const [step, setStep] = useState<Step>(initialStep)
  const [entry, setEntry] = useState<RecruiterInterviewEntry>(initialStep)
  const [feedback, setFeedback] = useState('')
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState('')
  const { interview, candidateName, opportunityTitle, suggestionId, canManage } = target

  const rounds = target.rounds && target.rounds.length > 0 ? sortRounds(target.rounds) : [interview]
  const proposals = [...(target.proposals ?? [])].sort((a, b) => a.version - b.version)
  const state = connectedDossierState(rounds, {
    proposals,
    placement: target.placement,
    filledAt: target.filledAt,
    phase: target.phase,
  })
  const now = new Date()
  const allowed = canManage ? allowedHiringActions('recruiter', state, now) : []
  const phase = target.phase !== undefined ? target.phase : canManage ? hiringPhase(state, now) : null
  const activeState = activeRoundOf(state.rounds)
  const active = activeState ? rounds.find((row) => row.id === activeState.id) : undefined
  const lastRound = rounds[rounds.length - 1]
  const nextRound = nextRoundNumber(state.rounds)

  // Offre pourvue (`poste_pourvu`) : seules « Non retenu » et « Absent » restent
  // possibles sur un tour passé (`allowedOutcomeResults` dans la modale).
  const canRecord =
    allowed.includes('record_outcome') &&
    Boolean(active) &&
    (phase == null || phase === 'issue_a_renseigner' || phase === 'poste_pourvu')
  const canReschedule = allowed.includes('reschedule_round') && active?.id === interview.id
  const canCancel = allowed.includes('cancel_round') && active?.id === interview.id
  const followUpPhase = phase === 'second_entretien_a_planifier' || phase === 'absent'
  const scheduleCheck = canManage ? checkHiringAction({ actor: 'recruiter', action: 'schedule_round', state, now }) : null
  const canPlanNext = followUpPhase && Boolean(scheduleCheck?.ok)
  const planBlocked = followUpPhase && scheduleCheck && !scheduleCheck.ok ? scheduleCheck.error : null

  const latest = latestProposal(proposals)
  const pending = pendingProposal(proposals, now)
  const canSend = allowed.includes('send_proposal')
  const sendCheck = canManage ? checkHiringAction({ actor: 'recruiter', action: 'send_proposal', state, now }) : null
  const sendBlocked = phase === 'retenu' && sendCheck && !sendCheck.ok ? sendCheck.error : null
  const canRevise = Boolean(pending) && allowed.includes('revise_proposal')
  const canWithdraw = Boolean(pending) && allowed.includes('withdraw_proposal')
  const nextVersion = nextProposalVersion(state.proposals)
  const companyName = currentUser?.recruiterProfile?.companyName || 'Votre entreprise'

  const backToDetail = () => {
    if (busy) return
    setActionError('')
    // Ouverte directement sur cette étape : l'annuler referme tout.
    if (step !== 'detail' && step === entry) {
      onClose()
      return
    }
    setStep('detail')
  }

  const open = (next: Step) => {
    setFeedback('')
    setActionError('')
    setStep(next)
  }

  const changed = async (text: string) => {
    setEntry('detail')
    setStep('detail')
    setFeedback(text)
    await onChanged(text)
  }

  const refresh = async () => {
    await onRefresh?.()
  }

  const confirmCancel = async () => {
    setBusy(true)
    setActionError('')
    try {
      await apiCancelInterview(suggestionId)
      setBusy(false)
      await changed(`Entretien annulé. ${candidateName} est prévenu·e ; la mise en relation reste active.`)
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Annulation impossible. Réessayez.')
      setBusy(false)
    }
  }

  const confirmWithdraw = async () => {
    if (!pending) return
    setBusy(true)
    setActionError('')
    try {
      await apiWithdrawHireProposal(suggestionId, pending.revision)
      setBusy(false)
      await changed(
        `Proposition retirée. OffRec prévient ${candidateName} (plateforme et email) avec un message neutre.`,
      )
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Retrait impossible. Réessayez.'
      if (err instanceof ApiError && err.status === 409) await refresh()
      setActionError(message)
      setBusy(false)
    }
  }

  if (step === 'reschedule' && canReschedule) {
    return (
      <InterviewScheduleModal
        mode="reschedule"
        suggestionId={suggestionId}
        candidateName={candidateName}
        opportunityTitle={opportunityTitle}
        current={interview}
        onClose={backToDetail}
        onDone={changed}
      />
    )
  }

  if (step === 'next_round') {
    return (
      <InterviewScheduleModal
        mode="next_round"
        round={nextRound}
        suggestionId={suggestionId}
        candidateName={candidateName}
        opportunityTitle={opportunityTitle}
        current={lastRound}
        onClose={backToDetail}
        onDone={changed}
      />
    )
  }

  if (step === 'outcome' && active) {
    return (
      <InterviewOutcomeModal
        suggestionId={suggestionId}
        candidateName={candidateName}
        opportunityTitle={opportunityTitle}
        interview={active}
        state={state}
        onClose={backToDetail}
        onDone={changed}
      />
    )
  }

  if (step === 'proposal' && canSend) {
    return (
      <HireProposalModal
        mode="send"
        suggestionId={suggestionId}
        candidateName={candidateName}
        opportunityTitle={opportunityTitle}
        current={latest}
        version={nextVersion}
        onClose={backToDetail}
        onDone={changed}
        onStale={refresh}
      />
    )
  }

  // Modification : la modale relit la dernière version (après un 409, la
  // version à jour, ou son nouvel état si elle n'est plus en attente).
  if (step === 'revise' && latest) {
    return (
      <HireProposalModal
        mode="revise"
        suggestionId={suggestionId}
        candidateName={candidateName}
        opportunityTitle={opportunityTitle}
        current={latest}
        version={latest.version}
        onClose={backToDetail}
        onDone={changed}
        onStale={refresh}
      />
    )
  }

  if (step === 'withdraw' && latest) {
    const remaining = MAX_PROPOSAL_VERSIONS - proposals.length
    return (
      <Modal key="withdraw" title="Retirer la proposition ?" onClose={backToDetail}>
        {pending ? (
          <>
            <p className="rivd-text">
              La proposition « {pending.jobTitle} » (version {pending.version}) faite à <strong>{candidateName}</strong>{' '}
              sera retirée ; motif enregistré : « Retirée par l’entreprise ». OffRec prévient le candidat sur la
              plateforme et par email, avec un message neutre :
            </p>
            <p className="rivd-quote">« {proposalWithdrawnNotice({ companyName, jobTitle: pending.jobTitle }).message} »</p>
            <p className="rivd-text">
              {remaining > 0
                ? `Vous pourrez envoyer une nouvelle proposition (${remaining} version${remaining > 1 ? 's' : ''} restante${remaining > 1 ? 's' : ''} sur ${MAX_PROPOSAL_VERSIONS}).`
                : `C’était la dernière version possible (${MAX_PROPOSAL_VERSIONS} au plus) : aucune nouvelle proposition ne pourra être envoyée pour ce dossier.`}
            </p>
          </>
        ) : (
          <p className="rivd-text">
            Cette proposition n’est plus en attente : {stateText(latest, 'recruiter')}
          </p>
        )}
        {actionError && (
          <p className="rivd-feedback is-error" role="alert">
            {actionError}
          </p>
        )}
        <div className="rivd-actions">
          <Button variant="ghost" size="sm" disabled={busy} onClick={backToDetail}>
            {pending ? 'Garder la proposition' : 'Fermer'}
          </Button>
          {pending && (
            <Button variant="danger" size="sm" disabled={busy} aria-busy={busy} onClick={() => void confirmWithdraw()}>
              <Undo2 size={14} aria-hidden />
              {busy ? 'Retrait…' : 'Retirer la proposition'}
            </Button>
          )}
        </div>
      </Modal>
    )
  }

  if (step === 'cancel') {
    return (
      <Modal key="cancel" title="Annuler l’entretien ?" onClose={backToDetail}>
        <p className="rivd-text">
          L’entretien avec <strong>{candidateName}</strong> prévu le {formatMadagascarDateTime(interview.scheduledAt)}{' '}
          sera annulé et le candidat prévenu (plateforme et email). La mise en relation reste active : vous pourrez
          reprogrammer un entretien.
        </p>
        {actionError && (
          <p className="rivd-feedback is-error" role="alert">
            {actionError}
          </p>
        )}
        <div className="rivd-actions">
          <Button variant="ghost" size="sm" disabled={busy} onClick={backToDetail}>
            Garder l’entretien
          </Button>
          <Button variant="danger" size="sm" disabled={busy} aria-busy={busy} onClick={confirmCancel}>
            {busy ? 'Annulation…' : 'Annuler l’entretien'}
          </Button>
        </div>
      </Modal>
    )
  }

  const needsNewDate = interview.status === 'empechement' || interview.status === 'annule'
  const showRounds = rounds.length > 1 || rounds.some((row) => row.outcome)
  const round = interview.round ?? 1
  const olderVersions = latest ? proposals.filter((row) => row.id !== latest.id).reverse() : []

  return (
    <Modal key="detail" title={`Entretien avec ${candidateName} — tour ${round}`} onClose={onClose}>
      <div className="rivd-head">
        <p className="rivd-offer">{opportunityTitle}</p>
        {phase && <HiringPhaseBadge audience="recruiter" phase={phase} />}
      </div>
      {feedback && (
        <p className="rivd-feedback is-ok" role="status">
          {feedback}
        </p>
      )}

      {latest && (
        <div className="rivd-proposal">
          <HireProposalSummary proposal={latest} audience="recruiter">
            {canRevise && (
              <Button size="sm" variant="outline" aria-haspopup="dialog" onClick={() => open('revise')}>
                <Pencil size={14} aria-hidden />
                Modifier
              </Button>
            )}
            {canWithdraw && (
              <Button size="sm" variant="ghost" aria-haspopup="dialog" onClick={() => open('withdraw')}>
                <Undo2 size={14} aria-hidden />
                Retirer
              </Button>
            )}
            {canSend && (
              <Button size="sm" aria-haspopup="dialog" onClick={() => open('proposal')}>
                <Send size={14} aria-hidden />
                Nouvelle proposition (version {nextVersion}/{MAX_PROPOSAL_VERSIONS})
              </Button>
            )}
            {latest.status === 'acceptee' && (
              <Link to={PLACEMENTS_PATH} className="btn btn-outline btn-sm">
                <ExternalLink size={14} aria-hidden />
                Voir le placement
              </Link>
            )}
          </HireProposalSummary>
          {olderVersions.length > 0 && (
            <details className="rivd-versions">
              <summary>Versions précédentes ({olderVersions.length})</summary>
              <ul>
                {olderVersions.map((row) => (
                  <li key={row.id}>
                    Version {row.version} · {HIRE_PROPOSAL_STATUS_LABELS[row.status]} · {stateText(row, 'recruiter')}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}

      <InterviewSummary interview={interview} audience="recruiter" title="Récapitulatif">
        {canRecord && (
          <Button size="sm" aria-haspopup="dialog" onClick={() => open('outcome')}>
            <ClipboardCheck size={14} aria-hidden />
            Renseigner l’issue
          </Button>
        )}
        {canPlanNext && (
          <Button size="sm" aria-haspopup="dialog" onClick={() => open('next_round')}>
            <CalendarPlus size={14} aria-hidden />
            Planifier le tour {nextRound}
          </Button>
        )}
        {canReschedule && (
          <Button
            variant={needsNewDate && !canRecord ? 'primary' : 'outline'}
            size="sm"
            aria-haspopup="dialog"
            onClick={() => open('reschedule')}
          >
            <CalendarClock size={14} aria-hidden />
            {needsNewDate || canRecord ? 'Reprogrammer' : 'Modifier la date'}
          </Button>
        )}
        {canCancel && interview.status !== 'annule' && (
          <Button variant="ghost" size="sm" aria-haspopup="dialog" onClick={() => open('cancel')}>
            <CalendarX size={14} aria-hidden />
            Annuler l’entretien
          </Button>
        )}
      </InterviewSummary>

      <PhaseNote
        phase={phase}
        planBlocked={planBlocked}
        canSend={canSend && !latest}
        sendBlocked={sendBlocked}
        canRecord={canRecord}
        onSend={() => open('proposal')}
      />

      {showRounds && <InterviewRounds rounds={rounds} audience="recruiter" currentId={interview.id} />}
    </Modal>
  )
}

interface PhaseNoteProps {
  phase: HiringPhase | null
  planBlocked: string | null
  /** « Faire une proposition » (première version ; les suivantes sont dans l'encadré). */
  canSend: boolean
  sendBlocked: string | null
  canRecord: boolean
  onSend: () => void
}

/** Ce que la phase du dossier laisse à faire, sous le récapitulatif. */
function PhaseNote({ phase, planBlocked, canSend, sendBlocked, canRecord, onSend }: PhaseNoteProps) {
  switch (phase) {
    case 'issue_a_renseigner':
      return (
        <p className="rivd-note is-warning">
          L’entretien est terminé : renseignez son issue. « Reprogrammer » reste possible s’il n’a pas pu avoir lieu
          pour une raison technique.
        </p>
      )
    case 'second_entretien_a_planifier':
    case 'absent':
      return (
        <p className="rivd-note">
          {planBlocked
            ? `${planBlocked} Aucun nouveau tour ne peut être fixé pour ce dossier.`
            : phase === 'absent'
              ? 'Le candidat ne s’est pas présenté : il peut expliquer son absence à OffRec. Vous pouvez lui proposer un nouveau tour.'
              : 'Second entretien à planifier : fixez la date du tour suivant quand vous êtes prêt·e.'}
        </p>
      )
    case 'retenu':
      return (
        <div className="rivd-next">
          <p className="rivd-note is-ok">
            Candidat retenu. OffRec l’a informé avec un message neutre.
            {canSend ? ' Faites-lui une proposition d’embauche : OffRec la lui transmet (plateforme et email).' : ''}
          </p>
          {canSend && (
            <Button size="sm" aria-haspopup="dialog" onClick={onSend}>
              <Send size={14} aria-hidden />
              Faire une proposition
            </Button>
          )}
          {!canSend && sendBlocked && <p className="rivd-soon">{sendBlocked}</p>}
        </div>
      )
    case 'embauche':
      return (
        <p className="rivd-note is-ok">
          Embauche confirmée : le placement est créé (success fee, étape 1 due). Suivez-le dans{' '}
          <Link to={PLACEMENTS_PATH}>Placements</Link>.
        </p>
      )
    case 'embauche_annulee':
      return <p className="rivd-note">Le placement de ce dossier a été annulé : le dossier est clos.</p>
    case 'clos_proposition_refusee':
      return (
        <p className="rivd-note">
          Le candidat a décliné votre proposition : le dossier est clos. Son profil reste proposé pour d’autres offres.
        </p>
      )
    case 'poste_pourvu':
      return (
        <p className="rivd-note">
          Tous les postes de cette offre sont pourvus : ce dossier est clos, sans nouvel entretien ni proposition.
          {canRecord ? ' Vous pouvez encore renseigner l’issue « Non retenu » ou « Absent » de l’entretien passé.' : ''}
        </p>
      )
    case 'non_retenu':
      return (
        <p className="rivd-note">
          Dossier clos : OffRec a informé le candidat avec un message neutre. Son profil reste proposé pour d’autres
          offres.
        </p>
      )
    default:
      return null
  }
}
