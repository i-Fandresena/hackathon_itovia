import { useEffect, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, Eye, EyeOff } from 'lucide-react'
import { GENDER_LABELS, PROVINCES } from '../../data/constants'
import { useApp } from '../../context/AppContext'
import { ApiError, apiSendVerificationCode } from '../../lib/api'
import { homePathForRole } from '../../lib/roles'
import { LogoMark } from '../../components/brand/Logo'
import { EmailVerificationModal } from '../../components/auth/EmailVerificationModal'
import type { Gender } from '../../types'
import './Auth.css'

interface LeadState {
  leadId?: string
  fullName?: string
  phone?: string
  province?: string
  city?: string
  gender?: Gender
}

/**
 * Formulaire spécial du "compte de suivi" pour un talent non-diplômé, après
 * une demande de contact (Signup.tsx, bouton "Poursuivre vers l'inscription").
 * Ce compte n'a aucun pouvoir sur le profil vérifié — il observe seulement
 * le statut, toujours fait avancer par l'agent (§7.3.14).
 */
export function TalentAccountSignup() {
  const { register, currentUser } = useApp()
  const navigate = useNavigate()
  const location = useLocation()
  const lead = (location.state as LeadState | null) ?? {}

  const [fullName, setFullName] = useState(lead.fullName ?? '')
  const [phone, setPhone] = useState(lead.phone ?? '')
  const [province, setProvince] = useState(lead.province ?? PROVINCES[0])
  const [gender, setGender] = useState<Gender>(lead.gender ?? 'femme')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showVerifyModal, setShowVerifyModal] = useState(false)

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
      await apiSendVerificationCode(email)
      setShowVerifyModal(true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Impossible d’envoyer le code de vérification.')
    }
    setLoading(false)
  }

  const handleVerified = async (verificationToken: string) => {
    setShowVerifyModal(false)
    setLoading(true)
    setError('')

    const result = await register(
      email,
      password,
      'talent',
      { fullName, email, phone, province, city: province, gender, leadId: lead.leadId },
      verificationToken,
    )
    if (result.ok) {
      navigate('/mon-espace')
      return
    }
    setError(result.error ?? 'Une erreur est survenue. Veuillez réessayer.')
    setLoading(false)
  }

  if (currentUser) return null

  return (
    <div className="split-auth-page">
      <Link to="/" className="split-back-link">
        <ArrowLeft size={16} aria-hidden />
        Retour à l’accueil
      </Link>

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
            Suivez l’avancement de votre demande depuis votre espace — votre
            profil reste vérifié uniquement par un agent de terrain.
          </p>
        </motion.div>
      </div>

      <motion.div
        className="split-right-panel"
        initial={{ opacity: 0, x: 28 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: 0.08 }}
      >
        <div className="split-form-wrapper">
          <div className="split-form-header">
            <h2 className="split-form-title">Créer mon compte de suivi</h2>
            <p className="split-form-subtitle">
              Pour suivre l’avancement de votre demande — pas besoin de CV.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="split-form" noValidate>
            <div className="split-field">
              <label htmlFor="talent-name" className="split-label">Nom complet</label>
              <input
                id="talent-name"
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="split-input"
              />
            </div>

            <div className="split-field">
              <label htmlFor="talent-email" className="split-label">Adresse e-mail</label>
              <input
                id="talent-email"
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
              <label htmlFor="talent-phone" className="split-label">Téléphone</label>
              <input
                id="talent-phone"
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="split-input"
              />
            </div>

            <div className="split-field">
              <label htmlFor="talent-gender" className="split-label">Genre</label>
              <select
                id="talent-gender"
                value={gender}
                onChange={(e) => setGender(e.target.value as Gender)}
                className="split-select"
              >
                {(Object.keys(GENDER_LABELS) as Gender[]).map((k) => (
                  <option key={k} value={k}>{GENDER_LABELS[k]}</option>
                ))}
              </select>
            </div>

            <div className="split-field">
              <label htmlFor="talent-province" className="split-label">Province</label>
              <select
                id="talent-province"
                value={province}
                onChange={(e) => setProvince(e.target.value)}
                className="split-select"
              >
                {PROVINCES.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            <div className="split-field">
              <label htmlFor="talent-password" className="split-label">Mot de passe</label>
              <div className="split-input-pw-wrap">
                <input
                  id="talent-password"
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
              {loading ? 'Envoi...' : 'Créer mon compte'}
            </motion.button>

            <p className="split-signup-row">
              Déjà inscrit ?{' '}
              <Link to="/connexion" className="split-signup-link">Se connecter</Link>
            </p>
          </form>
        </div>
      </motion.div>

      {showVerifyModal && (
        <EmailVerificationModal
          email={email}
          onVerified={handleVerified}
          onClose={() => { setShowVerifyModal(false); setLoading(false) }}
        />
      )}
    </div>
  )
}
