import type { MatchResult } from '../../types'
import './MatchScore.css'

interface MatchScoreProps {
  match: MatchResult
  compact?: boolean
}

export function MatchScore({ match, compact }: MatchScoreProps) {
  const tone =
    match.score >= 75 ? 'high' : match.score >= 50 ? 'mid' : 'low'

  return (
    <div className={`match-score match-${tone} ${compact ? 'match-compact' : ''}`}>
      <div className="match-header">
        <span className="match-pct">{match.score}%</span>
        {!compact && <span className="match-label">compatibilité profil</span>}
      </div>
      {!compact && match.reasons.length > 0 && (
        <ul className="match-reasons">
          {match.reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
