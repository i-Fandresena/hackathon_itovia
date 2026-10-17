import { useEffect, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { Bell, HandHeart, HeartHandshake, Inbox, MessageSquareLock, SearchX, ShieldCheck, Sprout, UsersRound } from 'lucide-react'
import { FadeUp } from '../../components/motion/Motion'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { Field, Select } from '../../components/ui/Form'
import { Loading } from '../../components/ui/Loading'
import { useApp } from '../../context/AppContext'
import {
  apiMyTalentContactRequests,
  apiPublicTalents,
  type MyTalentContactRequest,
  type PublicTalentList,
} from '../../lib/api'
import { formatDate } from '../../lib/format'
import { TALENT_RECOMMENDER_ROLES } from '../../lib/roles'
import type { ContactRequestStatus, UserRole } from '../../types'
import { PublicTalentCard, publicPlace } from './PublicTalentCard'
import './PublicTalents.css'

/** Rôles qui peuvent demander un contact (le serveur revérifie). */
export const CONTACT_REQUESTER_ROLES: UserRole[] = ['candidate', 'recruiter', 'particulier', 'talent']

export const CONTACT_STATUS_LABELS: Record<ContactRequestStatus, string> = {
  nouvelle: 'Envoyée — en attente de l’agent',
  transmise: 'Transmise au talent par l’agent',
  close: 'Close',
}

/**
 * Onglet « Talents recommandés » de l'Annuaire (`/annuaire/talents`).
 * Vitrine publique : des personnes du secteur
 * informel recommandées, rencontrées et vérifiées par un agent OffRec, qui
 * ont donné leur accord explicite pour apparaître ici. Aucun nom ni contact :
 * OffRec organise la mise en relation.
 */
export function PublicTalents() {
  const { currentUser, notifications, markNotificationRead, refreshNotifications } = useApp()
  const location = useLocation()
  const [params, setParams] = useSearchParams()
  const trade = params.get('metier') ?? ''
  const city = params.get('ville') ?? ''
  const [data, setData] = useState<PublicTalentList | null>(null)
  const [error, setError] = useState('')
  const [mine, setMine] = useState<MyTalentContactRequest[] | null>(null)
  const canRequest = currentUser ? CONTACT_REQUESTER_ROLES.includes(currentUser.role) : false
  const canRecommend = currentUser ? TALENT_RECOMMENDER_ROLES.includes(currentUser.role) : false
  // Le particulier et le compte talent n'ont pas de page « Notifications » :
  // les nouvelles de leurs demandes s'affichent ici, au-dessus du suivi.
  const updates = notifications.filter((n) => !n.read && n.link === '/talents#mes-demandes')

  const load = () => {
    setError('')
    setData(null)
    apiPublicTalents({ trade, city })
      .then(setData)
      .catch(() => setError('Impossible de charger les talents pour le moment.'))
  }

  useEffect(load, [trade, city])

  useEffect(() => {
    if (!canRequest) {
      setMine(null)
      return
    }
    apiMyTalentContactRequests()
      .then(setMine)
      .catch(() => setMine([]))
    void refreshNotifications()
  }, [canRequest, refreshNotifications])

  // Lien des notifications (« /talents#mes-demandes », redirigé vers
  // `/annuaire/talents#mes-demandes`) : défile jusqu'au suivi.
  useEffect(() => {
    if (location.hash === '#mes-demandes' && mine) {
      document.getElementById('mes-demandes')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [location.hash, mine])

  const setFilter = (key: 'metier' | 'ville', value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }

  const empty = data && data.recommended.length === 0 && data.newcomers.length === 0
  const filtered = Boolean(trade || city)

  return (
    <div className="ptl-page">
      <FadeUp eager>
        <header className="ptl-hero">
          <p className="eyebrow">Vitrine OffRec</p>
          <h2 className="ptl-hero-title">Talents recommandés</h2>
          <p className="ptl-hero-lead">
            Couturières, électriciens, cuisinières, maçons… Des personnes qui n’ont pas toujours de diplôme mais
            dont le travail parle pour elles : recommandées par des clients et des employeurs, puis rencontrées et
            vérifiées sur le terrain par un agent OffRec.
          </p>
          <ul className="ptl-promises">
            <li>
              <ShieldCheck size={16} aria-hidden />
              Savoir-faire vérifié par un agent
            </li>
            <li>
              <UsersRound size={16} aria-hidden />
              Recommandé par des personnes différentes
            </li>
            <li>
              <MessageSquareLock size={16} aria-hidden />
              Contact organisé par OffRec, jamais publié
            </li>
          </ul>
          {canRecommend && (
            <div className="ptl-actions">
              <Link to="/annuaire/recommander-un-talent">
                <Button>
                  <HeartHandshake size={16} aria-hidden /> Recommander un talent
                </Button>
              </Link>
            </div>
          )}
        </header>
      </FadeUp>

      <div className="ptl-filters">
        <Field label="Métier">
          <Select value={trade} onChange={(e) => setFilter('metier', e.target.value)}>
            <option value="">Tous les métiers</option>
            {(data?.filters.trades ?? (trade ? [trade] : [])).map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Ville">
          <Select value={city} onChange={(e) => setFilter('ville', e.target.value)}>
            <option value="">Toutes les villes</option>
            {(data?.filters.cities ?? (city ? [city] : [])).map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </Field>
        {filtered && (
          <Button variant="ghost" size="sm" className="ptl-filters-reset" onClick={() => setParams({}, { replace: true })}>
            Effacer les filtres
          </Button>
        )}
      </div>

      {error ? (
        <Card>
          <p className="ptl-error">{error}</p>
          <Button size="sm" onClick={load}>
            Réessayer
          </Button>
        </Card>
      ) : !data ? (
        <Loading />
      ) : empty ? (
        <EmptyState
          icon={SearchX}
          title={filtered ? 'Aucun talent pour ces critères' : 'Aucun talent présenté pour l’instant'}
          description={
            filtered
              ? 'Essayez un autre métier ou une autre ville.'
              : 'Les premières fiches apparaîtront dès que des talents vérifiés auront donné leur accord.'
          }
        />
      ) : (
        <>
          {data.recommended.length > 0 && (
            <section className="ptl-section" aria-labelledby="ptl-recommended">
              <div className="ptl-section-head">
                <h2 id="ptl-recommended">Recommandés par leurs clients</h2>
                <p>
                  {data.total.recommended} talent{data.total.recommended > 1 ? 's' : ''} · classés par niveau de
                  confiance : nombre de personnes différentes, preuves vérifiées, travaux récents.
                </p>
              </div>
              <div className="ptl-grid">
                {data.recommended.map((t) => (
                  <PublicTalentCard key={t.publicRef} talent={t} />
                ))}
              </div>
            </section>
          )}

          {data.newcomers.length > 0 && (
            <section className="ptl-section" aria-labelledby="ptl-newcomers">
              <div className="ptl-section-head">
                <h2 id="ptl-newcomers">
                  <Sprout size={20} aria-hidden /> Nouveaux talents vérifiés
                </h2>
                <p>
                  Rencontrés et vérifiés par un agent OffRec, ils arrivent sur la plateforme : leur réputation se
                  construit avec chaque nouvelle recommandation.
                </p>
              </div>
              <div className="ptl-grid">
                {data.newcomers.map((t) => (
                  <PublicTalentCard key={t.publicRef} talent={t} />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {!currentUser && (
        <Card className="ptl-cta">
          <HandHeart size={28} aria-hidden className="ptl-cta-icon" />
          <div>
            <h2>Besoin de l’un de ces savoir-faire ?</h2>
            <p>
              Connectez-vous pour décrire votre besoin : l’agent OffRec qui suit le talent vous recontacte et
              organise la rencontre.
            </p>
          </div>
          <div className="ptl-cta-actions">
            <Link to="/connexion" state={{ from: { pathname: '/annuaire/talents' } }}>
              <Button>Se connecter</Button>
            </Link>
            <Link to="/inscription">
              <Button variant="outline">Créer un compte</Button>
            </Link>
          </div>
        </Card>
      )}

      {canRequest && mine && mine.length > 0 && (
        <section id="mes-demandes" className="ptl-section ptl-mine" aria-labelledby="ptl-mine-title">
          <div className="ptl-section-head">
            <h2 id="ptl-mine-title">
              <Inbox size={20} aria-hidden /> Mes demandes de contact
            </h2>
            <p>Suivi de vos demandes. L’agent OffRec vous recontacte directement pour organiser la rencontre.</p>
          </div>
          {updates.map((n) => (
            <div key={n.id} className="ptl-update" role="status">
              <Bell size={16} aria-hidden />
              <p>
                <strong>{n.title}</strong> — {n.message}
              </p>
              <Button size="sm" variant="ghost" onClick={() => markNotificationRead(n.id)}>
                Marquer comme lu
              </Button>
            </div>
          ))}
          <div className="ptl-mine-list">
            {mine.map((r) => (
              <Card key={r.id} className="ptl-mine-item">
                <div className="ptl-mine-head">
                  <p className="ptl-mine-title">
                    {r.talent.publicRef ? (
                      <Link to={`/annuaire/talents/${r.talent.publicRef}`}>{r.talent.trade}</Link>
                    ) : (
                      r.talent.trade
                    )}{' '}
                    · {publicPlace(r.talent)}
                  </p>
                  <Badge variant={r.status === 'transmise' ? 'success' : r.status === 'nouvelle' ? 'primary' : 'muted'}>
                    {CONTACT_STATUS_LABELS[r.status]}
                  </Badge>
                </div>
                <p className="ptl-mine-need">{r.need}</p>
                <p className="ptl-mine-meta">Envoyée le {formatDate(r.createdAt)}</p>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
