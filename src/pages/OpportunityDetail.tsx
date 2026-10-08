import { ArrowLeft, Building2, FolderX, MapPin, Send } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { WithdrawDossierButton } from '../components/candidate/WithdrawDossierButton'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { EmptyState } from '../components/ui/EmptyState'
import { MatchScore } from '../components/ui/MatchScore'
import { ReportButton } from '../components/ui/ReportButton'
import {
  EXPERIENCE_LABELS,
  OPPORTUNITY_TYPE_LABELS,
  SECTOR_DETAIL_LABELS,
} from '../data/constants'
import { useApp } from '../context/AppContext'
import { toDisplayOpportunity } from '../lib/api'
import { canWithdrawFromDossier, dossierStatusInfo } from '../lib/candidateDossier'
import { formatDate } from '../lib/format'
import './OpportunityDetail.css'

interface OpportunityDetailProps {
  backLabel: string
  backTo: string
  /**
   * Espace candidat (`/candidat/offres/:id`) : la page affiche un DOSSIER,
   * lu exclusivement dans `mySuggestions` — jamais dans la liste publique
   * `opportunities`, qui porte le nom de l'entreprise. Ce nom n'apparaît
   * qu'une fois la mise en relation confirmée par OffRec.
   */
  candidate?: boolean
}

export function OpportunityDetail({ backLabel, backTo, candidate }: OpportunityDetailProps) {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { opportunities, getSuggestionForOpportunity, expressInterest } = useApp()
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null)
  const [withdrawnTitle, setWithdrawnTitle] = useState('')

  const suggestion = candidate && id ? getSuggestionForOpportunity(id) : undefined
  const opportunity = candidate
    ? suggestion && toDisplayOpportunity(suggestion.opportunity)
    : opportunities.find((o) => o.id === id)

  const backLink = (
    <button type="button" className="back-link" onClick={() => navigate(backTo)}>
      <ArrowLeft size={18} />
      {backLabel}
    </button>
  )

  if (!opportunity) {
    return (
      <div className="page">
        <div className="container" style={{ maxWidth: 720 }}>
          {backLink}
          <div className="detail-missing">
            {candidate ? (
              <EmptyState
                icon={withdrawnTitle ? Send : FolderX}
                title={withdrawnTitle ? 'Vous vous êtes retiré·e de ce dossier' : 'Dossier introuvable'}
                description={
                  withdrawnTitle
                    ? `Le dossier « ${withdrawnTitle} » est clos. Votre profil reste proposé pour les autres offres qui vous correspondent.`
                    : 'Ce dossier n’est plus en cours : il a pu être clos par OffRec, par l’entreprise ou par vous-même.'
                }
                actionLabel="Voir mes dossiers"
                onAction={() => navigate(backTo)}
              />
            ) : (
              <p>Offre introuvable.</p>
            )}
          </div>
        </div>
      </div>
    )
  }

  const status = suggestion ? dossierStatusInfo(suggestion.status) : null
  // Le nom de l'entreprise n'est affiché au candidat qu'à la mise en relation.
  const showCompany = !candidate || suggestion?.status === 'mise_en_relation'

  // Ligne héritée de l'ancien parcours : seul cas où le candidat signale
  // encore son intérêt (le serveur refuse tous les autres statuts).
  const handleLegacyInterest = async () => {
    if (!suggestion) return
    const result = await expressInterest(suggestion.id)
    setFeedback(
      result.ok
        ? { ok: true, text: 'Votre intérêt a été transmis à OffRec.' }
        : { ok: false, text: result.error ?? 'Envoi impossible.' },
    )
  }

  return (
    <div className="page">
      <div className="container" style={{ maxWidth: 720 }}>
        {backLink}

        <header className="page-header detail-header">
          <h1>{opportunity.title}</h1>
          {showCompany && opportunity.companyName && (
            <p className="detail-company">
              {candidate && <Building2 size={16} aria-hidden />}
              {opportunity.companyName}
            </p>
          )}
          {!showCompany && <p>Le nom de l’entreprise vous est communiqué à la mise en relation.</p>}
        </header>

        <div className="detail-badges">
          <Badge variant="primary">{opportunity.category}</Badge>
          <Badge variant="muted">{OPPORTUNITY_TYPE_LABELS[opportunity.opportunityType]}</Badge>
          <Badge variant="muted">{EXPERIENCE_LABELS[opportunity.level]}</Badge>
        </div>

        <p className="opp-location detail-location">
          <MapPin size={16} />
          {opportunity.city}, {opportunity.province} · Date limite : {formatDate(opportunity.deadline)}
        </p>

        <div className="detail-report">
          <ReportButton targetType="opportunity" targetId={opportunity.id} />
        </div>

        {suggestion && status && (
          <Card className="detail-dossier">
            <div className="detail-dossier-head">
              <h2>État de votre dossier</h2>
              <Badge variant={status.variant}>{status.label}</Badge>
            </div>
            <p className="detail-dossier-text">{status.description}</p>

            <div className="detail-dossier-actions">
              {suggestion.status === 'proposee_candidat' && (
                <Button size="sm" onClick={handleLegacyInterest}>
                  Cette offre m’intéresse
                </Button>
              )}
              {canWithdrawFromDossier(suggestion.status) && (
                <WithdrawDossierButton
                  suggestionId={suggestion.id}
                  opportunityTitle={opportunity.title}
                  onWithdrawn={setWithdrawnTitle}
                />
              )}
            </div>
            {suggestion.status === 'proposee_candidat' && (
              <p className="detail-dossier-note">
                Si vous signalez votre intérêt, OffRec étudie la transmission de votre profil à
                l’entreprise — pas de message à rédiger.
              </p>
            )}
            {suggestion.status === 'mise_en_relation' && (
              <p className="detail-dossier-note">
                Une fois la mise en relation confirmée, vous ne pouvez plus vous retirer de ce
                dossier depuis la plateforme.
              </p>
            )}
            {feedback && (
              <p className={`detail-feedback ${feedback.ok ? 'is-ok' : 'is-error'}`} role="status">
                {feedback.text}
              </p>
            )}
          </Card>
        )}

        {suggestion && (
          <div className="detail-match">
            <p className="detail-rec-label">Pourquoi votre profil a été proposé</p>
            <MatchScore match={{ score: suggestion.score, reasons: suggestion.reasons }} />
          </div>
        )}

        <Card className="detail-description">
          <h2>Description</h2>
          <p className="detail-description-text">{opportunity.description}</p>
          <h3>Compétences recherchées</h3>
          <div className="detail-badges">
            {opportunity.requiredSkills.map((s) => (
              <Badge key={s} variant="primary">
                {s}
              </Badge>
            ))}
          </div>
          {opportunity.sectorDetails && Object.keys(opportunity.sectorDetails).length > 0 && (
            <>
              <h3>Détails</h3>
              <dl className="detail-facts">
                {Object.entries(opportunity.sectorDetails).map(([key, value]) => {
                  if (value === '' || value === false) return null
                  return (
                    <div key={key}>
                      <dt>{SECTOR_DETAIL_LABELS[key] ?? key}</dt>
                      <dd>{value === true ? 'Oui' : value}</dd>
                    </div>
                  )
                })}
              </dl>
            </>
          )}
        </Card>

        {!candidate && (
          <Link to="/inscription">
            <Button>Créer un compte pour être recommandé·e</Button>
          </Link>
        )}
      </div>
    </div>
  )
}
