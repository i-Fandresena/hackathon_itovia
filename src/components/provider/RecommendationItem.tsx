import { BadgeCheck, Camera, Check, FileText, MapPin, Star } from 'lucide-react'
import { PROOF_LABELS } from '../../data/constants'
import { formatAriary, formatMonth } from '../../lib/format'
import type { Member, Recommendation } from '../../types'
import './RecommendationItem.css'

const PROOF_ICONS = {
  facture: FileText,
  photo: Camera,
  aucune: null,
}

interface RecommendationItemProps {
  recommendation: Recommendation
  author?: Member
  /** Vrai si ce retour est écarté du score (auto-recommandation). */
  excluded?: boolean
  canConfirm: boolean
  confirmed: boolean
  onConfirm: () => void
}

export function RecommendationItem({
  recommendation: rec,
  author,
  excluded,
  canConfirm,
  confirmed,
  onConfirm,
}: RecommendationItemProps) {
  const ProofIcon = PROOF_ICONS[rec.proof]

  return (
    <article className={`rec-item ${excluded ? 'rec-excluded' : ''}`}>
      <header className="rec-head">
        <div className="rec-author">
          <span className="rec-avatar" aria-hidden>
            {rec.authorName.charAt(0)}
          </span>
          <div>
            <p className="rec-name">
              {rec.authorName}
              {author?.phoneVerified && (
                <span className="rec-verified" title="Numéro vérifié">
                  <BadgeCheck size={14} aria-hidden />
                  vérifié
                </span>
              )}
            </p>
            <p className="rec-meta">
              <MapPin size={12} aria-hidden />
              {rec.authorDistrict} · chantier de {formatMonth(rec.jobDate)}
            </p>
          </div>
        </div>
        <div className="rec-rating" aria-label={`${rec.rating} sur 5`}>
          {Array.from({ length: 5 }, (_, i) => (
            <Star
              key={i}
              size={14}
              aria-hidden
              fill={i < rec.rating ? 'currentColor' : 'none'}
            />
          ))}
        </div>
      </header>

      <p className="rec-job">{rec.jobLabel}</p>
      <p className="rec-comment">{rec.comment}</p>

      <div className="rec-facts">
        {typeof rec.pricePaid === 'number' && rec.priceUnit && (
          <span className="rec-fact rec-fact-price">
            {formatAriary(rec.pricePaid)} {rec.priceUnit}
          </span>
        )}
        <span className={`rec-fact ${rec.proof === 'aucune' ? 'rec-fact-weak' : 'rec-fact-proof'}`}>
          {ProofIcon && <ProofIcon size={12} aria-hidden />}
          {PROOF_LABELS[rec.proof]}
        </span>
        <span className={`rec-fact ${rec.wouldUseAgain ? 'rec-fact-yes' : 'rec-fact-no'}`}>
          {rec.wouldUseAgain ? 'Referait appel à lui' : 'Ne referait pas appel à lui'}
        </span>
      </div>

      {excluded && (
        <p className="rec-excluded-note">
          Retour publié par le prestataire lui-même : exclu du score.
        </p>
      )}

      <footer className="rec-foot">
        <span className="rec-confirm-count">
          {rec.confirmations.length > 0
            ? `${rec.confirmations.length} membre${rec.confirmations.length > 1 ? 's ont' : ' a'} confirmé`
            : 'Aucune confirmation'}
        </span>
        {canConfirm && (
          <button
            type="button"
            className={`rec-confirm ${confirmed ? 'active' : ''}`}
            onClick={onConfirm}
          >
            <Check size={14} aria-hidden />
            {confirmed ? 'Confirmé' : 'J’ai eu la même expérience'}
          </button>
        )}
      </footer>
    </article>
  )
}
