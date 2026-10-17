import { LogIn, Sparkles, Store, Briefcase, UserPlus } from 'lucide-react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { Logo } from '../brand/Logo'
import { Button } from '../ui/Button'
import { ThemeToggle } from '../ui/ThemeToggle'
import { TabBar, type TabBarItem } from './TabBar'
import './Header.css'

interface HeaderProps {
  /** Sur la landing, la barre flotte en pastille au-dessus du hero bleu. */
  floating?: boolean
}

/**
 * Coquille publique (visiteur non connecté — dès qu'un compte est
 * connecté, `Layout.tsx` bascule entièrement sur `AppShell`). Sous 900px,
 * la nav horizontale est remplacée par la barre d'onglets en bas de
 * l'écran (`TabBar`) : les 5 liens publics tiennent tous, pas d'onglet
 * « Menu » nécessaire ici. Exception : la landing (`floating`) n'affiche
 * jamais cette barre — une page d'accueil ne doit pas donner l'impression
 * d'être déjà dans l'espace applicatif connecté. Sans barre en bas, la
 * pastille garde donc Connexion/Inscription toujours visibles (pas
 * seulement à partir de 900px comme `.header-nav`), sinon plus aucun
 * moyen d'y accéder sur mobile/tablette.
 */
export function Header({ floating }: HeaderProps = {}) {
  const { pathname } = useLocation()
  // Talents et entreprises sont des onglets de l'Annuaire : sur ces pages,
  // c'est le raccourci « Talents » / « Entreprises » qui est actif, pas
  // « Annuaire » (sinon deux liens actifs à la fois).
  const inTalents = pathname.startsWith('/annuaire/talents')
  const inCompanies = pathname.startsWith('/annuaire/entreprises')
  const annuaireActive = pathname.startsWith('/annuaire') && !inTalents && !inCompanies

  const navLinks: { to: string; label: string; wide?: boolean; active?: boolean }[] = [
    { to: '/annuaire/talents', label: 'Talents' },
    // Grand écran seulement (>= 1100px, sinon la nav passe sur deux lignes
    // ou déborde) ; la barre d'onglets mobile reste à 5 : accès depuis les
    // onglets de l'Annuaire et l'accueil.
    { to: '/annuaire/entreprises', label: 'Entreprises', wide: true },
    { to: '/annuaire', label: 'Annuaire', active: annuaireActive },
    { to: '/connexion', label: 'Connexion' },
  ]

  const tabItems: TabBarItem[] = [
    // « Talents » remplace « Guide » (ancre de la landing, toujours atteinte
    // par le logo) : 5 onglets au plus, lisibles à 390 px.
    { key: 'talents', label: 'Talents', icon: Sparkles, to: '/annuaire/talents' },
    { key: 'offres', label: 'Offres', icon: Briefcase, href: '/#offres' },
    { key: 'annuaire', label: 'Annuaire', icon: Store, to: '/annuaire', active: annuaireActive },
    { key: 'connexion', label: 'Connexion', icon: LogIn, to: '/connexion' },
    { key: 'inscription', label: 'Inscription', icon: UserPlus, to: '/inscription' },
  ]

  return (
    <header className={`site-header ${floating ? 'floating' : ''}`.trim()}>
      <div className="container header-inner">
        <Logo to="/" />

        <div className="header-right">
          <nav className="header-nav">
            <a href="/#comment-ca-marche">Comment ça marche</a>
            <a href="/#offres">Offres</a>
            {navLinks.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                className={({ isActive }) =>
                  [l.wide ? 'header-nav-wide' : '', (l.active ?? isActive) ? 'active' : ''].filter(Boolean).join(' ') ||
                  undefined
                }
                aria-current={l.active === false ? false : 'page'}
              >
                {l.label}
              </NavLink>
            ))}
            <NavLink to="/inscription">
              <Button size="sm">Créer un compte</Button>
            </NavLink>
          </nav>

          {floating && (
            <div className="header-auth-mobile">
              <Link to="/connexion">Connexion</Link>
              <Link to="/inscription">
                <Button size="sm">S'inscrire</Button>
              </Link>
            </div>
          )}

          {!floating && <ThemeToggle />}
        </div>
      </div>

      {!floating && <TabBar items={tabItems} />}
    </header>
  )
}
