import { CheckCircle2, PartyPopper, PauseCircle, XCircle } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '../ui/Button'
import { Field, Select, Textarea } from '../ui/Form'
import { Modal } from '../ui/Modal'
import { ApiError, apiAcceptHireProposal, apiDeclineHireProposal } from '../../lib/api'
import {
  DECLINE_NOTE_MAX,
  DECLINE_REASON_LABELS,
  HIRE_DECLINE_REASONS,
  formatCivilDate,
  proposalAcceptedNotice,
  proposalDeclinedNotice,
  type HireProposalView,
} from '../../lib/hiring'
import { contactDetailsError } from '../../lib/interview'
import type { HireDeclineReason } from '../../types'
import { HireProposalSummary } from './HireProposalSummary'
import './CandidateHireProposalCard.css'

/** Où mène « Mettre en pause mon accord de matching » (D6 : jamais automatique). */
const CONSENT_PATH = '/candidat/profil'

interface CandidateHireProposalCardProps {
  proposal: HireProposalView
  opportunityTitle: string
  /** Révélé à la mise en relation (seul état où une proposition existe). */
  companyName: string | null
  /** Ouvre la confirmation (« Accepter la proposition »). */
  onAccept: () => void
  /** Ouvre le formulaire de refus. */
  onDecline: () => void
  /** Titre de l'encadré (par défaut : « Proposition d'embauche »). */
  title?: string
  headingLevel?: 2 | 3 | 4
}

/**
 * Proposition d'embauche reçue par le candidat (sous-lot 6) : poste,
 * salaire, contrat, date de début, message de l'entreprise et « Réponse
 * attendue avant le … », puis « Accepter la proposition » / « Décliner »
 * (une modale à la fois : `CandidateHireProposalDialog`). Après la réponse :
 * « Embauche confirmée » ou « Proposition déclinée » ; une proposition
 * expirée ou retirée s'affiche en texte neutre, sans la raison du retrait.
 */
export function CandidateHireProposalCard({
  proposal,
  opportunityTitle,
  companyName,
  onAccept,
  onDecline,
  title,
  headingLevel = 3,
}: CandidateHireProposalCardProps) {
  const heading = title ?? (companyName ? `Proposition d’embauche de ${companyName}` : 'Proposition d’embauche')
  return (
    <div className="chp">
      <p className="chp-offer">Offre : {opportunityTitle}</p>
      <HireProposalSummary proposal={proposal} audience="candidate" title={heading} headingLevel={headingLevel}>
        {proposal.status === 'envoyee' && (
          <>
            <Button size="sm" aria-haspopup="dialog" onClick={onAccept}>
              <CheckCircle2 size={14} aria-hidden />
              Accepter la proposition
            </Button>
            <Button variant="outline" size="sm" aria-haspopup="dialog" onClick={onDecline}>
              <XCircle size={14} aria-hidden />
              Décliner
            </Button>
          </>
        )}
        {proposal.status === 'acceptee' && (
          <>
            <p className="chp-done is-ok">
              <PartyPopper size={15} aria-hidden />
              Félicitations ! Embauche confirmée — début le {formatCivilDate(proposal.startDate)}.
            </p>
            <Link to={CONSENT_PATH} className="chp-link">
              <PauseCircle size={14} aria-hidden />
              Mettre en pause mon accord de matching
            </Link>
          </>
        )}
        {proposal.status === 'refusee' && (
          <p className="chp-done">Proposition déclinée. Votre profil reste proposé par OffRec pour d’autres offres.</p>
        )}
      </HireProposalSummary>
    </div>
  )
}

export type CandidateProposalStep = 'accept' | 'decline'

interface CandidateHireProposalDialogProps {
  step: CandidateProposalStep
  suggestionId: string
  /** Proposition RELUE par le parent à chaque rendu (après un 409, la nouvelle version). */
  proposal: HireProposalView
  opportunityTitle: string
  companyName: string | null
  /** Ferme la modale (retour au détail, ou à la page). */
  onClose: () => void
  /** Recharge les dossiers (`refreshDossiers`, données de la page). */
  onRefresh: () => Promise<void> | void
  /** Réponse enregistrée, avec le message de retour (affiché par le parent). */
  onDone?: (feedback: string) => void
}

/**
 * Réponse du candidat à une proposition d'embauche, en modales successives
 * (jamais empilées ; une `key` par étape, Échap ne ferme qu'un niveau) :
 * - « Accepter » : confirmation, puis envoi de la révision AFFICHÉE. Un 409
 *   (proposition modifiée entre-temps) recharge le dossier et ré-affiche la
 *   nouvelle version en le signalant ; il faut la relire et confirmer à
 *   nouveau. Succès : écran « Félicitations ! », avec le lien facultatif
 *   « Mettre en pause mon accord de matching » (D6).
 * - « Décliner » : motif facultatif (liste fermée, montré à l'entreprise) et
 *   précision facultative sans coordonnées (lue par OffRec seulement).
 */
export function CandidateHireProposalDialog({
  step: initialStep,
  suggestionId,
  proposal,
  opportunityTitle,
  companyName,
  onClose,
  onRefresh,
  onDone,
}: CandidateHireProposalDialogProps) {
  const [step, setStep] = useState<CandidateProposalStep | 'accepted' | 'declined'>(initialStep)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [changed, setChanged] = useState(false)
  const [reason, setReason] = useState<HireDeclineReason | ''>('')
  const [note, setNote] = useState('')
  const [accepted, setAccepted] = useState<HireProposalView | null>(null)

  // La version affichée change (nouvelle révision relue par le parent) :
  // on le signale clairement, et c'est elle qu'un nouveau clic acceptera.
  const seen = useRef(`${proposal.id}:${proposal.revision}`)
  useEffect(() => {
    const key = `${proposal.id}:${proposal.revision}`
    if (seen.current === key) return
    seen.current = key
    if (step === 'accept' || step === 'decline') setChanged(true)
  }, [proposal.id, proposal.revision, step])

  const close = () => {
    if (!busy) onClose()
  }

  const company = companyName ?? 'l’entreprise'
  const pending = proposal.status === 'envoyee'

  const fail = async (err: unknown, fallback: string) => {
    const message = err instanceof ApiError ? err.message : fallback
    if (err instanceof ApiError && (err.status === 409 || err.status === 404)) {
      await onRefresh()
    }
    setError(message)
    setBusy(false)
  }

  const accept = async () => {
    if (busy || !pending) return
    setBusy(true)
    setError('')
    setChanged(false)
    try {
      // La révision AFFICHÉE : si l'entreprise a modifié sa proposition
      // entre-temps, le serveur répond 409 « modifiée ».
      const response = await apiAcceptHireProposal(suggestionId, proposal.id, proposal.revision)
      setAccepted(response.proposal)
      setBusy(false)
      setStep('accepted')
      await onRefresh()
      onDone?.(proposalAcceptedNotice({ jobTitle: response.proposal.jobTitle, companyName: company, startDate: response.proposal.startDate }).message)
    } catch (err) {
      await fail(err, 'Acceptation impossible. Réessayez.')
    }
  }

  const decline = async (event: FormEvent) => {
    event.preventDefault()
    if (busy || !pending) return
    const text = note.trim()
    const contactError = contactDetailsError(text)
    if (contactError) {
      setError(contactError)
      return
    }
    setBusy(true)
    setError('')
    setChanged(false)
    try {
      await apiDeclineHireProposal(suggestionId, {
        proposalId: proposal.id,
        revision: proposal.revision,
        ...(reason ? { reason } : {}),
        ...(text ? { note: text } : {}),
      })
      setBusy(false)
      setStep('declined')
      await onRefresh()
      onDone?.(proposalDeclinedNotice().message)
    } catch (err) {
      await fail(err, 'Envoi impossible. Réessayez.')
    }
  }

  if (step === 'accepted') {
    const done = accepted ?? proposal
    return (
      <Modal key="chp-accepted" title="Embauche confirmée" onClose={onClose}>
        <div className="chp-dialog">
          <p className="chp-congrats" role="status">
            <PartyPopper size={18} aria-hidden />
            {proposalAcceptedNotice({ jobTitle: done.jobTitle, companyName: company, startDate: done.startDate }).message}
          </p>
          <p className="chp-text">
            OffRec informe l’entreprise et vous transmet les modalités de votre premier jour. Votre accord de matching
            reste actif : c’est votre choix. Si vous ne souhaitez plus recevoir de propositions pour l’instant, vous
            pouvez le mettre en pause depuis votre profil.
          </p>
          <div className="chp-actions">
            <Link to={CONSENT_PATH} className="btn btn-outline btn-sm">
              <PauseCircle size={14} aria-hidden />
              Mettre en pause mon accord de matching
            </Link>
            <Button size="sm" onClick={onClose}>
              Fermer
            </Button>
          </div>
        </div>
      </Modal>
    )
  }

  if (step === 'declined') {
    return (
      <Modal key="chp-declined" title="Réponse transmise" onClose={onClose}>
        <div className="chp-dialog">
          <p className="chp-text" role="status">
            {proposalDeclinedNotice().message}
          </p>
          <div className="chp-actions">
            <Button size="sm" onClick={onClose}>
              Fermer
            </Button>
          </div>
        </div>
      </Modal>
    )
  }

  const changedNotice = changed && (
    <p className="chp-changed" role="alert">
      {pending
        ? 'L’entreprise a modifié sa proposition entre-temps : relisez la nouvelle version ci-dessous avant de répondre.'
        : 'Cette proposition n’attend plus de réponse : voici son état à jour.'}
    </p>
  )
  const errorLine = error && (
    <p className="chp-error" role="alert">
      {error}
    </p>
  )

  if (step === 'decline') {
    return (
      <Modal key="chp-decline" title="Décliner la proposition" onClose={close}>
        <form className="chp-dialog" onSubmit={decline} noValidate>
          <p className="chp-offer">
            {companyName ? `${companyName} · ` : ''}
            {opportunityTitle}
          </p>
          {changedNotice}
          <HireProposalSummary proposal={proposal} audience="candidate" title="La proposition" headingLevel={3} />
          {pending && (
            <fieldset className="chp-fields" disabled={busy}>
              <Field label="Motif (facultatif)" hint="Seule cette catégorie est transmise à l’entreprise.">
                <Select value={reason} onChange={(e) => setReason(e.target.value as HireDeclineReason | '')}>
                  <option value="">Ne pas préciser</option>
                  {HIRE_DECLINE_REASONS.map((value) => (
                    <option key={value} value={value}>
                      {DECLINE_REASON_LABELS[value]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field
                label="Précision pour OffRec (facultative)"
                hint={`Lue par OffRec seulement, jamais par l’entreprise. Sans email ni téléphone. ${note.length}/${DECLINE_NOTE_MAX}`}
              >
                <Textarea
                  rows={3}
                  maxLength={DECLINE_NOTE_MAX}
                  value={note}
                  placeholder="Ex. : j’ai accepté un autre poste plus proche de chez moi."
                  onChange={(e) => setNote(e.target.value)}
                />
              </Field>
            </fieldset>
          )}
          {errorLine}
          <div className="chp-actions">
            <Button variant="ghost" size="sm" disabled={busy} onClick={close}>
              {pending ? 'Revenir' : 'Fermer'}
            </Button>
            {pending && (
              <Button type="submit" variant="danger" size="sm" disabled={busy} aria-busy={busy}>
                <XCircle size={14} aria-hidden />
                {busy ? 'Envoi…' : 'Décliner la proposition'}
              </Button>
            )}
          </div>
        </form>
      </Modal>
    )
  }

  return (
    <Modal key="chp-accept" title="Accepter la proposition ?" onClose={close}>
      <div className="chp-dialog">
        <p className="chp-offer">
          {companyName ? `${companyName} · ` : ''}
          {opportunityTitle}
        </p>
        {changedNotice}
        <HireProposalSummary proposal={proposal} audience="candidate" title="La proposition que vous acceptez" headingLevel={3} />
        {pending && (
          <p className="chp-text">
            En acceptant, vous confirmez votre embauche chez <strong>{company}</strong> pour le poste «{' '}
            {proposal.jobTitle} », aux conditions ci-dessus. OffRec informe l’entreprise.
          </p>
        )}
        {errorLine}
        <div className="chp-actions">
          <Button variant="ghost" size="sm" disabled={busy} onClick={close}>
            {pending ? 'Revenir' : 'Fermer'}
          </Button>
          {pending && (
            <Button size="sm" disabled={busy} aria-busy={busy} onClick={() => void accept()}>
              <CheckCircle2 size={14} aria-hidden />
              {busy ? 'Confirmation…' : changed ? 'Accepter cette nouvelle version' : 'Confirmer mon embauche'}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  )
}
