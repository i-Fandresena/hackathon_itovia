import { useMemo } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, MapPin, MessageCircle, Phone } from 'lucide-react'
import { RecommendationItem } from '../../components/provider/RecommendationItem'
import { TrustBadge } from '../../components/provider/TrustBadge'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Loading } from '../../components/ui/Loading'
import { ReportButton } from '../../components/ui/ReportButton'
import { useApp } from '../../context/AppContext'
import { formatAriary } from '../../lib/format'
import { evaluateProvider } from '../../lib/trust'
import './Directory.css'

/** wa.me n'accepte que les chiffres. */
function whatsappHref(number: string): string {
  return `https://wa.me/${number.replace(/\D/g, '')}`
}

export function ProviderDetail() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const {
    hydrated,
    getProvider,
    recommendations,
    membersById,
    currentMemberId,
    canRecommendProvider,
    toggleConfirmation,
    hasConfirmed,
  } = useApp()

  const provider = getProvider(id)

  const trust = useMemo(
    () =>
      provider
        ? evaluateProvider(provider, recommendations, membersById)
        : null,
    [provider, recommendations, membersById],
  )

  const providerRecs = useMemo(
    () =>
      recommendations
        .filter((r) => r.providerId === id)
        .sort((a, b) => Date.parse(b.jobDate) - Date.parse(a.jobDate)),
    [recommendations, id],
  )

  if (!hydrated) {
    return (
      <div className="page">
        <div className="container">
          <Loading />
        </div>
      </div>
    )
  }

  if (!provider || !trust) {
    return (
      <div className="page">
        <div className="container">
          <p>Prestataire introuvable.</p>
          <Link to="/annuaire">Retour à l’annuaire</Link>
        </div>
      </div>
    )
  }

  const guard = canRecommendProvider(provider.id)

  return (
    <div className="page">
      <div className="container dir-detail">
        <Link to="/annuaire" className="dir-back">
          <ArrowLeft size={16} aria-hidden />
          Retour à l’annuaire
        </Link>

        <Card className="dir-hero">
          <div className="dir-hero-top">
            <div>
              <p className="dir-trade">{provider.trade}</p>
              <h1>{provider.name}</h1>
              <p className="dir-location">
                <MapPin size={14} aria-hidden />
                {provider.district}, {provider.city}
              </p>
            </div>
            <TrustBadge trust={trust} />
          </div>

          <p className="dir-desc">{provider.description}</p>

          {trust.price && (
            <div className="dir-price">
              <span className="dir-price-label">Prix constaté par les membres</span>
              <strong>
                {formatAriary(trust.price.median)} {trust.price.unit}
              </strong>
              <span className="dir-price-note">
                médiane sur {trust.price.sampleSize} retour
                {trust.price.sampleSize > 1 ? 's' : ''} — à titre indicatif,
                négociez sur cette base
              </span>
            </div>
          )}

          {trust.reasons.length > 0 && (
            <ul className="prov-reasons">
              {trust.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          )}

          {trust.warnings.map((w) => (
            <p key={w} className="prov-warning">
              <AlertTriangle size={14} aria-hidden />
              {w}
            </p>
          ))}

          <div className="dir-contact">
            <a className="dir-contact-btn" href={`tel:${provider.phone.replace(/\s/g, '')}`}>
              <Phone size={16} aria-hidden />
              {provider.phone}
            </a>
            {provider.whatsapp && (
              <a
                className="dir-contact-btn dir-contact-wa"
                href={whatsappHref(provider.whatsapp)}
                target="_blank"
                rel="noreferrer"
              >
                <MessageCircle size={16} aria-hidden />
                WhatsApp
              </a>
            )}
            {provider.claimedByMemberId && (
              <Badge variant="primary">Fiche revendiquée par le prestataire</Badge>
            )}
          </div>
          <div style={{ marginTop: '0.75rem' }}>
            <ReportButton targetType="provider" targetId={provider.id} />
          </div>
        </Card>

        <section className="dir-section">
          <div className="section-head-row">
            <div>
              <h2 className="section-title">
                {providerRecs.length} recommandation
                {providerRecs.length > 1 ? 's' : ''}
              </h2>
              <p className="section-sub">
                Chaque retour est rattaché à un chantier daté. Les plus anciens
                pèsent moins dans le score.
              </p>
            </div>
            <Button
              onClick={() => navigate(`/annuaire/${provider.id}/recommander`)}
              disabled={Boolean(currentMemberId) && !guard.ok}
            >
              Publier mon retour
            </Button>
          </div>

          {currentMemberId && !guard.ok && (
            <p className="dir-guard">{guard.error}</p>
          )}

          {providerRecs.length === 0 ? (
            <Card>
              <p className="dir-empty-recs">
                Personne n’a encore partagé d’expérience avec ce prestataire.
                Cette fiche n’est donc pas une garantie — c’est juste un contact.
              </p>
            </Card>
          ) : (
            <div className="rec-list">
              {providerRecs.map((rec) => (
                <RecommendationItem
                  key={rec.id}
                  recommendation={rec}
                  author={membersById.get(rec.authorMemberId)}
                  excluded={rec.authorMemberId === provider.claimedByMemberId}
                  canConfirm={
                    Boolean(currentMemberId) && rec.authorMemberId !== currentMemberId
                  }
                  confirmed={hasConfirmed(rec.id)}
                  onConfirm={() => toggleConfirmation(rec.id)}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
