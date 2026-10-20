import { CalendarCheck } from 'lucide-react'
import { useState } from 'react'
import type { FormEvent } from 'react'
import { Button } from '../ui/Button'
import { Field, Textarea } from '../ui/Form'
import { Modal } from '../ui/Modal'
import { ApiError, apiRescheduleInterview, apiScheduleInterview } from '../../lib/api'
import { INTERVIEW_MESSAGE_MAX, contactDetailsError } from '../../lib/interview'
import type { Interview, InterviewDuration } from '../../types'
import { InterviewDateFields, defaultInterviewDateInputs, interviewDateInputsToIso } from './InterviewDateFields'
import './InterviewScheduleModal.css'

interface InterviewScheduleModalProps {
  /** `schedule` : « Ce profil m'intéresse » (mise en relation) ;
   *  `reschedule` : nouvelle date du tour actif ;
   *  `next_round` : tour suivant après « Second entretien » ou une absence. */
  mode: 'schedule' | 'reschedule' | 'next_round'
  suggestionId: string
  candidateName: string
  opportunityTitle: string
  /** Entretien existant (reprogrammation, tour précédent) : pré-remplit durée et message. */
  current?: Interview | null
  /** Numéro du tour à fixer (`next_round`). */
  round?: number
  onClose: () => void
  /** Appelé après l'enregistrement par le serveur, avec un message de confirmation. */
  onDone: (feedback: string) => void
}

const TITLES = {
  schedule: 'Proposer un entretien',
  reschedule: 'Reprogrammer l’entretien',
  next_round: 'Planifier le tour suivant',
} as const

/**
 * Modale du recruteur : fixer (« Ce profil m'intéresse »), reprogrammer un
 * entretien ou fixer le tour suivant. Une seule date et heure, saisie en
 * heure de Madagascar ; le serveur refait tous les contrôles (fenêtre de 2 h
 * à 60 jours, accord du candidat, double envoi, 3 tours au plus).
 */
export function InterviewScheduleModal({
  mode,
  suggestionId,
  candidateName,
  opportunityTitle,
  current,
  round,
  onClose,
  onDone,
}: InterviewScheduleModalProps) {
  const initial = defaultInterviewDateInputs()
  const [date, setDate] = useState(initial.date)
  const [time, setTime] = useState(initial.time)
  const [duration, setDuration] = useState<InterviewDuration>(
    (current?.durationMinutes as InterviewDuration | undefined) ?? 30,
  )
  // Un tour suivant repart d'un message vide : celui du tour précédent ne
  // vaut plus pour ce nouvel entretien.
  const [message, setMessage] = useState(mode === 'next_round' ? '' : current?.message ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const close = () => {
    if (!busy) onClose()
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (busy) return
    const when = interviewDateInputsToIso(date, time)
    if (!when.ok) {
      setError(when.error)
      return
    }
    const contactError = contactDetailsError(message)
    if (contactError) {
      setError(contactError)
      return
    }
    setBusy(true)
    setError('')
    try {
      const input = { scheduledAt: when.iso, durationMinutes: duration, message: message.trim() || null }
      if (mode === 'reschedule') {
        await apiRescheduleInterview(suggestionId, input)
        onDone(`Nouvelle date envoyée à ${candidateName}, qui doit la confirmer.`)
      } else {
        await apiScheduleInterview(suggestionId, input)
        onDone(
          mode === 'next_round'
            ? `${round ? `Tour ${round}` : 'Tour suivant'} fixé avec ${candidateName} : OffRec le prévient (plateforme et email) et il doit confirmer sa présence.`
            :`Entretien fixé avec ${candidateName} : la mise en relation est faite et le candidat est notifié.`,
        )
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Enregistrement impossible. Réessayez.')
      setBusy(false)
    }
  }

  const title = mode === 'next_round' && round ? `Planifier le tour ${round}` : TITLES[mode]
  const submitLabel =
    mode === 'schedule'
      ? 'Fixer l’entretien et mettre en relation'
      : mode === 'reschedule'
        ? 'Envoyer la nouvelle date'
        : round
          ? `Fixer le tour ${round}`
          : 'Fixer le tour suivant'

  return (
    <Modal title={title} onClose={close}>
      <form className="ivm-form" onSubmit={submit} noValidate>
        <p className="ivm-context">
          <strong>{candidateName}</strong> · {opportunityTitle}
        </p>

        <InterviewDateFields
          date={date}
          time={time}
          duration={duration}
          onDateChange={setDate}
          onTimeChange={setTime}
          onDurationChange={setDuration}
        />

        <Field
          label="Message au candidat (facultatif)"
          hint={`Sans email ni téléphone : OffRec transmet les informations utiles. ${message.length}/${INTERVIEW_MESSAGE_MAX}`}
        >
          <Textarea
            rows={3}
            maxLength={INTERVIEW_MESSAGE_MAX}
            value={message}
            placeholder="Ex. : l’entretien portera sur vos projets récents."
            onChange={(e) => setMessage(e.target.value)}
          />
        </Field>

        <div className="ivm-reminder">
          {mode === 'schedule' ? (
            <>
              <p>
                <strong>En validant, OffRec vous met en relation avec ce candidat.</strong> Il est notifié sur la
                plateforme et par email, découvre le nom de votre entreprise, puis confirme sa présence ou signale un
                empêchement.
              </p>
              <p>
                Le lien Google Meet est créé dans l’agenda d’OffRec et transmis à chacun par OffRec : aucune adresse
                n’est échangée.
              </p>
            </>
          ) : mode === 'reschedule' ? (
            <p>Le candidat est notifié de la nouvelle date (plateforme et email) et devra la confirmer.</p>
          ) : (
            <>
              <p>
                OffRec informe le candidat de ce nouvel entretien (plateforme et email). Il confirme sa présence ou
                signale un empêchement.
              </p>
              <p>Un nouveau lien Google Meet est créé pour ce tour ; l’entretien précédent reste dans l’historique.</p>
            </>
          )}
        </div>

        {error && (
          <p className="ivm-error" role="alert">
            {error}
          </p>
        )}

        <div className="ivm-actions">
          <Button variant="ghost" size="sm" disabled={busy} onClick={close}>
            Annuler
          </Button>
          <Button type="submit" size="sm" disabled={busy} aria-busy={busy}>
            <CalendarCheck size={14} aria-hidden />
            {busy ? 'Enregistrement…' : submitLabel}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
