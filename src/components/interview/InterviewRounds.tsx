import { INTERVIEW_RESULT_LABELS, RESULT_REASON_LABELS, isOutcomeDue, isRoundOver } from '../../lib/hiring'
import { formatMadagascarShortDateTime } from '../../lib/interview'
import { toRoundStates, type RoundView } from '../hiring/hiringState'
import { interviewStatusLabel, type InterviewAudience } from './InterviewSummary'
import './InterviewRounds.css'

interface InterviewRoundsProps {
  rounds: readonly RoundView[]
  audience: InterviewAudience
  /** Tour détaillé au-dessus (mis en évidence). */
  currentId?: string
  title?: string
}

type Tone = 'neutral' | 'warning' | 'success' | 'muted'

const RESULT_TONE = { retenu: 'success', second_entretien: 'neutral', non_retenu: 'muted', absent: 'warning' } as const

/**
 * Frise des tours d'un dossier : « Tour 1 · 12 oct. 10:00 · Terminé — Retenu ».
 * Le candidat n'y lit que la date et l'état de l'entretien (jamais l'issue,
 * le motif ni la note, que le serveur ne lui envoie d'ailleurs pas) et sa
 * propre explication d'absence. Le recruteur lit l'issue, le motif et SA
 * note privée ; l'admin, l'issue, le motif et l'explication du candidat.
 */
export function InterviewRounds({ rounds, audience, currentId, title = 'Historique des tours' }: InterviewRoundsProps) {
  const now = new Date()
  const states = new Map(toRoundStates(rounds).map((state) => [state.id, state]))
  const ordered = [...rounds].sort((a, b) => (a.round ?? 1) - (b.round ?? 1))
  if (ordered.length === 0) return null

  return (
    <section className="ivr" aria-label={title}>
      <h3 className="ivr-title">{title}</h3>
      <ol className="ivr-list">
        {ordered.map((row) => {
          const state = states.get(row.id)
          const over = isRoundOver(row, now)
          let text: string
          let tone: Tone = 'neutral'
          if (row.status === 'annule') {
            text = 'Annulé'
            tone = 'muted'
          } else if (audience !== 'candidate' && row.outcome) {
            text = INTERVIEW_RESULT_LABELS[row.outcome]
            tone = RESULT_TONE[row.outcome]
          } else if (row.status === 'empechement') {
            text = 'Empêchement signalé'
            tone = 'warning'
          } else if (!over) {
            text = interviewStatusLabel(row.status, audience)
          } else if (audience !== 'candidate' && state && isOutcomeDue(state, now)) {
            text = 'Issue à renseigner'
            tone = 'warning'
          } else {
            text = 'Terminé'
            tone = 'muted'
          }
          const reason = audience !== 'candidate' && row.outcomeReason ? RESULT_REASON_LABELS[row.outcomeReason] : null
          const note = audience === 'recruiter' && row.outcomeNote ? row.outcomeNote : null
          const reply = audience !== 'recruiter' && row.absenceReply ? row.absenceReply : null
          return (
            <li key={row.id} className={`ivr-item${row.id === currentId ? ' is-current' : ''}`}>
              <div className="ivr-line">
                <span className="ivr-round">Tour {row.round ?? 1}</span>
                <time className="ivr-date" dateTime={row.scheduledAt}>
                  {formatMadagascarShortDateTime(row.scheduledAt)}
                </time>
                <span className={`ivr-state ivr-state-${tone}`}>{text}</span>
              </div>
              {reason && <p className="ivr-detail">Motif : {reason}</p>}
              {note && (
                <p className="ivr-detail ivr-note">
                  <span className="ivr-label">Votre note privée (visible par vous seul·e)</span> « {note} »
                </p>
              )}
              {reply && (
                <p className="ivr-detail">
                  <span className="ivr-label">
                    {audience === 'candidate' ? 'Votre explication, transmise à OffRec' : 'Explication du candidat'}
                  </span>{' '}
                  « {reply} »
                </p>
              )}
            </li>
          )
        })}
      </ol>
    </section>
  )
}
