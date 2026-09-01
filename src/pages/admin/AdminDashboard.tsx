import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'
import { FadeUp } from '../../components/motion/Motion'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Loading } from '../../components/ui/Loading'
import { apiAdminStats, type AdminStats } from '../../lib/api'
import { formatDate } from '../../lib/format'

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
        <FadeUp>
          <header className="page-header">
            <p className="eyebrow">Administration</p>
            <h1>Administration</h1>
            <p>Vue d’ensemble de la plateforme.</p>
          </header>
        </FadeUp>

        {stats.openReports > 0 && (
          <FadeUp>
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

        <FadeUp index={0}>
          <div className="grid-3" style={{ marginBottom: '1rem' }}>
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
          </div>
        </FadeUp>

        <FadeUp index={1}>
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
        <FadeUp index={2}>
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
        {stats.recentActivity.length === 0 ? (
          <Card>
            <p style={{ color: 'var(--color-text-muted)' }}>Aucune activité journalisée pour l’instant.</p>
          </Card>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {stats.recentActivity.map((a) => (
              <Card key={a.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <span>
                    <strong>{a.action}</strong>
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
