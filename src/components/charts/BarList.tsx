import { Link } from 'react-router-dom'
import './Charts.css'

export interface BarItem {
  key: string
  label: string
  value: number
  /** Précision sous le libellé (définition, période…). */
  hint?: string
  /** Lien interne vers l'écran correspondant. */
  to?: string
  /** Barre grisée : état hors du parcours principal (ex. dossiers écartés). */
  muted?: boolean
}

interface BarListProps {
  items: BarItem[]
  /** Nom de la liste, repris par les lecteurs d'écran. */
  title: string
}

/**
 * Barres horizontales étiquetées (une valeur par ligne, longueur relative au
 * maximum de la liste). Chaque valeur est écrite en toutes lettres à côté de
 * sa barre : la liste est elle-même l'alternative textuelle.
 */
export function BarList({ items, title }: BarListProps) {
  const max = Math.max(1, ...items.map((i) => i.value))
  return (
    <ol className="ochart-bars" aria-label={title}>
      {items.map((item) => {
        const pct = item.value > 0 ? Math.max(2, (item.value / max) * 100) : 0
        return (
          <li key={item.key}>
            <div className="ochart-bar-head">
              <span className="ochart-bar-label">
                {item.to ? <Link to={item.to}>{item.label}</Link> : item.label}
                {item.hint && <span className="ochart-bar-hint">{item.hint}</span>}
              </span>
              <span className="ochart-bar-value">{item.value.toLocaleString('fr-FR')}</span>
            </div>
            <div className="ochart-bar-track" aria-hidden="true">
              {pct > 0 && (
                <div className={`ochart-bar-fill ${item.muted ? 'is-muted' : ''}`.trim()} style={{ width: `${pct}%` }} />
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
