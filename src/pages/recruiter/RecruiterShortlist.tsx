import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, ShieldCheck, Sparkles, X } from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Input } from '../../components/ui/Form'
import { Loading } from '../../components/ui/Loading'
import { VerificationBadge } from '../../components/ui/VerificationBadge'
import { EndorsementItem, jobMonth } from '../../components/trust/EndorsementItem'
import { TrustLevelBadge } from '../../components/trust/TrustLevelBadge'
import { InterviewScheduleModal } from '../../components/interview/InterviewScheduleModal'
import { TALENT_STATUS_LABELS } from '../../data/endorsements'
import { useApp } from '../../context/AppContext'
import { formatDate } from '../../lib/format'
import './RecruiterShortlist.css'
import { ApiError, apiCreatePlacement, apiShortlist, type Shortlist, type ShortlistMatched } from '../../lib/api'
import type { MatchSuggestionStatus } from '../../types'

/** Seuls statuts que le serveur transmet au recruteur — mêmes libellés que
 *  « Candidats proposés ». Une suggestion en attente de validation
 *  (`suggeree`) ne lui parvient jamais. */
const SUGGESTION_STATUS_LABELS: Partial<Record<MatchSuggestionStatus, string>> = {
  proposee_recruteur: 'Nouveau profil proposé',
  interet_recruteur: 'Intérêt marqué',
  mise_en_relation: 'Mis en relation',
}

type Feedback = { ok: boolean; text: string }

function errorText(err: unknown, fallback: string): string {
  return err instanceof ApiError && err.message ? err.message : fallback
}

/**
 * Combine les candidats diplômés matchés par IA et les talents non-diplômés
 * proposés par un agent, avec un badge de provenance toujours visible —
 * les deux ne sont jamais présentés comme équivalents (cahier §7.3 règle 17).
 *
 * « Ce profil m'intéresse » suit le parcours en vigueur depuis la décision
 * 2026-10-14 : la modale `InterviewScheduleModal` fixe un entretien
 * (`POST /match-suggestions/:id/interview`), ce qui met en relation, comme
 * dans « Candidats proposés ». Toute erreur du serveur est affichée.
 */
export function RecruiterShortlist() {
  const { id = '' } = useParams()
  const { declineSuggestion, refreshDossiers } = useApp()
  const [data, setData] = useState<Shortlist | null>(null)
  const [salary, setSalary] = useState<Record<string, string>>({})
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [error, setError] = useState('')
  const [scheduling, setScheduling] = useState<ShortlistMatched | null>(null)
  /** Action en cours (clé `decline:<id>` / `place:<id>`) : évite le double clic. */
  const [busy, setBusy] = useState<string | null>(null)

  const load = () => {
    setError('')
    apiShortlist(id)
      .then(setData)
      .catch(() => setError('Impossible de charger la shortlist.'))
  }

  useEffect(load, [id])

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

  if (!data) {
    return (
      <div className="page">
        <div className="container">
          <Loading />
        </div>
      </div>
    )
  }

  /** Relit la shortlist et les dossiers partagés (« Candidats proposés »). */
  const reloadAll = async () => {
    load()
    await refreshDossiers()
  }

  const openScheduling = (m: ShortlistMatched) => {
    setFeedback(null)
    setScheduling(m)
  }

  const handleScheduled = async (text: string) => {
    setScheduling(null)
    setFeedback({ ok: true, text })
    await reloadAll()
  }

  const handleDecline = async (m: ShortlistMatched) => {
    if (busy) return
    setBusy(`decline:${m.suggestionId}`)
    setFeedback(null)
    const result = await declineSuggestion(m.suggestionId)
    setBusy(null)
    if (!result.ok) {
      setFeedback({ ok: false, text: result.error ?? 'Action impossible. Réessayez.' })
      load()
      return
    }
    setFeedback({ ok: true, text: `Profil de ${m.fullName} écarté.` })
    load()
  }

  const salaryOf = (key: string) => (salary[key] ? Number(salary[key]) : undefined)

  const declarePlacement = async (key: string, input: { candidateId?: string; talentId?: string }) => {
    if (busy) return
    const amount = salaryOf(key)
    if (amount !== undefined && (!Number.isFinite(amount) || amount <= 0)) {
      setFeedback({ ok: false, text: 'Indiquez un salaire mensuel positif, ou laissez le champ vide.' })
      return
    }
    setBusy(`place:${key}`)
    setFeedback(null)
    try {
      await apiCreatePlacement({ opportunityId: id, ...input, monthlySalaryAr: amount })
      setFeedback({ ok: true, text: 'Placement enregistré. Suivez le success fee depuis « Placements ».' })
    } catch (err) {
      setFeedback({ ok: false, text: errorText(err, 'Déclaration du placement impossible. Réessayez.') })
    } finally {
      setBusy(null)
    }
  }

  const matched = data.matched.filter((m) => SUGGESTION_STATUS_LABELS[m.status])

  return (
    <div className="page">
      <div className="container">
        <Link to="/recruteur/offres" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', marginBottom: '1rem' }}>
          <ArrowLeft size={16} aria-hidden />
          Retour à mes offres
        </Link>
        <header className="page-header">
          <h1>Shortlist</h1>
          <p>Profils vérifiés humainement par un agent et profils proposés par OffRec — jamais de contact direct, jamais confondus.</p>
        </header>

        {!scheduling && feedback && (
          <p className={`rsl-feedback ${feedback.ok ? 'is-ok' : 'is-error'}`} role={feedback.ok ? 'status' : 'alert'}>
            {feedback.text}
          </p>
        )}

        <h2 style={{ fontSize: '1.05rem', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <ShieldCheck size={18} />
          Vérifiés humainement ({data.proposed.length})
        </h2>
        {data.proposed.length > 0 && (
          <p className="rsl-explain">
            Classés par adéquation à l’offre. À adéquation égale, la confiance (recommandations vérifiées par un agent)
            départage. Les deux scores ne sont jamais additionnés.
          </p>
        )}
        {data.proposed.length === 0 ? (
          <p style={{ color: 'var(--color-ink-muted)', marginBottom: '1.5rem' }}>
            Aucun talent proposé par un agent pour cette offre pour l’instant.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
            {data.proposed.map((p) => (
              <Card key={p.talentId} className="rsl-talent">
                <div className="rsl-talent-head">
                  <div className="rsl-talent-main">
                    <strong>{p.fullName}</strong>
                    <VerificationBadge kind="human" subtitle="par un agent de terrain" />
                    <p className="rsl-muted">
                      {p.trade} · {p.district ? `${p.district}, ` : ''}
                      {p.city} · {TALENT_STATUS_LABELS[p.status]}
                    </p>
                  </div>
                  <div className="rsl-talent-actions">
                    <div style={{ width: 130 }}>
                      <Input
                        type="number"
                        min={1}
                        placeholder="Salaire Ar"
                        aria-label={`Salaire mensuel de ${p.fullName} (Ar)`}
                        value={salary[p.talentId] ?? ''}
                        onChange={(e) => setSalary((s) => ({ ...s, [p.talentId]: e.target.value }))}
                      />
                    </div>
                    <Button
                      size="sm"
                      disabled={busy !== null}
                      onClick={() => declarePlacement(p.talentId, { talentId: p.talentId })}
                    >
                      Déclarer un placement
                    </Button>
                  </div>
                </div>

                <div className="rsl-scores">
                  <div className="rsl-score rsl-score-match">
                    <span className="rsl-score-label">Adéquation à l’offre</span>
                    <span className="rsl-score-value">{p.match.score} %</span>
                    {p.match.reasons.length > 0 && <span className="rsl-score-note">{p.match.reasons.slice(0, 2).join(' · ')}</span>}
                  </div>
                  <div className="rsl-score rsl-score-trust">
                    <span className="rsl-score-label">Confiance</span>
                    <TrustLevelBadge level={p.trust.level} index={p.trust.index} />
                    <span className="rsl-score-note">
                      {p.trust.recommendationCount === 0
                        ? 'Pas encore de recommandation'
                        : `${p.trust.independentSources} source${p.trust.independentSources > 1 ? 's' : ''} indépendante${p.trust.independentSources > 1 ? 's' : ''} · ${p.trust.recommendationCount} recommandation${p.trust.recommendationCount > 1 ? 's' : ''}`}
                    </span>
                  </div>
                </div>

                <p className="rsl-verif">
                  {p.verification
                    ? `Vérifié par l’agent le ${formatDate(p.verification.verifiedAt)} : ${p.verification.validated} point${p.verification.validated > 1 ? 's' : ''} validé${p.verification.validated > 1 ? 's' : ''} sur ${p.verification.total} (grille « ${p.verification.trade} »).`
                    : 'Vérification de la grille métier en cours.'}
                </p>

                {p.endorsements.length > 0 && (
                  <details className="rsl-endorsements">
                    <summary>Voir les recommandations ({p.endorsements.length})</summary>
                    <ul className="rsl-reasons">
                      {p.trust.reasons.map((r) => (
                        <li key={r}>{r}</li>
                      ))}
                      {p.trust.warnings.map((w) => (
                        <li key={w} className="rsl-warning">
                          {w}
                        </li>
                      ))}
                    </ul>
                    <div className="rsl-endorsement-list">
                      {p.endorsements.map((e) => (
                        <EndorsementItem
                          key={e.id}
                          author={e.authorLabel}
                          meta={`Travail de ${jobMonth(e.jobDate)}`}
                          jobLabel={e.jobLabel}
                          highlights={e.highlights}
                          proofVerified={e.proofVerified}
                        />
                      ))}
                    </div>
                  </details>
                )}
              </Card>
            ))}
          </div>
        )}

        <h2 style={{ fontSize: '1.05rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Sparkles size={18} />
          Proposés par OffRec ({matched.length})
        </h2>
        {matched.length > 0 && (
          <p className="rsl-explain">
            « Ce profil m’intéresse » fixe un entretien : OffRec vous met en relation, prévient le candidat et transmet
            le lien de visio à chacun. L’entretien se suit ensuite dans « Candidats proposés ».
          </p>
        )}
        {matched.length === 0 ? (
          <p style={{ color: 'var(--color-ink-muted)' }}>Aucun candidat diplômé proposé pour l’instant.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {matched.map((m) => {
              const canSchedule = m.status === 'proposee_recruteur' || m.status === 'interet_recruteur'
              return (
                <Card key={m.candidateId}>
                  <div className="rsl-matched">
                    <div className="rsl-matched-main">
                      <strong>{m.fullName || 'Candidat'}</strong>
                      <VerificationBadge kind="ai" subtitle={`${m.match.score}% de compatibilité`} />
                      <p className="rsl-muted">{m.match.reasons.slice(0, 2).join(' · ')}</p>
                      <Badge variant={m.status === 'mise_en_relation' ? 'success' : 'muted'}>
                        {SUGGESTION_STATUS_LABELS[m.status]}
                      </Badge>
                    </div>
                    <div className="rsl-matched-actions">
                      {canSchedule && (
                        <>
                          <Button size="sm" disabled={busy !== null} aria-haspopup="dialog" onClick={() => openScheduling(m)}>
                            <Sparkles size={14} aria-hidden />
                            Ce profil m’intéresse
                          </Button>
                          <Button variant="outline" size="sm" disabled={busy !== null} onClick={() => handleDecline(m)}>
                            <X size={14} aria-hidden />
                            Écarter
                          </Button>
                        </>
                      )}
                      {m.status === 'mise_en_relation' && (
                        <Link to="/recruteur/candidatures" className="rsl-follow">
                          Suivre dans « Candidats proposés »
                          <ArrowRight size={14} aria-hidden />
                        </Link>
                      )}
                      <div className="rsl-place">
                        <div style={{ width: 130 }}>
                          <Input
                            type="number"
                            min={1}
                            placeholder="Salaire Ar"
                            aria-label={`Salaire mensuel de ${m.fullName || 'ce candidat'} (Ar)`}
                            value={salary[m.candidateId] ?? ''}
                            onChange={(e) => setSalary((s) => ({ ...s, [m.candidateId]: e.target.value }))}
                          />
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={busy !== null}
                          onClick={() => declarePlacement(m.candidateId, { candidateId: m.candidateId })}
                        >
                          Déclarer un placement
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        )}

        {scheduling && (
          <InterviewScheduleModal
            mode="schedule"
            suggestionId={scheduling.suggestionId}
            candidateName={scheduling.fullName || 'ce candidat'}
            opportunityTitle={data.opportunity.title}
            onClose={() => setScheduling(null)}
            onDone={handleScheduled}
          />
        )}
      </div>
    </div>
  )
}
