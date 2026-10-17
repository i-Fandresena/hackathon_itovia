import { AlertTriangle, Clock, ExternalLink, Video } from 'lucide-react'
import type { ReactNode } from 'react'
import { Badge } from '../ui/Badge'
import { INTERVIEW_STATUS_VARIANT, interviewStatusLabel } from './InterviewSummary'
import {
  INTERVIEW_PERIOD_LABELS,
  formatMadagascarDateTime,
  formatMadagascarTime,
  interviewEnd,
  isInterviewUpcoming,
} from '../../lib/interview'
import type { Interview, InterviewPeriod, InterviewStatus } from '../../types'
import './InterviewList.css'

/**
 * Briques partagées des onglets « Entretiens » (candidat, recruteur, admin) :
 * sélecteur de période, regroupement par offre, ligne d'entretien et
 * compteurs. Les pages gardent leurs données et leurs actions.
 */

export const INTERVIEW_PERIODS: InterviewPeriod[] = ['a_venir', 'passes', 'annules', 'tous']
export const INTERVIEW_STATUSES: InterviewStatus[] = ['planifie', 'confirme', 'empechement', 'annule']

/** Regroupe par offre en gardant l'ordre de la liste (le groupe qui porte
 *  l'entretien le plus proche vient en premier). */
export function groupInterviewsByOffer<T extends { opportunity: { id: string } }>(items: T[]) {
  const groups = new Map<string, { id: string; items: T[] }>()
  for (const item of items) {
    const group = groups.get(item.opportunity.id) ?? { id: item.opportunity.id, items: [] }
    group.items.push(item)
    groups.set(item.opportunity.id, group)
  }
  return [...groups.values()]
}

export function pluralize(count: number, singular: string, plural: string): string {
  return `${count} ${count > 1 ? plural : singular}`
}

/** Période : groupe de boutons bascule (clavier : Tab puis Entrée/Espace). */
export function InterviewPeriodTabs({
  value,
  onChange,
}: {
  value: InterviewPeriod
  onChange: (period: InterviewPeriod) => void
}) {
  return (
    <div className="ivl-periods" role="group" aria-label="Période">
      {INTERVIEW_PERIODS.map((period) => (
        <button
          key={period}
          type="button"
          className={`ivl-period${value === period ? ' is-active' : ''}`}
          aria-pressed={value === period}
          onClick={() => onChange(period)}
        >
          {INTERVIEW_PERIOD_LABELS[period]}
        </button>
      ))}
    </div>
  )
}

/** Tuile de compteur, cliquable pour appliquer le filtre correspondant. */
export function InterviewStat({
  value,
  label,
  tone = 'default',
  active,
  onClick,
}: {
  value: number
  label: string
  tone?: 'default' | 'warning' | 'danger'
  active?: boolean
  onClick?: () => void
}) {
  const content = (
    <>
      <span className="ivl-stat-value">{value}</span>
      <span className="ivl-stat-label">{label}</span>
    </>
  )
  const className = `ivl-stat ivl-stat-${tone}${value > 0 ? ' has-value' : ''}${active ? ' is-active' : ''}`
  return onClick ? (
    <button type="button" className={className} aria-pressed={active} onClick={onClick}>
      {content}
    </button>
  ) : (
    <div className={className}>{content}</div>
  )
}

/** État du lien de visio, en une ligne : lien, simulé, en attente ou aucun. */
export function InterviewMeetState({ interview }: { interview: Interview }) {
  if (interview.status === 'annule') return <span className="ivl-meet is-none">Aucun lien</span>
  if (interview.meetStatus === 'disponible' && interview.meetUrl) {
    return (
      <a className="ivl-meet is-link" href={interview.meetUrl} target="_blank" rel="noopener noreferrer">
        <Video size={14} aria-hidden />
        Google Meet
        <ExternalLink size={12} aria-hidden />
        <span className="ivl-sr">(s’ouvre dans un nouvel onglet)</span>
      </a>
    )
  }
  if (interview.meetStatus === 'en_attente') return <span className="ivl-meet is-pending">Lien Meet en attente</span>
  return (
    <span className="ivl-meet is-simulated" title="Agenda Google non configuré : aucun lien réel n’est créé.">
      Lien simulé
    </span>
  )
}

interface InterviewRowProps {
  interview: Interview
  audience: 'candidate' | 'recruiter' | 'admin'
  /** Titre de la ligne (nom du candidat ; entreprise côté candidat). */
  heading: string
  /** Niveau du titre de ligne (sous le titre de groupe). */
  headingLevel?: 3 | 4
  /** Précisions sous le nom (recruteur, entreprise…). */
  meta?: ReactNode
  /** Ligne supplémentaire (fournisseur d'agenda, erreur…). */
  extra?: ReactNode
  /** Mention courte à côté du statut (ex. « Réponse attendue »). */
  flag?: string
  actions?: ReactNode
}

/**
 * Ligne d'entretien : date et heure de Madagascar, durée, candidat, statut,
 * lien Meet ou son état, alerte d'empêchement, puis les actions.
 */
export function InterviewRow({
  interview,
  audience,
  heading,
  headingLevel = 3,
  meta,
  extra,
  flag,
  actions,
}: InterviewRowProps) {
  const end = interviewEnd(interview.scheduledAt, interview.durationMinutes)
  const upcoming = isInterviewUpcoming(interview)
  const Heading = headingLevel === 3 ? 'h3' : 'h4'
  return (
    <li className={`ivl-row ivl-row-${interview.status}`}>
      <div className="ivl-when">
        <time
          dateTime={interview.scheduledAt}
          className={`ivl-date${interview.status === 'annule' ? ' is-struck' : ''}`}
        >
          {formatMadagascarDateTime(interview.scheduledAt)}
        </time>
        <span className="ivl-duration">
          {interview.durationMinutes} min · fin à {formatMadagascarTime(end)}
          {!upcoming && interview.status !== 'annule' && ' · passé'}
        </span>
      </div>

      <div className="ivl-who">
        <Heading className="ivl-name">{heading}</Heading>
        {meta && <div className="ivl-meta">{meta}</div>}
      </div>

      <div className="ivl-state">
        <Badge variant={INTERVIEW_STATUS_VARIANT[interview.status]}>
          {interviewStatusLabel(interview.status, audience)}
        </Badge>
        {flag && (
          <span className="ivl-chip is-warning ivl-flag">
            <Clock size={12} aria-hidden />
            {flag}
          </span>
        )}
        <InterviewMeetState interview={interview} />
      </div>

      {interview.status === 'empechement' && (
        <p className="ivl-alert">
          <AlertTriangle size={14} aria-hidden />
          {audience === 'candidate'
            ? 'Vous avez signalé un empêchement : l’entreprise va proposer une nouvelle date.'
            : audience === 'recruiter'
              ? 'Empêchement signalé par le candidat : proposez une nouvelle date ou annulez.'
              : 'Empêchement signalé par le candidat : le recruteur doit reprogrammer ou annuler.'}
        </p>
      )}
      {extra && <div className="ivl-extra">{extra}</div>}
      {actions && <div className="ivl-actions">{actions}</div>}
    </li>
  )
}
