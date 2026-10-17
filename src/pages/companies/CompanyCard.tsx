import { Link } from 'react-router-dom'
import { ArrowRight, Building2, MapPin, UsersRound } from 'lucide-react'
import { TrustLevelBadge } from '../../components/trust/TrustLevelBadge'
import { SECTOR_LABELS } from '../../data/constants'
import { COMPANY_RELATIONS, companyRelationCount } from '../../data/endorsements'
import type { PublicCompany } from '../../types'

/** « 3 personnes différentes la recommandent ». */
export function companySourcesLabel(n: number): string {
  if (n === 0) return 'Pas encore de recommandation retenue'
  return n > 1 ? `${n} personnes différentes la recommandent` : '1 personne la recommande'
}

/** « 3 anciens salariés · 1 stagiaire », `null` sous le seuil de confidentialité. */
export function companyRelationsLabel(relations: PublicCompany['relations']): string | null {
  if (!relations) return null
  const parts = COMPANY_RELATIONS.filter((r) => relations[r] > 0).map((r) => companyRelationCount(r, relations[r]))
  return parts.length > 0 ? parts.join(' · ') : null
}

/**
 * Carte de la vitrine « Entreprises recommandées » : uniquement les champs
 * de la liste blanche publique — aucun auteur, aucun commentaire, aucune date.
 */
export function CompanyCard({ company }: { company: PublicCompany }) {
  const relations = companyRelationsLabel(company.relations)
  return (
    <Link to={`/annuaire/entreprises/${company.id}`} className={`ptl-card ptl-card-${company.level}`}>
      <div className="ptl-card-head">
        <span className="ptl-card-icon" aria-hidden>
          <Building2 size={20} strokeWidth={1.75} />
        </span>
        <div className="ptl-card-title">
          <h3>{company.name}</h3>
          <p className="ptl-card-sector">{SECTOR_LABELS[company.sector]}</p>
        </div>
      </div>
      <p className="ptl-card-place">
        <MapPin size={14} aria-hidden />
        {company.city}
      </p>
      <div className="ptl-card-trust">
        <TrustLevelBadge level={company.level} />
        <span className="ptl-card-sources">
          <UsersRound size={14} aria-hidden />
          {companySourcesLabel(company.independentSources)}
        </span>
      </div>
      {relations && <p className="cmp-relations-line">{relations}</p>}
      {company.highlights.length > 0 && (
        <ul className="ptl-chips" aria-label="Points forts cités">
          {company.highlights.slice(0, 3).map((h) => (
            <li key={h.label} className="ptl-chip">
              {h.label} <span className="cmp-chip-count">×{h.count}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="ptl-card-foot">
        <span className="cmp-card-note">Auteurs jamais affichés</span>
        <span className="ptl-card-more">
          Voir la fiche <ArrowRight size={14} aria-hidden />
        </span>
      </div>
    </Link>
  )
}
