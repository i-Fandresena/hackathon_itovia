import { Sparkles, Users, X } from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { MatchFitDetail } from '../../components/matching/MatchFitDetail'
import { useApp } from '../../context/AppContext'
import type { ReceivedSuggestion } from '../../lib/api'
import type { MatchSuggestionStatus } from '../../types'
import './RecruiterApplications.css'

/** Seuls statuts que le serveur transmet au recruteur : une suggestion en
 *  attente de validation (`suggeree`), héritée ou écartée ne lui parvient
 *  jamais, et ne s'affiche donc pas. */
const STATUS_DISPLAY: Partial<Record<MatchSuggestionStatus, { label: string; variant: 'primary' | 'success' }>> = {
  proposee_recruteur: { label: 'Nouveau profil proposé', variant: 'primary' },
  interet_recruteur: { label: 'Vous avez marqué un intérêt', variant: 'primary' },
  mise_en_relation: { label: 'Mis en relation', variant: 'success' },
}

function ordinal(rank: number): string {
  return rank === 1 ? '1er' : `${rank}e`
}

/** Regroupe par offre (ordre alphabétique des titres), meilleurs scores d'abord. */
function groupByOffer(suggestions: ReceivedSuggestion[]) {
  const groups = new Map<string, { id: string; title: string; items: ReceivedSuggestion[] }>()
  for (const s of suggestions) {
    const group = groups.get(s.opportunity.id) ?? { id: s.opportunity.id, title: s.opportunity.title, items: [] }
    group.items.push(s)
    groups.set(s.opportunity.id, group)
  }
  return [...groups.values()]
    .sort((a, b) => a.title.localeCompare(b.title, 'fr') || a.id.localeCompare(b.id))
    .map((group) => ({ ...group, items: group.items.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id)) }))
}

/**
 * OffRec est l'intermédiaire (décisions produit 2026-09-02 / 2026-10-08) :
 * les candidats ne postulent pas, c'est OffRec qui propose leur profil. Le
 * recruteur ne fait que marquer un intérêt ou écarter ; c'est l'admin qui
 * confirme ensuite la mise en relation. Chaque profil est présenté avec son
 * adéquation à l'offre, critère par critère (calculée par le serveur).
 */
export function RecruiterApplications() {
  const { receivedSuggestions: received, hydrated, expressInterest, declineSuggestion } = useApp()

  if (!hydrated) return null

  const groups = groupByOffer(received.filter((s) => STATUS_DISPLAY[s.status]))

  return (
    <div className="page">
      <div className="container">
        <header className="page-header">
          <h1>Candidats proposés</h1>
          <p>Profils présélectionnés par OffRec pour vos offres, classés par adéquation : marquez votre intérêt ou écartez. Le contact n’est ouvert qu’une fois la mise en relation confirmée par OffRec.</p>
        </header>

        {groups.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Aucun candidat proposé pour l’instant"
            description="OffRec vous proposera des profils dès qu’une correspondance pertinente sera identifiée."
          />
        ) : (
          groups.map((group) => (
            <section key={group.id} className="rapp-group">
              <h2 className="rapp-group-title">
                {group.title}
                <span className="rapp-group-count">
                  {group.items.length} profil{group.items.length > 1 ? 's' : ''}
                </span>
              </h2>
              <div className="rapp-list">
                {group.items.map((s) => (
                  <Card key={s.id} className="rapp-card">
                    <div className="rapp-head">
                      <div className="rapp-id">
                        <strong>{s.candidate.candidateProfile?.fullName ?? s.candidate.email}</strong>
                        {s.preselectionRank != null && (
                          <p className="rapp-rank">{ordinal(s.preselectionRank)} profil de la présélection OffRec</p>
                        )}
                      </div>
                      <div className="rapp-head-side">
                        <Badge variant={STATUS_DISPLAY[s.status]?.variant}>{STATUS_DISPLAY[s.status]?.label}</Badge>
                        <span className="rapp-score" title="Adéquation avec votre offre">
                          {s.score}%
                        </span>
                      </div>
                    </div>

                    {s.fit ? (
                      <MatchFitDetail fit={s.fit} />
                    ) : (
                      s.reasons.length > 0 && <p className="rapp-note">{s.reasons.slice(0, 2).join(' · ')}</p>
                    )}

                    {s.status === 'interet_recruteur' && (
                      <p className="rapp-note">OffRec organise la mise en relation et revient vers vous.</p>
                    )}
                    {(s.status === 'proposee_recruteur' || s.status === 'interet_recruteur') && (
                      <div className="rapp-actions">
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
            </section>
          ))
        )}
      </div>
    </div>
  )
}
