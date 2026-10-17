import { CalendarX, CheckCircle2 } from 'lucide-react'
import { useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { useApp } from '../../context/AppContext'
import { ApiError, apiConfirmInterview, apiReportInterviewUnavailable } from '../../lib/api'
import {
  INTERVIEW_REASON_MAX,
  contactDetailsError,
  interviewAwaitsCandidateReply,
  interviewEnd,
} from '../../lib/interview'
import type { Interview } from '../../types'
import { Button } from '../ui/Button'
import { Field, Textarea } from '../ui/Form'
import { Modal } from '../ui/Modal'
import { InterviewSummary } from './InterviewSummary'
import './CandidateInterviewCard.css'

/*
 * Réponse du candidat à un entretien (décision 2026-10-14) : le recruteur a
 * fixé la date ; le candidat confirme sa présence ou signale un empêchement
 * (motif court). Il ne propose jamais de date lui-même. Ce module porte la
 * logique partagée par l'encart du dossier (`CandidateInterviewCard`, page
 * `/candidat/offres/:id`) et la modale de détail (`CandidateInterviewDetail`,
 * tableau de bord et onglet « Entretiens »).
 */

export interface CandidateInterviewFeedback {
  ok: boolean
  text: string
}

/** Actions proposées au candidat ; le serveur reste juge (409 sinon). */
export function candidateInterviewPermissions(interview: Interview, now: Date = new Date()) {
  const ended = interviewEnd(interview.scheduledAt, interview.durationMinutes).getTime() < now.getTime()
  return {
    // Même règle que le serveur : plus de confirmation après l'heure de début.
    canConfirm: interviewAwaitsCandidateReply(interview, now),
    canReport: (interview.status === 'planifie' || interview.status === 'confirme') && !ended,
  }
}

/** Mention visible sans ouvrir le détail : la réponse du candidat est
 *  attendue (entretien planifié ou reprogrammé, pas encore commencé). */
export function candidateInterviewFlag(interview: Interview, now: Date = new Date()): string | null {
  if (!interviewAwaitsCandidateReply(interview, now)) return null
  return interview.rescheduleCount > 0 ? 'Nouvelle date : réponse attendue' : 'Réponse attendue'
}

/**
 * Confirmer / signaler un empêchement, puis recharger les dossiers du
 * compte (`refreshDossiers`) et, si fourni, les données de la page.
 */
export function useCandidateInterviewResponse(suggestionId: string, onChanged?: () => Promise<void> | void) {
  const { refreshDossiers } = useApp()
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState<CandidateInterviewFeedback | null>(null)

  const afterChange = async () => {
    await Promise.all([refreshDossiers(), onChanged?.()])
  }

  const confirm = async () => {
    if (busy) return
    setBusy(true)
    setFeedback(null)
    try {
      await apiConfirmInterview(suggestionId)
      setFeedback({ ok: true, text: 'Présence confirmée : l’entreprise en est informée.' })
      await afterChange()
    } catch (err) {
      setFeedback({ ok: false, text: err instanceof ApiError ? err.message : 'Confirmation impossible. Réessayez.' })
    } finally {
      setBusy(false)
    }
  }

  /** Transmet le motif ; renvoie un message d'erreur, ou `null` si c'est fait. */
  const report = async (reason: string): Promise<string | null> => {
    setBusy(true)
    setFeedback(null)
    try {
      await apiReportInterviewUnavailable(suggestionId, reason)
      setFeedback({ ok: true, text: 'Empêchement transmis : l’entreprise va proposer une nouvelle date.' })
      await afterChange()
      return null
    } catch (err) {
      return err instanceof ApiError ? err.message : 'Envoi impossible. Réessayez.'
    } finally {
      setBusy(false)
    }
  }

  return { busy, feedback, clearFeedback: () => setFeedback(null), confirm, report }
}

/** Boutons « Confirmer ma présence » / « Signaler un empêchement », ou `null`. */
export function candidateInterviewButtons({
  interview,
  busy,
  onConfirm,
  onReport,
}: {
  interview: Interview
  busy: boolean
  onConfirm: () => void
  onReport: () => void
}): ReactNode {
  const { canConfirm, canReport } = candidateInterviewPermissions(interview)
  if (!canConfirm && !canReport) return null
  return (
    <>
      {canConfirm && (
        <Button size="sm" disabled={busy} aria-busy={busy} onClick={onConfirm}>
          <CheckCircle2 size={14} aria-hidden />
          {busy ? 'Envoi…' : 'Confirmer ma présence'}
        </Button>
      )}
      {canReport && (
        <Button variant="outline" size="sm" disabled={busy} aria-haspopup="dialog" onClick={onReport}>
          <CalendarX size={14} aria-hidden />
          Signaler un empêchement
        </Button>
      )}
    </>
  )
}

/** Note d'annulation et message de retour après une réponse. */
export function CandidateInterviewNotes({
  interview,
  feedback,
}: {
  interview: Interview
  feedback: CandidateInterviewFeedback | null
}) {
  return (
    <>
      {interview.status === 'annule' && (
        <p className="civ-note">
          L’entreprise a annulé cet entretien. Votre mise en relation reste active : OffRec revient vers vous pour la
          suite.
        </p>
      )}
      {feedback && (
        <p className={`civ-feedback ${feedback.ok ? 'is-ok' : 'is-error'}`} role="status">
          {feedback.text}
        </p>
      )}
    </>
  )
}

/** Formulaire du motif d'empêchement (contenu d'une modale, sans la modale). */
export function CandidateInterviewReportForm({
  busy,
  onCancel,
  onSubmit,
}: {
  busy: boolean
  onCancel: () => void
  /** Renvoie un message d'erreur, ou `null` une fois le motif transmis. */
  onSubmit: (reason: string) => Promise<string | null>
}) {
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (busy) return
    const text = reason.trim()
    if (text.length < 3) {
      setError('Indiquez brièvement le motif de l’empêchement.')
      return
    }
    const contactError = contactDetailsError(text)
    if (contactError) {
      setError(contactError)
      return
    }
    setError('')
    const failure = await onSubmit(text)
    if (failure) setError(failure)
  }

  return (
    <form className="civ-form" onSubmit={submit} noValidate>
      <p className="civ-text">
        L’entreprise est prévenue et pourra vous proposer une nouvelle date. Indiquez un motif court, sans
        coordonnées.
      </p>
      <Field label="Motif" hint={`${reason.length}/${INTERVIEW_REASON_MAX}`}>
        <Textarea
          rows={3}
          maxLength={INTERVIEW_REASON_MAX}
          value={reason}
          placeholder="Ex. : examen ce jour-là, disponible à partir du 3 novembre."
          aria-invalid={error ? true : undefined}
          onChange={(e) => setReason(e.target.value)}
        />
      </Field>
      {error && (
        <p className="civ-error" role="alert">
          {error}
        </p>
      )}
      <div className="civ-actions">
        <Button variant="ghost" size="sm" disabled={busy} onClick={onCancel}>
          Annuler
        </Button>
        <Button type="submit" size="sm" disabled={busy} aria-busy={busy}>
          {busy ? 'Envoi…' : 'Envoyer à l’entreprise'}
        </Button>
      </div>
    </form>
  )
}

interface CandidateInterviewCardProps {
  suggestionId: string
  interview: Interview
  companyName: string | null
}

/**
 * Encart « Entretien » de la page du dossier (`/candidat/offres/:id`, cible
 * des notifications) : récapitulatif et réponse directement dans la page ;
 * le motif d'empêchement s'ouvre dans une modale (une seule à la fois).
 */
export function CandidateInterviewCard({ suggestionId, interview, companyName }: CandidateInterviewCardProps) {
  const { busy, feedback, confirm, report } = useCandidateInterviewResponse(suggestionId)
  const [reportOpen, setReportOpen] = useState(false)

  const closeReport = () => {
    if (!busy) setReportOpen(false)
  }

  const submitReport = async (reason: string) => {
    const failure = await report(reason)
    if (!failure) setReportOpen(false)
    return failure
  }

  return (
    <>
      <InterviewSummary interview={interview} audience="candidate" companyName={companyName}>
        {candidateInterviewButtons({
          interview,
          busy,
          onConfirm: () => void confirm(),
          onReport: () => setReportOpen(true),
        })}
      </InterviewSummary>

      <CandidateInterviewNotes interview={interview} feedback={feedback} />

      {reportOpen && (
        <Modal title="Signaler un empêchement" onClose={closeReport}>
          <CandidateInterviewReportForm busy={busy} onCancel={closeReport} onSubmit={submitReport} />
        </Modal>
      )}
    </>
  )
}
