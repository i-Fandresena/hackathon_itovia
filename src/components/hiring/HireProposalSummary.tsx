import { useId, type ReactNode } from 'react'
import {
  CONTRACT_TYPE_LABELS,
  DECLINE_REASON_LABELS,
  HIRE_PROPOSAL_STATUS_LABELS,
  MAX_PROPOSAL_VERSIONS,
  WITHDRAW_REASON_LABELS,
  formatCivilDate,
  type HireProposalView,
  type HiringAudience,
} from '../../lib/hiring'
import { formatMadagascarDateTime } from '../../lib/interview'
import { formatAriary } from '../../lib/format'
import type { HireProposalStatus } from '../../types'
import './HireProposalSummary.css'

type Tone = 'info' | 'warning' | 'success' | 'muted'

/** Statut vu par le candidat : jamais la raison d'un retrait. */
const CANDIDATE_STATUS_LABELS: Record<HireProposalStatus, string> = {
  envoyee: 'Réponse attendue',
  acceptee: 'Embauche confirmée',
  refusee: 'Proposition déclinée',
  expiree: 'Proposition expirée',
  retiree: 'Proposition retirée',
}

const STATUS_TONE: Record<HireProposalStatus, Tone> = {
  envoyee: 'warning',
  acceptee: 'success',
  refusee: 'muted',
  expiree: 'muted',
  retiree: 'muted',
}

interface HireProposalSummaryProps {
  proposal: HireProposalView
  /** Lecteur : le candidat ne lit que des textes neutres (jamais la raison d'un retrait). */
  audience: HiringAudience
  title?: string
  /** Niveau du titre de l'encadré (3 par défaut). */
  headingLevel?: 2 | 3 | 4
  /** Boutons d'action, sous le récapitulatif. */
  children?: ReactNode
}

/**
 * Récapitulatif d'une proposition d'embauche (sous-lot 6), partagé par le
 * recruteur, le candidat et l'admin : poste, salaire mensuel brut en
 * Ariary, contrat et durée, date de début (jour civil, heure de
 * Madagascar), message, statut et échéance. Ce qui est affiché vient de la
 * vue du serveur (`toHireProposalView`, décision D3) : le recruteur lit la
 * catégorie d'un refus, l'admin aussi sa précision ; le candidat ne lit
 * jamais la raison d'un retrait (texte neutre).
 */
export function HireProposalSummary({
  proposal,
  audience,
  title = 'Proposition d’embauche',
  headingLevel = 3,
  children,
}: HireProposalSummaryProps) {
  const headingId = useId()
  const Heading = `h${headingLevel}` as 'h2' | 'h3' | 'h4'
  const status = proposal.status
  const statusLabel = audience === 'candidate' ? CANDIDATE_STATUS_LABELS[status] : HIRE_PROPOSAL_STATUS_LABELS[status]
  const contract = proposal.contractDurationMonths
    ? `${CONTRACT_TYPE_LABELS[proposal.contractType]} · ${proposal.contractDurationMonths} mois`
    : CONTRACT_TYPE_LABELS[proposal.contractType]

  return (
    <section className={`hps hps-${STATUS_TONE[status]}`} aria-labelledby={headingId}>
      <div className="hps-head">
        <Heading className="hps-title" id={headingId}>
          {title}
        </Heading>
        <span className={`hps-status hps-status-${STATUS_TONE[status]}`}>{statusLabel}</span>
        {audience !== 'candidate' && (
          <span className="hps-version">
            Version {proposal.version}/{MAX_PROPOSAL_VERSIONS}
            {proposal.revision > 0 ? ` · modifiée ${proposal.revision} fois` : ''}
          </span>
        )}
      </div>

      <dl className="hps-rows">
        <div>
          <dt>Poste</dt>
          <dd>{proposal.jobTitle}</dd>
        </div>
        <div>
          <dt>Salaire mensuel brut</dt>
          <dd>{formatAriary(proposal.monthlySalaryAr)}</dd>
        </div>
        <div>
          <dt>Contrat</dt>
          <dd>{contract}</dd>
        </div>
        <div>
          <dt>Début</dt>
          <dd>{formatCivilDate(proposal.startDate)}</dd>
        </div>
      </dl>

      {proposal.message && (
        <p className="hps-message">
          <span className="hps-label">{audience === 'candidate' ? 'Message de l’entreprise' : 'Message au candidat'}</span>
          <span className="hps-quote">« {proposal.message} »</span>
        </p>
      )}

      <p className="hps-state" role={status === 'envoyee' ? undefined : 'note'}>
        {stateText(proposal, audience)}
      </p>

      {audience === 'admin' && status === 'refusee' && proposal.declineNote && (
        <p className="hps-private">
          <span className="hps-label">Précision du candidat (OffRec seulement)</span>
          <span className="hps-quote">« {proposal.declineNote} »</span>
        </p>
      )}

      {children && <div className="hps-actions">{children}</div>}
    </section>
  )
}

const when = (iso: string | null | undefined) => (iso ? formatMadagascarDateTime(iso) : null)

/** Phrase d'état sous le récapitulatif, selon le lecteur. */
export function stateText(proposal: HireProposalView, audience: HiringAudience): string {
  const deadline = formatMadagascarDateTime(proposal.expiresAt)
  switch (proposal.status) {
    case 'envoyee':
      return audience === 'candidate'
        ? `Réponse attendue avant le ${deadline} (heure de Madagascar).`
        : `En attente de la réponse du candidat · expire le ${deadline} (heure de Madagascar) sans réponse.`
    case 'acceptee': {
      const answered = when(proposal.respondedAt)
      return audience === 'candidate'
        ? `Vous avez accepté cette proposition${answered ? ` le ${answered}` : ''}. Début le ${formatCivilDate(proposal.startDate)}.`
        : `Acceptée${answered ? ` le ${answered}` : ''} : le placement est créé (success fee, étape 1 due).`
    }
    case 'refusee': {
      const answered = when(proposal.respondedAt)
      const reason = proposal.declineReason ? DECLINE_REASON_LABELS[proposal.declineReason] : null
      if (audience === 'candidate') {
        return `Vous avez décliné cette proposition${answered ? ` le ${answered}` : ''}.${reason ? ` Motif indiqué : ${reason}.` : ''}`
      }
      return `Déclinée par le candidat${answered ? ` le ${answered}` : ''} · motif : ${reason ?? 'non précisé'}.`
    }
    case 'expiree':
      return audience === 'candidate'
        ? `Cette proposition a expiré le ${deadline} sans réponse. Contactez OffRec si vous êtes toujours intéressé·e.`
        : `Expirée le ${deadline} sans réponse du candidat.`
    case 'retiree': {
      const withdrawn = when(proposal.withdrawnAt)
      if (audience === 'candidate') {
        // Texte neutre : jamais la raison du retrait (D3).
        return `Cette proposition a été retirée${withdrawn ? ` le ${withdrawn}` : ''}. OffRec revient vers vous pour la suite.`
      }
      const reason = proposal.withdrawReason ? WITHDRAW_REASON_LABELS[proposal.withdrawReason] : null
      return `Retirée${withdrawn ? ` le ${withdrawn}` : ''}${reason ? ` · ${reason}` : ''}.`
    }
  }
}
