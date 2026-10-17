import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Building2, ChevronDown, ChevronUp, FileText, Lock } from 'lucide-react'
import { TrustLevelBadge } from '../../components/trust/TrustLevelBadge'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { Field, Input, Select } from '../../components/ui/Form'
import { Loading } from '../../components/ui/Loading'
import { Modal } from '../../components/ui/Modal'
import { SECTOR_LABELS } from '../../data/constants'
import { RELATION_LABELS } from '../../data/endorsements'
import {
  ApiError,
  apiAdminCompanies,
  apiAdminCompanyEndorsements,
  apiAdminCompanyRecruiters,
  apiAdminLinkCompanyRecruiter,
  apiAdminReviewCompanyEndorsement,
  apiAdminSetCompanyHidden,
  apiFileUrl,
  type AdminCompany,
  type AdminCompanyEndorsement,
  type AdminRecruiterOption,
} from '../../lib/api'
import { formatDate } from '../../lib/format'
import './AdminTalents.css'
import './AdminCompanies.css'

type Filter = 'all' | 'proofs' | 'hidden'

/**
 * Entreprises recommandées, côté admin : revue des preuves (le fichier est
 * supprimé du disque après la décision), exclusion d'un auteur lié, masquage
 * d'une fiche, liaison à un compte recruteur. Les auteurs et commentaires ne
 * sont visibles qu'ici.
 */
export function AdminCompanies() {
  /** `?entreprise=<id>` (lien depuis « Recruteurs ») : cette fiche seule, recommandations ouvertes. */
  const [searchParams, setSearchParams] = useSearchParams()
  const focusId = searchParams.get('entreprise')
  const [companies, setCompanies] = useState<AdminCompany[] | null>(null)
  const [recruiters, setRecruiters] = useState<AdminRecruiterOption[]>([])
  const [filter, setFilter] = useState<Filter>('all')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [openId, setOpenId] = useState<string | null>(focusId)
  const [hiding, setHiding] = useState<AdminCompany | null>(null)
  const [linking, setLinking] = useState<AdminCompany | null>(null)

  const load = useCallback(() => {
    setError('')
    apiAdminCompanies()
      .then(setCompanies)
      .catch(() => setError('Impossible de charger les entreprises.'))
    apiAdminCompanyRecruiters()
      .then(setRecruiters)
      .catch(() => setRecruiters([]))
  }, [])

  useEffect(load, [load])

  const list = (companies ?? []).filter((c) =>
    focusId ? c.id === focusId : filter === 'proofs' ? c.pendingProofs > 0 : filter === 'hidden' ? c.hiddenAt !== null : true,
  )
  const pendingTotal = (companies ?? []).reduce((sum, c) => sum + c.pendingProofs, 0)
  const hiddenTotal = (companies ?? []).filter((c) => c.hiddenAt).length

  const unhide = async (c: AdminCompany) => {
    try {
      await apiAdminSetCompanyHidden(c.id, false)
      setNotice(`« ${c.name} » est de nouveau visible.`)
      load()
    } catch (err) {
      setNotice(err instanceof ApiError ? err.message : 'Action impossible.')
    }
  }

  return (
    <div className="page">
      <div className="container">
        <header className="page-header">
          <h1>Entreprises</h1>
          <p>
            Employeurs recommandés par d’anciens salariés, stagiaires et prestataires. Revoyez les documents (supprimés
            après votre décision), écartez un auteur lié, masquez une fiche ou liez-la à un compte recruteur.
          </p>
        </header>

        <div className="adt-filters">
          {(
            [
              ['all', 'Toutes', companies?.length ?? 0],
              ['proofs', 'Documents à examiner', pendingTotal],
              ['hidden', 'Masquées', hiddenTotal],
            ] as const
          ).map(([f, label, n]) => (
            <button
              key={f}
              type="button"
              className={`chip ${filter === f && !focusId ? 'active' : ''}`}
              onClick={() => {
                setFilter(f)
                if (focusId) setSearchParams({}, { replace: true })
              }}
            >
              {label}
              <span className="adt-count">{n}</span>
            </button>
          ))}
        </div>

        {focusId && (
          <p className="adt-notice" role="status">
            Une seule fiche affichée.{' '}
            <Button variant="ghost" size="sm" onClick={() => setSearchParams({}, { replace: true })}>
              Tout afficher
            </Button>
          </p>
        )}

        <p className="adt-private">
          <Lock size={14} aria-hidden /> Auteurs et commentaires visibles des admins uniquement : jamais du public, ni du
          recruteur lié, ni dans les notifications.
        </p>

        {notice && (
          <p className="adt-notice" role="status">
            {notice}
          </p>
        )}

        {error ? (
          <div className="adt-error">
            <p>{error}</p>
            <Button size="sm" onClick={load}>
              Réessayer
            </Button>
          </div>
        ) : !companies ? (
          <Loading />
        ) : list.length === 0 ? (
          <EmptyState icon={Building2} title="Aucune entreprise" description="Aucune entreprise pour ce filtre." />
        ) : (
          <div className="adt-list">
            {list.map((c) => (
              <Card key={c.id} className="adt-card">
                <div className="adt-card-head">
                  <div className="adt-card-main">
                    <p className="adt-card-title">
                      {c.hiddenAt ? (
                        c.name
                      ) : (
                        <Link to={`/annuaire/entreprises/${c.id}`} className="adt-link">
                          {c.name}
                        </Link>
                      )}
                    </p>
                    <p className="adt-muted">
                      {SECTOR_LABELS[c.sector]} · {c.city}, {c.province} · créée le {formatDate(c.createdAt)}
                    </p>
                  </div>
                  <div className="adt-tags">
                    <TrustLevelBadge level={c.trust.level} index={c.trust.index} />
                    {c.hiddenAt && <Badge variant="muted">Masquée</Badge>}
                    {c.pendingProofs > 0 && (
                      <Badge variant="primary">
                        {c.pendingProofs} document{c.pendingProofs > 1 ? 's' : ''} à examiner
                      </Badge>
                    )}
                  </div>
                </div>
                <dl className="adt-facts">
                  <div>
                    <dt>Recommandations</dt>
                    <dd>
                      {c.retainedCount} retenue{c.retainedCount > 1 ? 's' : ''} sur {c.endorsementCount} ·{' '}
                      {c.trust.independentSources} source{c.trust.independentSources > 1 ? 's' : ''} indépendante
                      {c.trust.independentSources > 1 ? 's' : ''}
                    </dd>
                  </div>
                  <div>
                    <dt>Recruteur lié</dt>
                    <dd>
                      {c.recruiter ? `${c.recruiter.email}${c.recruiter.companyName ? ` (${c.recruiter.companyName})` : ''}` : 'aucun'}{' '}
                      <button type="button" className="adt-inline-btn" onClick={() => setLinking(c)}>
                        {c.recruiter ? 'Modifier' : 'Lier'}
                      </button>
                    </dd>
                  </div>
                  <div>
                    <dt>Visibilité</dt>
                    <dd>
                      {c.hiddenAt ? (
                        <>
                          masquée le {formatDate(c.hiddenAt)}
                          {c.hiddenReason ? ` — ${c.hiddenReason}` : ''}{' '}
                          <button type="button" className="adt-inline-btn" onClick={() => unhide(c)}>
                            Réafficher
                          </button>
                        </>
                      ) : (
                        <>
                          publique{' '}
                          <button type="button" className="adt-inline-btn" onClick={() => setHiding(c)}>
                            Masquer
                          </button>
                        </>
                      )}
                    </dd>
                  </div>
                </dl>
                <button
                  type="button"
                  className="adc-toggle"
                  aria-expanded={openId === c.id}
                  onClick={() => setOpenId(openId === c.id ? null : c.id)}
                >
                  {openId === c.id ? <ChevronUp size={16} aria-hidden /> : <ChevronDown size={16} aria-hidden />}
                  {openId === c.id ? 'Masquer les recommandations' : 'Voir les recommandations'}
                </button>
                {openId === c.id && (
                  <CompanyEndorsements
                    companyId={c.id}
                    onChanged={(msg) => {
                      setNotice(msg)
                      load()
                    }}
                  />
                )}
              </Card>
            ))}
          </div>
        )}

        {hiding && (
          <HideModal
            company={hiding}
            onClose={() => setHiding(null)}
            onDone={(msg) => {
              setHiding(null)
              setNotice(msg)
              load()
            }}
          />
        )}
        {linking && (
          <LinkModal
            company={linking}
            recruiters={recruiters}
            onClose={() => setLinking(null)}
            onDone={(msg) => {
              setLinking(null)
              setNotice(msg)
              load()
            }}
          />
        )}
      </div>
    </div>
  )
}

function CompanyEndorsements({ companyId, onChanged }: { companyId: string; onChanged: (msg: string) => void }) {
  const [items, setItems] = useState<AdminCompanyEndorsement[] | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [excluding, setExcluding] = useState<string | null>(null)
  const [reason, setReason] = useState('')

  const load = useCallback(() => {
    setError('')
    apiAdminCompanyEndorsements(companyId)
      .then(setItems)
      .catch(() => setError('Impossible de charger les recommandations.'))
  }, [companyId])

  useEffect(load, [load])

  const review = async (id: string, body: { proofAccepted?: boolean; exclude?: { reason: string } }, msg: string) => {
    setBusy(id)
    setError('')
    try {
      await apiAdminReviewCompanyEndorsement(id, body)
      setExcluding(null)
      setReason('')
      load()
      onChanged(msg)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Action impossible.')
    } finally {
      setBusy(null)
    }
  }

  if (error) return <p className="adc-error">{error}</p>
  if (!items) return <Loading />
  if (items.length === 0) return <p className="adt-muted">Aucune recommandation.</p>

  return (
    <ul className="adc-endorsements">
      {items.map((e) => (
        <li key={e.id} className={`adc-endorsement ${e.excludedAt ? 'is-excluded' : ''}`}>
          <div className="adc-endorsement-head">
            <p className="adc-endorsement-title">
              {RELATION_LABELS[e.relation]} · {e.jobLabel}
            </p>
            <span className="adt-muted">
              jusqu’au {formatDate(e.jobDate)} · reçue le {formatDate(e.createdAt)}
            </span>
          </div>
          <p className="adt-muted">
            Auteur : {e.authorName} ({e.authorRoleLabel}) · {e.authorDistrict}
          </p>
          <div className="adc-highlights">
            {e.highlights.map((h) => (
              <span key={h} className="adc-tag">
                {h}
              </span>
            ))}
          </div>
          {e.comment && <p className="adc-comment">« {e.comment} »</p>}

          <div className="adc-proof">
            {e.proofFileUrl ? (
              <>
                <a className="adt-link adc-proof-link" href={apiFileUrl(e.proofFileUrl)} target="_blank" rel="noreferrer">
                  <FileText size={15} aria-hidden /> Ouvrir le document
                </a>
                <Button size="sm" disabled={busy === e.id} onClick={() => review(e.id, { proofAccepted: true }, 'Document accepté et supprimé du serveur.')}>
                  Accepter
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy === e.id}
                  onClick={() => review(e.id, { proofAccepted: false }, 'Document refusé et supprimé du serveur.')}
                >
                  Refuser
                </Button>
                <span className="adt-muted">Le fichier est supprimé après votre décision.</span>
              </>
            ) : e.proofAccepted === true ? (
              <Badge variant="success">Document accepté (fichier supprimé)</Badge>
            ) : e.proofAccepted === false ? (
              <Badge variant="muted">Document refusé (fichier supprimé)</Badge>
            ) : (
              <span className="adt-muted">Sans document</span>
            )}
          </div>

          {e.excludedAt ? (
            <p className="adc-excluded">
              Écartée le {formatDate(e.excludedAt)} : {e.excludedReason}
            </p>
          ) : excluding === e.id ? (
            <form
              className="adc-exclude-form"
              onSubmit={(ev) => {
                ev.preventDefault()
                if (reason.trim().length >= 3) void review(e.id, { exclude: { reason: reason.trim() } }, 'Recommandation écartée : elle ne compte plus.')
              }}
            >
              <Input
                autoFocus
                maxLength={300}
                placeholder="Motif (ex. auteur lié à la direction)"
                value={reason}
                onChange={(ev) => setReason(ev.target.value)}
              />
              <Button type="submit" size="sm" variant="danger" disabled={busy === e.id || reason.trim().length < 3}>
                Écarter
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setExcluding(null)}>
                Annuler
              </Button>
            </form>
          ) : (
            <button type="button" className="adt-inline-btn" onClick={() => setExcluding(e.id)}>
              Écarter (auteur lié à l’entreprise)
            </button>
          )}
        </li>
      ))}
    </ul>
  )
}

function HideModal({ company, onClose, onDone }: { company: AdminCompany; onClose: () => void; onDone: (msg: string) => void }) {
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async () => {
    setBusy(true)
    setError('')
    try {
      await apiAdminSetCompanyHidden(company.id, true, reason.trim())
      onDone(`« ${company.name} » est masquée : elle n’apparaît plus nulle part.`)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Action impossible.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <Modal title="Masquer l’entreprise" onClose={onClose}>
      <p className="adt-muted adc-modal-text">
        « {company.name} » disparaît immédiatement de la vitrine, de la recherche, des offres et du tableau de bord du
        recruteur lié. Les recommandations sont conservées.
      </p>
      <Field label="Motif">
        <Input maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} />
      </Field>
      {error && <p className="adc-error">{error}</p>}
      <div className="adc-modal-actions">
        <Button variant="danger" disabled={busy || reason.trim().length < 3} onClick={submit}>
          Masquer
        </Button>
        <Button variant="ghost" onClick={onClose}>
          Annuler
        </Button>
      </div>
    </Modal>
  )
}

function LinkModal({
  company,
  recruiters,
  onClose,
  onDone,
}: {
  company: AdminCompany
  recruiters: AdminRecruiterOption[]
  onClose: () => void
  onDone: (msg: string) => void
}) {
  const [recruiterId, setRecruiterId] = useState(company.recruiter?.id ?? '')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async (id: string | null) => {
    setBusy(true)
    setError('')
    try {
      await apiAdminLinkCompanyRecruiter(company.id, id)
      onDone(id ? `« ${company.name} » est liée au compte recruteur.` : `« ${company.name} » n’est plus liée à aucun recruteur.`)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Action impossible.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <Modal title="Lier à un compte recruteur" onClose={onClose}>
      <p className="adt-muted adc-modal-text">
        Le recruteur verra le niveau, le nombre de recommandations et les points forts de « {company.name} » sur son
        tableau de bord — jamais les auteurs ni les commentaires. Vérifiez qu’il représente bien cette entreprise.
      </p>
      <Field label="Compte recruteur">
        <Select value={recruiterId} onChange={(e) => setRecruiterId(e.target.value)}>
          <option value="">Choisir…</option>
          {recruiters.map((r) => (
            <option key={r.id} value={r.id} disabled={Boolean(r.linkedCompany && r.linkedCompany.id !== company.id)}>
              {r.companyName ?? r.email} — {r.email}
              {r.linkedCompany && r.linkedCompany.id !== company.id ? ` (déjà lié à ${r.linkedCompany.name})` : ''}
            </option>
          ))}
        </Select>
      </Field>
      {error && <p className="adc-error">{error}</p>}
      <div className="adc-modal-actions">
        <Button disabled={busy || !recruiterId} onClick={() => submit(recruiterId)}>
          Lier
        </Button>
        {company.recruiter && (
          <Button variant="outline" disabled={busy} onClick={() => submit(null)}>
            Délier
          </Button>
        )}
        <Button variant="ghost" onClick={onClose}>
          Annuler
        </Button>
      </div>
    </Modal>
  )
}
