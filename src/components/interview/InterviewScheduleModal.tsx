import { CalendarCheck } from 'lucide-react'
import { useState } from 'react'
import type { FormEvent } from 'react'
import { Button } from '../ui/Button'
import { Field, Input, Select, Textarea } from '../ui/Form'
import { Modal } from '../ui/Modal'
import { ApiError, apiRescheduleInterview, apiScheduleInterview } from '../../lib/api'
import {
  INTERVIEW_DURATIONS,
  INTERVIEW_MAX_AHEAD_DAYS,
  INTERVIEW_MESSAGE_MAX,
  contactDetailsError,
  interviewWindowError,
  madagascarInputsToIso,
  toMadagascarInputs,
} from '../../lib/interview'
import type { Interview, InterviewDuration } from '../../types'
import './InterviewScheduleModal.css'

interface InterviewScheduleModalProps {
  mode: 'schedule' | 'reschedule'
  suggestionId: string
  candidateName: string
  opportunityTitle: string
  /** Entretien existant (reprogrammation) : pré-remplit durée et message. */
  current?: Interview | null
  onClose: () => void
  /** Appelé après l'enregistrement par le serveur, avec un message de confirmation. */
  onDone: (feedback: string) => void
}

/** Demain 10 h 00, heure de Madagascar. */
function defaultInputs(): { date: string; time: string } {
  const tomorrow = toMadagascarInputs(new Date(Date.now() + 24 * 60 * 60 * 1000))
  return { date: tomorrow.date, time: '10:00' }
}

/**
 * Modale du recruteur : fixer (« Ce profil m'intéresse ») ou reprogrammer
 * un entretien. Une seule date et heure, saisie en heure de Madagascar ;
 * le serveur refait tous les contrôles (fenêtre de 2 h à 60 jours, accord
 * du candidat, double envoi).
 */
export function InterviewScheduleModal({
  mode,
  suggestionId,
  candidateName,
  opportunityTitle,
  current,
  onClose,
  onDone,
}: InterviewScheduleModalProps) {
  const initial = defaultInputs()
  const [date, setDate] = useState(initial.date)
  const [time, setTime] = useState(initial.time)
  const [duration, setDuration] = useState<InterviewDuration>(
    (current?.durationMinutes as InterviewDuration | undefined) ?? 30,
  )
  const [message, setMessage] = useState(current?.message ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const today = toMadagascarInputs(new Date()).date
  const maxDate = toMadagascarInputs(new Date(Date.now() + INTERVIEW_MAX_AHEAD_DAYS * 24 * 60 * 60 * 1000)).date

  const close = () => {
    if (!busy) onClose()
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (busy) return
    const iso = madagascarInputsToIso(date, time)
    if (!iso) {
      setError('Indiquez une date et une heure valides.')
      return
    }
    const windowError = interviewWindowError(new Date(iso), new Date())
    if (windowError) {
      setError(windowError)
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
      const input = { scheduledAt: iso, durationMinutes: duration, message: message.trim() || null }
      if (mode === 'schedule') {
        await apiScheduleInterview(suggestionId, input)
        onDone(`Entretien fixé avec ${candidateName} : la mise en relation est faite et le candidat est notifié.`)
      } else {
        await apiRescheduleInterview(suggestionId, input)
        onDone(`Nouvelle date envoyée à ${candidateName}, qui doit la confirmer.`)
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Enregistrement impossible. Réessayez.')
      setBusy(false)
    }
  }

  return (
    <Modal title={mode === 'schedule' ? 'Proposer un entretien' : 'Reprogrammer l’entretien'} onClose={close}>
      <form className="ivm-form" onSubmit={submit} noValidate>
        <p className="ivm-context">
          <strong>{candidateName}</strong> · {opportunityTitle}
        </p>

        <div className="ivm-when">
          <Field label="Date">
            <Input
              type="date"
              value={date}
              min={today}
              max={maxDate}
              required
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>
          <Field label="Heure" hint="Heure de Madagascar (UTC+3)">
            <Input type="time" value={time} step={300} required onChange={(e) => setTime(e.target.value)} />
          </Field>
        </div>

        <Field label="Durée">
          <Select value={duration} onChange={(e) => setDuration(Number(e.target.value) as InterviewDuration)}>
            {INTERVIEW_DURATIONS.map((d) => (
              <option key={d} value={d}>
                {d} minutes
              </option>
            ))}
          </Select>
        </Field>

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
          ) : (
            <p>Le candidat est notifié de la nouvelle date (plateforme et email) et devra la confirmer.</p>
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
          <Button type="submit" size="sm" disabled={busy}>
            <CalendarCheck size={14} aria-hidden />
            {busy ? 'Enregistrement…' : mode === 'schedule' ? 'Fixer l’entretien et mettre en relation' : 'Envoyer la nouvelle date'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
