import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { HeartHandshake } from 'lucide-react'
import { FadeUp } from '../../components/motion/Motion'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { Loading } from '../../components/ui/Loading'
import { TRUST_LEVEL_LABELS } from '../../data/endorsements'
import { apiAgentTakeSignal, apiAgentTalentSignals, type AgentTalentSignal } from '../../lib/api'
import { formatDate } from '../../lib/format'
import type { TalentSignalStatus } from '../../types'
import './TalentSignals.css'

export const SIGNAL_STATUS_LABELS: Record<TalentSignalStatus, string> = {
  nouveau: 'À prendre',
  pris_en_charge: 'Pris en charge',
  converti: 'Profil créé',
  refuse: 'Refusé',
  injoignable: 'Injoignable',
  expire: 'Expiré',
  fusionne: 'Fusionné',
}

export const SIGNAL_STATUS_VARIANT: Record<TalentSignalStatus, 'primary' | 'success' | 'muted' | 'default'> = {
  nouveau: 'primary',
  pris_en_charge: 'default',
  converti: 'success',
  refuse: 'muted',
  injoignable: 'muted',
  expire: 'muted',
  fusionne: 'muted',
}

const DAY_MS = 24 * 60 * 60 * 1000

/** Jours restants avant la purge du contact, affiché à partir de J-7. */
export function daysBeforeExpiry(expiresAt: string, status: TalentSignalStatus): number | null {
  if (!['nouveau', 'pris_en_charge', 'injoignable'].includes(status)) return null
  const days = Math.ceil((Date.parse(expiresAt) - Date.now()) / DAY_MS)
  return days <= 7 ? Math.max(days, 0) : null
}

type Filter = 'file' | TalentSignalStatus

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'file', label: 'File' },
  { key: 'nouveau', label: 'À prendre' },
  { key: 'pris_en_charge', label: 'Mes signaux' },
  { key: 'injoignable', label: 'Injoignables' },
  { key: 'converti', label: 'Profils créés' },
  { key: 'fusionne', label: 'Fusionnés' },
  { key: 'refuse', label: 'Refusés' },
  { key: 'expire', label: 'Expirés' },
]

/**
 * File « Signaux à traiter » (anciennement « Talents recommandés ») : les signaux `nouveau` sont partagés entre
 * tous les agents ; une fois pris en charge, seul l'agent qui l'a pris le
 * voit. Le téléphone ne s'affiche que sur la fiche du signal.
 */
export function TalentSignals() {
  const navigate = useNavigate()
  const [filter, setFilter] = useState<Filter>('file')
  const [data, setData] = useState<{ counts: Partial<Record<TalentSignalStatus, number>>; signals: AgentTalentSignal[] } | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = useCallback(() => {
    setError('')
    apiAgentTalentSignals(filter === 'file' ? undefined : filter)
      .then(setData)
      .catch(() => setError('Impossible de charger les talents recommandés.'))
  }, [filter])

  useEffect(load, [load])

  const take = async (id: string) => {
    setNotice('')
    try {
      await apiAgentTakeSignal(id)
      navigate(`/agent/recommandations/${id}`)
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Prise en charge impossible.')
      load()
    }
  }

  const counts = data?.counts ?? {}

  return (
    <div className="page">
      <div className="container">
        <FadeUp eager>
          <header className="page-header">
            <p className="eyebrow">Espace agent de terrain</p>
            <h1>Signaux à traiter</h1>
            <p>
              Des membres d’OffRec recommandent des personnes qu’ils ont vues travailler. Prenez un signal en charge,
              appelez la personne, obtenez son accord et vérifiez son savoir-faire avant de créer son profil.
            </p>
          </header>
        </FadeUp>

        <div className="tsg-filters" role="tablist" aria-label="Filtrer les signaux">
          {FILTERS.map((f) => {
            const count = f.key === 'file' ? undefined : counts[f.key]
            return (
              <button
                key={f.key}
                type="button"
                role="tab"
                aria-selected={filter === f.key}
                className={`chip ${filter === f.key ? 'active' : ''}`}
                onClick={() => setFilter(f.key)}
              >
                {f.label}
                {count ? <span className="tsg-filter-count">{count}</span> : null}
              </button>
            )
          })}
        </div>

        {notice && (
          <p className="tsg-notice" role="status">
            {notice}
          </p>
        )}

        {error ? (
          <Card>
            <p style={{ marginBottom: '0.75rem' }}>{error}</p>
            <Button size="sm" onClick={load}>
              Réessayer
            </Button>
          </Card>
        ) : !data ? (
          <Loading />
        ) : data.signals.length === 0 ? (
          <EmptyState
            icon={HeartHandshake}
            title="Aucun signal ici"
            description="Les talents recommandés par les membres d’OffRec apparaîtront dans cette file."
          />
        ) : (
          <div className="tsg-list">
            {data.signals.map((s) => {
              const expiry = daysBeforeExpiry(s.expiresAt, s.status)
              return (
                <Card key={s.id} className="tsg-card">
                  <div className="tsg-card-head">
                    <div className="tsg-card-main">
                      <Link to={`/agent/recommandations/${s.id}`} className="tsg-card-title">
                        {s.trade} · {s.district}
                      </Link>
                      <p className="tsg-card-meta">
                        {s.city}, {s.province} · reçu le {formatDate(s.createdAt)}
                        {s.subjectName ? ` · « ${s.subjectName} »` : ''}
                        {s.hasPhone ? ' · téléphone donné' : ''}
                      </p>
                    </div>
                    <Badge variant={SIGNAL_STATUS_VARIANT[s.status]}>{SIGNAL_STATUS_LABELS[s.status]}</Badge>
                  </div>
                  <div className="tsg-card-tags">
                    <span className="tsg-tag">
                      Recommandé {s.endorsementCount} fois
                    </span>
                    <span className={`tsg-tag tsg-level-${s.trust.level}`}>
                      {TRUST_LEVEL_LABELS[s.trust.level]}
                      {s.trust.index !== null ? ` · ${s.trust.index}` : ''}
                    </span>
                    <span className="tsg-tag">
                      {s.trust.independentSources} source{s.trust.independentSources > 1 ? 's' : ''} indépendante
                      {s.trust.independentSources > 1 ? 's' : ''}
                    </span>
                    {s.proofCount > 0 && (
                      <span className="tsg-tag">
                        {s.proofCount} photo{s.proofCount > 1 ? 's' : ''}
                      </span>
                    )}
                    {s.mergedCount > 0 && <span className="tsg-tag">{s.mergedCount} fusionné(s)</span>}
                    {s.possibleDuplicateIds.length > 0 && <span className="tsg-tag tsg-tag-warn">Doublon possible</span>}
                    {expiry !== null && (
                      <span className="tsg-tag tsg-tag-warn">
                        {expiry === 0 ? 'Expire aujourd’hui' : `Expire dans ${expiry} jour${expiry > 1 ? 's' : ''}`}
                      </span>
                    )}
                  </div>
                  <div className="tsg-card-actions">
                    {s.status === 'nouveau' && (
                      <Button size="sm" onClick={() => take(s.id)}>
                        Prendre en charge
                      </Button>
                    )}
                    <Link to={`/agent/recommandations/${s.id}`}>
                      <Button size="sm" variant="ghost">
                        Ouvrir
                      </Button>
                    </Link>
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
