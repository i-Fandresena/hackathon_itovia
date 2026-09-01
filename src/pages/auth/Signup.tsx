import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { FadeUp } from '../../components/motion/Motion'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Field, Input, Select } from '../../components/ui/Form'
import { GENDER_LABELS, PROVINCES } from '../../data/constants'
import { useApp } from '../../context/AppContext'
import { homePathForRole } from '../../lib/roles'
import type { Gender, UserRole } from '../../types'
import './Auth.css'

const ROLE_OPTIONS: { role: UserRole; label: string }[] = [
  { role: 'candidate', label: 'Je cherche une opportunité' },
  { role: 'recruiter', label: 'Je recrute' },
  { role: 'particulier', label: 'Je cherche un professionnel' },
]

export function Signup() {
  const { register, currentUser } = useApp()
  const navigate = useNavigate()
  const [role, setRole] = useState<UserRole>('candidate')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [phone, setPhone] = useState('')
  const [province, setProvince] = useState<string>(PROVINCES[0])
  const [gender, setGender] = useState<Gender>('femme')
  const [error, setError] = useState('')

  useEffect(() => {
    if (currentUser) {
      navigate(homePathForRole(currentUser.role), { replace: true })
    }
  }, [currentUser, navigate])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (role === 'candidate') {
      const result = await register(email, password, 'candidate', {
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
      if (!result.ok) {
        setError(result.error ?? 'Erreur')
        return
      }
      navigate('/candidat/profil')
    } else if (role === 'recruiter') {
      const result = await register(email, password, 'recruiter', {
        companyName,
        email,
        phone,
        province,
        city: province,
        sector: 'Autre',
      })
      if (!result.ok) {
        setError(result.error ?? 'Erreur')
        return
      }
      navigate('/recruteur')
    } else {
      const result = await register(email, password, 'particulier', {
        fullName,
        email,
        phone,
        province,
        city: province,
      })
      if (!result.ok) {
        setError(result.error ?? 'Erreur')
        return
      }
      navigate('/particulier')
    }
  }

  if (currentUser) return null

  return (
    <div className="page auth-page">
      <div className="container auth-container">
        <p className="auth-eyebrow">
          <span className="eyebrow">Recommandations locales, vérifiées</span>
        </p>
        <FadeUp eager>
          <Card>
            <h1>Créer un compte</h1>
            <p className="auth-sub">Rejoignez OffRec en quelques secondes</p>

            <div className="role-toggle">
              {ROLE_OPTIONS.map((o) => (
                <button
                  key={o.role}
                  type="button"
                  className={role === o.role ? 'active' : ''}
                  onClick={() => setRole(o.role)}
                >
                  {role === o.role && (
                    <motion.span
                      layoutId="role-toggle-pill"
                      className="role-toggle-pill"
                      transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                    />
                  )}
                  <span>{o.label}</span>
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit}>
              {role === 'recruiter' ? (
                <Field label="Nom de l’entreprise / organisation">
                  <Input
                    required
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                  />
                </Field>
              ) : (
                <Field label="Nom complet">
                  <Input
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </Field>
              )}
              <Field label="Email">
                <Input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </Field>
              <Field label="Téléphone">
                <Input
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+261 34 00 000 00"
                />
              </Field>
              {role === 'candidate' && (
                <Field label="Genre">
                  <Select value={gender} onChange={(e) => setGender(e.target.value as Gender)}>
                    {(Object.keys(GENDER_LABELS) as Gender[]).map((k) => (
                      <option key={k} value={k}>
                        {GENDER_LABELS[k]}
                      </option>
                    ))}
                  </Select>
                </Field>
              )}
              <Field label="Province">
                <Select
                  value={province}
                  onChange={(e) => setProvince(e.target.value)}
                >
                  {PROVINCES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Mot de passe" hint="Minimum 6 caractères">
                <Input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </Field>
              {error && <p className="auth-error">{error}</p>}
              <Button type="submit" fullWidth>
                S’inscrire
              </Button>
            </form>
            <p className="auth-footer">
              Déjà inscrit ? <Link to="/connexion">Se connecter</Link>
            </p>
          </Card>
        </FadeUp>
      </div>
    </div>
  )
}
