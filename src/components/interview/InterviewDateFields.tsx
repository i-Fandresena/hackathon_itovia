import { Field, Input, Select } from '../ui/Form'
import {
  INTERVIEW_DURATIONS,
  INTERVIEW_MAX_AHEAD_DAYS,
  interviewWindowError,
  madagascarInputsToIso,
  toMadagascarInputs,
} from '../../lib/interview'
import type { InterviewDuration } from '../../types'
import './InterviewDateFields.css'

const DAY_MS = 24 * 60 * 60 * 1000

/** Demain 10 h 00, heure de Madagascar. */
export function defaultInterviewDateInputs(): { date: string; time: string } {
  const tomorrow = toMadagascarInputs(new Date(Date.now() + DAY_MS))
  return { date: tomorrow.date, time: '10:00' }
}

/** Instant ISO (`+03:00`) de la saisie, ou le message d'erreur à afficher
 *  (date invalide, hors fenêtre de 2 h à 60 jours). Le serveur refait le contrôle. */
export function interviewDateInputsToIso(
  date: string,
  time: string,
  now: Date = new Date(),
): { ok: true; iso: string } | { ok: false; error: string } {
  const iso = madagascarInputsToIso(date, time)
  if (!iso) return { ok: false, error: 'Indiquez une date et une heure valides.' }
  const windowError = interviewWindowError(new Date(iso), now)
  return windowError ? { ok: false, error: windowError } : { ok: true, iso }
}

interface InterviewDateFieldsProps {
  date: string
  time: string
  duration: InterviewDuration
  onDateChange: (value: string) => void
  onTimeChange: (value: string) => void
  onDurationChange: (value: InterviewDuration) => void
  disabled?: boolean
}

/**
 * Date, heure (heure de Madagascar) et durée d'un entretien — champs
 * partagés par `InterviewScheduleModal` (fixer, reprogrammer, tour suivant)
 * et `InterviewOutcomeModal` (« Second entretien » avec sa date).
 */
export function InterviewDateFields({
  date,
  time,
  duration,
  onDateChange,
  onTimeChange,
  onDurationChange,
  disabled,
}: InterviewDateFieldsProps) {
  const today = toMadagascarInputs(new Date()).date
  const maxDate = toMadagascarInputs(new Date(Date.now() + INTERVIEW_MAX_AHEAD_DAYS * DAY_MS)).date
  return (
    <>
      <div className="ivdf-when">
        <Field label="Date">
          <Input
            type="date"
            value={date}
            min={today}
            max={maxDate}
            required
            disabled={disabled}
            onChange={(e) => onDateChange(e.target.value)}
          />
        </Field>
        <Field label="Heure" hint="Heure de Madagascar (UTC+3)">
          <Input
            type="time"
            value={time}
            step={300}
            required
            disabled={disabled}
            onChange={(e) => onTimeChange(e.target.value)}
          />
        </Field>
      </div>

      <Field label="Durée">
        <Select
          value={duration}
          disabled={disabled}
          onChange={(e) => onDurationChange(Number(e.target.value) as InterviewDuration)}
        >
          {INTERVIEW_DURATIONS.map((d) => (
            <option key={d} value={d}>
              {d} minutes
            </option>
          ))}
        </Select>
      </Field>
    </>
  )
}
