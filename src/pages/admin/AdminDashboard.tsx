import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, LogIn } from 'lucide-react'
import { FadeUp } from '../../components/motion/Motion'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Loading } from '../../components/ui/Loading'
import { apiAdminStats, type AdminStats } from '../../lib/api'
import { formatDate } from '../../lib/format'

type ActivityItem = AdminStats['recentActivity'][number]

/**
 * Libellés lisibles pour les décisions candidat/recruteur (intérêt/déclin) —
 * c'est le "suivi des décisions prises par les entreprises" demandé, pas
 * juste un code d'action brut.
 */
function describeActivity(a: ActivityItem): string {
  const meta = (a.metadata ?? {}) as Record<string, unknown>
  const opportunityTitle = typeof meta.opportunityTitle === 'string' ? meta.opportunityTitle : null
  const candidateName = typeof meta.candidateName === 'string' ? meta.candidateName : null

  switch (a.action) {
    case 'candidate_interested':
      return `Candidat intéressé — ${opportunityTitle ?? 'offre'}`
    case 'candidate_declined':
      return `Candidat a décliné — ${opportunityTitle ?? 'offre'}`
    case 'recruiter_interested':
      return `Recruteur intéressé — ${opportunityTitle ?? 'offre'}`
    case 'recruiter_declined':
      return candidateName
        ? `Recruteur a écarté ${candidateName} — ${opportunityTitle ?? 'offre'}`
        : `Recruteur a écarté un profil — ${opportunityTitle ?? 'offre'}`
    case 'admin:create_agent':
      return 'Création d’un compte agent'
    default:
      if (a.action.startsWith('moderation:')) {
        return `Modération — ${a.action.replace('moderation:', '')}`
      }
      return a.action
  }
}

/**
 * Tableau de bord admin. La modération détaillée vit sur sa propre page
 * (`/admin/moderation`) ; ici on donne une vue d'ensemble fiable de ce qui
 * existe réellement en base, avec un accès rapide s'il y a des signalements.
 */
export function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    apiAdminStats()
      .then(setStats)
      .catch(() => setError('Impossible de charger les statistiques.'))
  }, [])

  if (error) {
    return (
      <div className="page">
        <div className="container">
          <p>{error}</p>
        </div>
      </div>
    )
  }

  if (!stats) {
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
        <FadeUp eager>
          <header className="page-header">
            <p className="eyebrow">Administration</p>
            <h1>Administration</h1>
            <p>Vue d’ensemble de la plateforme.</p>
          </header>
        </FadeUp>

        {stats.openReports > 0 && (
          <FadeUp eager>
            <Card style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AlertTriangle size={18} />
                {stats.openReports} signalement{stats.openReports > 1 ? 's' : ''} en attente de traitement
              </span>
              <Link to="/admin/moderation">
                <Button size="sm">Traiter</Button>
              </Link>
            </Card>
          </FadeUp>
        )}

        <FadeUp eager index={0}>
          <div className="grid-3" style={{ marginBottom: '1.5rem' }}>
            <Card className="stat-card">
              <strong>{stats.users.candidates}</strong>
              <span>Candidats</span>
            </Card>
            <Card className="stat-card">
              <strong>{stats.users.recruiters}</strong>
              <span>Recruteurs</span>
            </Card>
            <Card className="stat-card">
              <strong>{stats.users.individuals}</strong>
              <span>Particuliers</span>
            </Card>
            <Card className="stat-card">
              <strong>{stats.users.agents}</strong>
              <span>Agents de terrain</span>
            </Card>
          </div>
        </FadeUp>

        <h2 style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>Emploi vérifié</h2>
        <FadeUp eager index={1}>
          <div className="grid-3" style={{ marginBottom: '1.5rem' }}>
            <Card className="stat-card">
              <strong>{stats.employment.femalePercent}%</strong>
              <span>Profils recommandés — femmes ({stats.employment.genderPoolSize} mesurés)</span>
            </Card>
            <Card className="stat-card">
              <strong>{stats.employment.placements}</strong>
              <span>Placements</span>
            </Card>
            <Card className="stat-card">
              <strong>{stats.employment.activePartnerCompanies}</strong>
              <span>Entreprises partenaires actives</span>
            </Card>
          </div>
        </FadeUp>

        <FadeUp eager index={2}>
          <div className="grid-3" style={{ marginBottom: '1.5rem' }}>
            <Card className="stat-card">
              <strong>{stats.opportunities}</strong>
              <span>Offres publiées</span>
            </Card>
            <Card className="stat-card">
              <strong>{stats.applications}</strong>
              <span>Candidatures</span>
            </Card>
            <Card className="stat-card">
              <strong>{stats.providers}</strong>
              <span>Prestataires</span>
            </Card>
            <Card className="stat-card">
              <strong>{stats.recommendations}</strong>
              <span>Recommandations</span>
            </Card>
            <Card className="stat-card">
              <strong>{stats.members}</strong>
              <span>Membres annuaire</span>
            </Card>
          </div>
        </FadeUp>

        <h2 style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>Revenus (simulé)</h2>
        <FadeUp eager index={3}>
          <div className="grid-3" style={{ marginBottom: '1.5rem' }}>
            <Card className="stat-card">
              <strong>{stats.revenue.totalAr.toLocaleString('fr-FR')} Ar</strong>
              <span>Revenu cumulé</span>
            </Card>
            <Card className="stat-card">
              <strong>{stats.revenue.payingRecruiters}</strong>
              <span>Entreprises payantes</span>
            </Card>
            <Card className="stat-card">
              <strong>{stats.revenue.transactionCount}</strong>
              <span>Transactions</span>
            </Card>
          </div>
        </FadeUp>

        <h2 style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>Activité récente</h2>

        {stats.recentLoginCount > 0 && (
          <Card
            style={{
              marginBottom: '0.75rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              color: 'var(--color-text-muted)',
              fontSize: '0.85rem',
            }}
          >
            <LogIn size={14} />
            {stats.recentLoginCount} connexion{stats.recentLoginCount > 1 ? 's' : ''}/déconnexion{stats.recentLoginCount > 1 ? 's' : ''} ces 7 derniers jours
          </Card>
        )}

        {stats.recentActivity.length === 0 ? (
          <Card>
            <p style={{ color: 'var(--color-text-muted)' }}>Aucune décision journalisée pour l’instant.</p>
          </Card>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {stats.recentActivity.map((a) => (
              <Card key={a.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <span>
                    <strong>{describeActivity(a)}</strong>
                    {a.userEmail ? ` — ${a.userEmail} (${a.userRole})` : ''}
                  </span>
                  <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                    {formatDate(a.createdAt)}
                  </span>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
