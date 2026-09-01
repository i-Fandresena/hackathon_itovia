import { useState, type FormEvent } from 'react'
import { UserPlus } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Field, Input, Select } from '../../components/ui/Form'
import { PROVINCES } from '../../data/constants'
import { apiAdminCreateAgent } from '../../lib/api'

/**
 * Provisionne un compte agent : pas de self-service (cahier des charges
 * §12 — un statut de vérification agent non fiable détruirait la promesse
 * « compétences vérifiées »).
 */
export function AdminAgents() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [province, setProvince] = useState<string>(PROVINCES[0])
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    try {
      await apiAdminCreateAgent({
        email,
        password,
        agentProfile: { fullName, phone, province, city: province },
      })
      setSuccess(`Compte agent créé pour ${email}.`)
      setEmail('')
      setPassword('')
      setFullName('')
      setPhone('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Création impossible.')
    }
  }

  return (
    <div className="page">
      <div className="container" style={{ maxWidth: 560 }}>
        <header className="page-header">
          <h1>Agents de terrain</h1>
          <p>Provisionnez un nouveau compte agent — ce rôle n’est pas auto-inscriptible.</p>
        </header>
        <Card>
          <form onSubmit={handleSubmit}>
            <Field label="Nom complet">
              <Input required value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </Field>
            <Field label="Email">
              <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <Field label="Téléphone">
              <Input required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+261 34 00 000 00" />
            </Field>
            <Field label="Province">
              <Select value={province} onChange={(e) => setProvince(e.target.value)}>
                {PROVINCES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Mot de passe temporaire" hint="Minimum 8 caractères">
              <Input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
            </Field>
            {error && <p style={{ color: 'var(--color-danger, #c0392b)' }}>{error}</p>}
            {success && <p className="save-ok">{success}</p>}
            <Button type="submit" fullWidth>
              <UserPlus size={16} />
              Créer le compte agent
            </Button>
          </form>
        </Card>
      </div>
    </div>
  )
}
