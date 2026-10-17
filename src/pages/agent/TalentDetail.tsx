import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, Lock, Send } from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Field, Input, Select, Textarea } from '../../components/ui/Form'
import { Loading } from '../../components/ui/Loading'
import { Modal } from '../../components/ui/Modal'
import { EndorsementItem, jobMonth } from '../../components/trust/EndorsementItem'
import { SubjectTrustPanel } from '../../components/trust/SubjectTrustPanel'
import {
  apiAgentReviewEndorsement,
  apiFileUrl,
  apiListOpportunities,
  apiProposeTalent,
  apiTalentDetail,
  apiVerifyTalent,
  ApiError,
  type AgentSignalEndorsement,
  type AgentTalentDetail,
} from '../../lib/api'
import { VERIFICATION_GRIDS } from '../../data/verificationGrids'
import { RELATION_LABELS, TALENT_STATUS_LABELS } from '../../data/endorsements'
import { formatDate } from '../../lib/format'
import type { Opportunity } from '../../types'
import { PublicVisibilityBlock } from './PublicVisibilityBlock'
import './TalentDetail.css'

export function TalentDetail() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const [talent, setTalent] = useState<AgentTalentDetail | null>(null)
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [checklist, setChecklist] = useState<Record<string, boolean>>({})
  const [note, setNote] = useState('')
  const [selectedOpportunity, setSelectedOpportunity] = useState('')
  const [feedback, setFeedback] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [excluding, setExcluding] = useState<AgentSignalEndorsement | null>(null)
  const [reason, setReason] = useState('')

  const load = () => {
    setError('')
    apiTalentDetail(id)
      .then((t) => {
        setTalent(t)
        const grid = VERIFICATION_GRIDS[t.trade] ?? VERIFICATION_GRIDS.default
        setChecklist(Object.fromEntries(grid.map((item) => [item, false])))
      })
      .catch(() => setError('Impossible de charger ce talent.'))
  }

  useEffect(load, [id])
  useEffect(() => {
    apiListOpportunities().then(setOpportunities)
  }, [])

  // Offres triées par adéquation décroissante (score calculé par le serveur).
  const scoredOpportunities = useMemo(() => {
    const scores = new Map((talent?.opportunityMatches ?? []).map((m) => [m.opportunityId, m.score]))
    return opportunities
      .map((o) => ({ opportunity: o, score: scores.get(o.id) ?? null }))
      .sort((a, b) => (b.score ?? -1) - (a.score ?? -1))
  }, [opportunities, talent])

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

  if (!talent) {
    return (
      <div className="page">
        <div className="container">
          <Loading />
        </div>
      </div>
    )
  }

  const run = async (action: () => Promise<unknown>, success: string) => {
    setBusy(true)
    setFeedback('')
    try {
      await action()
      setFeedback(success)
      load()
    } catch (err) {
      setFeedback(err instanceof ApiError ? err.message : 'Action impossible.')
    } finally {
      setBusy(false)
    }
  }

  const handleVerify = async (e: FormEvent) => {
    e.preventDefault()
    await apiVerifyTalent(id, { trade: talent.trade, checklist, note: note.trim() || undefined })
    setFeedback('Vérification enregistrée.')
    setNote('')
    load()
  }

  const handlePropose = async (e: FormEvent) => {
    e.preventDefault()
    if (!selectedOpportunity) return
    await run(() => apiProposeTalent(id, selectedOpportunity), 'Talent proposé pour cette offre.')
    setSelectedOpportunity('')
  }

  const selectedMatch = talent.opportunityMatches.find((m) => m.opportunityId === selectedOpportunity)
  const proposedIds = new Set(talent.proposals.map((p) => p.opportunityId))
  const matchById = new Map(talent.opportunityMatches.map((m) => [m.opportunityId, m.score]))

  return (
    <div className="page">
      <div className="container tdet">
        <Link to="/agent" className="tdet-back">
          <ArrowLeft size={16} aria-hidden />
          Retour à mes talents
        </Link>

        <Card className="tdet-block">
          <div className="tdet-head">
            <div className="tdet-head-main">
              <h1>{talent.fullName}</h1>
              <p className="tdet-muted">
                {talent.trade} · {talent.phone} · {talent.district ? `${talent.district}, ` : ''}
                {talent.city}, {talent.province}
              </p>
            </div>
            <Badge variant="primary">{TALENT_STATUS_LABELS[talent.status]}</Badge>
          </div>
          <p className="tdet-consent">
            {talent.consentAt
              ? `Accord de la personne recueilli le ${formatDate(talent.consentAt)}.`
              : 'Accord non tracé (profil antérieur).'}
          </p>
          {talent.skills.length > 0 && (
            <div className="skill-chips" style={{ marginTop: '0.75rem' }}>
              {talent.skills.map((s) => (
                <span key={s} className="chip">
                  {s}
                </span>
              ))}
            </div>
          )}
          <Button variant="outline" size="sm" style={{ marginTop: '1rem' }} onClick={() => navigate(`/agent/talents/${id}/modifier`)}>
            Modifier les informations
          </Button>
        </Card>

        {feedback && (
          <p className="save-ok" role="status" style={{ marginBottom: '1rem' }}>
            {feedback}
          </p>
        )}

        <Card className="tdet-block">
          <SubjectTrustPanel
            trust={talent.trust}
            footer="Calculée à partir des recommandations : seules les preuves que vous acceptez comptent. Indépendante de l’adéquation à une offre."
          />
        </Card>

        <PublicVisibilityBlock
          talentId={talent.id}
          visibility={talent.publicVisibility}
          preview={talent.publicPreview}
          onChanged={(message) => {
            setFeedback(message)
            load()
          }}
        />

        <h2 className="tdet-section-title">Recommandations ({talent.endorsements.length})</h2>
        {talent.endorsements.length === 0 ? (
          <p className="tdet-muted tdet-section-gap">
            Aucune recommandation rattachée. Celles reçues pour ce numéro de téléphone s’ajouteront ici automatiquement.
          </p>
        ) : (
          <div className="tdet-list tdet-section-gap">
            {talent.endorsements.map((e) => (
              <EndorsementItem
                key={e.id}
                author={`${e.authorRoleLabel} (${e.authorName}) · ${e.authorDistrict}`}
                meta={`${RELATION_LABELS[e.relation]} · travail de ${jobMonth(e.jobDate)} · reçue le ${formatDate(e.createdAt)}`}
                jobLabel={`${e.jobLabel}${e.hiddenJobLabel ? ' (libellé masqué pour les entreprises)' : ''}`}
                highlights={e.highlights}
                proofVerified={e.proofAccepted === true && e.proof !== 'aucune'}
                excluded={Boolean(e.excludedAt)}
                badges={
                  <>
                    {e.excludedAt && <Badge variant="muted">Écartée</Badge>}
                    {e.reviewedAt && !e.excludedAt && <Badge variant="success">Revue</Badge>}
                  </>
                }
              >
                {e.comment && (
                  <p className="tdet-private">
                    <Lock size={12} aria-hidden /> {e.comment}
                  </p>
                )}
                {e.excludedAt && <p className="tdet-muted">Motif : {e.excludedReason}</p>}
                {e.proofFileUrl && (
                  <a className="tdet-proof" href={apiFileUrl(e.proofFileUrl)} target="_blank" rel="noreferrer">
                    <img src={apiFileUrl(e.proofFileUrl)} alt="Photo du travail jointe à la recommandation" loading="lazy" />
                  </a>
                )}
                {!e.excludedAt && (
                  <div className="tdet-actions">
                    {e.proof !== 'aucune' && e.proofAccepted !== true && (
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => run(() => apiAgentReviewEndorsement(e.id, { proofAccepted: true }), 'Preuve acceptée.')}>
                        Accepter la preuve
                      </Button>
                    )}
                    {e.proof !== 'aucune' && e.proofAccepted !== false && (
                      <Button size="sm" variant="ghost" disabled={busy} onClick={() => run(() => apiAgentReviewEndorsement(e.id, { proofAccepted: false }), 'Preuve refusée.')}>
                        Refuser la preuve
                      </Button>
                    )}
                    {!e.reviewedAt && (
                      <Button size="sm" variant="ghost" disabled={busy} onClick={() => run(() => apiAgentReviewEndorsement(e.id, { reviewed: true }), 'Recommandation revue.')}>
                        Marquer comme revue
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      onClick={() =>
                        run(
                          () => apiAgentReviewEndorsement(e.id, { hiddenJobLabel: !e.hiddenJobLabel }),
                          e.hiddenJobLabel ? 'Libellé affiché.' : 'Libellé masqué.',
                        )
                      }
                    >
                      {e.hiddenJobLabel ? 'Afficher le libellé' : 'Masquer le libellé'}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      onClick={() => {
                        setReason('')
                        setExcluding(e)
                      }}
                    >
                      Auteur lié : écarter
                    </Button>
                  </div>
                )}
              </EndorsementItem>
            ))}
          </div>
        )}

        <Card className="tdet-block">
          <h2 className="tdet-card-title">Vérifier les compétences</h2>
          <p className="tdet-muted" style={{ marginBottom: '0.75rem' }}>
            Grille standardisée pour le métier <strong>{talent.trade}</strong> : cochez chaque
            point réellement observé sur le terrain (§7.3 règle 15 — un référentiel commun, pas
            un champ libre).
          </p>
          <form onSubmit={handleVerify}>
            <Field label="Grille de compétences">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {Object.keys(checklist).map((item) => (
                  <label key={item} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
                    <input
                      type="checkbox"
                      checked={checklist[item] ?? false}
                      onChange={(e) => setChecklist((c) => ({ ...c, [item]: e.target.checked }))}
                    />
                    {item}
                  </label>
                ))}
              </div>
            </Field>
            <Field label="Note qualitative (optionnel)">
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
            </Field>
            <Button type="submit">
              <CheckCircle2 size={16} />
              Enregistrer la vérification
            </Button>
          </form>
        </Card>

        <Card className="tdet-block">
          <h2 className="tdet-card-title">Proposer une opportunité</h2>
          <p className="tdet-muted" style={{ marginBottom: '0.75rem' }}>
            Offres triées par adéquation (compétences, province…). La confiance ne sert qu’à départager, chez le
            recruteur, des talents d’adéquation égale : les deux ne sont jamais additionnées.
          </p>
          <form onSubmit={handlePropose} className="tdet-propose">
            <div className="tdet-propose-field">
              <Field label="Offre">
                <Select value={selectedOpportunity} onChange={(e) => setSelectedOpportunity(e.target.value)}>
                  <option value="">Choisir…</option>
                  {scoredOpportunities.map(({ opportunity: o, score }) => (
                    <option key={o.id} value={o.id} disabled={proposedIds.has(o.id)}>
                      {score !== null ? `${score} % · ` : ''}
                      {o.title} — {o.companyName}
                      {proposedIds.has(o.id) ? ' (déjà proposé)' : ''}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <Button type="submit" disabled={!selectedOpportunity || busy}>
              <Send size={16} />
              Proposer
            </Button>
          </form>
          {selectedMatch && (
            <p className="tdet-match">
              <strong>Adéquation à l’offre : {selectedMatch.score} %</strong>
              {selectedMatch.reasons.length > 0 && ` — ${selectedMatch.reasons.slice(0, 2).join(' · ')}`}
            </p>
          )}
          {talent.proposals.length > 0 && (
            <div className="tdet-proposals">
              <h3>Déjà proposé à</h3>
              {talent.proposals.map((p) => (
                <p key={p.id} className="tdet-muted">
                  {p.opportunity.title} — {p.opportunity.companyName} · le {formatDate(p.proposedAt)}
                  {matchById.has(p.opportunityId) ? ` · adéquation ${matchById.get(p.opportunityId)} %` : ''}
                </p>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <h2 className="tdet-card-title">Historique de vérification</h2>
          {talent.verifications.length === 0 ? (
            <p className="tdet-muted">Aucune vérification enregistrée.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {talent.verifications.map((v) => (
                <div key={v.id} style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: '0.5rem' }}>
                  <strong>{v.trade}</strong>
                  <p className="tdet-muted">
                    {formatDate(v.verifiedAt)}
                    {v.note ? ` — ${v.note}` : ''}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Card>

        {excluding && (
          <Modal onClose={() => setExcluding(null)} title="Écarter une recommandation">
            <p className="tdet-muted" style={{ marginBottom: '0.75rem' }}>
              L’auteur est lié à la personne (famille, associé…) : la recommandation reste en base mais ne compte plus.
            </p>
            <Field label="Motif">
              <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex. : frère de la personne" />
            </Field>
            <div className="tdet-actions">
              <Button
                variant="danger"
                disabled={busy || reason.trim().length < 3}
                onClick={async () => {
                  const target = excluding
                  setExcluding(null)
                  await run(() => apiAgentReviewEndorsement(target.id, { exclude: { reason: reason.trim() } }), 'Recommandation écartée.')
                }}
              >
                Écarter
              </Button>
              <Button variant="ghost" onClick={() => setExcluding(null)}>
                Annuler
              </Button>
            </div>
          </Modal>
        )}
      </div>
    </div>
  )
}
