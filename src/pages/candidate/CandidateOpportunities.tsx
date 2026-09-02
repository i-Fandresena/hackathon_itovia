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
import { rankOpportunities } from '../../lib/recommendation'

export function CandidateOpportunities() {
  const { currentUser, opportunities, isBookmarked, toggleBookmark, hydrated } =
    useApp()
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    province: '',
    category: '',
    sector: '',
  })

  const profile = currentUser?.candidateProfile

  const list = useMemo(() => {
    const filtered = filterOpportunities(opportunities, filters)
    if (!profile) return filtered.map((o) => ({ opportunity: o, match: undefined }))
    return rankOpportunities(profile, filtered)
  }, [opportunities, filters, profile])

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
            Classées par score de compatibilité avec votre profil.
          </p>
        </header>

        <OpportunityFilters filters={filters} onChange={setFilters} />

        {list.length === 0 ? (
          <EmptyState
            icon={Compass}
            title="Aucune offre trouvée"
            description="Essayez d’élargir vos filtres ou de modifier votre profil."
          />
        ) : (
          <div className="opp-list">
            {list.map(({ opportunity, match }) => (
              <OpportunityCard
                key={opportunity.id}
                opportunity={opportunity}
                match={match}
                showMatch={!!match}
                detailPath={`/candidat/offres/${opportunity.id}`}
                bookmarked={isBookmarked(opportunity.id)}
                onBookmark={() => toggleBookmark(opportunity.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
