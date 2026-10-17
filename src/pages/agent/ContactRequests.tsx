import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Mail, MessageSquareLock, Phone } from 'lucide-react'
import { FadeUp } from '../../components/motion/Motion'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { Loading } from '../../components/ui/Loading'
import { Modal } from '../../components/ui/Modal'
import {
  ApiError,
  apiAgentContactRequests,
  apiAgentUpdateContactRequest,
  type AgentContactRequest,
} from '../../lib/api'
import { formatDateTime } from '../../lib/format'
import type { ContactRequestStatus } from '../../types'
import './ContactRequests.css'

const STATUS_LABELS: Record<ContactRequestStatus, string> = {
  nouvelle: 'Nouvelle',
  transmise: 'Transmise',
  close: 'Close',
}

const STATUS_VARIANT: Record<ContactRequestStatus, 'primary' | 'success' | 'muted'> = {
  nouvelle: 'primary',
  transmise: 'success',
  close: 'muted',
}

type Filter = 'all' | ContactRequestStatus

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'Toutes' },
  { key: 'nouvelle', label: 'Nouvelles' },
  { key: 'transmise', label: 'Transmises' },
  { key: 'close', label: 'Closes' },
]

/**
 * Demandes de contact reçues via la vitrine pour les talents que suit
 * l'agent. OffRec reste l'intermédiaire : l'agent appelle le talent, puis
 * organise la rencontre hors ligne ; la plateforme ne transmet jamais les
 * coordonnées du talent au demandeur.
 */
export function ContactRequests() {
  const [filter, setFilter] = useState<Filter>('all')
  const [data, setData] = useState<{ counts: Partial<Record<ContactRequestStatus, number>>; requests: AgentContactRequest[] } | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [confirm, setConfirm] = useState<{ request: AgentContactRequest; status: 'transmise' | 'close' } | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    setError('')
    apiAgentContactRequests(filter === 'all' ? undefined : filter)
      .then(setData)
      .catch(() => setError('Impossible de charger les demandes de contact.'))
  }, [filter])

  useEffect(load, [load])

  const apply = async () => {
    if (!confirm) return
    setBusy(true)
    setNotice('')
    try {
      await apiAgentUpdateContactRequest(confirm.request.id, confirm.status)
      setNotice(
        confirm.status === 'transmise'
          ? 'Demande marquée transmise : le demandeur en est informé.'
          : 'Demande close.',
      )
      setConfirm(null)
      load()
    } catch (err) {
      setNotice(err instanceof ApiError ? err.message : 'Action impossible.')
      setConfirm(null)
    } finally {
      setBusy(false)
    }
  }

  const counts = data?.counts ?? {}

  return (
    <div className="page">
      <div className="container">
        <FadeUp eager>
          <header className="page-header">
            <p className="eyebrow">Espace agent de terrain</p>
            <h1>Demandes pour mes talents</h1>
            <p>
              Des membres ont vu la fiche publique d’un de vos talents et souhaitent le contacter. Appelez le talent,
              présentez-lui le besoin, puis organisez la rencontre : ses coordonnées ne sont jamais transmises par la
              plateforme.
            </p>
          </header>
        </FadeUp>

        <div className="pcr-filters" role="tablist" aria-label="Filtrer les demandes">
          {FILTERS.map((f) => {
            const count = f.key === 'all' ? undefined : counts[f.key]
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
                {count ? <span className="pcr-filter-count">{count}</span> : null}
              </button>
            )
          })}
        </div>

        {notice && (
          <p className="pcr-notice" role="status">
            {notice}
          </p>
        )}

        {error ? (
          <Card>
            <p className="pcr-error">{error}</p>
            <Button size="sm" onClick={load}>
              Réessayer
            </Button>
          </Card>
        ) : !data ? (
          <Loading />
        ) : data.requests.length === 0 ? (
          <EmptyState
            icon={MessageSquareLock}
            title="Aucune demande ici"
            description="Les demandes envoyées depuis la vitrine « Talents recommandés » pour vos talents apparaîtront ici."
          />
        ) : (
          <div className="pcr-list">
            {data.requests.map((r) => (
              <Card key={r.id} className="pcr-card">
                <div className="pcr-head">
                  <div className="pcr-head-main">
                    <Link to={`/agent/talents/${r.talent.id}`} className="pcr-talent">
                      {r.talent.fullName} · {r.talent.trade}
                    </Link>
                    <p className="pcr-meta">
                      {r.talent.district ? `${r.talent.district}, ` : ''}
                      {r.talent.city} · reçue le {formatDateTime(r.createdAt)}
                      {r.handledAt ? ` · traitée le ${formatDateTime(r.handledAt)}` : ''}
                    </p>
                  </div>
                  <Badge variant={STATUS_VARIANT[r.status]}>{STATUS_LABELS[r.status]}</Badge>
                </div>

                <div className="pcr-need">
                  <p className="pcr-label">Besoin exprimé</p>
                  <p className="pcr-need-text">{r.need}</p>
                </div>

                <div className="pcr-requester">
                  <p className="pcr-label">Demandeur</p>
                  <p className="pcr-requester-name">
                    {r.requester.name ?? 'Nom non renseigné'} <span className="pcr-role">({r.requester.roleLabel.replace(/^Un(e)? /, '')})</span>
                  </p>
                  <div className="pcr-contact">
                    <a href={`mailto:${r.requester.email}`}>
                      <Mail size={14} aria-hidden /> {r.requester.email}
                    </a>
                    {r.requester.phone && (
                      <a href={`tel:${r.requester.phone.replace(/\s+/g, '')}`}>
                        <Phone size={14} aria-hidden /> {r.requester.phone}
                      </a>
                    )}
                  </div>
                </div>

                {r.status !== 'close' && (
                  <div className="pcr-actions">
                    {r.status === 'nouvelle' && (
                      <Button size="sm" disabled={busy} onClick={() => setConfirm({ request: r, status: 'transmise' })}>
                        Marquer transmise
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" disabled={busy} onClick={() => setConfirm({ request: r, status: 'close' })}>
                      Clore
                    </Button>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}

        {confirm && (
          <Modal
            title={confirm.status === 'transmise' ? 'Marquer la demande transmise' : 'Clore la demande'}
            onClose={() => setConfirm(null)}
          >
            <p className="pcr-modal-text">
              {confirm.status === 'transmise'
                ? 'Vous avez présenté le besoin au talent et vous organisez la rencontre. Le demandeur reçoit une notification (sans les coordonnées du talent).'
                : 'La demande est terminée (rencontre organisée, talent non intéressé ou demande sans suite). Le demandeur n’est pas notifié.'}
            </p>
            <div className="pcr-actions">
              <Button disabled={busy} onClick={apply}>
                Confirmer
              </Button>
              <Button variant="ghost" onClick={() => setConfirm(null)}>
                Annuler
              </Button>
            </div>
          </Modal>
        )}
      </div>
    </div>
  )
}
