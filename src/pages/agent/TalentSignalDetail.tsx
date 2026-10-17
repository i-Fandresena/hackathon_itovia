import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Lock, Phone } from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Field, Input } from '../../components/ui/Form'
import { Loading } from '../../components/ui/Loading'
import { Modal } from '../../components/ui/Modal'
import { RELATION_LABELS, TRUST_LEVEL_LABELS } from '../../data/endorsements'
import { SECTOR_LABELS } from '../../data/constants'
import {
  apiAgentMergeSignal,
  apiAgentReviewEndorsement,
  apiAgentTakeSignal,
  apiAgentTalentSignal,
  apiAgentUpdateSignal,
  apiFileUrl,
  type AgentSignalEndorsement,
  type AgentTalentSignalDetail,
} from '../../lib/api'
import { formatDate } from '../../lib/format'
import { SIGNAL_STATUS_LABELS, SIGNAL_STATUS_VARIANT, daysBeforeExpiry } from './TalentSignals'
import './TalentSignals.css'

type Dialog = { kind: 'refuse' } | { kind: 'exclude'; endorsement: AgentSignalEndorsement } | null

/**
 * Fiche d'un signal : contact (privé), recommandations avec photos et revue,
 * doublons possibles et fusion, suites (injoignable, refus, création du
 * profil). La création effective du profil reste le formulaire talent.
 */
export function TalentSignalDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [signal, setSignal] = useState<AgentTalentSignalDetail | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [dialog, setDialog] = useState<Dialog>(null)
  const [reason, setReason] = useState('')

  const load = useCallback(() => {
    if (!id) return
    setError('')
    apiAgentTalentSignal(id)
      .then(setSignal)
      .catch(() => setError('Signal introuvable, ou pris en charge par un autre agent.'))
  }, [id])

  useEffect(load, [load])

  const run = async (action: () => Promise<unknown>, success?: string) => {
    setBusy(true)
    setNotice('')
    try {
      await action()
      if (success) setNotice(success)
      load()
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Action impossible.')
    } finally {
      setBusy(false)
    }
  }

  if (error) {
    return (
      <div className="page">
        <div className="container tsg-detail">
          <Link to="/agent/recommandations" className="tsg-back">
            <ArrowLeft size={16} aria-hidden /> Signaux à traiter
          </Link>
          <Card>
            <p>{error}</p>
          </Card>
        </div>
      </div>
    )
  }
  if (!signal) {
    return (
      <div className="page">
        <div className="container tsg-detail">
          <Loading />
        </div>
      </div>
    )
  }

  const mine = signal.mine
  const open = ['nouveau', 'pris_en_charge', 'injoignable'].includes(signal.status)
  const canReview = mine && open
  const expiry = daysBeforeExpiry(signal.expiresAt, signal.status)
  const t = signal.trust

  return (
    <div className="page">
      <div className="container tsg-detail">
        <Link to="/agent/recommandations" className="tsg-back">
          <ArrowLeft size={16} aria-hidden /> Signaux à traiter
        </Link>

        <header className="tsg-detail-head">
          <div className="tsg-card-main">
            <h1>
              {signal.trade} · {signal.district}
            </h1>
            <p className="tsg-card-meta">
              {signal.city}, {signal.province} · {SECTOR_LABELS[signal.sector]} · reçu le {formatDate(signal.createdAt)}
            </p>
          </div>
          <div className="tsg-card-tags">
            <Badge variant={SIGNAL_STATUS_VARIANT[signal.status]}>{SIGNAL_STATUS_LABELS[signal.status]}</Badge>
            {expiry !== null && (
              <span className="tsg-tag tsg-tag-warn">
                {expiry === 0 ? 'Expire aujourd’hui' : `Expire dans ${expiry} jour${expiry > 1 ? 's' : ''}`}
              </span>
            )}
          </div>
        </header>

        {notice && (
          <p className="tsg-notice" role="status">
            {notice}
          </p>
        )}

        {signal.status === 'converti' && signal.talentId && signal.mine && (
          <Card className="tsg-block">
            <p>
              Profil créé à partir de ce signal : ses recommandations y sont rattachées.{' '}
              <Link className="tsg-inline-link" to={`/agent/talents/${signal.talentId}`}>
                Ouvrir le profil
              </Link>
            </p>
          </Card>
        )}

        {signal.mergedIntoId && (
          <Card className="tsg-block">
            <p>
              Ce signal a été fusionné.{' '}
              <Link className="tsg-inline-link" to={`/agent/recommandations/${signal.mergedIntoId}`}>
                Ouvrir le signal principal
              </Link>
            </p>
          </Card>
        )}

        <div className="tsg-actions">
          {signal.status === 'nouveau' && (
            <Button
              disabled={busy}
              onClick={() => run(() => apiAgentTakeSignal(signal.id), 'Signal pris en charge : il n’est plus visible des autres agents.')}
            >
              Prendre en charge
            </Button>
          )}
          {mine && signal.status === 'pris_en_charge' && (
            <>
              <Link to={`/agent/talents/nouveau?fromSignal=${signal.id}`}>
                <Button>Créer le profil</Button>
              </Link>
              <Button variant="outline" disabled={busy} onClick={() => run(() => apiAgentUpdateSignal(signal.id, 'injoignable'), 'Marqué injoignable.')}>
                Injoignable
              </Button>
              <Button variant="ghost" disabled={busy} onClick={() => run(() => apiAgentUpdateSignal(signal.id, 'nouveau'), 'Signal rendu à la file.')}>
                Rendre à la file
              </Button>
            </>
          )}
          {mine && signal.status === 'injoignable' && (
            <Button variant="outline" disabled={busy} onClick={() => run(() => apiAgentUpdateSignal(signal.id, 'pris_en_charge'), 'Signal repris.')}>
              Reprendre le contact
            </Button>
          )}
          {mine && (signal.status === 'pris_en_charge' || signal.status === 'injoignable') && (
            <Button variant="danger" disabled={busy} onClick={() => setDialog({ kind: 'refuse' })}>
              Refuser
            </Button>
          )}
        </div>

        <div className="tsg-grid">
          <Card className="tsg-block">
            <h2 className="tsg-block-title">Contact</h2>
            <p className="tsg-private">
              <Lock size={14} aria-hidden /> Privé : jamais publié, visible seulement par vous et les admins.
            </p>
            {signal.contactPurged ? (
              <p className="tsg-muted">Contact effacé (signal refusé, expiré ou converti).</p>
            ) : (
              <dl className="tsg-contact">
                <dt>Nom donné</dt>
                <dd>{signal.subjectName || '—'}</dd>
                <dt>Téléphone</dt>
                <dd>
                  {signal.contactPhone ? (
                    <a className="tsg-inline-link" href={`tel:${signal.contactPhone.replace(/\s/g, '')}`}>
                      <Phone size={14} aria-hidden /> {signal.contactPhone}
                    </a>
                  ) : (
                    '—'
                  )}
                </dd>
                <dt>Où la trouver</dt>
                <dd>{signal.contactHint || '—'}</dd>
              </dl>
            )}
            {signal.merged.length > 0 && (
              <div className="tsg-merged">
                <h3>Signaux fusionnés ici</h3>
                {signal.merged.map((m) => (
                  <p key={m.id} className="tsg-muted">
                    {formatDate(m.createdAt)} · {m.district}
                    {m.subjectName ? ` · « ${m.subjectName} »` : ''}
                    {m.contactPhone ? ` · ${m.contactPhone}` : ''}
                    {m.contactHint ? ` · ${m.contactHint}` : ''}
                  </p>
                ))}
              </div>
            )}
          </Card>

          <Card className="tsg-block">
            <h2 className="tsg-block-title">Aperçu de confiance</h2>
            <p className="tsg-trust-level">
              <span className={`tsg-tag tsg-level-${t.level}`}>{TRUST_LEVEL_LABELS[t.level]}</span>
              {t.index !== null && <span className="tsg-muted">Indice {t.index} / 100</span>}
            </p>
            <p className="tsg-muted">
              Recommandé {t.recommendationCount} fois · {t.independentSources} source
              {t.independentSources > 1 ? 's' : ''} indépendante{t.independentSources > 1 ? 's' : ''}
            </p>
            <ul className="tsg-reasons">
              {t.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
              {t.warnings.map((w) => (
                <li key={w} className="tsg-warning">
                  {w}
                </li>
              ))}
            </ul>
            <p className="tsg-hint">Seules les photos acceptées par un agent comptent comme preuve.</p>
          </Card>
        </div>

        <h2 className="tsg-section-title">Recommandations ({signal.endorsements.length})</h2>
        <div className="tsg-list">
          {signal.endorsements.map((e) => (
            <Card key={e.id} className={`tsg-card ${e.excludedAt ? 'tsg-excluded' : ''}`}>
              <div className="tsg-card-head">
                <div className="tsg-card-main">
                  <p className="tsg-card-title-static">
                    {e.authorRoleLabel} ({e.authorName}) · {e.authorDistrict}
                  </p>
                  <p className="tsg-card-meta">
                    {RELATION_LABELS[e.relation]} · travail du {formatDate(e.jobDate)} · envoyée le {formatDate(e.createdAt)}
                  </p>
                </div>
                <div className="tsg-card-tags">
                  {e.excludedAt && <Badge variant="muted">Écartée</Badge>}
                  {e.reviewedAt && !e.excludedAt && <Badge variant="success">Revue</Badge>}
                </div>
              </div>
              <p className={`tsg-job ${e.hiddenJobLabel ? 'tsg-job-hidden' : ''}`}>
                « {e.jobLabel} »{e.hiddenJobLabel ? ' (libellé masqué)' : ''}
              </p>
              <div className="tsg-card-tags">
                {e.highlights.map((h) => (
                  <span key={h} className="tsg-tag">
                    {h}
                  </span>
                ))}
              </div>
              {e.comment && (
                <p className="tsg-comment">
                  <Lock size={12} aria-hidden /> {e.comment}
                </p>
              )}
              {e.excludedAt && <p className="tsg-muted">Motif : {e.excludedReason}</p>}
              {e.proofFileUrl && (
                <div className="tsg-proof">
                  <a href={apiFileUrl(e.proofFileUrl)} target="_blank" rel="noreferrer">
                    <img src={apiFileUrl(e.proofFileUrl)} alt="Photo du travail jointe à la recommandation" loading="lazy" />
                  </a>
                  <span className="tsg-muted">
                    {e.proofAccepted === true
                      ? 'Preuve acceptée'
                      : e.proofAccepted === false
                        ? 'Preuve refusée'
                        : 'Preuve à revoir'}
                  </span>
                </div>
              )}
              {canReview && !e.excludedAt && (
                <div className="tsg-card-actions">
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
                    onClick={() => run(() => apiAgentReviewEndorsement(e.id, { hiddenJobLabel: !e.hiddenJobLabel }))}
                  >
                    {e.hiddenJobLabel ? 'Afficher le libellé' : 'Masquer le libellé'}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => {
                      setReason('')
                      setDialog({ kind: 'exclude', endorsement: e })
                    }}
                  >
                    Auteur lié : écarter
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </div>

        {open && signal.possibleDuplicates.length > 0 && (
          <>
            <h2 className="tsg-section-title">Doublons possibles</h2>
            <p className="tsg-muted tsg-section-sub">Même métier, même quartier{signal.subjectName ? ' et même prénom' : ''}. À vous de juger.</p>
            <div className="tsg-list">
              {signal.possibleDuplicates.map((d) => (
                <Card key={d.id} className="tsg-card">
                  <div className="tsg-card-head">
                    <div className="tsg-card-main">
                      <Link className="tsg-card-title" to={`/agent/recommandations/${d.id}`}>
                        {d.trade} · {d.district}
                      </Link>
                      <p className="tsg-card-meta">
                        {d.city} · reçu le {formatDate(d.createdAt)}
                        {d.subjectName ? ` · « ${d.subjectName} »` : ''}
                      </p>
                    </div>
                    <Badge variant={SIGNAL_STATUS_VARIANT[d.status]}>{SIGNAL_STATUS_LABELS[d.status]}</Badge>
                  </div>
                  {(mine || signal.status === 'nouveau') && (
                    <div className="tsg-card-actions">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => run(() => apiAgentMergeSignal(d.id, signal.id), 'Doublon fusionné dans ce signal.')}
                      >
                        Fusionner ici
                      </Button>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          </>
        )}

        {dialog?.kind === 'refuse' && (
          <Modal title="Refuser ce signal ?" onClose={() => setDialog(null)}>
            <p className="tsg-modal-text">
              Le contact, les commentaires et les photos seront effacés immédiatement. Les recommandations restent
              comptées dans les statistiques, sans donnée personnelle.
            </p>
            <div className="tsg-card-actions">
              <Button
                variant="danger"
                disabled={busy}
                onClick={() => {
                  setDialog(null)
                  void run(() => apiAgentUpdateSignal(signal.id, 'refuse'), 'Signal refusé, contact effacé.').then(() =>
                    navigate('/agent/recommandations'),
                  )
                }}
              >
                Refuser et effacer
              </Button>
              <Button variant="ghost" onClick={() => setDialog(null)}>
                Annuler
              </Button>
            </div>
          </Modal>
        )}

        {dialog?.kind === 'exclude' && (
          <Modal title="Écarter cette recommandation" onClose={() => setDialog(null)}>
            <p className="tsg-modal-text">
              Utilisez-le quand l’auteur est lié à la personne (famille, associé…). La recommandation reste en base mais
              ne compte plus.
            </p>
            <Field label="Motif">
              <Input value={reason} maxLength={300} placeholder="Ex. frère de la personne" onChange={(ev) => setReason(ev.target.value)} />
            </Field>
            <div className="tsg-card-actions">
              <Button
                disabled={busy || reason.trim().length < 3}
                onClick={() => {
                  const target = dialog.endorsement
                  setDialog(null)
                  void run(() => apiAgentReviewEndorsement(target.id, { exclude: { reason: reason.trim() } }), 'Recommandation écartée.')
                }}
              >
                Écarter
              </Button>
              <Button variant="ghost" onClick={() => setDialog(null)}>
                Annuler
              </Button>
            </div>
          </Modal>
        )}
      </div>
    </div>
  )
}
