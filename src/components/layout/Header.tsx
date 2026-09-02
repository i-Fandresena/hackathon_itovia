import { HelpCircle, LogIn, Store, Briefcase, UserPlus } from 'lucide-react'
import { Link, NavLink } from 'react-router-dom'
import { Logo } from '../brand/Logo'
import { Button } from '../ui/Button'
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
  const navLinks = [
    { to: '/annuaire', label: 'Annuaire' },
    { to: '/connexion', label: 'Connexion' },
  ]

  const tabItems: TabBarItem[] = [
    { key: 'comment', label: 'Guide', icon: HelpCircle, href: '/#comment-ca-marche' },
    { key: 'offres', label: 'Offres', icon: Briefcase, href: '/#offres' },
    { key: 'annuaire', label: 'Annuaire', icon: Store, to: '/annuaire' },
    { key: 'connexion', label: 'Connexion', icon: LogIn, to: '/connexion' },
    { key: 'inscription', label: 'Inscription', icon: UserPlus, to: '/inscription' },
  ]

  return (
    <header className={`site-header ${floating ? 'floating' : ''}`.trim()}>
      <div className="container header-inner">
        <Logo to="/" />

        <nav className="header-nav">
          <a href="/#comment-ca-marche">Comment ça marche</a>
          <a href="/#offres">Offres</a>
          {navLinks.map((l) => (
            <NavLink key={l.to} to={l.to}>
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
      </div>

      {!floating && <TabBar items={tabItems} />}
    </header>
  )
}
