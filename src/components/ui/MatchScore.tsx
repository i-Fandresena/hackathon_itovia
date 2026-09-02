import type { MatchResult } from '../../types'
import './MatchScore.css'

interface MatchScoreProps {
  match: MatchResult
  compact?: boolean
}

export function MatchScore({ match, compact }: MatchScoreProps) {
  const tone =
    match.score >= 75 ? 'high' : match.score >= 50 ? 'mid' : 'low'

  if (compact) {
    return (
      <div className={`match-score match-${tone} match-compact`}>
        <div className="match-header">
          <span className="match-pct">{match.score}%</span>
        </div>
      </div>
    )
  }

  const [topReason, ...otherReasons] = match.reasons

  return (
    <div className={`match-score match-${tone}`}>
      <div className="match-header">
        <span className="match-label">Compatibilité profil</span>
        <span className="match-pct">{match.score}%</span>
      </div>
      <div className="match-bar-track" role="progressbar" aria-valuenow={match.score} aria-valuemin={0} aria-valuemax={100}>
        <div className="match-bar-fill" style={{ width: `${match.score}%` }} />
      </div>
      {topReason && (
        <p className="match-why">
          <strong>Pourquoi ce match ·</strong> {topReason}
        </p>
      )}
      {otherReasons.length > 0 && (
        <ul className="match-reasons">
          {otherReasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
