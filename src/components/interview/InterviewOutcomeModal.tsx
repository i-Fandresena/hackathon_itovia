import { ClipboardCheck } from 'lucide-react'
import { useId, useState } from 'react'
import type { FormEvent } from 'react'
import { Button } from '../ui/Button'
import { Field, Select, Textarea } from '../ui/Form'
import { Modal } from '../ui/Modal'
import { useApp } from '../../context/AppContext'
import { ApiError, apiRecordInterviewOutcome, type InterviewOutcomeInput, type RecruiterInterview } from '../../lib/api'
import {
  INTERVIEW_RESULTS,
  INTERVIEW_RESULT_CHOICES,
  OUTCOME_NOTE_MAX,
  OUTCOME_RESULT_REQUIRED_ERROR,
  RESULT_REASON_LABELS,
  absentNotice,
  allowedOutcomeResults,
  checkHiringAction,
  nextRoundNumber,
  nonRetenuNotice,
  outcomeReasonError,
  reasonsForResult,
  retenuNotice,
  secondRoundNotice,
  type HiringDossierState,
} from '../../lib/hiring'
import { INTERVIEW_MESSAGE_MAX, contactDetailsError, formatMadagascarDateTime } from '../../lib/interview'
import type { InterviewDuration, InterviewResult, InterviewResultReason } from '../../types'
import { InterviewDateFields, defaultInterviewDateInputs, interviewDateInputsToIso } from './InterviewDateFields'
import './InterviewOutcomeModal.css'

interface InterviewOutcomeModalProps {
  suggestionId: string
  candidateName: string
  opportunityTitle: string
  /** Tour actif dont on renseigne l'issue. */
  interview: RecruiterInterview
  /** État du dossier (tours) : décide des issues proposées (`allowedOutcomeResults`). */
  state: HiringDossierState
  onClose: () => void
  /** Appelé après l'enregistrement par le serveur, avec le message de retour. */
  onDone: (feedback: string) => void
}

const RESULT_HINTS: Record<InterviewResult, string> = {
  retenu: 'Vous souhaitez poursuivre avec ce candidat.',
  second_entretien: 'Un autre entretien est nécessaire avant de décider.',
  non_retenu: 'Vous ne donnez pas suite pour ce poste.',
  absent: 'L’entretien n’a pas eu lieu : le candidat était absent.',
}

/**
 * « Issue de l'entretien » (recruteur, après l'heure de fin du tour) :
 * quatre issues, motif en liste fermée selon l'issue (obligatoire pour
 * « Non retenu »), note privée facultative et, pour « Second entretien », la
 * date du tour suivant tout de suite ou plus tard. Les issues proposées
 * viennent de `allowedOutcomeResults` (src/lib/hiring.ts) ; le serveur
 * refait tous les contrôles (400, 404, 409, 503 affichés tels quels).
 */
export function InterviewOutcomeModal({
  suggestionId,
  candidateName,
  opportunityTitle,
  interview,
  state,
  onClose,
  onDone,
}: InterviewOutcomeModalProps) {
  const { currentUser } = useApp()
  const formId = useId()
  const [now] = useState(() => new Date())
  const initial = defaultInterviewDateInputs()
  const [result, setResult] = useState<InterviewResult | null>(null)
  const [reason, setReason] = useState<InterviewResultReason | ''>('')
  const [note, setNote] = useState('')
  const [nextNow, setNextNow] = useState(true)
  const [date, setDate] = useState(initial.date)
  const [time, setTime] = useState(initial.time)
  const [duration, setDuration] = useState<InterviewDuration>(
    (interview.durationMinutes as InterviewDuration | undefined) ?? 30,
  )
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const allowed = allowedOutcomeResults(state, now)
  const blocked = allowed.length === 0 ? checkHiringAction({ actor: 'recruiter', action: 'record_outcome', state, now }) : null
  const round = interview.round ?? 1
  const nextRound = nextRoundNumber(state.rounds)
  const companyName = currentUser?.recruiterProfile?.companyName || 'Votre entreprise'

  const close = () => {
    if (!busy) onClose()
  }

  const choose = (value: InterviewResult) => {
    setResult(value)
    setReason('')
    setError('')
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (busy) return
    if (!result) {
      setError(OUTCOME_RESULT_REQUIRED_ERROR)
      return
    }
    const reasonError = outcomeReasonError(result, reason || null)
    if (reasonError) {
      setError(reasonError)
      return
    }
    const noteError = contactDetailsError(note)
    if (noteError) {
      setError(`Note privée : ${noteError}`)
      return
    }
    const input: InterviewOutcomeInput = { interviewId: interview.id, result }
    if (reason) input.reason = reason
    if (note.trim()) input.note = note.trim()
    if (result === 'second_entretien' && nextNow) {
      const when = interviewDateInputsToIso(date, time)
      if (!when.ok) {
        setError(`Tour ${nextRound} : ${when.error}`)
        return
      }
      const messageError = contactDetailsError(message)
      if (messageError) {
        setError(`Message au candidat : ${messageError}`)
        return
      }
      input.nextRound = { scheduledAt: when.iso, durationMinutes: duration, message: message.trim() || null }
    }
    setBusy(true)
    setError('')
    try {
      const response = await apiRecordInterviewOutcome(suggestionId, input)
      onDone(successText(result, candidateName, response.nextInterview ? response.nextInterview.round : null, nextRound))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Enregistrement impossible. Réessayez.')
      setBusy(false)
    }
  }

  const title = `Issue de l’entretien — ${candidateName}, tour ${round}`

  if (blocked && !blocked.ok) {
    return (
      <Modal title={title} onClose={close}>
        <p className="ivo-context">{opportunityTitle}</p>
        <p className="ivo-error" role="alert">
          {blocked.error}
        </p>
        <div className="ivo-actions">
          <Button variant="outline" size="sm" onClick={close}>
            Fermer
          </Button>
        </div>
      </Modal>
    )
  }

  const reasons = result ? reasonsForResult(result) : []
  const reasonRequired = result === 'non_retenu'
  const preview = result ? candidatePreview(result) : null

  function candidatePreview(value: InterviewResult): { channels: string; text: string } {
    switch (value) {
      case 'retenu':
        return { channels: 'sur la plateforme', text: retenuNotice({ opportunityTitle }).message }
      case 'non_retenu':
        return { channels: 'sur la plateforme et par email', text: nonRetenuNotice({ opportunityTitle }).message }
      case 'absent':
        return {
          channels: 'sur la plateforme et par email, avec le bouton « Expliquer mon absence »',
          text: absentNotice({ opportunityTitle, scheduledAt: interview.scheduledAt }).message,
        }
      case 'second_entretien': {
        if (!nextNow) {
          return {
            channels: 'rien pour l’instant',
            text: `OffRec le préviendra quand vous fixerez la date du tour ${nextRound}.`,
          }
        }
        const when = interviewDateInputsToIso(date, time)
        return {
          channels: 'sur la plateforme et par email',
          text: when.ok
            ? secondRoundNotice({
                companyName,
                opportunityTitle,
                scheduledAt: when.iso,
                durationMinutes: duration,
                round: nextRound,
              }).message
            : 'Le message « Second entretien proposé », avec la date et la durée choisies ci-dessus.',
        }
      }
    }
  }

  return (
    <Modal title={title} onClose={close}>
      <form className="ivo-form" onSubmit={submit} noValidate aria-describedby={`${formId}-context`}>
        <p className="ivo-context" id={`${formId}-context`}>
          {opportunityTitle} · entretien du {formatMadagascarDateTime(interview.scheduledAt)} (heure de Madagascar)
        </p>

        <fieldset className="ivo-choices" disabled={busy}>
          <legend className="ivo-legend">Issue</legend>
          {INTERVIEW_RESULTS.map((value) => {
            const enabled = allowed.includes(value)
            const check = enabled
              ? null
              : checkHiringAction({ actor: 'recruiter', action: 'record_outcome', state, now, result: value })
            const why = check && !check.ok ? check.error : null
            const hintId = `${formId}-${value}-hint`
            return (
              <label key={value} className={`ivo-choice${result === value ? ' is-selected' : ''}${enabled ? '' : ' is-disabled'}`}>
                <input
                  type="radio"
                  name={`${formId}-result`}
                  value={value}
                  checked={result === value}
                  disabled={!enabled}
                  aria-describedby={hintId}
                  onChange={() => choose(value)}
                />
                <span className="ivo-choice-text">
                  <span className="ivo-choice-label">{INTERVIEW_RESULT_CHOICES[value]}</span>
                  <span className="ivo-choice-hint" id={hintId}>
                    {why ?? RESULT_HINTS[value]}
                  </span>
                </span>
              </label>
            )
          })}
        </fieldset>

        {result && reasons.length > 0 && (
          <Field
            label={reasonRequired ? 'Motif (obligatoire)' : 'Motif (facultatif)'}
            hint="Liste fermée : visible par vous et par OffRec, jamais par le candidat."
          >
            <Select
              value={reason}
              required={reasonRequired}
              disabled={busy}
              aria-invalid={error && reasonRequired && !reason ? true : undefined}
              onChange={(e) => setReason(e.target.value as InterviewResultReason | '')}
            >
              <option value="">{reasonRequired ? 'Choisissez un motif' : 'Aucun motif'}</option>
              {reasons.map((value) => (
                <option key={value} value={value}>
                  {RESULT_REASON_LABELS[value]}
                </option>
              ))}
            </Select>
          </Field>
        )}

        {result === 'second_entretien' && (
          <fieldset className="ivo-next" disabled={busy}>
            <legend className="ivo-legend">Tour {nextRound}</legend>
            <div className="ivo-next-modes">
              <label className="ivo-inline">
                <input type="radio" name={`${formId}-next`} checked={nextNow} onChange={() => setNextNow(true)} />
                Fixer la date maintenant
              </label>
              <label className="ivo-inline">
                <input type="radio" name={`${formId}-next`} checked={!nextNow} onChange={() => setNextNow(false)} />
                Plus tard
              </label>
            </div>
            {nextNow ? (
              <>
                <InterviewDateFields
                  date={date}
                  time={time}
                  duration={duration}
                  onDateChange={setDate}
                  onTimeChange={setTime}
                  onDurationChange={setDuration}
                  disabled={busy}
                />
                <Field
                  label="Message au candidat (facultatif)"
                  hint={`Sans email ni téléphone. ${message.length}/${INTERVIEW_MESSAGE_MAX}`}
                >
                  <Textarea
                    rows={2}
                    maxLength={INTERVIEW_MESSAGE_MAX}
                    value={message}
                    disabled={busy}
                    placeholder="Ex. : entretien avec la direction technique."
                    onChange={(e) => setMessage(e.target.value)}
                  />
                </Field>
              </>
            ) : (
              <p className="ivo-muted">
                Le dossier passe en « Second entretien à planifier » : vous fixerez la date du tour {nextRound} depuis
                le détail de l’entretien.
              </p>
            )}
          </fieldset>
        )}

        {result && (
          <Field
            label="Note privée (facultative)"
            hint={`Visible par vous seul·e, jamais transmise au candidat. Sans email ni téléphone. ${note.length}/${OUTCOME_NOTE_MAX}`}
          >
            <Textarea
              rows={3}
              maxLength={OUTCOME_NOTE_MAX}
              value={note}
              disabled={busy}
              placeholder="Ex. : bon niveau en réseau, à revoir sur la gestion de projet."
              onChange={(e) => setNote(e.target.value)}
            />
          </Field>
        )}

        <div className="ivo-reminder">
          <p>
            <strong>OffRec informe le candidat avec un message neutre.</strong> Il ne voit jamais votre motif ni votre
            note.
          </p>
          {preview && (
            <p>
              Ce qu’il recevra ({preview.channels}) : <span className="ivo-quote">« {preview.text} »</span>
            </p>
          )}
        </div>

        {error && (
          <p className="ivo-error" role="alert">
            {error}
          </p>
        )}

        <div className="ivo-actions">
          <Button variant="ghost" size="sm" disabled={busy} onClick={close}>
            Annuler
          </Button>
          <Button type="submit" size="sm" disabled={busy || !result} aria-busy={busy}>
            <ClipboardCheck size={14} aria-hidden />
            {busy ? 'Enregistrement…' : 'Enregistrer l’issue'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

/** Message de retour au recruteur (plan §2.1 A.4). */
function successText(result: InterviewResult, candidateName: string, createdRound: number | null, nextRound: number): string {
  switch (result) {
    case 'retenu':
      return `Issue enregistrée : ${candidateName} est retenu·e. Vous pouvez lui faire une proposition d’embauche.`
    case 'second_entretien':
      return createdRound
        ? `Issue enregistrée. Le tour ${createdRound} est fixé : OffRec prévient ${candidateName} (plateforme et email), qui doit confirmer sa présence.`
        : `Issue enregistrée : second entretien à planifier. Fixez la date du tour ${nextRound} quand vous êtes prêt·e.`
    case 'non_retenu':
      return `Issue enregistrée. OffRec informe ${candidateName} avec un message neutre ; son profil reste proposé pour d’autres offres.`
    case 'absent':
      return 'Absence enregistrée. OffRec est prévenu et revient vers le candidat.'
  }
}
