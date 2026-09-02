import { useMemo, useState } from 'react'
import { Compass } from 'lucide-react'
import {
  OpportunityFilters,
  filterOpportunities,
  type FilterState,
} from '../../components/opportunity/OpportunityFilters'
import { OpportunityCard } from '../../components/opportunity/OpportunityCard'
import { EmptyState } from '../../components/ui/EmptyState'
import { Loading } from '../../components/ui/Loading'
import { useApp } from '../../context/AppContext'

/**
 * Le fil du candidat, pas un catalogue : uniquement les offres qu'OffRec a
 * choisi de lui proposer (décision produit 2026-09-02) — plus de parcours
 * "toutes les offres, classées par un score calculé côté client".
 */
export function CandidateOpportunities() {
  const { mySuggestions, isBookmarked, toggleBookmark, hydrated } = useApp()
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    province: '',
    category: '',
    sector: '',
  })

  const active = useMemo(() => mySuggestions.filter((s) => s.status !== 'ecartee'), [mySuggestions])

  const list = useMemo(() => {
    const filteredOpps = filterOpportunities(active.map((s) => s.opportunity), filters)
    const keep = new Set(filteredOpps.map((o) => o.id))
    return active
      .filter((s) => keep.has(s.opportunityId))
      .map((s) => ({
        opportunity: s.opportunity,
        match: { score: s.score, reasons: s.reasons },
      }))
  }, [active, filters])

  if (!hydrated) {
    return (
      <div className="page">
        <div className="container">
          <Loading />
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <div className="container">
        <header className="page-header">
          <h1>Offres recommandées</h1>
          <p>
            Sélectionnées par OffRec pour votre profil — postulez en un clic,
            OffRec s’occupe du reste.
          </p>
        </header>

        <OpportunityFilters filters={filters} onChange={setFilters} />

        {list.length === 0 ? (
          <EmptyState
            icon={Compass}
            title="Aucune offre pour l’instant"
            description="OffRec vous proposera des offres dès qu’une correspondance pertinente sera identifiée avec votre profil."
          />
        ) : (
          <div className="opp-list">
            {list.map(({ opportunity, match }) => (
              <OpportunityCard
                key={opportunity.id}
                opportunity={opportunity}
                match={match}
                showMatch
                detailPath={`/candidat/offres/${opportunity.id}`}
                bookmarked={isBookmarked(opportunity.id)}
                onBookmark={() => toggleBookmark(opportunity.id)}
                hideCompany
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
