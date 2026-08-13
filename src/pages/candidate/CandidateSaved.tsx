import { Bookmark } from 'lucide-react'
import { OpportunityCard } from '../../components/opportunity/OpportunityCard'
import { EmptyState } from '../../components/ui/EmptyState'
import { useApp } from '../../context/AppContext'
import { rankOpportunities } from '../../lib/recommendation'

export function CandidateSaved() {
  const { opportunities, bookmarks, isBookmarked, toggleBookmark, currentUser } =
    useApp()
  const saved = opportunities.filter((o) => bookmarks.includes(o.id))
  const profile = currentUser?.candidateProfile
  const ranked = profile
    ? rankOpportunities(profile, saved)
    : saved.map((o) => ({ opportunity: o, match: { score: 0, reasons: [] as string[] } }))

  return (
    <div className="page">
      <div className="container">
        <header className="page-header">
          <h1>Mes favoris</h1>
          <p>Offres que vous avez enregistrées pour plus tard.</p>
        </header>
        {ranked.length === 0 ? (
          <EmptyState
            icon={Bookmark}
            title="Aucun favori"
            description="Enregistrez des offres depuis la liste pour les retrouver ici."
          />
        ) : (
          <div className="opp-list">
            {ranked.map((item) => (
              <OpportunityCard
                key={item.opportunity.id}
                opportunity={item.opportunity}
                match={profile ? item.match : undefined}
                showMatch={!!profile}
                detailPath={`/candidat/offres/${item.opportunity.id}`}
                bookmarked={isBookmarked(item.opportunity.id)}
                onBookmark={() => toggleBookmark(item.opportunity.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
