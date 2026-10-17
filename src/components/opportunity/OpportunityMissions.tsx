import './OpportunityMissions.css'

interface OpportunityMissionsProps {
  /** Absent ou vide : rien n'est rendu (offres antérieures aux missions). */
  missions?: readonly string[] | null
  /** Variante resserrée pour les cartes admin. */
  compact?: boolean
  /** Libellé accessible de la liste quand aucun titre visible ne la précède. */
  label?: string
}

/** Missions d'une offre, dans l'ordre choisi par le recruteur. */
export function OpportunityMissions({ missions, compact, label }: OpportunityMissionsProps) {
  if (!missions || missions.length === 0) return null
  return (
    <ul className={`opp-missions${compact ? ' opp-missions-compact' : ''}`} aria-label={label}>
      {missions.map((mission, index) => (
        <li key={`${index}-${mission}`}>{mission}</li>
      ))}
    </ul>
  )
}
