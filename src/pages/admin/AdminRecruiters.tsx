import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowLeft,
  Briefcase,
  BriefcaseBusiness,
  Building2,
  ExternalLink,
  Handshake,
  MessageCircle,
  Search,
} from 'lucide-react'
import { OpportunityMissions } from '../../components/opportunity/OpportunityMissions'
import { TrustLevelBadge } from '../../components/trust/TrustLevelBadge'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { Input, Select } from '../../components/ui/Form'
import { Loading } from '../../components/ui/Loading'
import { EXPERIENCE_LABELS, OPPORTUNITY_TYPE_LABELS, SECTOR_LABELS } from '../../data/constants'
import {
  apiAdminRecruiter,
  apiAdminRecruiters,
  type AdminRecruiterDetail,
  type AdminRecruiterList,
  type AdminRecruiterOpportunity,
  type AdminRecruiterSort,
  type AdminRecruiterSummary,
  type AdminUserStatus,
} from '../../lib/api'
import { formatAriary, formatDate } from '../../lib/format'
import './AdminRecruiters.css'

const PAGE_SIZE = 50

const STATUS_LABELS: Record<AdminUserStatus, string> = {
  active: 'Actif',
  warned: 'Averti',
  restricted: 'Restreint',
  suspended: 'Suspendu',
  banned: 'Banni',
}

const STATUS_FILTERS: { value: AdminUserStatus | ''; label: string }[] = [
  { value: '', label: 'Tous' },
  { value: 'active', label: 'Actifs' },
  { value: 'warned', label: 'Avertis' },
  { value: 'restricted', label: 'Restreints' },
  { value: 'suspended', label: 'Suspendus' },
  { value: 'banned', label: 'Bannis' },
]

const SORT_LABELS: Record<AdminRecruiterSort, string> = {
  activity: 'Activité la plus récente',
  recent: 'Inscription la plus récente',
  name: 'Entreprise (A → Z)',
}

/** Répartition des profils d'une offre, dans l'ordre du parcours. */
const SUGGESTION_STEPS: { key: keyof AdminRecruiterOpportunity['suggestions']; label: string; tone: string }[] = [
  { key: 'suggeree', label: 'À valider', tone: 'pending' },
  { key: 'proposee_recruteur', label: 'Transmis', tone: 'sent' },
  { key: 'interet_recruteur', label: 'Intéressé', tone: 'interest' },
  { key: 'mise_en_relation', label: 'Mis en relation', tone: 'done' },
  { key: 'ecartee', label: 'Écartés', tone: 'muted' },
]

function StatusBadge({ status }: { status: AdminUserStatus }) {
  return <span className={`arec-status arec-status-${status}`}>{STATUS_LABELS[status]}</span>
}

function plural(count: number, singular: string, pluralForm: string): string {
  return `${count} ${count > 1 ? pluralForm : singular}`
}

/**
 * Comptes recruteurs (consultation) : liste avec recherche, filtre de statut
 * et tri, puis le détail d'un compte avec ses offres et l'avancement des
 * profils proposés. Aucune action sensible ici : chaque action renvoie vers
 * l'écran admin qui la porte déjà (présélection, modération, entreprises,
 * messagerie). Le compte affiché est dans l'URL (`?id=`).
 */
export function AdminRecruiters() {
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedId = searchParams.get('id')

  const [search, setSearch] = useState('')
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<AdminUserStatus | ''>('')
  const [sort, setSort] = useState<AdminRecruiterSort>('activity')

  const [list, setList] = useState<AdminRecruiterList | null>(null)
  const [listLoading, setListLoading] = useState(false)
  const [listError, setListError] = useState('')
  const [moreLoading, setMoreLoading] = useState(false)
  const listRequest = useRef(0)

  const [detail, setDetail] = useState<AdminRecruiterDetail | null>(null)
  const [detailError, setDetailError] = useState('')
  const detailRequest = useRef(0)

  // Recherche différée : une requête quand la saisie s'arrête, pas à chaque touche.
  useEffect(() => {
    const timer = window.setTimeout(() => setQ(search.trim()), 300)
    return () => window.clearTimeout(timer)
  }, [search])

  const loadList = useCallback(() => {
    const request = ++listRequest.current
    setListLoading(true)
    setListError('')
    apiAdminRecruiters({ q: q || undefined, status: status || undefined, sort, limit: PAGE_SIZE, offset: 0 })
      .then((result) => {
        if (request === listRequest.current) setList(result)
      })
      .catch(() => {
        if (request === listRequest.current) setListError('Impossible de charger les comptes recruteurs.')
      })
      .finally(() => {
        if (request === listRequest.current) setListLoading(false)
      })
  }, [q, status, sort])

  useEffect(loadList, [loadList])

  const loadMore = async () => {
    if (!list) return
    const request = listRequest.current
    setMoreLoading(true)
    try {
      const next = await apiAdminRecruiters({
        q: q || undefined,
        status: status || undefined,
        sort,
        limit: PAGE_SIZE,
        offset: list.recruiters.length,
      })
      if (request !== listRequest.current) return
      setList({ ...next, recruiters: [...list.recruiters, ...next.recruiters] })
    } catch {
      if (request === listRequest.current) setListError('Impossible de charger la suite de la liste.')
    } finally {
      setMoreLoading(false)
    }
  }

  const loadDetail = useCallback(() => {
    if (!selectedId) {
      setDetail(null)
      setDetailError('')
      return
    }
    const request = ++detailRequest.current
    setDetail(null)
    setDetailError('')
    apiAdminRecruiter(selectedId)
      .then((result) => {
        if (request === detailRequest.current) setDetail(result)
      })
      .catch((err) => {
        if (request !== detailRequest.current) return
        setDetailError(
          err?.status === 404 || err?.status === 400
            ? 'Ce compte recruteur est introuvable.'
            : 'Impossible de charger le détail de ce recruteur.',
        )
      })
  }, [selectedId])

  useEffect(loadDetail, [loadDetail])

  const select = (id: string | null) => {
    setSearchParams(id ? { id } : {})
    window.scrollTo({ top: 0 })
  }

  const statusCount = (value: AdminUserStatus | '') =>
    !list ? null : value ? list.statusCounts[value] : Object.values(list.statusCounts).reduce((a, b) => a + b, 0)

  return (
    <div className="page">
      <div className="container">
        <header className="page-header">
          <h1>Recruteurs</h1>
          <p>
            Comptes recruteurs, leurs offres et l’avancement des profils proposés. Page de consultation : les actions se
            font depuis la mise en relation, la modération, les entreprises ou la messagerie.
          </p>
        </header>

        <div className={`arec-layout${selectedId ? ' arec-has-detail' : ''}`}>
          <section className="arec-list-col" aria-label="Comptes recruteurs">
            <div className="arec-toolbar">
              <label className="arec-search">
                <Search size={16} aria-hidden />
                <Input
                  type="search"
                  placeholder="Nom, entreprise ou email"
                  aria-label="Rechercher un recruteur"
                  value={search}
                  maxLength={80}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </label>
              <Select
                aria-label="Trier"
                value={sort}
                onChange={(e) => setSort(e.target.value as AdminRecruiterSort)}
              >
                {(Object.keys(SORT_LABELS) as AdminRecruiterSort[]).map((value) => (
                  <option key={value} value={value}>
                    {SORT_LABELS[value]}
                  </option>
                ))}
              </Select>
            </div>

            <div className="arec-filters" role="group" aria-label="Statut du compte">
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f.value || 'all'}
                  type="button"
                  className={`chip ${status === f.value ? 'active' : ''}`}
                  aria-pressed={status === f.value}
                  onClick={() => setStatus(f.value)}
                >
                  {f.label}
                  {statusCount(f.value) !== null && <span className="arec-count">{statusCount(f.value)}</span>}
                </button>
              ))}
            </div>

            {listError && !list ? (
              <div className="arec-error">
                <p>{listError}</p>
                <Button size="sm" onClick={loadList}>
                  Réessayer
                </Button>
              </div>
            ) : !list ? (
              <Loading />
            ) : list.recruiters.length === 0 ? (
              <EmptyState
                icon={BriefcaseBusiness}
                title={list.totalRecruiters === 0 ? 'Aucun compte recruteur' : 'Aucun résultat'}
                description={
                  list.totalRecruiters === 0
                    ? 'Aucun recruteur ne s’est encore inscrit.'
                    : 'Aucun compte ne correspond à cette recherche ou à ce statut.'
                }
              />
            ) : (
              <>
                <p className="arec-result-line" aria-live="polite">
                  {plural(list.total, 'compte', 'comptes')}
                  {list.total !== list.totalRecruiters ? ` sur ${list.totalRecruiters}` : ''}
                  {listLoading ? ' · mise à jour…' : ''}
                </p>
                <ul className={`arec-list${listLoading ? ' arec-list-loading' : ''}`} aria-busy={listLoading}>
                  {list.recruiters.map((r) => (
                    <li key={r.id}>
                      <RecruiterRow recruiter={r} active={r.id === selectedId} onSelect={() => select(r.id)} />
                    </li>
                  ))}
                </ul>
                {listError && <p className="arec-inline-error">{listError}</p>}
                {list.recruiters.length < list.total && (
                  <Button variant="outline" size="sm" disabled={moreLoading} onClick={loadMore}>
                    {moreLoading ? 'Chargement…' : `Afficher plus (${list.total - list.recruiters.length} restants)`}
                  </Button>
                )}
              </>
            )}
          </section>

          <section className="arec-detail-col" aria-label="Détail du recruteur">
            {!selectedId ? (
              <div className="arec-placeholder">
                <BriefcaseBusiness size={22} aria-hidden />
                <p>Sélectionnez un recruteur pour voir ses offres et l’avancement des profils proposés.</p>
              </div>
            ) : (
              <>
                <Button variant="ghost" size="sm" className="arec-back" onClick={() => select(null)}>
                  <ArrowLeft size={16} aria-hidden />
                  Retour à la liste
                </Button>
                {detailError ? (
                  <div className="arec-error">
                    <p>{detailError}</p>
                    <Button size="sm" onClick={loadDetail}>
                      Réessayer
                    </Button>
                  </div>
                ) : !detail ? (
                  <Loading />
                ) : (
                  <RecruiterDetail detail={detail} />
                )}
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}

function RecruiterRow({
  recruiter: r,
  active,
  onSelect,
}: {
  recruiter: AdminRecruiterSummary
  active: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      className={`arec-row${active ? ' arec-row-active' : ''}`}
      aria-current={active ? 'true' : undefined}
      onClick={onSelect}
    >
      <span className="arec-row-head">
        <span className="arec-row-name">{r.displayName}</span>
        <StatusBadge status={r.status} />
      </span>
      <span className="arec-row-meta">
        {r.email}
        {r.profile ? ` · ${r.profile.city}` : ''}
      </span>
      <span className="arec-row-stats">
        <span>
          <strong>{r.counts.openOffers}</strong> {r.counts.openOffers > 1 ? 'offres ouvertes' : 'offre ouverte'}
        </span>
        <span>
          <strong>{r.counts.proposedProfiles}</strong> {r.counts.proposedProfiles > 1 ? 'profils transmis' : 'profil transmis'}
        </span>
        <span>
          <strong>{r.counts.connections}</strong> {r.counts.connections > 1 ? 'mises en relation' : 'mise en relation'}
        </span>
        {r.counts.awaitingValidation > 0 && (
          <span className="arec-row-pending">
            <strong>{r.counts.awaitingValidation}</strong> à valider
          </span>
        )}
      </span>
      <span className="arec-row-date">Dernière activité : {formatDate(r.lastActivityAt)}</span>
    </button>
  )
}

function RecruiterDetail({ detail }: { detail: AdminRecruiterDetail }) {
  const r = detail.recruiter
  const c = r.counts
  const counters: { label: string; value: number; hint?: string }[] = [
    { label: 'Offres ouvertes', value: c.openOffers, hint: 'non pourvues, date limite à venir, compte actif' },
    ...(c.filledOffers !== undefined ? [{ label: 'Offres pourvues', value: c.filledOffers }] : []),
    { label: 'Offres expirées', value: c.expiredOffers, hint: 'date limite dépassée, non pourvues' },
    { label: 'À valider', value: c.awaitingValidation, hint: 'profils en attente de validation admin' },
    { label: 'Profils transmis', value: c.proposedProfiles, hint: 'actuellement chez le recruteur' },
    { label: 'Intérêts', value: c.interests, hint: 'mises en relation comprises' },
    { label: 'Mises en relation', value: c.connections },
    { label: 'Talents proposés', value: c.talentProposals, hint: 'par les agents de terrain' },
    { label: 'Placements', value: c.placements },
  ]

  return (
    <div className="arec-detail">
      <Card className="arec-card">
        <div className="arec-detail-head">
          <div className="arec-detail-title">
            <h2>{r.displayName}</h2>
            <p className="arec-muted">{r.email}</p>
          </div>
          <StatusBadge status={r.status} />
        </div>

        <dl className="arec-facts">
          <div>
            <dt>Inscription</dt>
            <dd>{formatDate(r.createdAt)}</dd>
          </div>
          <div>
            <dt>Dernière activité</dt>
            <dd>{formatDate(r.lastActivityAt)}</dd>
          </div>
          <div>
            <dt>Entreprise déclarée</dt>
            <dd>
              {r.profile
                ? `${r.profile.companyName} · ${SECTOR_LABELS[r.profile.sector] ?? r.profile.sector}`
                : 'Profil recruteur absent'}
            </dd>
          </div>
          <div>
            <dt>Localisation</dt>
            <dd>{r.profile ? `${r.profile.city}, ${r.profile.province}` : '—'}</dd>
          </div>
          <div>
            <dt>Abonnement</dt>
            <dd>
              {r.subscription
                ? `${r.subscription.planName} · ${
                    r.subscription.priceAr > 0 ? `${formatAriary(r.subscription.priceAr)} / mois` : 'gratuit'
                  } · depuis le ${formatDate(r.subscription.startedAt)}`
                : 'Aucun abonnement'}
            </dd>
          </div>
          <div>
            <dt>Fiche entreprise liée</dt>
            <dd>
              {r.linkedCompany ? (
                <span className="arec-company">
                  <span>{r.linkedCompany.name}</span>
                  {r.linkedCompany.hidden && <Badge variant="muted">Masquée</Badge>}
                  {r.linkedCompany.trust && (
                    <TrustLevelBadge level={r.linkedCompany.trust.level} index={r.linkedCompany.trust.index} />
                  )}
                </span>
              ) : (
                'Aucune'
              )}
            </dd>
          </div>
        </dl>

        <div className="arec-actions">
          <Link to={`/admin/moderation?compte=${encodeURIComponent(r.email)}`} className="btn btn-outline btn-sm">
            <AlertTriangle size={14} aria-hidden />
            Modération
            {c.openReports > 0 && <span className="arec-count arec-count-alert">{c.openReports}</span>}
          </Link>
          <Link
            to={r.linkedCompany ? `/admin/entreprises?entreprise=${r.linkedCompany.id}` : '/admin/entreprises'}
            className="btn btn-outline btn-sm"
          >
            <Building2 size={14} aria-hidden />
            {r.linkedCompany ? 'Fiche entreprise' : 'Lier une entreprise'}
          </Link>
          {detail.conversationId ? (
            <Link to={`/messages?c=${detail.conversationId}`} className="btn btn-outline btn-sm">
              <MessageCircle size={14} aria-hidden />
              Messagerie
            </Link>
          ) : (
            <span className="arec-muted arec-no-conv">
              <MessageCircle size={14} aria-hidden />
              Aucune conversation avec vous
            </span>
          )}
        </div>
      </Card>

      <dl className="arec-counters">
        {counters.map((counter) => (
          <div key={counter.label} className="arec-counter">
            <dt>{counter.label}</dt>
            <dd>{counter.value}</dd>
            {counter.hint && <span>{counter.hint}</span>}
          </div>
        ))}
      </dl>

      <h3 className="arec-section-title">
        Offres
        <span className="arec-count">{detail.opportunitiesTotal}</span>
      </h3>
      {detail.opportunities.length === 0 ? (
        <EmptyState icon={Briefcase} title="Aucune offre" description="Ce recruteur n’a encore publié aucune offre." />
      ) : (
        <>
          {detail.opportunitiesTotal > detail.opportunities.length && (
            <p className="arec-muted">
              {detail.opportunities.length} offres affichées sur {detail.opportunitiesTotal} (les compteurs portent sur
              toutes).
            </p>
          )}
          <ul className="arec-offers">
            {detail.opportunities.map((o) => (
              <li key={o.id}>
                <OfferCard offer={o} />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

/**
 * État d'une offre (sous-lot 6) : la définition unique du serveur
 * (`opportunityClosedReason`) via `open` / `closedReason` / `filled` ; repli
 * sur la date limite avec un serveur plus ancien.
 */
function offerState(o: AdminRecruiterOpportunity): { label: string; tone: 'open' | 'filled' | 'closed'; title?: string } {
  const open = o.open ?? !o.expired
  if (open) return { label: 'Ouverte', tone: 'open' }
  if (o.filled) return { label: 'Pourvue', tone: 'filled', title: o.closedReason ?? undefined }
  if (o.expired) return { label: 'Expirée', tone: 'closed', title: o.closedReason ?? undefined }
  return { label: 'Fermée', tone: 'closed', title: o.closedReason ?? undefined }
}

function OfferCard({ offer: o }: { offer: AdminRecruiterOpportunity }) {
  const legacy = o.suggestions.legacy
  const state = offerState(o)
  const closed = state.tone !== 'open'
  return (
    <Card className={`arec-card arec-offer${closed ? ' arec-offer-expired' : ''}`}>
      <div className="arec-offer-head">
        <div className="arec-offer-main">
          <p className="arec-offer-title">{o.title}</p>
          <p className="arec-muted">
            {OPPORTUNITY_TYPE_LABELS[o.opportunityType] ?? o.opportunityType} ·{' '}
            {(EXPERIENCE_LABELS[o.level] ?? o.level).replace(/\s*\(.*\)$/, '')} · {o.city}
          </p>
        </div>
        <span
          className={`arec-offer-state ${state.tone === 'open' ? 'arec-offer-state-open' : state.tone === 'filled' ? 'arec-offer-state-filled' : 'arec-offer-state-expired'}`}
          title={state.title}
        >
          {state.label}
        </span>
      </div>

      <p className="arec-offer-dates">
        Publiée le {formatDate(o.createdAt)} · date limite {formatDate(o.deadline)}
        {closed && o.closedReason ? ` · ${o.closedReason}` : ''}
      </p>

      {o.requiredSkills.length > 0 && (
        <div className="arec-skills" aria-label="Compétences requises">
          {o.requiredSkills.map((skill) => (
            <Badge key={skill} variant="primary">
              {skill}
            </Badge>
          ))}
        </div>
      )}

      {(o.missions ?? []).length > 0 && (
        <details className="arec-missions">
          <summary>
            {o.missions.length} mission{o.missions.length > 1 ? 's' : ''}
          </summary>
          <OpportunityMissions missions={o.missions} compact />
        </details>
      )}

      <ul className="arec-steps" aria-label="Profils par statut">
        {SUGGESTION_STEPS.map((step) => (
          <li
            key={step.key}
            className={`arec-step arec-step-${step.tone}${o.suggestions[step.key] === 0 ? ' arec-step-zero' : ''}`}
          >
            <strong>{o.suggestions[step.key]}</strong>
            <span>{step.label}</span>
          </li>
        ))}
        <li className={`arec-step arec-step-talent${o.talentProposals === 0 ? ' arec-step-zero' : ''}`}>
          <strong>{o.talentProposals}</strong>
          <span>Talents (agents)</span>
        </li>
        <li className={`arec-step arec-step-done${o.placements === 0 ? ' arec-step-zero' : ''}`}>
          <strong>{o.placements}</strong>
          <span>Placements</span>
        </li>
      </ul>
      {legacy > 0 && (
        <p className="arec-muted">+ {plural(legacy, 'profil', 'profils')} de l’ancien parcours (candidature par offre).</p>
      )}

      <div className="arec-actions">
        <Link to={`/admin/mise-en-relation?offre=${o.id}`} className="btn btn-outline btn-sm">
          <Handshake size={14} aria-hidden />
          {closed ? 'Voir dans Mise en relation' : 'Présélection et mise en relation'}
        </Link>
        <Link to={`/offres/${o.id}`} className="btn btn-ghost btn-sm">
          <ExternalLink size={14} aria-hidden />
          Voir l’offre
        </Link>
      </div>
    </Card>
  )
}
