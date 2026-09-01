import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'
import { FadeUp } from '../../components/motion/Motion'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Field, Input } from '../../components/ui/Form'
import { useApp } from '../../context/AppContext'
import { TRADES } from '../../data/constants'

/**
 * Espace « particulier » : parcours simple, pas de jargon. On décrit un
 * besoin, OffRec recommande des profils via l'annuaire de confiance déjà
 * existant — pas de moteur séparé à maintenir.
 */
export function IndividualDashboard() {
  const { currentUser, providers } = useApp()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const firstName = currentUser?.individualProfile?.fullName.split(' ')[0] ?? ''

  const handleSearch = (e: FormEvent) => {
    e.preventDefault()
    navigate(query.trim() ? `/annuaire?q=${encodeURIComponent(query.trim())}` : '/annuaire')
  }

  return (
    <div className="page">
      <div className="container">
        <FadeUp>
          <header className="page-header">
            <p className="eyebrow">Espace particulier</p>
            <h1>{firstName ? `Bonjour, ${firstName}` : 'De quoi avez-vous besoin ?'}</h1>
            <p>Décrivez votre besoin ou choisissez un métier pour trouver un professionnel recommandé.</p>
          </header>
        </FadeUp>

        <FadeUp index={1}>
          <Card style={{ marginBottom: '1.5rem' }}>
            <form onSubmit={handleSearch} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 220 }}>
                <Field label="Je cherche…">
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Électricien, maçon, plombier…"
                  />
                </Field>
              </div>
              <Button type="submit">
                <Search size={16} />
                Rechercher
              </Button>
            </form>
          </Card>
        </FadeUp>

        <div className="grid-3" style={{ marginBottom: '1.5rem' }}>
          <FadeUp index={0}>
            <Card className="stat-card">
              <strong>{providers.length}</strong>
              <span>Prestataires référencés</span>
            </Card>
          </FadeUp>
          <FadeUp index={1}>
            <Card className="stat-card">
              <strong>{TRADES.length}</strong>
              <span>Métiers couverts</span>
            </Card>
          </FadeUp>
          <FadeUp index={2}>
            <Card className="stat-card">
              <strong>Antananarivo</strong>
              <span>Zone couverte</span>
            </Card>
          </FadeUp>
        </div>

        <h2 style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>Métiers</h2>
        <div className="skill-chips">
          {TRADES.map((trade) => (
            <button
              key={trade}
              type="button"
              className="chip"
              onClick={() => navigate(`/annuaire?trade=${encodeURIComponent(trade)}`)}
            >
              {trade}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
