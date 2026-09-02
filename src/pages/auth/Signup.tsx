import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Eye, EyeOff } from 'lucide-react'
import { ACTIVE_SECTORS, GENDER_LABELS, PROVINCES, SECTOR_LABELS, SECTORS, TRADES, TRADE_SECTOR } from '../../data/constants'
import { useApp } from '../../context/AppContext'
import { apiSubmitTalentLead } from '../../lib/api'
import { homePathForRole } from '../../lib/roles'
import { LogoMark } from '../../components/brand/Logo'
import { AnimatedIcon } from '../../components/ui/AnimatedIcon'
import type { Gender, Sector, UserRole } from '../../types'
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

/** Métiers des secteurs actifs du pilote en premier, pour refléter la
 *  densité recherchée sans masquer les autres métiers. */
const SORTED_TRADES = [...TRADES].sort((a, b) => {
  const aActive = ACTIVE_SECTORS.includes(TRADE_SECTOR[a])
  const bActive = ACTIVE_SECTORS.includes(TRADE_SECTOR[b])
  if (aActive === bActive) return a.localeCompare(b)
  return aActive ? -1 : 1
})

type CandidatePath = 'diplome' | 'non_diplome'

export function Signup() {
  const { register, currentUser } = useApp()
  const navigate = useNavigate()
  const [role, setRole] = useState<UserRole>('candidate')
  const [candidatePath, setCandidatePath] = useState<CandidatePath>('diplome')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [fullName, setFullName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [phone, setPhone] = useState('')
  const [province, setProvince] = useState<string>(PROVINCES[0])
  const [gender, setGender] = useState<Gender>('femme')
  const [sector, setSector] = useState<Sector | ''>('')
  const [trade, setTrade] = useState<string>(SORTED_TRADES[0])
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [leadSubmitted, setLeadSubmitted] = useState(false)

  useEffect(() => {
    if (currentUser) {
      navigate(homePathForRole(currentUser.role), { replace: true })
    }
  }, [currentUser, navigate])

  const isNonDiplomaPath = role === 'candidate' && candidatePath === 'non_diplome'

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (isNonDiplomaPath) {
      try {
        await apiSubmitTalentLead({
          fullName,
          phone,
          province,
          city: province,
          gender,
          trade,
          sector: TRADE_SECTOR[trade as (typeof TRADES)[number]],
          message: message.trim() || undefined,
        })
        setLeadSubmitted(true)
      } catch {
        setError('Impossible d’envoyer votre demande. Veuillez réessayer.')
      }
      setLoading(false)
      return
    }

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
        sector: sector || undefined,
      })
      if (result.ok) { navigate('/candidat/profil'); return }
    } else if (role === 'recruiter') {
      result = await register(email, password, 'recruiter', {
        companyName,
        email,
        phone,
        province,
        city: province,
        sector: sector || 'autre',
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
                onClick={() => { setRole(o.role); setLeadSubmitted(false); setError('') }}
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

          {/* Sous-choix candidat : diplômé/formation vs sait-faire un métier
              sans diplôme — la séparation la plus importante du parcours
              (philosophie « compétences d'abord »), pas un détail d'ergonomie. */}
          {role === 'candidate' && (
            <>
              <div className="signup-role-toggle">
                <button
                  type="button"
                  className={`signup-role-btn ${candidatePath === 'diplome' ? 'active' : ''}`}
                  onClick={() => { setCandidatePath('diplome'); setLeadSubmitted(false); setError('') }}
                >
                  {candidatePath === 'diplome' && (
                    <motion.span layoutId="signup-path-pill" className="signup-role-pill" transition={{ type: 'spring', stiffness: 500, damping: 35 }} />
                  )}
                  <span className="signup-role-label">J’ai un diplôme / une formation</span>
                </button>
                <button
                  type="button"
                  className={`signup-role-btn ${candidatePath === 'non_diplome' ? 'active' : ''}`}
                  onClick={() => { setCandidatePath('non_diplome'); setLeadSubmitted(false); setError('') }}
                >
                  {candidatePath === 'non_diplome' && (
                    <motion.span layoutId="signup-path-pill" className="signup-role-pill" transition={{ type: 'spring', stiffness: 500, damping: 35 }} />
                  )}
                  <span className="signup-role-label">Je n’ai pas de diplôme mais je sais faire un métier</span>
                </button>
              </div>
              <p className="split-subtoggle-hint">
                {candidatePath === 'diplome'
                  ? 'Vous déposerez un CV et recevrez des offres matchées automatiquement.'
                  : 'Pas de CV à fournir : un agent de terrain vous contactera pour vérifier votre métier avec la grille correspondante.'}
              </p>
            </>
          )}

          {leadSubmitted ? (
            <div className="split-success">
              Votre demande a bien été envoyée. Un agent de terrain OffRec vous
              contactera au {phone} pour vérifier votre métier.
            </div>
          ) : (
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

              {/* Email + mot de passe : pas de compte pour le parcours non-diplômé */}
              {!isNonDiplomaPath && (
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
              )}

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

              {/* Métier déclaré (parcours non-diplômé uniquement) */}
              {isNonDiplomaPath && (
                <div className="split-field">
                  <label htmlFor="signup-trade" className="split-label">Métier que vous savez faire</label>
                  <select
                    id="signup-trade"
                    value={trade}
                    onChange={(e) => setTrade(e.target.value)}
                    className="split-select"
                  >
                    {SORTED_TRADES.map((t) => (
                      <option key={t} value={t}>
                        {t}{ACTIVE_SECTORS.includes(TRADE_SECTOR[t]) ? '' : ` (${SECTOR_LABELS[TRADE_SECTOR[t]]})`}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Secteur (diplômé/entreprise, optionnel/informatif) */}
              {!isNonDiplomaPath && (role === 'candidate' || role === 'recruiter') && (
                <div className="split-field">
                  <label htmlFor="signup-sector" className="split-label">
                    Secteur{role === 'candidate' ? ' d’intérêt (optionnel)' : ''}
                  </label>
                  <select
                    id="signup-sector"
                    value={sector}
                    onChange={(e) => setSector(e.target.value as Sector | '')}
                    className="split-select"
                  >
                    {role === 'candidate' && <option value="">Aucun en particulier</option>}
                    {SECTORS.map((s) => (
                      <option key={s} value={s}>{SECTOR_LABELS[s]}</option>
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

              {/* Message (parcours non-diplômé, optionnel) */}
              {isNonDiplomaPath && (
                <div className="split-field">
                  <label htmlFor="signup-message" className="split-label">Un mot pour l’agent (optionnel)</label>
                  <input
                    id="signup-message"
                    type="text"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Ex. disponible dès maintenant, quartier Isotry…"
                    className="split-input"
                  />
                </div>
              )}

              {/* Mot de passe : pas de compte pour le parcours non-diplômé */}
              {!isNonDiplomaPath && (
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
              )}

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

              {/* Bouton de soumission */}
              <motion.button
                type="submit"
                className="split-submit-btn"
                disabled={loading}
                whileHover={{ scale: loading ? 1 : 1.01 }}
                whileTap={{ scale: loading ? 1 : 0.99 }}
              >
                {loading
                  ? 'Envoi...'
                  : isNonDiplomaPath
                    ? 'Envoyer ma demande de contact'
                    : "S'inscrire"}
              </motion.button>

              <p className="split-signup-row">
                Déjà inscrit ?{' '}
                <Link to="/connexion" className="split-signup-link">Se connecter</Link>
              </p>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  )
}
