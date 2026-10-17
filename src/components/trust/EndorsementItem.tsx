import type { ReactNode } from 'react'
import { Camera } from 'lucide-react'
import { formatDate } from '../../lib/format'
import './EndorsementItem.css'

interface EndorsementItemProps {
  /** Ligne d'auteur déjà composée par l'appelant (ex. « Un client · Itaosy »). */
  author: string
  /** Précision sous l'auteur (relation, dates…). */
  meta?: string
  /** `null` : libellé non affiché (non revu ou masqué). */
  jobLabel?: string | null
  highlights: string[]
  proofVerified?: boolean
  excluded?: boolean
  /** Contenu complémentaire (commentaire privé, photo, actions de revue). */
  children?: ReactNode
  badges?: ReactNode
}

/**
 * Une recommandation positive (talent ou entreprise). N'affiche que ce que
 * l'appelant lui passe : c'est la réponse du serveur qui décide de ce qu'un
 * rôle a le droit de voir.
 */
export function EndorsementItem({ author, meta, jobLabel, highlights, proofVerified, excluded, children, badges }: EndorsementItemProps) {
  return (
    <article className={`endorse-item ${excluded ? 'endorse-item-excluded' : ''}`}>
      <div className="endorse-item-head">
        <div className="endorse-item-main">
          <p className="endorse-item-author">{author}</p>
          {meta && <p className="endorse-item-meta">{meta}</p>}
        </div>
        {(badges || proofVerified) && (
          <div className="endorse-item-badges">
            {proofVerified && (
              <span className="endorse-item-proof">
                <Camera size={12} aria-hidden /> Preuve vérifiée par un agent
              </span>
            )}
            {badges}
          </div>
        )}
      </div>
      {jobLabel && <p className="endorse-item-job">« {jobLabel} »</p>}
      {highlights.length > 0 && (
        <div className="endorse-item-tags">
          {highlights.map((h) => (
            <span key={h} className="endorse-item-tag">
              {h}
            </span>
          ))}
        </div>
      )}
      {children}
    </article>
  )
}

/** « travail de juil. 2026 » — la date exacte n'apporte rien au lecteur. */
export function jobMonth(iso: string): string {
  return formatDate(iso).replace(/^\d+\s+/, '')
}
