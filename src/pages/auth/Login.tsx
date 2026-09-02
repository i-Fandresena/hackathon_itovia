import { useEffect, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, Eye, EyeOff } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { homePathForRole } from '../../lib/roles'
import { LogoMark } from '../../components/brand/Logo'
import { AnimatedIcon } from '../../components/ui/AnimatedIcon'
import './Auth.css'

const FEATURES = [
  { icon: 'shield' as const, label: 'Offres vérifiées par nos équipes', delay: 0.35 },
  { icon: 'star' as const, label: 'Recommandations IA personnalisées', delay: 0.5 },
  { icon: 'check' as const, label: 'Candidatures en un clic', delay: 0.65 },
]

export function Login() {
  const { login, currentUser } = useApp()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (currentUser) {
      navigate(homePathForRole(currentUser.role), { replace: true })
    }
  }, [currentUser, navigate])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const result = await login(email, password)
      if (!result.ok || !result.user) {
        setError(result.error ?? 'Identifiants incorrects. Veuillez vérifier vos informations.')
        setLoading(false)
        return
      }
      const dest = from ?? homePathForRole(result.user.role)
      navigate(dest, { replace: true })
    } catch {
      setError('Une erreur réseau est survenue. Veuillez réessayer.')
      setLoading(false)
    }
  }

  return (
    <div className="split-auth-page">
      <Link to="/" className="split-back-link">
        <ArrowLeft size={16} aria-hidden />
        Retour à l’accueil
      </Link>

      {/* ── Panneau gauche bleu ── */}
      <div className="split-left-panel">
        <svg className="split-wave" viewBox="0 0 560 560" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <ellipse cx="280" cy="560" rx="360" ry="320" fill="rgba(255,255,255,0.05)" />
          <ellipse cx="280" cy="600" rx="300" ry="280" fill="rgba(255,255,255,0.07)" />
          <ellipse cx="280" cy="640" rx="240" ry="240" fill="rgba(255,255,255,0.09)" />
        </svg>

        <motion.div
          className="split-brand-block"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="split-logo-badge">
            <LogoMark size={40} />
          </div>
          <h1 className="split-brand-name">OffRec</h1>
          <p className="split-brand-tagline">
            La plateforme professionnelle qui connecte les talents avec les meilleures opportunités à Madagascar.
          </p>
          <ul className="split-feature-list">
            {FEATURES.map((f) => (
              <li key={f.label} className="split-feature-item">
                <span className="split-feature-icon">
                  <AnimatedIcon icon={f.icon} size={18} color="rgba(255,255,255,0.95)" delay={f.delay} />
                </span>
                <span>{f.label}</span>
              </li>
            ))}
          </ul>
        </motion.div>
      </div>

      {/* ── Panneau droit blanc ── */}
      <motion.div
        className="split-right-panel"
        initial={{ opacity: 0, x: 28 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: 0.08 }}
      >
        <div className="split-form-wrapper">
          <div className="split-form-header">
            <h2 className="split-form-title">Bienvenue</h2>
            <p className="split-form-subtitle">Connectez-vous à votre compte</p>
          </div>

          <form onSubmit={handleSubmit} className="split-form" noValidate>
            <div className="split-field">
              <label htmlFor="auth-email" className="split-label">Adresse e-mail</label>
              <input
                id="auth-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nom@exemple.mg"
                className="split-input"
              />
            </div>

            <div className="split-field">
              <label htmlFor="auth-password" className="split-label">Mot de passe</label>
              <div className="split-input-pw-wrap">
                <input
                  id="auth-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="split-input"
                />
                <button
                  type="button"
                  className="split-pw-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                  aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {error && (
              <motion.div
                className="split-error"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
              >
                {error}
              </motion.div>
            )}

            <motion.button
              type="submit"
              className="split-submit-btn"
              disabled={loading}
              whileHover={{ scale: loading ? 1 : 1.01 }}
              whileTap={{ scale: loading ? 1 : 0.99 }}
            >
              {loading ? 'Connexion...' : 'Se connecter'}
            </motion.button>

            <p className="split-signup-row">
              Pas encore de compte ?{' '}
              <Link to="/inscription" className="split-signup-link">S'inscrire</Link>
            </p>
          </form>
        </div>
      </motion.div>
    </div>
  )
}
