import { useEffect, useRef, useState } from 'react'
import { Modal } from '../ui/Modal'
import {
  CandidateInterviewNotes,
  CandidateInterviewReportForm,
  candidateInterviewButtons,
  useCandidateInterviewResponse,
} from './CandidateInterviewCard'
import { InterviewSummary } from './InterviewSummary'
import type { Interview } from '../../types'
import './CandidateInterviewDetail.css'

export interface CandidateInterviewTarget {
  suggestionId: string
  opportunityTitle: string
  /** Révélé à la mise en relation — seul état où un entretien existe. */
  companyName: string | null
  interview: Interview
}

interface CandidateInterviewDetailProps {
  /** Relu par le parent à chaque rendu (par identifiant de dossier) : la
   *  modale revient à jour après une confirmation ou un empêchement. */
  target: CandidateInterviewTarget
  onClose: () => void
  /** Rechargement des données propres à la page, après une réponse
   *  (les dossiers du compte sont rechargés dans tous les cas). */
  onChanged?: () => Promise<void> | void
}

/**
 * Détail d'un entretien côté candidat, partagé par le tableau de bord
 * (« Mes dossiers en cours » → « Voir l'entretien ») et l'onglet
 * « Entretiens » : entreprise, offre, date et heure de Madagascar, durée,
 * statut, lien Meet ou son état, message du recruteur, puis « Confirmer ma
 * présence » / « Signaler un empêchement ». Le motif remplace la modale de
 * détail le temps de la saisie (jamais deux modales empilées : un seul Échap
 * ne ferme qu'un niveau), puis le détail revient avec le message de retour.
 */
export function CandidateInterviewDetail({ target, onClose, onChanged }: CandidateInterviewDetailProps) {
  const { suggestionId, opportunityTitle, companyName, interview } = target
  const [step, setStep] = useState<'detail' | 'report'>('detail')
  const { busy, feedback, clearFeedback, confirm, report } = useCandidateInterviewResponse(suggestionId, onChanged)

  const notesRef = useRef<HTMLDivElement>(null)

  // Après une réponse, le bouton cliqué disparaît : le focus irait sur
  // `body`. On le pose sur le message de retour, dans la modale.
  useEffect(() => {
    if (feedback && step === 'detail' && (!document.activeElement || document.activeElement === document.body)) {
      notesRef.current?.focus()
    }
  }, [feedback, step])

  const backToDetail = () => {
    if (!busy) setStep('detail')
  }

  if (step === 'report') {
    return (
      // `key` distincte : chaque étape remonte sa modale, qui place le focus
      // (champ du motif) et le rend ensuite au bouton d'ouverture.
      <Modal key="report" title="Signaler un empêchement" onClose={backToDetail}>
        <p className="civd-offer">
          {companyName ? `${companyName} · ` : ''}
          {opportunityTitle}
        </p>
        <CandidateInterviewReportForm
          busy={busy}
          onCancel={backToDetail}
          onSubmit={async (reason) => {
            const failure = await report(reason)
            if (!failure) setStep('detail')
            return failure
          }}
        />
      </Modal>
    )
  }

  return (
    <Modal key="detail" title={companyName ? `Entretien avec ${companyName}` : 'Votre entretien'} onClose={onClose}>
      <p className="civd-offer">Offre : {opportunityTitle}</p>
      <InterviewSummary interview={interview} audience="candidate" companyName={companyName} title="Récapitulatif">
        {candidateInterviewButtons({
          interview,
          busy,
          onConfirm: () => void confirm(),
          onReport: () => {
            clearFeedback()
            setStep('report')
          },
        })}
      </InterviewSummary>
      <div className="civd-notes" ref={notesRef} tabIndex={-1}>
        <CandidateInterviewNotes interview={interview} feedback={feedback} />
      </div>
    </Modal>
  )
}
