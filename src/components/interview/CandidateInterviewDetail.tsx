import { useEffect, useRef, useState } from 'react'
import { Modal } from '../ui/Modal'
import { HiringPhaseBadge } from '../hiring/HiringPhaseBadge'
import {
  CandidateHireProposalCard,
  CandidateHireProposalDialog,
  type CandidateProposalStep,
} from '../hiring/CandidateHireProposalCard'
import { useApp } from '../../context/AppContext'
import {
  CandidateAbsenceButton,
  CandidateAbsenceReplyForm,
  CandidateInterviewNotes,
  CandidateInterviewReportForm,
  absenceToExplain,
  candidateInterviewButtons,
  useCandidateInterviewResponse,
} from './CandidateInterviewCard'
import { InterviewRounds } from './InterviewRounds'
import { InterviewSummary } from './InterviewSummary'
import type { CandidateInterview } from '../../lib/api'
import { CANDIDATE_PHASE_TEXT } from '../../lib/candidateDossier'
import type { CandidateHiringPhase, HireProposalView } from '../../lib/hiring'
import type { Interview } from '../../types'
import './CandidateInterviewDetail.css'

export interface CandidateInterviewTarget {
  suggestionId: string
  opportunityTitle: string
  /** Révélé à la mise en relation — seul état où un entretien existe. */
  companyName: string | null
  /** Tour affiché : le tour actif, sinon le dernier. */
  interview: Interview
  /** Tous les tours du dossier (date et état ; jamais l'issue, le motif ni la note). */
  rounds?: CandidateInterview[]
  /** Phase neutre du dossier (`candidatePhase`), calculée par le serveur. */
  candidatePhase?: CandidateHiringPhase | null
  /** Dernière proposition d'embauche (vue candidat : jamais la raison d'un retrait). */
  proposal?: HireProposalView | null
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

/** Phases dont le texte neutre éclaire la suite (les autres sont déjà dites par le récapitulatif). */
const PHASES_WITH_TEXT: readonly CandidateHiringPhase[] = [
  'suite_en_attente',
  'suite_favorable',
  'entretien_manque',
  'clos',
  'embauche',
]

/**
 * Détail d'un entretien côté candidat, partagé par le tableau de bord
 * (« Mes dossiers en cours » → « Voir l'entretien ») et l'onglet
 * « Entretiens » : entreprise, offre, date et heure de Madagascar, durée,
 * statut, lien Meet ou son état, message du recruteur, phase neutre du
 * dossier et historique des tours (jamais l'issue), puis « Confirmer ma
 * présence » / « Signaler un empêchement » / « Expliquer mon absence ». Le
 * formulaire remplace la modale de détail le temps de la saisie (jamais deux
 * modales empilées : un seul Échap ne ferme qu'un niveau), puis le détail
 * revient avec le message de retour. Sous-lot 6 : la proposition d'embauche
 * reçue s'affiche en tête, avec « Accepter la proposition » (confirmation,
 * révision affichée) et « Décliner » (`CandidateHireProposalDialog`, qui
 * remplace elle aussi le détail).
 */
export function CandidateInterviewDetail({ target, onClose, onChanged }: CandidateInterviewDetailProps) {
  const { suggestionId, opportunityTitle, companyName, interview, candidatePhase, proposal } = target
  const rounds = target.rounds ?? []
  const { refreshDossiers } = useApp()
  const [step, setStep] = useState<'detail' | 'report' | 'absence' | CandidateProposalStep>('detail')
  const [proposalFeedback, setProposalFeedback] = useState('')
  const { busy, feedback, clearFeedback, confirm, report, explainAbsence } = useCandidateInterviewResponse(
    suggestionId,
    onChanged,
  )
  const absence = absenceToExplain(rounds)

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

  const refreshAll = async () => {
    await Promise.all([refreshDossiers(), onChanged?.()])
  }

  if ((step === 'accept' || step === 'decline') && proposal) {
    return (
      <CandidateHireProposalDialog
        step={step}
        suggestionId={suggestionId}
        proposal={proposal}
        opportunityTitle={opportunityTitle}
        companyName={companyName}
        onClose={() => setStep('detail')}
        onRefresh={refreshAll}
        onDone={setProposalFeedback}
      />
    )
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

  if (step === 'absence') {
    return (
      <Modal key="absence" title="Expliquer mon absence" onClose={backToDetail}>
        <p className="civd-offer">
          {companyName ? `${companyName} · ` : ''}
          {opportunityTitle}
        </p>
        <CandidateAbsenceReplyForm
          busy={busy}
          onCancel={backToDetail}
          onSubmit={async (reason) => {
            if (!absence) return 'Aucune absence à expliquer pour ce dossier.'
            const failure = await explainAbsence(absence.id, reason)
            if (!failure) setStep('detail')
            return failure
          }}
        />
      </Modal>
    )
  }

  return (
    <Modal key="detail" title={companyName ? `Entretien avec ${companyName}` : 'Votre entretien'} onClose={onClose}>
      <div className="civd-head">
        <p className="civd-offer">Offre : {opportunityTitle}</p>
        {candidatePhase && <HiringPhaseBadge audience="candidate" phase={candidatePhase} />}
      </div>
      {proposalFeedback && (
        <p className="civd-proposal-feedback" role="status">
          {proposalFeedback}
        </p>
      )}
      {proposal && (
        <div className="civd-proposal">
          <CandidateHireProposalCard
            proposal={proposal}
            opportunityTitle={opportunityTitle}
            companyName={companyName}
            title="Proposition d’embauche"
            onAccept={() => {
              setProposalFeedback('')
              setStep('accept')
            }}
            onDecline={() => {
              setProposalFeedback('')
              setStep('decline')
            }}
          />
        </div>
      )}
      <InterviewSummary
        interview={interview}
        audience="candidate"
        companyName={companyName}
        title={rounds.length > 1 ? `Tour ${interview.round ?? 1}` : 'Récapitulatif'}
      >
        {candidateInterviewButtons({
          interview,
          busy,
          onConfirm: () => void confirm(),
          onReport: () => {
            clearFeedback()
            setStep('report')
          },
        })}
        {absence && (
          <CandidateAbsenceButton
            busy={busy}
            onClick={() => {
              clearFeedback()
              setStep('absence')
            }}
          />
        )}
      </InterviewSummary>
      <div className="civd-notes" ref={notesRef} tabIndex={-1}>
        {candidatePhase && PHASES_WITH_TEXT.includes(candidatePhase) && (
          <p className="civd-phase">{CANDIDATE_PHASE_TEXT[candidatePhase]}</p>
        )}
        <CandidateInterviewNotes interview={interview} feedback={feedback} />
      </div>
      {rounds.length > 1 && <InterviewRounds rounds={rounds} audience="candidate" currentId={interview.id} />}
    </Modal>
  )
}
