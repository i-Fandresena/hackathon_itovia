import { CalendarX, CheckCircle2, MessageSquareText } from 'lucide-react'
import { useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { useApp } from '../../context/AppContext'
import {
  ApiError,
  apiConfirmInterview,
  apiReplyAbsence,
  apiReportInterviewUnavailable,
  type CandidateInterview,
} from '../../lib/api'
import { ABSENCE_REPLY_MAX, ABSENCE_REPLY_MIN, latestRound } from '../../lib/hiring'
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
import { InterviewRounds } from './InterviewRounds'
import { InterviewSummary } from './InterviewSummary'
import './CandidateInterviewCard.css'

/*
 * Réponse du candidat à un entretien (décision 2026-10-14) : le recruteur a
 * fixé la date ; le candidat confirme sa présence ou signale un empêchement
 * (motif court). Il ne propose jamais de date lui-même. Après une absence
 * (sous-lot 4), il peut l'expliquer à OffRec (admins seuls, jamais
 * l'entreprise). Ce module porte la logique partagée par l'encart du dossier
 * (`CandidateInterviewCard`, page `/candidat/offres/:id`) et la modale de
 * détail (`CandidateInterviewDetail`, tableau de bord et onglet « Entretiens »).
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

/** Tour dont le candidat peut encore expliquer l'absence (le plus récent),
 *  d'après `canExplainAbsence` renvoyé par le serveur. */
export function absenceToExplain(rounds: readonly CandidateInterview[]): CandidateInterview | undefined {
  return latestRound(rounds.filter((row) => row.canExplainAbsence))
}

export const ABSENCE_FLAG = 'Absence à expliquer'

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

  /**
   * Explique une absence à OffRec ; renvoie un message d'erreur à garder
   * dans le formulaire, ou `null` quand il faut le fermer (envoyé, ou déjà
   * répondu : 409, affiché en retour).
   */
  const explainAbsence = async (interviewId: string, reason: string): Promise<string | null> => {
    setBusy(true)
    setFeedback(null)
    try {
      await apiReplyAbsence(suggestionId, interviewId, reason)
      setFeedback({ ok: true, text: 'Votre explication a été transmise.' })
      await afterChange()
      return null
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setFeedback({ ok: false, text: err.message })
        await afterChange()
        return null
      }
      return err instanceof ApiError ? err.message : 'Envoi impossible. Réessayez.'
    } finally {
      setBusy(false)
    }
  }

  return { busy, feedback, clearFeedback: () => setFeedback(null), confirm, report, explainAbsence }
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

/** Bouton « Expliquer mon absence » (seulement si le serveur le permet). */
export function CandidateAbsenceButton({ busy, onClick }: { busy: boolean; onClick: () => void }) {
  return (
    <Button variant="outline" size="sm" disabled={busy} aria-haspopup="dialog" onClick={onClick}>
      <MessageSquareText size={14} aria-hidden />
      Expliquer mon absence
    </Button>
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

/** Formulaire « Expliquer mon absence » (contenu d'une modale) : lu par OffRec seulement. */
export function CandidateAbsenceReplyForm({
  busy,
  onCancel,
  onSubmit,
}: {
  busy: boolean
  onCancel: () => void
  /** Renvoie un message d'erreur, ou `null` une fois l'explication transmise. */
  onSubmit: (reason: string) => Promise<string | null>
}) {
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (busy) return
    const text = reason.trim()
    if (text.length < ABSENCE_REPLY_MIN) {
      setError('Expliquez brièvement votre absence.')
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
        Votre explication est transmise à OffRec seulement, jamais à l’entreprise. Quelques mots suffisent, sans
        coordonnées : OffRec revient vers vous.
      </p>
      <Field label="Votre explication" hint={`${reason.length}/${ABSENCE_REPLY_MAX}`}>
        <Textarea
          rows={3}
          maxLength={ABSENCE_REPLY_MAX}
          value={reason}
          placeholder="Ex. : coupure d’électricité dans mon quartier à l’heure de l’entretien."
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
          {busy ? 'Envoi…' : 'Envoyer à OffRec'}
        </Button>
      </div>
    </form>
  )
}

interface CandidateInterviewCardProps {
  suggestionId: string
  interview: Interview
  companyName: string | null
  /** Tous les tours du dossier (vue candidat : date et état, jamais l'issue). */
  rounds?: CandidateInterview[]
}

/**
 * Encart « Entretien » de la page du dossier (`/candidat/offres/:id`, cible
 * des notifications) : récapitulatif et réponse directement dans la page,
 * historique des tours et « Expliquer mon absence » si le serveur le permet ;
 * le motif d'empêchement et l'explication d'absence s'ouvrent dans une
 * modale (une seule à la fois).
 */
export function CandidateInterviewCard({ suggestionId, interview, companyName, rounds = [] }: CandidateInterviewCardProps) {
  const { busy, feedback, confirm, report, explainAbsence } = useCandidateInterviewResponse(suggestionId)
  const [dialog, setDialog] = useState<'report' | 'absence' | null>(null)
  const absence = absenceToExplain(rounds)

  const closeDialog = () => {
    if (!busy) setDialog(null)
  }

  const submitReport = async (reason: string) => {
    const failure = await report(reason)
    if (!failure) setDialog(null)
    return failure
  }

  const submitAbsence = async (reason: string) => {
    if (!absence) return 'Aucune absence à expliquer pour ce dossier.'
    const failure = await explainAbsence(absence.id, reason)
    if (!failure) setDialog(null)
    return failure
  }

  return (
    <>
      <InterviewSummary interview={interview} audience="candidate" companyName={companyName}>
        {candidateInterviewButtons({
          interview,
          busy,
          onConfirm: () => void confirm(),
          onReport: () => setDialog('report'),
        })}
        {absence && <CandidateAbsenceButton busy={busy} onClick={() => setDialog('absence')} />}
      </InterviewSummary>

      <CandidateInterviewNotes interview={interview} feedback={feedback} />

      {rounds.length > 1 && <InterviewRounds rounds={rounds} audience="candidate" currentId={interview.id} />}

      {dialog === 'report' && (
        <Modal key="report" title="Signaler un empêchement" onClose={closeDialog}>
          <CandidateInterviewReportForm busy={busy} onCancel={closeDialog} onSubmit={submitReport} />
        </Modal>
      )}
      {dialog === 'absence' && (
        <Modal key="absence" title="Expliquer mon absence" onClose={closeDialog}>
          <CandidateAbsenceReplyForm busy={busy} onCancel={closeDialog} onSubmit={submitAbsence} />
        </Modal>
      )}
    </>
  )
}
