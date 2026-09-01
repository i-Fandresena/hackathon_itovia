import { Bell, LogOut, Menu, X } from 'lucide-react'
import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { Logo } from '../brand/Logo'
import { useApp } from '../../context/AppContext'
import { Button } from '../ui/Button'
import './Header.css'

interface HeaderProps {
  /** Sur la landing, la barre flotte en pastille au-dessus du hero bleu. */
  floating?: boolean
}

export function Header({ floating }: HeaderProps = {}) {
  const { currentUser, logout, unreadCount } = useApp()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  const handleLogout = async () => {
    await logout()
    navigate('/')
    setMenuOpen(false)
  }

  const candidateLinks = [
    { to: '/candidat', label: 'Tableau de bord' },
    { to: '/candidat/offres', label: 'Offres' },
    { to: '/annuaire', label: 'Annuaire' },
    { to: '/candidat/favoris', label: 'Favoris' },
    { to: '/candidat/profil', label: 'Profil' },
  ]

  const recruiterLinks = [
    { to: '/recruteur', label: 'Tableau de bord' },
    { to: '/recruteur/publier', label: 'Publier' },
    { to: '/recruteur/offres', label: 'Mes offres' },
    { to: '/annuaire', label: 'Annuaire' },
    { to: '/recruteur/candidatures', label: 'Candidatures' },
  ]

  const navLinks =
    currentUser?.role === 'recruiter' ? recruiterLinks : candidateLinks

  return (
    <header className={`site-header ${floating ? 'floating' : ''}`.trim()}>
      <div className="container header-inner">
        <span onClick={() => setMenuOpen(false)} role="presentation">
          <Logo to="/" />
        </span>

        <nav className={`header-nav ${menuOpen ? 'open' : ''}`}>
          {!currentUser ? (
            <>
              <a href="/#comment-ca-marche" onClick={() => setMenuOpen(false)}>
                Comment ça marche
              </a>
              <a href="/#offres" onClick={() => setMenuOpen(false)}>
                Offres
              </a>
              <NavLink to="/annuaire" onClick={() => setMenuOpen(false)}>
                Annuaire
              </NavLink>
              <NavLink to="/connexion" onClick={() => setMenuOpen(false)}>
                Connexion
              </NavLink>
              <NavLink to="/inscription" onClick={() => setMenuOpen(false)}>
                <Button size="sm">Créer un compte</Button>
              </NavLink>
            </>
          ) : (
            <>
              {navLinks.map((l) => (
                <NavLink
                  key={l.to}
                  to={l.to}
                  end={l.to === '/candidat' || l.to === '/recruteur'}
                  onClick={() => setMenuOpen(false)}
                >
                  {l.label}
                </NavLink>
              ))}
              {currentUser.role === 'candidate' && (
                <NavLink
                  to="/candidat/notifications"
                  className="notif-link"
                  onClick={() => setMenuOpen(false)}
                >
                  <Bell size={18} />
                  {unreadCount > 0 && (
                    <span className="notif-badge">{unreadCount}</span>
                  )}
                </NavLink>
              )}
              <button type="button" className="nav-logout" onClick={handleLogout}>
                <LogOut size={16} />
                Déconnexion
              </button>
            </>
          )}
        </nav>

        <button
          type="button"
          className="menu-toggle"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label={menuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
        >
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>
    </header>
  )
}
