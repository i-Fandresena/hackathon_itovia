import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Building2, CheckCircle2, HeartHandshake, MapPin, SearchX, UsersRound } from 'lucide-react'
import { FadeUp } from '../../components/motion/Motion'
import { TrustLevelBadge } from '../../components/trust/TrustLevelBadge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { Loading } from '../../components/ui/Loading'
import { ReportButton } from '../../components/ui/ReportButton'
import { useApp } from '../../context/AppContext'
import { SECTOR_LABELS } from '../../data/constants'
import { COMPANY_RELATIONS, COMPANY_RELATION_MIN, TRUST_LEVEL_LABELS, companyRelationCount } from '../../data/endorsements'
import { ApiError, apiPublicCompany } from '../../lib/api'
import type { PublicCompany } from '../../types'
import { companySourcesLabel } from './CompanyCard'
import { COMPANY_RECOMMENDER_ROLES } from './PublicCompanies'
import '../talents/PublicTalents.css'
import './Companies.css'

const LEVEL_EXPLANATIONS = {
  nouveau: 'Pas encore assez de recommandations de personnes différentes pour se prononcer. Ce n’est pas un avis négatif.',
  recommande: 'Recommandée par au moins deux personnes différentes qui y ont travaillé.',
  tres_recommande:
    'Recommandée par au moins quatre personnes différentes, dont au moins une avec un document vérifié par OffRec, pour une expérience récente.',
} as const

/**
 * Fiche publique d'une entreprise (`/annuaire/entreprises/:id`, ancienne adresse `/entreprises/:id` redirigée) : mêmes champs que la
 * carte (liste blanche) — jamais d'auteur, de commentaire, de poste ni de date.
 */
export function PublicCompanyDetail() {
  const { id = '' } = useParams()
  const { currentUser } = useApp()
  const [company, setCompany] = useState<PublicCompany | null>(null)
  const [state, setState] = useState<'loading' | 'ok' | 'missing' | 'error'>('loading')

  const load = () => {
    setState('loading')
    apiPublicCompany(id)
      .then((c) => {
        setCompany(c)
        setState('ok')
      })
      .catch((err) => setState(err instanceof ApiError && err.status === 404 ? 'missing' : 'error'))
  }

  useEffect(load, [id])

  if (state === 'loading') {
    return (
      <div className="page">
        <div className="container">
          <Loading />
        </div>
      </div>
    )
  }

  if (state !== 'ok' || !company) {
    return (
      <div className="page">
        <div className="container ptl-page">
          <Link to="/annuaire/entreprises" className="ptl-back">
            <ArrowLeft size={16} aria-hidden /> Toutes les entreprises recommandées
          </Link>
          {state === 'missing' ? (
            <EmptyState
              icon={SearchX}
              title="Cette entreprise n’est pas (ou plus) présentée"
              description="Le lien n’est plus valable. Découvrez les autres entreprises recommandées."
            />
          ) : (
            <Card>
              <p className="ptl-error">Impossible de charger cette fiche pour le moment.</p>
              <Button size="sm" onClick={load}>
                Réessayer
              </Button>
            </Card>
          )}
        </div>
      </div>
    )
  }

  const canRecommend = currentUser ? COMPANY_RECOMMENDER_ROLES.includes(currentUser.role) : false
  const relationTotal = company.relations ? COMPANY_RELATIONS.reduce((sum, r) => sum + company.relations![r], 0) : 0
  const maxHighlight = Math.max(1, ...company.highlights.map((h) => h.count))

  return (
    <div className="page">
      <div className="container ptl-page ptl-detail">
        <Link to="/annuaire/entreprises" className="ptl-back">
          <ArrowLeft size={16} aria-hidden /> Toutes les entreprises recommandées
        </Link>

        <div className="ptl-detail-grid">
          <div className="ptl-detail-main">
            <FadeUp eager>
              <Card className={`ptl-detail-hero ptl-card-${company.level}`}>
                <div className="ptl-card-head">
                  <span className="ptl-card-icon ptl-card-icon-lg" aria-hidden>
                    <Building2 size={26} strokeWidth={1.75} />
                  </span>
                  <div className="ptl-card-title">
                    <h1>{company.name}</h1>
                    <p className="ptl-card-sector">{SECTOR_LABELS[company.sector]}</p>
                  </div>
                </div>
                <p className="ptl-card-place">
                  <MapPin size={15} aria-hidden />
                  {company.city}
                </p>
                <div className="ptl-card-trust">
                  <TrustLevelBadge level={company.level} />
                  <span className="ptl-card-sources">
                    <UsersRound size={15} aria-hidden />
                    {companySourcesLabel(company.independentSources)}
                  </span>
                </div>
                <p className="ptl-level-note">
                  <strong>{TRUST_LEVEL_LABELS[company.level]} :</strong> {LEVEL_EXPLANATIONS[company.level]}
                </p>
              </Card>
            </FadeUp>

            <Card className="ptl-block">
              <h2>Qui la recommande</h2>
              {company.relations && relationTotal > 0 ? (
                <ul className="cmp-bars">
                  {COMPANY_RELATIONS.filter((r) => company.relations![r] > 0).map((r) => (
                    <li key={r} className="cmp-bar">
                      <span className="cmp-bar-label">{companyRelationCount(r, company.relations![r])}</span>
                      <span className="cmp-bar-track" aria-hidden>
                        <span
                          className="cmp-bar-fill"
                          style={{ width: `${Math.round((100 * company.relations![r]) / relationTotal)}%` }}
                        />
                      </span>
                      <span className="cmp-bar-value">{company.relations![r]}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="ptl-muted">
                  Le détail (anciens salariés, stagiaires, prestataires) s’affiche à partir de {COMPANY_RELATION_MIN}{' '}
                  recommandations, pour qu’aucun auteur ne puisse être reconnu.
                </p>
              )}
            </Card>

            <Card className="ptl-block">
              <h2>Points forts cités</h2>
              {company.highlights.length > 0 ? (
                <ul className="cmp-bars">
                  {company.highlights.map((h) => (
                    <li key={h.label} className="cmp-bar">
                      <span className="cmp-bar-label">{h.label}</span>
                      <span className="cmp-bar-track" aria-hidden>
                        <span className="cmp-bar-fill" style={{ width: `${Math.round((100 * h.count) / maxHighlight)}%` }} />
                      </span>
                      <span className="cmp-bar-value">×{h.count}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="ptl-muted">Les points forts apparaîtront avec les premières recommandations.</p>
              )}
            </Card>

            <Card className="ptl-block">
              <h2>Comment OffRec protège les auteurs</h2>
              <ul className="ptl-steps">
                <li>
                  <CheckCircle2 size={16} aria-hidden />
                  Seules des personnes qui y ont travaillé (salariés, stagiaires, prestataires) peuvent recommander une
                  entreprise, une seule fois chacune.
                </li>
                <li>
                  <CheckCircle2 size={16} aria-hidden />
                  Aucun nom d’auteur ni commentaire n’est publié ou transmis à l’entreprise.
                </li>
                <li>
                  <CheckCircle2 size={16} aria-hidden />
                  Un document (contrat, bulletin de paie…) peut appuyer une recommandation : OffRec le vérifie puis le
                  supprime.
                </li>
                <li>
                  <CheckCircle2 size={16} aria-hidden />
                  Seules les recommandations positives sont publiées ; un problème grave se signale en privé à OffRec.
                </li>
              </ul>
            </Card>
          </div>

          <aside className="ptl-detail-side">
            <Card className="ptl-contact">
              <h2>
                <HeartHandshake size={18} aria-hidden /> Vous y avez travaillé ?
              </h2>
              {!currentUser ? (
                <>
                  <p className="ptl-muted">
                    Connectez-vous pour recommander cette entreprise. Votre nom n’est jamais montré, ni au public ni à
                    l’entreprise.
                  </p>
                  <div className="ptl-contact-actions">
                    <Link
                      to="/connexion"
                      state={{ from: { pathname: `/annuaire/recommander-une-entreprise?entreprise=${company.id}` } }}
                    >
                      <Button fullWidth>Se connecter pour recommander</Button>
                    </Link>
                    <Link to="/inscription" className="ptl-link">
                      Pas encore de compte ? Inscrivez-vous
                    </Link>
                  </div>
                </>
              ) : canRecommend ? (
                <>
                  <p className="ptl-muted">
                    Salarié·e, stagiaire ou prestataire : partagez ce qu’elle fait bien. Votre nom reste privé.
                  </p>
                  <div className="ptl-contact-actions">
                    <Link to={`/annuaire/recommander-une-entreprise?entreprise=${company.id}`}>
                      <Button fullWidth>Recommander cette entreprise</Button>
                    </Link>
                  </div>
                </>
              ) : (
                <p className="ptl-muted">
                  Les recommandations d’entreprises sont réservées aux candidats, particuliers et talents qui y ont
                  travaillé.
                </p>
              )}
            </Card>
            {currentUser && (
              <div className="ptl-report">
                <ReportButton targetType="company" targetId={company.id} />
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  )
}
