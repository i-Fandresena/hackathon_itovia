import { Sparkles, Users, X } from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { useApp } from '../../context/AppContext'
import type { MatchSuggestionStatus } from '../../types'

const STATUS_LABELS: Record<MatchSuggestionStatus, string> = {
  proposee_candidat: 'Proposé au candidat',
  interet_candidat: 'Candidat intéressé',
  proposee_recruteur: 'Nouveau profil proposé',
  interet_recruteur: 'Vous avez marqué un intérêt',
  mise_en_relation: 'Mis en relation',
  ecartee: 'Écarté',
}

const STATUS_VARIANT: Record<MatchSuggestionStatus, 'muted' | 'primary' | 'success'> = {
  proposee_candidat: 'muted',
  interet_candidat: 'muted',
  proposee_recruteur: 'primary',
  interet_recruteur: 'primary',
  mise_en_relation: 'success',
  ecartee: 'muted',
}

/**
 * OffRec est l'intermédiaire (décision produit 2026-09-02) : plus de
 * candidature directe, plus de contact direct — le recruteur ne fait que
 * marquer un intérêt sur les profils qu'OffRec lui propose ; c'est
 * l'admin qui débloque ensuite le contact.
 */
export function RecruiterApplications() {
  const { receivedSuggestions, hydrated, expressInterest, declineSuggestion } = useApp()

  if (!hydrated) return null

  return (
    <div className="page">
      <div className="container">
        <header className="page-header">
          <h1>Candidats proposés</h1>
          <p>Profils sélectionnés par OffRec pour vos offres — jamais de contact direct tant qu’une mise en relation n’est pas confirmée.</p>
        </header>

        {receivedSuggestions.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Aucun candidat proposé pour l’instant"
            description="OffRec vous proposera des profils dès qu’une correspondance pertinente sera identifiée."
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {receivedSuggestions.map((s) => (
              <Card key={s.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                  <div>
                    <strong>{s.candidate.candidateProfile?.fullName ?? s.candidate.email}</strong>
                    <p className="app-offer-title">Offre : {s.opportunity.title}</p>
                    {s.reasons.length > 0 && (
                      <p style={{ fontSize: '0.85rem', color: 'var(--color-ink-muted)', marginTop: '0.35rem' }}>
                        {s.reasons.slice(0, 2).join(' · ')}
                      </p>
                    )}
                  </div>
                  <Badge variant={STATUS_VARIANT[s.status]}>{STATUS_LABELS[s.status]}</Badge>
                </div>
                {(s.status === 'proposee_recruteur' || s.status === 'interet_recruteur') && (
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                    {s.status === 'proposee_recruteur' && (
                      <Button size="sm" onClick={() => expressInterest(s.id)}>
                        <Sparkles size={14} />
                        Ce profil m’intéresse
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={() => declineSuggestion(s.id)}>
                      <X size={14} />
                      Écarter
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
