import { useEffect, useState } from 'react'
import { ArrowRight, Briefcase, Check, Hammer, Search } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import dashboardPreview from '../assets/dashboard-preview.png'
import { FadeUp, Stagger } from '../components/motion/Motion'
import { OpportunityCard } from '../components/opportunity/OpportunityCard'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { STATS } from '../data/constants'
import { useApp } from '../context/AppContext'
import { homePathForRole } from '../lib/roles'
import './Landing.css'

/** Les trois publics de la plateforme. La carte active est mise en avant,
 *  les onglets déplacent simplement cette mise en avant. */
const AUDIENCES = [
  {
    id: 'particuliers',
    icon: Search,
    tab: 'Particuliers',
    title: 'Particuliers',
    text: 'Trouvez l’artisan ou le fournisseur que vos voisins ont déjà testé, avec le prix qu’ils ont payé et la date du chantier.',
    action: { label: 'Chercher', to: '/annuaire' },
    secondary: { label: 'En savoir plus', to: '/annuaire' },
  },
  {
    id: 'prestataires',
    icon: Hammer,
    tab: 'Artisans & fournisseurs',
    title: 'Artisans & fournisseurs',
    text: 'Faites-vous connaître par les retours de vos clients plutôt que par la publicité. Votre réputation se construit sur des chantiers réels.',
    action: { label: 'Créer ma fiche', to: '/inscription' },
    secondary: { label: 'En savoir plus', to: '/annuaire' },
  },
  {
    id: 'recruteurs',
    icon: Briefcase,
    tab: 'Recruteurs',
    title: 'Recruteurs',
    text: 'Publiez vos offres et recevez des candidatures qualifiées de votre région, classées par compatibilité avec le poste.',
    action: { label: 'Publier une offre', to: '/inscription' },
    secondary: { label: 'En savoir plus', to: '/inscription' },
  },
]

/** Règles réellement implémentées, côté application et côté base de données
 *  (voir `src/lib/trust.ts` et `supabase/schema.sql`). */
const COMMITMENTS = [
  'Un seul retour par membre et par prestataire',
  'Pas d’auto-recommandation sur une fiche revendiquée',
  'Aucune suppression d’avis, y compris négatif',
  'Les fiches trop peu documentées sont signalées',
]

const STAT_ITEMS = [
  { v: `${STATS.opportunities}+`, l: 'Offres actives' },
  { v: `${STATS.candidates}+`, l: 'Candidats inscrits' },
  { v: `${STATS.recruiters}+`, l: 'Recruteurs locaux' },
  { v: String(STATS.provinces), l: 'Provinces couvertes' },
]

export function Landing() {
  const { opportunities, currentUser } = useApp()
  const featured = opportunities.filter((o) => o.featured).slice(0, 4)
  // Carte du milieu active par défaut, comme dans la maquette.
  const [active, setActive] = useState(1)
  const navigate = useNavigate()

  // Un membre déjà connecté qui atterrit sur « / » (ex. lien direct, retour
  // arrière) doit rejoindre son tableau de bord plutôt que revoir la page
  // marketing dans la coquille applicative — voir même logique dans Login.tsx.
  useEffect(() => {
    if (currentUser) {
      navigate(homePathForRole(currentUser.role), { replace: true })
    }
  }, [currentUser, navigate])

  if (currentUser) return null

  return (
    <div className="landing">
      <section className="hero">
        {/* Ciel dégradé et nuages : purement décoratif, aucun asset externe. */}
        <div className="hero-sky" aria-hidden>
          <span className="hero-cloud hero-cloud-1" />
          <span className="hero-cloud hero-cloud-2" />
          <span className="hero-cloud hero-cloud-3" />
          <span className="hero-cloud hero-cloud-4" />
          <span className="hero-cloud hero-cloud-5" />
        </div>

        <div className="container hero-inner">
          <div className="hero-grid">
            <FadeUp className="hero-copy">
              <p className="hero-eyebrow">Recommandations locales, vérifiées</p>
              <h1>
                Chaque expérience vécue.
                <br />
                Un seul annuaire de confiance.
              </h1>
            </FadeUp>

            <FadeUp index={1} className="hero-aside">
              <p className="hero-lead">
                Trouvez l’artisan ou le fournisseur que vos voisins ont déjà
                testé — avec le prix qu’ils ont payé et la date du chantier.
              </p>
              <div className="hero-cta">
                <Link to="/annuaire">
                  <Button size="lg">
                    Voir l’annuaire
                    <ArrowRight size={18} />
                  </Button>
                </Link>
                <Link to="/inscription">
                  <Button variant="outline" size="lg">
                    Créer un compte
                  </Button>
                </Link>
              </div>
              <p className="hero-demo">
                Démo : <code>candidat@demo.mg</code> · <code>demo123</code>
              </p>
            </FadeUp>
          </div>

          <FadeUp index={2} className="hero-shot">
            <img
              src={dashboardPreview}
              alt="Tableau de bord OffRec : annuaire de confiance, fiches à confirmer et prix constatés"
              width={1600}
              height={780}
            />
          </FadeUp>
        </div>
      </section>

      <section className="stats-section">
        <div className="container stats-grid">
          {STAT_ITEMS.map((s, i) => (
            <FadeUp key={s.l} index={i}>
              <Card className="stat-card">
                <strong>{s.v}</strong>
                <span>{s.l}</span>
              </Card>
            </FadeUp>
          ))}
        </div>
      </section>

      <section id="comment-ca-marche" className="section audiences">
        <div className="audiences-sky" aria-hidden>
          <span className="audiences-cloud audiences-cloud-1" />
          <span className="audiences-cloud audiences-cloud-2" />
        </div>

        <div className="container audiences-inner">
          <FadeUp>
            <h2 className="audiences-title">
              Un même annuaire,{' '}
              <span className="audiences-title-accent">trois façons</span> de
              s’en servir
            </h2>
          </FadeUp>

          <FadeUp index={1}>
            <div className="audiences-tabs" role="tablist">
              {AUDIENCES.map((a, i) => (
                <button
                  key={a.id}
                  type="button"
                  role="tab"
                  id={`tab-${a.id}`}
                  aria-selected={i === active}
                  aria-controls={`panel-${a.id}`}
                  className={`audiences-tab ${i === active ? 'active' : ''}`}
                  onClick={() => setActive(i)}
                >
                  {a.tab}
                </button>
              ))}
            </div>
          </FadeUp>

          <Stagger className="audiences-grid">
            {AUDIENCES.map((a, i) => (
              <FadeUp key={a.id} index={i}>
                <article
                  id={`panel-${a.id}`}
                  role="tabpanel"
                  aria-labelledby={`tab-${a.id}`}
                  className={`audience-card ${i === active ? 'active' : ''}`}
                >
                  <div className="audience-icon">
                    <a.icon size={22} strokeWidth={1.75} />
                  </div>
                  <h3>{a.title}</h3>
                  <p>{a.text}</p>
                  <div className="audience-actions">
                    <Link to={a.action.to}>
                      <Button
                        size="sm"
                        variant={i === active ? 'outline' : 'primary'}
                      >
                        {a.action.label}
                      </Button>
                    </Link>
                    <Link to={a.secondary.to} className="audience-more">
                      {a.secondary.label}
                      <ArrowRight size={14} />
                    </Link>
                  </div>
                </article>
              </FadeUp>
            ))}
          </Stagger>
        </div>
      </section>

      <section id="offres" className="section section-alt">
        <div className="container">
          <FadeUp>
            <p className="eyebrow">Catalogue</p>
            <h2 className="section-title">Offres à la une</h2>
            <p className="section-sub">
              Exemples réels de publications sur la plateforme.
            </p>
          </FadeUp>
          <div className="opp-list opp-list--landing">
            {featured.map((o, i) => (
              <FadeUp key={o.id} index={i}>
                <OpportunityCard opportunity={o} detailPath={`/offres/${o.id}`} />
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      <section className="section cta-section">
        <div className="container">
          <FadeUp>
            <p className="cta-eyebrow">
              Nous construisons un annuaire de confiance à Madagascar.
            </p>
            <h2 className="cta-display">
              <span>La Confiance</span>
              <span>Se Construit</span>
            </h2>
            <p className="cta-pill">Ce qui nous engage, concrètement</p>
          </FadeUp>

          <FadeUp index={1}>
            <div className="cta-box">
              <div className="cta-quote">
                <span className="cta-mark" aria-hidden>
                  “
                </span>
                <blockquote>
                  Un avis ne peut pas être supprimé, <em>même par le prestataire
                  concerné</em>. Un prix affiché est un prix réellement payé. Une
                  fiche qui repose sur un seul retour est signalée comme telle.
                  Nous préférons un annuaire <em>plus petit et fiable</em> qu’un
                  annuaire vaste et douteux.
                </blockquote>
                <footer>
                  <strong>L’équipe OffRec</strong>
                  <span>Antananarivo</span>
                </footer>
              </div>

              <div className="cta-rules">
                <p className="cta-rules-title">Règles appliquées par la plateforme</p>
                <ul>
                  {COMMITMENTS.map((c) => (
                    <li key={c}>
                      <Check size={15} aria-hidden />
                      {c}
                    </li>
                  ))}
                </ul>
                <div className="cta-actions">
                  <Link to="/inscription">
                    <Button variant="secondary" size="lg">
                      Créer un compte
                    </Button>
                  </Link>
                  <Link to="/annuaire" className="cta-link">
                    Parcourir l’annuaire
                    <ArrowRight size={15} />
                  </Link>
                </div>
              </div>
            </div>
          </FadeUp>
        </div>
      </section>
    </div>
  )
}
