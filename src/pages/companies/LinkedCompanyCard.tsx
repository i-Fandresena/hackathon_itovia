import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Building2 } from 'lucide-react'
import { TrustLevelBadge } from '../../components/trust/TrustLevelBadge'
import { Card } from '../../components/ui/Card'
import { apiCompanyForOpportunity, apiMyLinkedCompany } from '../../lib/api'
import type { LinkedCompanySummary, PublicCompany } from '../../types'
import { companySourcesLabel } from './CompanyCard'
import '../talents/PublicTalents.css'
import './Companies.css'

/**
 * Encart du tableau de bord recruteur : la fiche entreprise liée par un
 * admin (niveau, nombre, points forts). Rien si aucune fiche n'est liée.
 * Jamais d'auteur ni de commentaire (le serveur ne les envoie pas).
 */
export function LinkedCompanyCard() {
  const [company, setCompany] = useState<LinkedCompanySummary | null>(null)

  useEffect(() => {
    apiMyLinkedCompany()
      .then(setCompany)
      .catch(() => setCompany(null))
  }, [])

  if (!company) return null
  const n = company.recommendationCount
  return (
    <Card className="cmp-linked">
      <div className="cmp-linked-head">
        <h2 className="cmp-linked-title">
          <Building2 size={18} aria-hidden /> Votre entreprise sur OffRec : {company.name}
        </h2>
        <TrustLevelBadge level={company.level} />
      </div>
      <p className="cmp-linked-count">
        {n === 0
          ? 'Pas encore de recommandation retenue.'
          : `Recommandée ${n} fois par d’anciens salariés, stagiaires ou prestataires · ${companySourcesLabel(company.independentSources).toLowerCase()}.`}
      </p>
      {company.highlights.length > 0 && (
        <ul className="ptl-chips" aria-label="Points forts cités">
          {company.highlights.map((h) => (
            <li key={h.label} className="ptl-chip">
              {h.label} <span className="cmp-chip-count">×{h.count}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="cmp-linked-note">
        Les auteurs restent anonymes et aucun commentaire n’est transmis. <Link to={`/annuaire/entreprises/${company.id}`}>Voir la fiche publique</Link>
      </p>
    </Card>
  )
}

/**
 * Confiance de l'employeur sur une offre : page publique `/offres/:id` (le
 * nom y est déjà public) et dossier candidat APRÈS la mise en relation
 * seulement — l'appelant ne doit jamais l'afficher avant (le niveau
 * permettrait de deviner l'entreprise).
 */
export function EmployerTrust({ opportunityId }: { opportunityId: string }) {
  const [company, setCompany] = useState<PublicCompany | null>(null)

  useEffect(() => {
    setCompany(null)
    apiCompanyForOpportunity(opportunityId)
      .then(setCompany)
      .catch(() => setCompany(null))
  }, [opportunityId])

  if (!company) return null
  return (
    <div className="cmp-employer">
      <span className="cmp-employer-label">Employeur recommandé sur OffRec</span>
      <TrustLevelBadge level={company.level} />
      <span className="ptl-card-sources">{companySourcesLabel(company.independentSources)}</span>
      <Link to={`/annuaire/entreprises/${company.id}`}>Voir la fiche de {company.name}</Link>
    </div>
  )
}
