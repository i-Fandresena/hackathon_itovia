import { useEffect, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Field, Input } from '../../components/ui/Form'
import { useApp } from '../../context/AppContext'
import { DEMO_CANDIDATE_EMAIL, DEMO_PASSWORD, DEMO_RECRUITER_EMAIL } from '../../data/seed'
import './Auth.css'

export function Login() {
  const { login, currentUser } = useApp()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (currentUser) {
      const dest = currentUser.role === 'candidate' ? '/candidat' : '/recruteur'
      navigate(dest, { replace: true })
    }
  }, [currentUser, navigate])

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    const result = login(email, password)
    if (!result.ok || !result.user) {
      setError(result.error ?? 'Erreur de connexion')
      return
    }
    const dest =
      from ?? (result.user.role === 'recruiter' ? '/recruteur' : '/candidat')
    navigate(dest, { replace: true })
  }

  const fillDemo = (role: 'candidate' | 'recruiter') => {
    setEmail(role === 'candidate' ? DEMO_CANDIDATE_EMAIL : DEMO_RECRUITER_EMAIL)
    setPassword(DEMO_PASSWORD)
    setError('')
  }

  return (
    <div className="page auth-page">
      <div className="container auth-container">
        <Card>
          <h1>Connexion</h1>
          <p className="auth-sub">Accédez à votre espace OffRec</p>
          <form onSubmit={handleSubmit}>
            <Field label="Email">
              <Input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="vous@email.mg"
              />
            </Field>
            <Field label="Mot de passe">
              <Input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>
            {error && <p className="auth-error">{error}</p>}
            <Button type="submit" fullWidth>
              Se connecter
            </Button>
          </form>
          <div className="demo-buttons">
            <Button type="button" variant="outline" size="sm" onClick={() => fillDemo('candidate')}>
              Compte candidat démo
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => fillDemo('recruiter')}>
              Compte recruteur démo
            </Button>
          </div>
          <p className="auth-footer">
            Pas encore de compte ? <Link to="/inscription">S’inscrire</Link>
          </p>
        </Card>
      </div>
    </div>
  )
}
