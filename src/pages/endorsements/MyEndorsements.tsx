import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { HeartHandshake } from 'lucide-react'
import { FadeUp } from '../../components/motion/Motion'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { Loading } from '../../components/ui/Loading'
import { RELATION_LABELS } from '../../data/endorsements'
import { apiFileUrl, apiMyEndorsements, type MyEndorsement } from '../../lib/api'
import { formatDate } from '../../lib/format'
import { useApp } from '../../context/AppContext'
import { COMPANY_RECOMMENDER_ROLES } from '../companies/PublicCompanies'
import './RecommendTalent.css'

/** Statut neutre affiché, selon le sujet de la recommandation. */
function statusLabel(e: MyEndorsement): string {
  if (e.subjectType === 'entreprise') return e.status === 'en_cours' ? 'Document en cours de vérification' : 'Prise en compte'
  return e.status === 'en_cours' ? 'En cours de traitement' : 'Traitée'
}

/**
 * Onglet « Mes recommandations » de l'Annuaire (`/annuaire/mes-recommandations`).
 * Recommandations envoyées par le compte (talents et entreprises). Statut
 * volontairement neutre : « en cours » puis « traitée », sans dire ce que
 * l'agent ou l'admin a décidé, ni si la personne était déjà connue d'OffRec.
 */
export function MyEndorsements() {
  const navigate = useNavigate()
  const { currentUser } = useApp()
  const canRecommendCompany = currentUser ? COMPANY_RECOMMENDER_ROLES.includes(currentUser.role) : false
  const [items, setItems] = useState<MyEndorsement[] | null>(null)
  const [error, setError] = useState('')

  const load = () => {
    setError('')
    apiMyEndorsements()
      .then(setItems)
      .catch(() => setError('Impossible de charger vos recommandations.'))
  }

  useEffect(load, [])

  return (
    <div className="rt-page">
      <FadeUp eager>
        <header className="page-header rt-mine-head">
          <h2>Mes recommandations</h2>
          <p>
            Les talents et les entreprises que vous avez recommandés. Un agent OffRec traite chaque talent ; votre
            nom n’est jamais montré à une entreprise.
          </p>
        </header>
      </FadeUp>

      {error ? (
        <Card>
          <p style={{ marginBottom: '0.75rem' }}>{error}</p>
          <Button size="sm" onClick={load}>
            Réessayer
          </Button>
        </Card>
      ) : !items ? (
        <Loading />
      ) : items.length === 0 ? (
        <EmptyState
          icon={HeartHandshake}
          title="Aucune recommandation pour l’instant"
          description="Vous connaissez quelqu’un qui travaille bien ? Recommandez-le : un agent ira le rencontrer."
          actionLabel="Recommander un talent"
          onAction={() => navigate('/annuaire/recommander-un-talent')}
        />
      ) : (
        <>
          <div className="rt-list-actions">
            <Link to="/annuaire/recommander-un-talent">
              <Button size="sm">Recommander un talent</Button>
            </Link>
            {canRecommendCompany && (
              <Link to="/annuaire/recommander-une-entreprise">
                <Button size="sm" variant="outline">
                  Recommander une entreprise
                </Button>
              </Link>
            )}
          </div>
          <div className="rt-list">
            {items.map((e) => (
              <Card key={e.id}>
                <div className="rt-item-head">
                  <div>
                    <p className="rt-item-title">
                      {e.subjectType === 'entreprise' ? (
                        e.companyId ? (
                          <Link to={`/annuaire/entreprises/${e.companyId}`}>{e.companyName}</Link>
                        ) : (
                          e.companyName
                        )
                      ) : (
                        <>
                          {e.trade} · {e.district}
                        </>
                      )}
                    </p>
                    <p className="rt-item-meta">
                      {e.subjectType === 'entreprise' ? 'Entreprise · ' : ''}
                      {e.city} · {RELATION_LABELS[e.relation]} · envoyée le {formatDate(e.createdAt)}
                    </p>
                  </div>
                  <Badge variant={e.status === 'en_cours' ? 'primary' : 'muted'}>{statusLabel(e)}</Badge>
                </div>
                <p className="rt-item-job">
                  « {e.jobLabel} » — {formatDate(e.jobDate)}
                </p>
                <div className="rt-item-tags">
                  {e.highlights.map((h) => (
                    <span key={h} className="rt-tag">
                      {h}
                    </span>
                  ))}
                  {e.proofFileUrl && (
                    <a className="rt-link" href={apiFileUrl(e.proofFileUrl)} target="_blank" rel="noreferrer">
                      {e.subjectType === 'entreprise' ? 'Voir mon document' : 'Voir ma photo'}
                    </a>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
