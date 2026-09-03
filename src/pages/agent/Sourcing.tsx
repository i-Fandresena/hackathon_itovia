import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Briefcase, Radar, UserRound } from 'lucide-react'
import { FadeUp } from '../../components/motion/Motion'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { Field, Input, Select, Textarea } from '../../components/ui/Form'
import { Loading } from '../../components/ui/Loading'
import { PROVINCES, SECTOR_LABELS, SECTORS } from '../../data/constants'
import {
  apiCreateSourcingLead,
  apiListSourcingLeads,
  apiUpdateSourcingLeadStatus,
  type SourcingLeadInput,
} from '../../lib/api'
import type { LeadStatus, Sector, SourcingLead, SourcingLeadType } from '../../types'

const STATUS_LABELS: Record<LeadStatus, string> = {
  nouveau: 'Nouvelle piste',
  contacte: 'Contact engagé',
  converti: 'Convertie',
  ignore: 'Non retenue',
}

const STATUS_VARIANT: Record<LeadStatus, 'muted' | 'primary' | 'success'> = {
  nouveau: 'primary',
  contacte: 'muted',
  converti: 'success',
  ignore: 'muted',
}

const TYPE_LABELS: Record<SourcingLeadType, string> = {
  talent: 'Profil potentiel',
  opportunity: "Besoin d'une entreprise",
}

const defaultForm: SourcingLeadInput = {
  type: 'talent',
  source: '',
  sourceUrl: '',
  trade: '',
  sector: 'btp',
  province: PROVINCES[0],
  city: PROVINCES[0],
  description: '',
}

/**
 * Veille : un agent journalise ici un signal repéré en ligne ou sur le
 * terrain — jamais un profil ni une offre publiés en soi. Un profil
 * n'apparaît "vérifié" dans l'annuaire qu'après la même vérification
 * humaine que n'importe quel TalentProfile (§7.3.15) ; une piste d'offre ne
 * devient une vraie Opportunity que si l'entreprise crée elle-même un
 * compte recruteur — OffRec ne publie jamais une annonce à sa place.
 */
export function Sourcing() {
  const [leads, setLeads] = useState<SourcingLead[] | null>(null)
  const [form, setForm] = useState<SourcingLeadInput>(defaultForm)
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState('')

  const load = () => {
    apiListSourcingLeads().then(setLeads)
  }

  useEffect(load, [])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      await apiCreateSourcingLead(form)
      setForm(defaultForm)
      setShowForm(false)
      load()
    } catch {
      setError('Enregistrement impossible — vérifiez les champs (l’URL doit être complète si renseignée).')
    }
  }

  const markContacted = async (id: string) => {
    await apiUpdateSourcingLeadStatus(id, 'contacte')
    load()
  }

  const markConverted = async (id: string) => {
    await apiUpdateSourcingLeadStatus(id, 'converti')
    load()
  }

  const ignore = async (id: string) => {
    await apiUpdateSourcingLeadStatus(id, 'ignore')
    load()
  }

  if (!leads) {
    return (
      <div className="page">
        <div className="container">
          <Loading />
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <div className="container">
        <FadeUp eager>
          <header
            className="page-header"
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}
          >
            <div>
              <p className="eyebrow">Espace agent de terrain</p>
              <h1>Veille</h1>
              <p>
                Journalisez un signal repéré en ligne ou sur le terrain — un profil
                potentiel ou un besoin d’entreprise. Rien n’est publié tant que
                vous n’avez pas vérifié vous-même.
              </p>
            </div>
            <Button size="sm" onClick={() => setShowForm((s) => !s)}>
              <Radar size={16} />
              {showForm ? 'Fermer' : 'Nouvelle piste'}
            </Button>
          </header>
        </FadeUp>

        {showForm && (
          <Card style={{ marginBottom: '1.5rem' }}>
            <form onSubmit={handleSubmit}>
              <Field label="Type de piste">
                <Select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value as SourcingLeadType })}
                >
                  <option value="talent">Profil potentiel (personne à approcher)</option>
                  <option value="opportunity">Besoin d’une entreprise (offre potentielle)</option>
                </Select>
              </Field>
              <Field label="Source" hint="D’où vient le signal — groupe Facebook, affiche de quartier, bouche-à-oreille…">
                <Input
                  required
                  value={form.source}
                  onChange={(e) => setForm({ ...form, source: e.target.value })}
                  placeholder="Ex. Groupe Facebook « Bâtiment Antananarivo »"
                />
              </Field>
              <Field label="Lien (optionnel)">
                <Input
                  type="url"
                  value={form.sourceUrl}
                  onChange={(e) => setForm({ ...form, sourceUrl: e.target.value })}
                  placeholder="https://…"
                />
              </Field>
              <Field label="Métier concerné">
                <Input
                  required
                  value={form.trade}
                  onChange={(e) => setForm({ ...form, trade: e.target.value })}
                  placeholder="Ex. Plombier"
                />
              </Field>
              <Field label="Secteur">
                <Select value={form.sector} onChange={(e) => setForm({ ...form, sector: e.target.value as Sector })}>
                  {SECTORS.map((s) => (
                    <option key={s} value={s}>
                      {SECTOR_LABELS[s]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Province">
                <Select
                  value={form.province}
                  onChange={(e) => setForm({ ...form, province: e.target.value, city: e.target.value })}
                >
                  {PROVINCES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Ville / quartier">
                <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
              </Field>
              <Field label="Description" hint="Ce que vous avez repéré, pour vous en souvenir au moment du contact.">
                <Textarea
                  required
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </Field>
              {error && <p style={{ color: 'var(--color-danger)', fontSize: '0.9rem' }}>{error}</p>}
              <Button type="submit" fullWidth>
                Enregistrer la piste
              </Button>
            </form>
          </Card>
        )}

        {leads.length === 0 ? (
          <EmptyState
            icon={Radar}
            title="Aucune piste pour l’instant"
            description="Journalisez un signal repéré en ligne ou sur le terrain pour commencer."
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {leads.map((lead) => (
              <Card key={lead.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.25rem' }}>
                      {lead.type === 'talent' ? <UserRound size={15} /> : <Briefcase size={15} />}
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-ink-muted)' }}>
                        {TYPE_LABELS[lead.type]}
                      </span>
                    </div>
                    <strong style={{ color: 'var(--color-ink)' }}>
                      {lead.trade} · {SECTOR_LABELS[lead.sector]}
                    </strong>
                    <p style={{ fontSize: '0.85rem', color: 'var(--color-ink-muted)' }}>
                      {lead.city} · Source : {lead.source}
                      {lead.sourceUrl && (
                        <>
                          {' · '}
                          <a href={lead.sourceUrl} target="_blank" rel="noreferrer">
                            Voir le lien
                          </a>
                        </>
                      )}
                    </p>
                    <p style={{ fontSize: '0.85rem', color: 'var(--color-ink-muted)', fontStyle: 'italic' }}>
                      « {lead.description} »
                    </p>
                  </div>
                  <Badge variant={STATUS_VARIANT[lead.status]}>{STATUS_LABELS[lead.status]}</Badge>
                </div>
                {lead.status !== 'converti' && lead.status !== 'ignore' && (
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
                    {lead.status === 'nouveau' && (
                      <Button size="sm" variant="ghost" onClick={() => markContacted(lead.id)}>
                        Marquer contact engagé
                      </Button>
                    )}
                    {lead.type === 'talent' ? (
                      <Link to={`/agent/talents/nouveau?fromSourcingLead=${lead.id}`}>
                        <Button size="sm">Créer le profil vérifié</Button>
                      </Link>
                    ) : (
                      <Button size="sm" onClick={() => markConverted(lead.id)}>
                        Marquer convertie (entreprise inscrite)
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => ignore(lead.id)}>
                      Non retenue
                    </Button>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
