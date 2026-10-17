import { useState } from 'react'
import { CalendarClock, CalendarX } from 'lucide-react'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import { InterviewScheduleModal } from './InterviewScheduleModal'
import { InterviewSummary } from './InterviewSummary'
import { ApiError, apiCancelInterview } from '../../lib/api'
import { formatMadagascarDateTime } from '../../lib/interview'
import type { Interview } from '../../types'
import './RecruiterInterviewDetail.css'

export interface RecruiterInterviewTarget {
  suggestionId: string
  candidateName: string
  opportunityTitle: string
  interview: Interview
  /** Dossier `mise_en_relation` : « Modifier la date », « Reprogrammer » et
   *  « Annuler » sont permis (le serveur reste juge). */
  canManage: boolean
}

interface RecruiterInterviewDetailProps {
  /** Relu par le parent à chaque rendu (par identifiant de dossier) : la
   *  modale revient à jour après une reprogrammation ou une annulation. */
  target: RecruiterInterviewTarget
  onClose: () => void
  /** Appelé après une reprogrammation ou une annulation enregistrée, avec
   *  le message de confirmation : le parent recharge ses données. */
  onChanged: (feedback: string) => Promise<void> | void
}

type Step = 'detail' | 'reschedule' | 'cancel'

/**
 * Détail d'un entretien côté recruteur, partagé par « Candidats proposés »
 * et « Entretiens » : récapitulatif (`InterviewSummary`), puis « Modifier la
 * date » (ou « Reprogrammer » après un empêchement ou une annulation) et
 * « Annuler l'entretien ». Pendant la reprogrammation ou la confirmation
 * d'annulation, la modale de détail s'efface, puis revient avec le message
 * de confirmation.
 */
export function RecruiterInterviewDetail({ target, onClose, onChanged }: RecruiterInterviewDetailProps) {
  const [step, setStep] = useState<Step>('detail')
  const [feedback, setFeedback] = useState('')
  const [busy, setBusy] = useState(false)
  const [cancelError, setCancelError] = useState('')
  const { interview, candidateName, opportunityTitle, suggestionId, canManage } = target

  const backToDetail = () => {
    if (busy) return
    setStep('detail')
    setCancelError('')
  }

  const changed = async (text: string) => {
    setStep('detail')
    setFeedback(text)
    await onChanged(text)
  }

  const confirmCancel = async () => {
    setBusy(true)
    setCancelError('')
    try {
      await apiCancelInterview(suggestionId)
      setBusy(false)
      await changed(`Entretien annulé. ${candidateName} est prévenu·e ; la mise en relation reste active.`)
    } catch (err) {
      setCancelError(err instanceof ApiError ? err.message : 'Annulation impossible. Réessayez.')
      setBusy(false)
    }
  }

  if (step === 'reschedule') {
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

  if (step === 'cancel') {
    return (
      <Modal title="Annuler l’entretien ?" onClose={backToDetail}>
        <p className="rivd-text">
          L’entretien avec <strong>{candidateName}</strong> prévu le {formatMadagascarDateTime(interview.scheduledAt)}{' '}
          sera annulé et le candidat prévenu (plateforme et email). La mise en relation reste active : vous pourrez
          reprogrammer un entretien.
        </p>
        {cancelError && (
          <p className="rivd-feedback is-error" role="alert">
            {cancelError}
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

  return (
    <Modal title={`Entretien avec ${candidateName}`} onClose={onClose}>
      <p className="rivd-offer">{opportunityTitle}</p>
      {feedback && (
        <p className="rivd-feedback is-ok" role="status">
          {feedback}
        </p>
      )}
      <InterviewSummary interview={interview} audience="recruiter" title="Récapitulatif">
        {canManage && (
          <Button
            variant={needsNewDate ? 'primary' : 'outline'}
            size="sm"
            onClick={() => {
              setFeedback('')
              setStep('reschedule')
            }}
          >
            <CalendarClock size={14} aria-hidden />
            {needsNewDate ? 'Reprogrammer' : 'Modifier la date'}
          </Button>
        )}
        {canManage && interview.status !== 'annule' && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setFeedback('')
              setStep('cancel')
            }}
          >
            <CalendarX size={14} aria-hidden />
            Annuler l’entretien
          </Button>
        )}
      </InterviewSummary>
    </Modal>
  )
}
