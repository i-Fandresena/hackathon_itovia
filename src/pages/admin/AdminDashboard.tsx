import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, Handshake, LogIn } from 'lucide-react'
import { FadeUp } from '../../components/motion/Motion'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Loading } from '../../components/ui/Loading'
import { apiAdminMatchSuggestions, apiAdminStats, type AdminStats } from '../../lib/api'
import { formatDate } from '../../lib/format'
import './AdminDashboard.css'

type ActivityItem = AdminStats['recentActivity'][number]

const PLACEMENT_STAGE_SHORT: Record<string, string> = {
  etape1_due: 'étape 1 due',
  etape1_payee: 'étape 1 payée',
  etape2_due: 'étape 2 due',
  etape2_payee: 'étape 2 payée',
  annule: 'annulé',
}

/** Libellés admin des statuts de suggestion, pour le journal d'activité. */
const SUGGESTION_STATUS_SHORT: Record<string, string> = {
  suggeree: 'à valider',
  proposee_candidat: 'proposé au candidat (ancien parcours)',
  interet_candidat: 'candidat intéressé (ancien parcours)',
  proposee_recruteur: 'transmis au recruteur',
  interet_recruteur: 'recruteur intéressé',
  mise_en_relation: 'mis en relation',
  ecartee: 'écarté',
}

const ROLE_SHORT: Record<string, string> = {
  candidate: 'candidat',
  recruiter: 'recruteur',
  particulier: 'particulier',
  admin: 'admin',
  agent: 'agent',
  talent: 'talent',
}

/**
 * Libellés lisibles du journal d'audit (décisions des entreprises, parcours
 * de matching, vérification des CV) — jamais un code d'action brut pour les
 * actions connues. La liste suit les écritures d'`AuditLog` côté serveur.
 */
function describeActivity(a: ActivityItem): string {
  const meta = (a.metadata ?? {}) as Record<string, unknown>
  const opportunityTitle = typeof meta.opportunityTitle === 'string' ? meta.opportunityTitle : null
  const candidateName = typeof meta.candidateName === 'string' ? meta.candidateName : null

  switch (a.action) {
    // Ancien parcours : l'intérêt par offre n'existe plus que sur les
    // dossiers hérités, mais ces lignes restent en base.
    case 'candidate_interested':
      return `Candidat intéressé (ancien parcours) — ${opportunityTitle ?? 'offre'}`
    case 'candidate_declined':
      return `Candidat s’est retiré d’un dossier — ${opportunityTitle ?? 'offre'}`
    case 'matching_consent_given':
      return meta.source === 'cv_upload' ? 'Accord de matching donné au dépôt du CV' : 'Accord de matching donné'
    case 'matching_consent_withdrawn': {
      const withdrawn = typeof meta.withdrawnSuggestions === 'number' ? meta.withdrawnSuggestions : 0
      return withdrawn > 0
        ? `Accord de matching retiré — ${withdrawn} dossier${withdrawn > 1 ? 's' : ''} écarté${withdrawn > 1 ? 's' : ''}`
        : 'Accord de matching retiré'
    }
    case 'cv_upload': {
      const flags = Array.isArray(meta.flagCodes) ? meta.flagCodes.length : 0
      return flags > 0 ? `CV déposé — ${flags} point${flags > 1 ? 's' : ''} à vérifier` : 'CV déposé'
    }
    case 'cv_verification':
      return meta.decision === 'verifie' ? 'CV vérifié' : meta.decision === 'rejete' ? 'CV rejeté' : 'Décision sur un CV'
    case 'match_suggestion_created':
      return meta.reactivated === true ? 'Suggestion remise en file de validation' : 'Candidat mis en file de validation'
    case 'match_suggestion_status': {
      const to = typeof meta.to === 'string' ? SUGGESTION_STATUS_SHORT[meta.to] ?? meta.to : null
      return to ? `Suggestion passée à « ${to} »` : 'Statut de suggestion modifié'
    }
    case 'register':
      return 'Nouveau compte créé'
    case 'admin:cv_verifier_roles':
      return 'Habilitations de vérification des CV modifiées'
    case 'recruiter_interested':
      return `Recruteur intéressé — ${opportunityTitle ?? 'offre'}`
    case 'recruiter_declined':
      return candidateName
        ? `Recruteur a écarté ${candidateName} — ${opportunityTitle ?? 'offre'}`
        : `Recruteur a écarté un profil — ${opportunityTitle ?? 'offre'}`
    case 'admin:create_agent':
      return 'Création d’un compte agent'
    case 'admin_corrected_placement_stage': {
      const toStage = typeof meta.toStage === 'string' ? PLACEMENT_STAGE_SHORT[meta.toStage] ?? meta.toStage : '?'
      return `Placement corrigé — passé à ${toStage}`
    }
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
  // Compteur secondaire : `null` tant qu'il n'est pas chargé (ou en cas
  // d'échec) — le tableau de bord s'affiche quand même.
  const [toValidate, setToValidate] = useState<number | null>(null)

  useEffect(() => {
    apiAdminStats()
      .then(setStats)
      .catch(() => setError('Impossible de charger les statistiques.'))
    // Même périmètre que la file « À valider » de la page Mise en relation :
    // suggestions en attente + dossiers hérités de l'ancien parcours.
    apiAdminMatchSuggestions()
      .then((suggestions) =>
        setToValidate(
          suggestions.filter(
            (s) => s.status === 'suggeree' || s.status === 'interet_candidat' || s.status === 'proposee_candidat',
          ).length,
        ),
      )
      .catch(() => setToValidate(null))
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
            <Card className="admin-alert">
              <span className="admin-alert-text">
                <AlertTriangle size={18} aria-hidden />
                {stats.openReports} signalement{stats.openReports > 1 ? 's' : ''} en attente de traitement
              </span>
              <Link to="/admin/moderation">
                <Button size="sm">Traiter</Button>
              </Link>
            </Card>
          </FadeUp>
        )}

        {toValidate !== null && toValidate > 0 && (
          <FadeUp eager>
            <Card className="admin-alert">
              <span className="admin-alert-text">
                <Handshake size={18} aria-hidden />
                {toValidate} suggestion{toValidate > 1 ? 's' : ''} de matching à valider
              </span>
              <Link to="/admin/mise-en-relation">
                <Button size="sm">Valider</Button>
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
            <Link to="/admin/placements" style={{ textDecoration: 'none' }}>
              <Card className="stat-card">
                <strong>{stats.employment.placements}</strong>
                <span>Placements</span>
              </Card>
            </Link>
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
            <Link to="/admin/mise-en-relation" style={{ textDecoration: 'none' }}>
              <Card className="stat-card">
                <strong>{toValidate ?? '—'}</strong>
                <span>Suggestions à valider</span>
              </Card>
            </Link>
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
                    {a.userEmail ? ` — ${a.userEmail} (${ROLE_SHORT[a.userRole ?? ''] ?? a.userRole})` : ''}
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
