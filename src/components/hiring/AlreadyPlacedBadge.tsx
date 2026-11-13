import { BriefcaseBusiness } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { AlreadyPlacedView } from '../../types'
import './AlreadyPlacedBadge.css'

/** Phrase complète (titre, lecteurs d'écran, fiche candidat). */
export function alreadyPlacedText(placed: AlreadyPlacedView): string {
  const count = `${placed.activePlacements} placement${placed.activePlacements > 1 ? 's' : ''} actif${placed.activePlacements > 1 ? 's' : ''}`
  return placed.matchingPaused
    ? `Déjà en poste via OffRec (${count}) : matching en pause.`
    : `Déjà en poste via OffRec (${count}) : réintégré au matching par un admin.`
}

/**
 * Badge « Déjà placé » (décision 2026-11-12) — écrans ADMIN seulement :
 * nombre de placements actifs du candidat, lien vers « Placements ». Ton
 * « attention » tant que son matching est en pause, neutre une fois
 * réintégré. Jamais affiché côté recruteur (le serveur ne lui envoie pas
 * `alreadyPlaced`).
 */
export function AlreadyPlacedBadge({ placed }: { placed: AlreadyPlacedView | null | undefined }) {
  if (!placed) return null
  const text = alreadyPlacedText(placed)
  return (
    <Link
      to="/admin/placements"
      className={`apb ${placed.matchingPaused ? 'apb-paused' : 'apb-reintegrated'}`}
      title={`${text} Voir les placements.`}
      aria-label={`${text} Voir les placements.`}
    >
      <BriefcaseBusiness size={12} aria-hidden />
      Déjà placé{placed.activePlacements > 1 ? ` · ${placed.activePlacements}` : ''}
    </Link>
  )
}
