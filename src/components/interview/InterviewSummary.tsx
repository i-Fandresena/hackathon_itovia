import { CalendarClock, ExternalLink, Video } from 'lucide-react'
import type { ReactNode } from 'react'
import { Badge } from '../ui/Badge'
import {
  INTERVIEW_STATUS_LABELS,
  formatMadagascarDateTime,
  formatMadagascarTime,
  interviewEnd,
} from '../../lib/interview'
import type { AdminInterview, Interview, InterviewStatus } from '../../types'
import './InterviewSummary.css'

export type InterviewAudience = 'candidate' | 'recruiter' | 'admin'
type Audience = InterviewAudience

interface InterviewSummaryProps {
  interview: Interview | AdminInterview
  audience: Audience
  /** Nom de l'entreprise (vue candidat, révélé à la mise en relation). */
  companyName?: string | null
  /** Titre de la carte ; « Entretien » par défaut. */
  title?: string
  /** Actions affichées sous le récapitulatif. */
  children?: ReactNode
}

/** Couleur du badge de statut, partagée avec les listes « Entretiens ». */
export const INTERVIEW_STATUS_VARIANT: Record<InterviewStatus, 'primary' | 'success' | 'default' | 'muted'> = {
  planifie: 'primary',
  confirme: 'success',
  empechement: 'default',
  annule: 'muted',
}

/** Libellé du statut selon le lecteur : le candidat lit « À confirmer » et
 *  « Présence confirmée » plutôt que la formulation tournée vers l'entreprise. */
export function interviewStatusLabel(status: InterviewStatus, audience: Audience): string {
  if (audience === 'candidate') {
    if (status === 'planifie') return 'À confirmer'
    if (status === 'confirme') return 'Présence confirmée'
  }
  return INTERVIEW_STATUS_LABELS[status]
}

const isAdminInterview = (interview: Interview | AdminInterview): interview is AdminInterview =>
  'calendarError' in interview

/** Libellé de la visioconférence, honnête sur l'état réel du lien. */
function MeetLine({ interview, audience }: { interview: Interview; audience: Audience }) {
  if (interview.status === 'annule') {
    return <span className="iv-muted">Aucun lien : l’entretien est annulé.</span>
  }
  if (interview.meetStatus === 'disponible' && interview.meetUrl) {
    return (
      <a className="iv-meet-link" href={interview.meetUrl} target="_blank" rel="noopener noreferrer">
        <Video size={15} aria-hidden />
        Rejoindre sur Google Meet
        <ExternalLink size={13} aria-hidden />
        <span className="iv-sr">(s’ouvre dans un nouvel onglet)</span>
      </a>
    )
  }
  if (interview.meetStatus === 'en_attente') {
    return (
      <span className="iv-pending">
        Lien Google Meet en attente :{' '}
        {audience === 'admin'
          ? 'l’agenda Google n’a pas répondu, relancez la synchronisation.'
          : audience === 'candidate'
            ? 'OffRec vous l’envoie dès qu’il est prêt (sur la plateforme et par email).'
            : 'OffRec le communique dès que possible.'}
      </span>
    )
  }
  if (audience === 'candidate') {
    return (
      <span className="iv-pending">
        Lien de visio simulé : cet environnement de démonstration ne crée aucun lien réel. OffRec vous indiquera
        comment rejoindre l’entretien.
      </span>
    )
  }
  return (
    <span className="iv-pending">
      Lien Meet simulé : l’agenda Google d’OffRec n’est pas configuré sur cet environnement, aucun lien réel
      n’a été créé.
    </span>
  )
}

/**
 * Récapitulatif d'un entretien (décision 2026-10-14) : date et heure en
 * heure de Madagascar, durée, statut, lien Meet ou son état. Partagé par
 * les vues candidat, recruteur et admin ; les actions viennent en `children`.
 */
export function InterviewSummary({ interview, audience, companyName, title = 'Entretien', children }: InterviewSummaryProps) {
  const end = interviewEnd(interview.scheduledAt, interview.durationMinutes)
  const past = end.getTime() < Date.now()
  const statusLabel = interviewStatusLabel(interview.status, audience)

  return (
    <section className={`iv-summary iv-summary-${interview.status}`} aria-label={title}>
      <div className="iv-head">
        <h3 className="iv-title">
          <CalendarClock size={16} aria-hidden />
          {title}
        </h3>
        <Badge variant={INTERVIEW_STATUS_VARIANT[interview.status]}>{statusLabel}</Badge>
      </div>

      <dl className="iv-rows">
        <div>
          <dt>Date</dt>
          <dd>
            <span className={interview.status === 'annule' ? 'iv-struck' : undefined}>
              {formatMadagascarDateTime(interview.scheduledAt)}
            </span>
            <span className="iv-tz"> (heure de Madagascar)</span>
            {past && interview.status !== 'annule' && <span className="iv-muted"> · passé</span>}
          </dd>
        </div>
        <div>
          <dt>Durée</dt>
          <dd>
            {interview.durationMinutes} minutes · fin à {formatMadagascarTime(end)}
          </dd>
        </div>
        {audience === 'candidate' && companyName && (
          <div>
            <dt>Entreprise</dt>
            <dd>{companyName}</dd>
          </div>
        )}
        <div>
          <dt>Visio</dt>
          <dd>
            <MeetLine interview={interview} audience={audience} />
          </dd>
        </div>
        {audience === 'admin' && isAdminInterview(interview) && (
          <div>
            <dt>Agenda</dt>
            <dd>
              {interview.provider === 'google' ? 'Google Calendar (OffRec)' : 'Simulé (non configuré)'}
              {interview.calendarError && <span className="iv-error"> · À régulariser : {interview.calendarError}</span>}
            </dd>
          </div>
        )}
      </dl>

      {interview.message && (
        <p className="iv-message">
          <span className="iv-message-label">{audience === 'recruiter' ? 'Votre message' : 'Message du recruteur'}</span>
          {interview.message}
        </p>
      )}

      {interview.status === 'empechement' && (
        <p className="iv-alert" role={audience === 'recruiter' ? 'status' : undefined}>
          {audience === 'candidate'
            ? 'Vous avez signalé un empêchement : l’entreprise va proposer une nouvelle date.'
            : 'Le candidat a signalé un empêchement.'}
          {interview.declineReason && (
            <>
              {' '}
              Motif : « {interview.declineReason} »
            </>
          )}
        </p>
      )}

      {interview.rescheduleCount > 0 && interview.status !== 'annule' && (
        <p className="iv-muted iv-small">
          Reprogrammé {interview.rescheduleCount === 1 ? 'une fois' : `${interview.rescheduleCount} fois`}.
        </p>
      )}

      {children && <div className="iv-actions">{children}</div>}
    </section>
  )
}
