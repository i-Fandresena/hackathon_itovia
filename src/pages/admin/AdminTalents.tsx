import { useCallback, useEffect, useState } from 'react'
import { Lock, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Modal } from '../../components/ui/Modal'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { Loading } from '../../components/ui/Loading'
import { TrustLevelBadge } from '../../components/trust/TrustLevelBadge'
import { TALENT_STATUS_LABELS } from '../../data/endorsements'
import { SECTOR_LABELS } from '../../data/constants'
import {
  ApiError,
  apiAdminRevokePublicVisibility,
  apiAdminTalentSignals,
  apiAdminTalents,
  type AdminTalent,
  type AdminTalentSignal,
} from '../../lib/api'
import { formatDate } from '../../lib/format'
import type { TalentSignalStatus } from '../../types'
import { SIGNAL_STATUS_LABELS, SIGNAL_STATUS_VARIANT } from '../agent/TalentSignals'
import './AdminTalents.css'

type Tab = 'talents' | 'signals'

const SIGNAL_FILTERS: (TalentSignalStatus | '')[] = ['', 'nouveau', 'pris_en_charge', 'injoignable', 'converti', 'refuse', 'expire', 'fusionne']

/**
 * Vue admin en lecture seule : les profils de talents (créés et modifiés par
 * leur agent uniquement, §7.3.14) et les signaux « talent recommandé ». Le
 * contact d'un signal est visible ici — jamais public.
 */
export function AdminTalents() {
  const [tab, setTab] = useState<Tab>('talents')
  const [talents, setTalents] = useState<AdminTalent[] | null>(null)
  const [signals, setSignals] = useState<AdminTalentSignal[] | null>(null)
  const [counts, setCounts] = useState<Partial<Record<TalentSignalStatus, number>>>({})
  const [filter, setFilter] = useState<TalentSignalStatus | ''>('')
  const [error, setError] = useState('')
  const [revoking, setRevoking] = useState<AdminTalent | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')

  const revoke = async () => {
    if (!revoking) return
    setBusy(true)
    try {
      await apiAdminRevokePublicVisibility(revoking.id)
      setNotice('Fiche publique retirée. L’agent du talent en est informé.')
      loadTalents()
    } catch (err) {
      setNotice(err instanceof ApiError ? err.message : 'Retrait impossible.')
    } finally {
      setBusy(false)
      setRevoking(null)
    }
  }

  const loadTalents = useCallback(() => {
    setError('')
    apiAdminTalents()
      .then(setTalents)
      .catch(() => setError('Impossible de charger les talents.'))
  }, [])

  const loadSignals = useCallback(() => {
    setError('')
    setSignals(null)
    apiAdminTalentSignals(filter || undefined)
      .then((r) => {
        setSignals(r.signals)
        setCounts(r.counts)
      })
      .catch(() => setError('Impossible de charger les signaux.'))
  }, [filter])

  useEffect(loadTalents, [loadTalents])
  useEffect(() => {
    if (tab === 'signals') loadSignals()
  }, [tab, loadSignals])

  const total = Object.values(counts).reduce((a, b) => a + (b ?? 0), 0)

  return (
    <div className="page">
      <div className="container">
        <header className="page-header">
          <h1>Talents</h1>
          <p>
            Profils suivis par les agents et talents recommandés en attente. Lecture seule : seul l’agent qui suit un
            talent crée ou modifie son profil.
          </p>
        </header>

        <div className="adt-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={tab === 'talents'} className={`chip ${tab === 'talents' ? 'active' : ''}`} onClick={() => setTab('talents')}>
            Profils{talents ? ` (${talents.length})` : ''}
          </button>
          <button type="button" role="tab" aria-selected={tab === 'signals'} className={`chip ${tab === 'signals' ? 'active' : ''}`} onClick={() => setTab('signals')}>
            Signaux recommandés
          </button>
        </div>

        {error && (
          <div className="adt-error">
            <p>{error}</p>
            <Button size="sm" onClick={tab === 'talents' ? loadTalents : loadSignals}>
              Réessayer
            </Button>
          </div>
        )}

        {notice && (
          <p className="adt-notice" role="status">
            {notice}
          </p>
        )}

        {tab === 'talents' &&
          !error &&
          (!talents ? (
            <Loading />
          ) : talents.length === 0 ? (
            <EmptyState icon={Users} title="Aucun talent" description="Les profils créés par les agents apparaîtront ici." />
          ) : (
            <div className="adt-list">
              {talents.map((t) => (
                <Card key={t.id} className="adt-card">
                  <div className="adt-card-head">
                    <div className="adt-card-main">
                      <p className="adt-card-title">{t.fullName}</p>
                      <p className="adt-muted">
                        {t.trade} · {SECTOR_LABELS[t.sector]} · {t.district ? `${t.district}, ` : ''}
                        {t.city}
                      </p>
                    </div>
                    <div className="adt-tags">
                      <TrustLevelBadge level={t.trust.level} index={t.trust.index} />
                      <Badge variant={t.status === 'place' ? 'success' : t.status === 'en_attente' ? 'muted' : 'primary'}>
                        {TALENT_STATUS_LABELS[t.status]}
                      </Badge>
                    </div>
                  </div>
                  <dl className="adt-facts">
                    <div>
                      <dt>Agent</dt>
                      <dd>{t.agent.name}</dd>
                    </div>
                    <div>
                      <dt>Accord</dt>
                      <dd>{t.consentAt ? `recueilli le ${formatDate(t.consentAt)}` : 'non tracé (profil antérieur)'}</dd>
                    </div>
                    <div>
                      <dt>Fiche publique</dt>
                      <dd>
                        {t.publicVisible && t.publicRef ? (
                          <>
                            <Link to={`/annuaire/talents/${t.publicRef}`} className="adt-link">
                              en ligne
                            </Link>{' '}
                            · accord du {formatDate(t.publicConsentAt!)}
                          </>
                        ) : t.publicConsentAt ? (
                          `accord du ${formatDate(t.publicConsentAt)} · masquée (conditions non réunies)`
                        ) : (
                          'non publiée'
                        )}
                        {t.openContactRequests > 0
                          ? ` · ${t.openContactRequests} demande${t.openContactRequests > 1 ? 's' : ''} de contact en cours`
                          : ''}
                        {t.publicConsentAt && (
                          <>
                            {' '}
                            <button type="button" className="adt-inline-btn" onClick={() => setRevoking(t)}>
                              Retirer
                            </button>
                          </>
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt>Vérification</dt>
                      <dd>
                        {t.verification
                          ? `${formatDate(t.verification.verifiedAt)} · ${t.verification.validated}/${t.verification.total} points`
                          : 'aucune'}
                        {t.verificationCount > 1 ? ` (${t.verificationCount} au total)` : ''}
                      </dd>
                    </div>
                    <div>
                      <dt>Recommandations</dt>
                      <dd>
                        {t.trust.recommendationCount} · {t.trust.independentSources} source{t.trust.independentSources > 1 ? 's' : ''} indépendante
                        {t.trust.independentSources > 1 ? 's' : ''}
                      </dd>
                    </div>
                    <div>
                      <dt>Suivi</dt>
                      <dd>
                        {t.proposalCount} proposition{t.proposalCount > 1 ? 's' : ''} · {t.placementCount} placement{t.placementCount > 1 ? 's' : ''}
                      </dd>
                    </div>
                  </dl>
                </Card>
              ))}
            </div>
          ))}

        {revoking && (
          <Modal title="Retirer la fiche publique" onClose={() => setRevoking(null)}>
            <p className="adt-muted" style={{ marginBottom: '1rem', lineHeight: 1.55 }}>
              Modération : la fiche « {revoking.trade} » disparaît immédiatement de la vitrine et son lien ne fonctionne
              plus. Seul l’agent pourra la republier, avec un nouvel accord de la personne.
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <Button variant="danger" disabled={busy} onClick={revoke}>
                Retirer la fiche
              </Button>
              <Button variant="ghost" onClick={() => setRevoking(null)}>
                Annuler
              </Button>
            </div>
          </Modal>
        )}

        {tab === 'signals' && !error && (
          <>
            <div className="adt-filters">
              {SIGNAL_FILTERS.map((f) => (
                <button key={f || 'all'} type="button" className={`chip ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
                  {f ? SIGNAL_STATUS_LABELS[f] : 'Tous'}
                  <span className="adt-count">{f ? (counts[f] ?? 0) : total}</span>
                </button>
              ))}
            </div>
            <p className="adt-private">
              <Lock size={14} aria-hidden /> Contacts privés : visibles des agents et des admins uniquement, effacés à la
              conversion, au refus ou après 60 jours sans suite.
            </p>
            {!signals ? (
              <Loading />
            ) : signals.length === 0 ? (
              <EmptyState icon={Users} title="Aucun signal" description="Aucun talent recommandé pour ce filtre." />
            ) : (
              <div className="adt-list">
                {signals.map((s) => (
                  <Card key={s.id} className="adt-card">
                    <div className="adt-card-head">
                      <div className="adt-card-main">
                        <p className="adt-card-title">
                          {s.trade} · {s.district}
                        </p>
                        <p className="adt-muted">
                          {s.city}, {s.province} · reçu le {formatDate(s.createdAt)}
                          {s.agentName ? ` · suivi par ${s.agentName}` : ' · dans la file'}
                        </p>
                      </div>
                      <div className="adt-tags">
                        <TrustLevelBadge level={s.trust.level} index={s.trust.index} />
                        <Badge variant={SIGNAL_STATUS_VARIANT[s.status]}>{SIGNAL_STATUS_LABELS[s.status]}</Badge>
                      </div>
                    </div>
                    <dl className="adt-facts">
                      <div>
                        <dt>Recommandé</dt>
                        <dd>{s.endorsementCount} fois</dd>
                      </div>
                      <div>
                        <dt>Contact</dt>
                        <dd>
                          {s.contactPurged
                            ? 'effacé'
                            : [s.subjectName && `« ${s.subjectName} »`, s.contactPhone, s.contactHint].filter(Boolean).join(' · ') || '—'}
                        </dd>
                      </div>
                      {s.status !== 'converti' && s.status !== 'fusionne' && (
                        <div>
                          <dt>Échéance</dt>
                          <dd>{formatDate(s.expiresAt)}</dd>
                        </div>
                      )}
                      {s.talentId && (
                        <div>
                          <dt>Profil</dt>
                          <dd>créé (voir l’onglet Profils)</dd>
                        </div>
                      )}
                    </dl>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
