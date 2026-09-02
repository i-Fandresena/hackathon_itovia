import { Link } from 'react-router-dom'
import { Logo } from '../brand/Logo'
import './Footer.css'

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div>
          <Logo to="/" className="footer-logo" />
          <p className="footer-tagline">
            Offres et recommandations professionnelles pour Madagascar.
          </p>
        </div>
        <div>
          <p className="footer-heading">Plateforme</p>
          <Link to="/inscription">Créer un compte</Link>
          <Link to="/connexion">Connexion</Link>
        </div>
        <div>
          <p className="footer-heading">Contact</p>
          <p>contact@qualitec.mg</p>
          <p>+261 38 64 234 49</p>
          <p>+261 36 324 83</p>
          <p>+261 34 50 305 27</p>
        </div>
      </div>
      <div className="container footer-bottom">
        <p>© 2026 OffRec — Fait pour les talents malgaches</p>
      </div>
    </footer>
  )
}
