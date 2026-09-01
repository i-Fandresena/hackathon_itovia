import { ArrowRight, UserCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { FadeUp } from '../../components/motion/Motion'
import { OpportunityCard } from '../../components/opportunity/OpportunityCard'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { useApp } from '../../context/AppContext'
import { rankOpportunities } from '../../lib/recommendation'

export function CandidateDashboard() {
  const { currentUser, opportunities, isBookmarked, toggleBookmark } = useApp()
  const profile = currentUser?.candidateProfile

  if (!profile) {
    return (
      <div className="page">
        <div className="container">
          <Card>
            <h1>Complétez votre profil</h1>
            <p style={{ margin: '0.75rem 0', color: 'var(--color-text-muted)' }}>
              Pour recevoir des recommandations personnalisées, renseignez vos compétences et préférences.
            </p>
            <Link to="/candidat/profil">
              <Button>Configurer mon profil</Button>
            </Link>
          </Card>
        </div>
      </div>
    )
  }

  const ranked = rankOpportunities(profile, opportunities).slice(0, 3)
  const bookmarks = opportunities.filter((o) => isBookmarked(o.id)).length

  return (
    <div className="page">
      <div className="container">
        <FadeUp>
          <header className="page-header">
            <p className="eyebrow">Espace candidat</p>
            <h1>Bonjour, {profile.fullName.split(' ')[0]}</h1>
            <p>
              Voici vos opportunités recommandées pour {profile.province}.
            </p>
          </header>
        </FadeUp>

        <div className="grid-3" style={{ marginBottom: '1.5rem' }}>
          <FadeUp index={0}>
            <Card className="stat-card">
              <strong>{ranked.length > 0 ? ranked[0].match.score : '—'}%</strong>
              <span>Meilleur match actuel</span>
            </Card>
          </FadeUp>
          <FadeUp index={1}>
            <Card className="stat-card">
              <strong>{opportunities.length}</strong>
              <span>Offres disponibles</span>
            </Card>
          </FadeUp>
          <FadeUp index={2}>
            <Card className="stat-card">
              <strong>{bookmarks}</strong>
              <span>Favoris enregistrés</span>
            </Card>
          </FadeUp>
        </div>

        <div className="section-head-row" style={{ marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '1.15rem' }}>Recommandé pour vous</h2>
          <Link to="/candidat/offres">
            <Button variant="ghost" size="sm">
              Voir tout <ArrowRight size={16} />
            </Button>
          </Link>
        </div>

        <div className="opp-list">
          {ranked.map(({ opportunity, match }) => (
            <OpportunityCard
              key={opportunity.id}
              opportunity={opportunity}
              match={match}
              showMatch
              detailPath={`/candidat/offres/${opportunity.id}`}
              bookmarked={isBookmarked(opportunity.id)}
              onBookmark={() => toggleBookmark(opportunity.id)}
            />
          ))}
        </div>

        <Card style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <UserCircle size={40} strokeWidth={1.5} className="dash-icon" />
          <div style={{ flex: 1 }}>
            <strong>Affinez vos recommandations</strong>
            <p style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>
              Mettez à jour vos compétences pour améliorer le score de compatibilité.
            </p>
          </div>
          <Link to="/candidat/profil">
            <Button variant="outline" size="sm">
              Mon profil
            </Button>
          </Link>
        </Card>
      </div>
    </div>
  )
}
