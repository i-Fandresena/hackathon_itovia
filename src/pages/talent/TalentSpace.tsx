import { useEffect, useState } from 'react'
import { CheckCircle2, Clock, ShieldCheck } from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Loading } from '../../components/ui/Loading'
import { apiTalentAccountMe, type TalentAccountMe } from '../../lib/api'
import { formatDate } from '../../lib/format'
import type { LeadStatus, TalentStatus } from '../../types'

const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  nouveau: 'Votre demande a bien été reçue',
  contacte: 'Un agent vous a contacté',
  converti: 'Votre profil a été créé — vérification en cours',
  ignore: 'Votre demande n’a pas été retenue',
}

const TALENT_STATUS_LABELS: Record<TalentStatus, string> = {
  en_attente: 'En attente de vérification',
  verifie: 'Vérifié',
  recommande: 'Recommandé à une entreprise',
  place: 'Placé',
}

const TALENT_STATUS_VARIANT: Record<TalentStatus, 'muted' | 'primary' | 'success'> = {
  en_attente: 'muted',
  verifie: 'primary',
  recommande: 'primary',
  place: 'success',
}

/**
 * "Mon espace" — le compte de suivi d'un talent non-diplômé. Lecture
 * seule : ce compte n'a jamais le pouvoir de créer ou modifier son propre
 * TalentProfile, seulement de voir où en est l'agent (§7.3.14).
 */
export function TalentSpace() {
  const [account, setAccount] = useState<TalentAccountMe | null>(null)
  const [error, setError] = useState('')

  const load = () => {
    setError('')
    apiTalentAccountMe()
      .then(setAccount)
      .catch(() => setError('Impossible de charger votre espace.'))
  }

  useEffect(load, [])

  if (error) {
    return (
      <div className="page">
        <div className="container">
          <p style={{ marginBottom: '1rem' }}>{error}</p>
          <Button size="sm" onClick={load}>
            Réessayer
          </Button>
        </div>
      </div>
    )
  }

  if (!account) {
    return (
      <div className="page">
        <div className="container">
          <Loading />
        </div>
      </div>
    )
  }

  const { talent, lead } = account

  return (
    <div className="page">
      <div className="container" style={{ maxWidth: 640 }}>
        <header className="page-header">
          <p className="eyebrow">Mon espace</p>
          <h1>Bonjour {account.fullName.split(' ')[0]}</h1>
          <p>
            Votre profil est vérifié exclusivement par un agent de terrain — cet
            espace vous permet de suivre où en est votre demande, sans rien à
            remplir de votre côté.
          </p>
        </header>

        <Card style={{ marginBottom: '1.25rem' }}>
          {talent ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <ShieldCheck size={20} color="var(--color-accent)" />
                  <strong>Statut de votre profil</strong>
                </div>
                <Badge variant={TALENT_STATUS_VARIANT[talent.status]}>
                  {TALENT_STATUS_LABELS[talent.status]}
                </Badge>
              </div>
              <p style={{ color: 'var(--color-ink-muted)', fontSize: '0.9rem', marginTop: '0.75rem' }}>
                Métier suivi : <strong>{talent.trade}</strong>
              </p>
              {talent.verifications.length > 0 && (
                <div style={{ marginTop: '1rem', borderTop: '1px solid var(--color-border)', paddingTop: '0.75rem' }}>
                  <p style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                    Historique de vérification
                  </p>
                  {talent.verifications.map((v) => (
                    <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', color: 'var(--color-ink-muted)' }}>
                      <CheckCircle2 size={14} />
                      {formatDate(v.verifiedAt)}
                    </div>
                  ))}
                </div>
              )}
              {talent.proposals.length > 0 && (
                <div style={{ marginTop: '1rem', borderTop: '1px solid var(--color-border)', paddingTop: '0.75rem' }}>
                  <p style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                    Opportunités proposées par votre agent
                  </p>
                  {talent.proposals.map((p) => (
                    <div key={p.id} style={{ fontSize: '0.85rem', color: 'var(--color-ink-muted)' }}>
                      {p.opportunity.title} — {p.opportunity.companyName}
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Clock size={20} color="var(--color-ink-muted)" />
              <div>
                <strong>{lead ? LEAD_STATUS_LABELS[lead.status] : 'Demande en cours de traitement'}</strong>
                <p style={{ color: 'var(--color-ink-muted)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                  Un agent de terrain OffRec va vous contacter au {account.phone} pour
                  vérifier votre métier avec la grille de compétences correspondante.
                </p>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
