import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Eye, EyeOff } from 'lucide-react'
import { GENDER_LABELS, PROVINCES } from '../../data/constants'
import { useApp } from '../../context/AppContext'
import { homePathForRole } from '../../lib/roles'
import { LogoMark } from '../../components/brand/Logo'
import { AnimatedIcon } from '../../components/ui/AnimatedIcon'
import type { Gender, UserRole } from '../../types'
import './Auth.css'

const ROLE_OPTIONS: { role: UserRole; label: string; icon: 'target' | 'briefcase' | 'search' }[] = [
  { role: 'candidate', label: 'Je cherche une opportunité', icon: 'target' },
  { role: 'recruiter', label: 'Je recrute', icon: 'briefcase' },
  { role: 'particulier', label: 'Je cherche un professionnel', icon: 'search' },
]

const FEATURES = [
  { icon: 'check' as const, label: 'Inscription gratuite en 1 minute', delay: 0.35 },
  { icon: 'user' as const, label: 'Profil visible par les recruteurs', delay: 0.5 },
  { icon: 'star' as const, label: 'Alertes personnalisées d’offres', delay: 0.65 },
]

export function Signup() {
  const { register, currentUser } = useApp()
  const navigate = useNavigate()
  const [role, setRole] = useState<UserRole>('candidate')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [fullName, setFullName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [phone, setPhone] = useState('')
  const [province, setProvince] = useState<string>(PROVINCES[0])
  const [gender, setGender] = useState<Gender>('femme')
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

    let result
    if (role === 'candidate') {
      result = await register(email, password, 'candidate', {
        fullName,
        email,
        phone,
        province,
        city: province,
        gender,
        educationLevel: 'licence',
        skills: [],
        experienceLevel: 'debutant',
        desiredOpportunityTypes: ['emploi', 'stage'],
        availability: 'flexible',
      })
      if (result.ok) { navigate('/candidat/profil'); return }
    } else if (role === 'recruiter') {
      result = await register(email, password, 'recruiter', {
        companyName,
        email,
        phone,
        province,
        city: province,
        sector: 'Autre',
      })
      if (result.ok) { navigate('/recruteur'); return }
    } else {
      result = await register(email, password, 'particulier', {
        fullName,
        email,
        phone,
        province,
        city: province,
      })
      if (result.ok) { navigate('/particulier'); return }
    }

    setError(result?.error ?? 'Une erreur est survenue. Veuillez réessayer.')
    setLoading(false)
  }

  if (currentUser) return null

  return (
    <div className="split-auth-page split-signup-page">
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
            Créez votre compte et accédez aux meilleures opportunités professionnelles à Madagascar.
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
        <div className="split-form-wrapper signup-form-wrapper">
          <div className="split-form-header">
            <h2 className="split-form-title">Créer un compte</h2>
            <p className="split-form-subtitle">Rejoignez OffRec en quelques secondes</p>
          </div>

          {/* Sélecteur de rôle */}
          <div className="signup-role-toggle">
            {ROLE_OPTIONS.map((o) => (
              <button
                key={o.role}
                type="button"
                className={`signup-role-btn ${role === o.role ? 'active' : ''}`}
                onClick={() => setRole(o.role)}
              >
                {role === o.role && (
                  <motion.span
                    layoutId="signup-role-pill"
                    className="signup-role-pill"
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  />
                )}
                <span className="signup-role-icon-wrap">
                  <AnimatedIcon
                    icon={o.icon}
                    size={20}
                    color={role === o.role ? '#1a56ff' : '#6b7280'}
                  />
                </span>
                <span className="signup-role-label">{o.label}</span>
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="split-form" noValidate>
            {/* Nom */}
            <div className="split-field">
              <label htmlFor="signup-name" className="split-label">
                {role === 'recruiter' ? "Nom de l'entreprise / organisation" : 'Nom complet'}
              </label>
              <input
                id="signup-name"
                type="text"
                required
                autoComplete={role === 'recruiter' ? 'organization' : 'name'}
                value={role === 'recruiter' ? companyName : fullName}
                onChange={(e) =>
                  role === 'recruiter'
                    ? setCompanyName(e.target.value)
                    : setFullName(e.target.value)
                }
                placeholder={role === 'recruiter' ? 'Ex. TechMada Solutions' : 'Votre prénom et nom'}
                className="split-input"
              />
            </div>

            {/* Email */}
            <div className="split-field">
              <label htmlFor="signup-email" className="split-label">Adresse e-mail</label>
              <input
                id="signup-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nom@exemple.mg"
                className="split-input"
              />
            </div>

            {/* Téléphone */}
            <div className="split-field">
              <label htmlFor="signup-phone" className="split-label">Téléphone</label>
              <input
                id="signup-phone"
                type="tel"
                required
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+261 34 00 000 00"
                className="split-input"
              />
            </div>

            {/* Genre (candidat uniquement) */}
            {role === 'candidate' && (
              <div className="split-field">
                <label htmlFor="signup-gender" className="split-label">Genre</label>
                <select
                  id="signup-gender"
                  value={gender}
                  onChange={(e) => setGender(e.target.value as Gender)}
                  className="split-select"
                >
                  {(Object.keys(GENDER_LABELS) as Gender[]).map((k) => (
                    <option key={k} value={k}>{GENDER_LABELS[k]}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Province */}
            <div className="split-field">
              <label htmlFor="signup-province" className="split-label">Province</label>
              <select
                id="signup-province"
                value={province}
                onChange={(e) => setProvince(e.target.value)}
                className="split-select"
              >
                {PROVINCES.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            {/* Mot de passe */}
            <div className="split-field">
              <label htmlFor="signup-password" className="split-label">Mot de passe</label>
              <div className="split-input-pw-wrap">
                <input
                  id="signup-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 6 caractères"
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

            {/* Erreur */}
            {error && (
              <motion.div
                className="split-error"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
              >
                {error}
              </motion.div>
            )}

            {/* Bouton S'inscrire */}
            <motion.button
              type="submit"
              className="split-submit-btn"
              disabled={loading}
              whileHover={{ scale: loading ? 1 : 1.01 }}
              whileTap={{ scale: loading ? 1 : 0.99 }}
            >
              {loading ? 'Inscription...' : "S'inscrire"}
            </motion.button>

            <p className="split-signup-row">
              Déjà inscrit ?{' '}
              <Link to="/connexion" className="split-signup-link">Se connecter</Link>
            </p>
          </form>
        </div>
      </motion.div>
    </div>
  )
}
