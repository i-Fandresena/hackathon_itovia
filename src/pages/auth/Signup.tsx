import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Field, Input, Select } from '../../components/ui/Form'
import { PROVINCES } from '../../data/constants'
import { useApp } from '../../context/AppContext'
import type { UserRole } from '../../types'
import './Auth.css'

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
  const [error, setError] = useState('')

  useEffect(() => {
    if (currentUser) {
      navigate(currentUser.role === 'candidate' ? '/candidat' : '/recruteur', {
        replace: true,
      })
    }
  }, [currentUser, navigate])

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (role === 'candidate') {
      const result = register(email, password, 'candidate', {
        fullName,
        email,
        phone,
        province,
        city: province,
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
    } else {
      const result = register(email, password, 'recruiter', {
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
    }
  }

  if (currentUser) return null

  return (
    <div className="page auth-page">
      <div className="container auth-container">
        <Card>
          <h1>Créer un compte</h1>
          <p className="auth-sub">Rejoignez OffRec en quelques secondes</p>

          <div className="role-toggle">
            <button
              type="button"
              className={role === 'candidate' ? 'active' : ''}
              onClick={() => setRole('candidate')}
            >
              Je cherche une opportunité
            </button>
            <button
              type="button"
              className={role === 'recruiter' ? 'active' : ''}
              onClick={() => setRole('recruiter')}
            >
              Je recrute
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            {role === 'candidate' ? (
              <Field label="Nom complet">
                <Input
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </Field>
            ) : (
              <Field label="Nom de l’entreprise / organisation">
                <Input
                  required
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
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
      </div>
    </div>
  )
}
