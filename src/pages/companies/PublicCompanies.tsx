import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Building2, EyeOff, FileCheck2, HeartHandshake, SearchX, UsersRound } from 'lucide-react'
import { FadeUp } from '../../components/motion/Motion'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { Field, Input, Select } from '../../components/ui/Form'
import { Loading } from '../../components/ui/Loading'
import { useApp } from '../../context/AppContext'
import { SECTORS, SECTOR_LABELS } from '../../data/constants'
import { apiPublicCompanies, type PublicCompanyList } from '../../lib/api'
import type { Sector, UserRole } from '../../types'
import { CompanyCard } from './CompanyCard'
import '../talents/PublicTalents.css'
import './Companies.css'

/** Rôles qui peuvent recommander une entreprise (décision F3 ; le serveur revérifie). */
export const COMPANY_RECOMMENDER_ROLES: UserRole[] = ['candidate', 'particulier', 'talent']

/**
 * Onglet « Entreprises recommandées » de l'Annuaire (`/annuaire/entreprises`).
 * Vitrine publique : des employeurs recommandés
 * par d'anciens salariés, stagiaires ou prestataires. Aucun auteur, aucun
 * commentaire : seulement le niveau, le nombre de sources, la répartition
 * par relation et les points forts cités.
 */
export function PublicCompanies() {
  const { currentUser } = useApp()
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const city = params.get('ville') ?? ''
  const sector = (params.get('secteur') ?? '') as Sector | ''
  const [query, setQuery] = useState(q)
  const [data, setData] = useState<PublicCompanyList | null>(null)
  const [error, setError] = useState('')
  const canRecommend = currentUser ? COMPANY_RECOMMENDER_ROLES.includes(currentUser.role) : false

  const load = () => {
    setError('')
    setData(null)
    apiPublicCompanies({ q, city, sector: sector || undefined })
      .then(setData)
      .catch(() => setError('Impossible de charger les entreprises pour le moment.'))
  }

  useEffect(load, [q, city, sector])

  const setFilter = (key: 'q' | 'ville' | 'secteur', value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }

  // Recherche : appliquée après une courte pause de frappe.
  useEffect(() => {
    if (query.trim() === q) return
    const t = window.setTimeout(() => setFilter('q', query.trim()), 350)
    return () => window.clearTimeout(t)
  }, [query])

  const filtered = Boolean(q || city || sector)

  return (
    <div className="ptl-page">
      <FadeUp eager>
        <header className="ptl-hero">
          <p className="eyebrow">Vitrine OffRec</p>
          <h2 className="ptl-hero-title">Entreprises recommandées</h2>
          <p className="ptl-hero-lead">
            Paie à l’heure, contrat respecté, sécurité… Des employeurs recommandés par celles et ceux qui y ont
            travaillé : anciens salariés, stagiaires et prestataires. Pour choisir où postuler en connaissance de
            cause.
          </p>
          <ul className="ptl-promises">
            <li>
              <UsersRound size={16} aria-hidden />
              Recommandée par des personnes différentes
            </li>
            <li>
              <EyeOff size={16} aria-hidden />
              Auteurs jamais affichés, même à l’entreprise
            </li>
            <li>
              <FileCheck2 size={16} aria-hidden />
              Documents vérifiés par OffRec puis supprimés
            </li>
          </ul>
          {canRecommend && (
            <div className="ptl-actions">
              <Link to="/annuaire/recommander-une-entreprise">
                <Button>
                  <HeartHandshake size={16} aria-hidden /> Recommander une entreprise
                </Button>
              </Link>
            </div>
          )}
        </header>
      </FadeUp>

      <div className="cmp-filters">
        <div className="cmp-filter-q">
          <Field label="Rechercher une entreprise">
            <Input
              type="search"
              maxLength={80}
              placeholder="Nom de l’entreprise"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </Field>
        </div>
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
        <Field label="Secteur">
          <Select value={sector} onChange={(e) => setFilter('secteur', e.target.value)}>
            <option value="">Tous les secteurs</option>
            {SECTORS.map((s) => (
              <option key={s} value={s}>
                {SECTOR_LABELS[s]}
              </option>
            ))}
          </Select>
        </Field>
        {filtered && (
          <Button
            variant="ghost"
            size="sm"
            className="ptl-filters-reset"
            onClick={() => {
              setQuery('')
              setParams({}, { replace: true })
            }}
          >
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
      ) : data.companies.length === 0 ? (
        <EmptyState
          icon={filtered ? SearchX : Building2}
          title={filtered ? 'Aucune entreprise pour ces critères' : 'Aucune entreprise recommandée pour l’instant'}
          description={
            filtered
              ? 'Essayez un autre nom, une autre ville ou un autre secteur.'
              : 'Les premières fiches apparaîtront avec les premières recommandations.'
          }
        />
      ) : (
        <section className="ptl-section" aria-labelledby="cmp-list-title">
          <div className="ptl-section-head">
            <h2 id="cmp-list-title">
              {data.total} entreprise{data.total > 1 ? 's' : ''}
            </h2>
            <p>
              Classées par niveau de confiance : nombre de personnes différentes, documents vérifiés, expériences
              récentes. Seules les recommandations positives sont publiées.
            </p>
          </div>
          <div className="ptl-grid">
            {data.companies.map((c) => (
              <CompanyCard key={c.id} company={c} />
            ))}
          </div>
        </section>
      )}

      {!currentUser && (
        <Card className="ptl-cta">
          <HeartHandshake size={28} aria-hidden className="ptl-cta-icon" />
          <div>
            <h2>Vous avez travaillé dans une bonne entreprise ?</h2>
            <p>
              Connectez-vous pour la recommander. Votre nom n’est jamais montré, ni au public ni à l’entreprise.
            </p>
          </div>
          <div className="ptl-cta-actions">
            <Link to="/connexion" state={{ from: { pathname: '/annuaire/recommander-une-entreprise' } }}>
              <Button>Se connecter</Button>
            </Link>
            <Link to="/inscription">
              <Button variant="outline">Créer un compte</Button>
            </Link>
          </div>
        </Card>
      )}
    </div>
  )
}
