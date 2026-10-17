import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowLeft,
  BriefcaseBusiness,
  FileCheck2,
  FileText,
  GraduationCap,
  Handshake,
  Search,
  Sparkles,
} from 'lucide-react'
import { CvFlagList, CvStatusBadge } from '../../components/cv/CvStatus'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { Input, Select } from '../../components/ui/Form'
import { Loading } from '../../components/ui/Loading'
import {
  AVAILABILITY_LABELS,
  EDUCATION_LABELS,
  EXPERIENCE_LABELS,
  GENDER_LABELS,
  OPPORTUNITY_TYPE_LABELS,
  SECTOR_LABELS,
} from '../../data/constants'
import {
  apiAdminCandidate,
  apiAdminCandidates,
  apiFileUrl,
  type AdminCandidateAccountDetail,
  type AdminCandidateConsentFilter,
  type AdminCandidateCvFilter,
  type AdminCandidateDossier,
  type AdminCandidateExtracted,
  type AdminCandidateList,
  type AdminCandidateSort,
  type AdminCandidateSummary,
  type AdminUserStatus,
} from '../../lib/api'
import { formatDate, formatMonth } from '../../lib/format'
import type { CvVerificationStatus, MatchSuggestionStatus } from '../../types'
import './AdminCandidates.css'

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

const SORT_LABELS: Record<AdminCandidateSort, string> = {
  activity: 'Activité la plus récente',
  recent: 'Inscription la plus récente',
  name: 'Nom (A → Z)',
  completion: 'Profil le plus complet',
}

const CV_FILTERS: { value: AdminCandidateCvFilter | ''; label: string }[] = [
  { value: '', label: 'Tous les CV' },
  { value: 'present', label: 'CV déposé' },
  { value: 'absent', label: 'Sans CV' },
  { value: 'non_verifie', label: 'CV à vérifier' },
  { value: 'verifie', label: 'CV vérifié' },
  { value: 'rejete', label: 'CV rejeté' },
]

const CONSENT_FILTERS: { value: AdminCandidateConsentFilter | ''; label: string }[] = [
  { value: '', label: 'Accord : tous' },
  { value: 'given', label: 'Accord donné' },
  { value: 'missing', label: 'Sans accord' },
]

/** Badge CV compact de la liste (le détail utilise `CvStatusBadge`). */
const CV_PILL: Record<CvVerificationStatus | 'absent', { label: string; tone: string }> = {
  verifie: { label: 'CV vérifié', tone: 'ok' },
  non_verifie: { label: 'CV à vérifier', tone: 'warn' },
  rejete: { label: 'CV rejeté', tone: 'danger' },
  absent: { label: 'Sans CV', tone: 'muted' },
}

/** Dossiers par statut, dans l'ordre du parcours. */
const DOSSIER_STEPS: { key: keyof AdminCandidateSummary['counts']; label: string; tone: string }[] = [
  { key: 'suggeree', label: 'À valider', tone: 'pending' },
  { key: 'proposee_recruteur', label: 'Transmis', tone: 'sent' },
  { key: 'interet_recruteur', label: 'Intérêt recruteur', tone: 'interest' },
  { key: 'mise_en_relation', label: 'Mis en relation', tone: 'done' },
  { key: 'ecartee', label: 'Écartés', tone: 'muted' },
]

const DOSSIER_STATUS: Record<MatchSuggestionStatus, { label: string; tone: string }> = {
  suggeree: { label: 'À valider', tone: 'pending' },
  proposee_candidat: { label: 'Proposé au candidat (ancien parcours)', tone: 'muted' },
  interet_candidat: { label: 'Candidat intéressé (ancien parcours)', tone: 'muted' },
  proposee_recruteur: { label: 'Transmis au recruteur', tone: 'sent' },
  interet_recruteur: { label: 'Recruteur intéressé', tone: 'interest' },
  mise_en_relation: { label: 'Mis en relation', tone: 'done' },
  ecartee: { label: 'Écarté', tone: 'muted' },
}

const CONFIDENCE_LABELS: Record<AdminCandidateExtracted['confidence'], string> = {
  high: 'élevée',
  medium: 'moyenne',
  low: 'faible',
}

function StatusBadge({ status }: { status: AdminUserStatus }) {
  return <span className={`acan-status acan-status-${status}`}>{STATUS_LABELS[status]}</span>
}

function Pill({ tone, children }: { tone: string; children: ReactNode }) {
  return <span className={`acan-pill acan-pill-${tone}`}>{children}</span>
}

function CvPill({ cv }: { cv: AdminCandidateSummary['cv'] }) {
  const pill = CV_PILL[cv.uploaded && cv.verificationStatus ? cv.verificationStatus : 'absent']
  return <Pill tone={pill.tone}>{pill.label}</Pill>
}

function ConsentPill({ at }: { at: string | null }) {
  return at ? <Pill tone="ok">Accord donné</Pill> : <Pill tone="muted">Sans accord</Pill>
}

function plural(count: number, singular: string, pluralForm: string): string {
  return `${count} ${count > 1 ? pluralForm : singular}`
}

/** Libellé de niveau sans la précision entre parenthèses (« Junior (1–2 ans) » → « Junior »). */
function shortLevel(label: string): string {
  return label.replace(/\s*\(.*\)$/, '')
}

/** Les dates extraites d'un CV sont du texte libre : formatées seulement si interprétables. */
function cvDate(value: string | null): string | null {
  if (!value) return null
  return Number.isNaN(new Date(value).getTime()) ? value : formatMonth(value)
}

function cvPeriod(start: string | null, end: string | null, isCurrent: boolean): string | null {
  const from = cvDate(start)
  const to = isCurrent ? 'aujourd’hui' : cvDate(end)
  if (from && to) return `${from} – ${to}`
  return from ?? to
}

/**
 * Comptes candidats (consultation) : liste avec recherche, filtres (statut du
 * compte, CV, accord de matching) et tri, puis le détail d'un compte — profil
 * confirmé, CV et sa vérification, suggestions extraites du CV (à part, non
 * confirmées) et dossiers de mise en relation. Aucune action ici : chaque
 * action renvoie vers l'écran admin qui la porte déjà (vérification du CV,
 * mise en relation, modération). Le compte affiché est dans l'URL (`?id=`).
 */
export function AdminCandidates() {
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedId = searchParams.get('id')

  const [search, setSearch] = useState('')
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<AdminUserStatus | ''>('')
  const [cv, setCv] = useState<AdminCandidateCvFilter | ''>('')
  const [consent, setConsent] = useState<AdminCandidateConsentFilter | ''>('')
  const [sort, setSort] = useState<AdminCandidateSort>('activity')

  const [list, setList] = useState<AdminCandidateList | null>(null)
  const [listLoading, setListLoading] = useState(false)
  const [listError, setListError] = useState('')
  const [moreLoading, setMoreLoading] = useState(false)
  const listRequest = useRef(0)

  const [detail, setDetail] = useState<AdminCandidateAccountDetail | null>(null)
  const [detailError, setDetailError] = useState('')
  const detailRequest = useRef(0)

  // Recherche différée : une requête quand la saisie s'arrête, pas à chaque touche.
  useEffect(() => {
    const timer = window.setTimeout(() => setQ(search.trim()), 300)
    return () => window.clearTimeout(timer)
  }, [search])

  const params = useCallback(
    (offset: number) => ({
      q: q || undefined,
      status: status || undefined,
      cv: cv || undefined,
      consent: consent || undefined,
      sort,
      limit: PAGE_SIZE,
      offset,
    }),
    [q, status, cv, consent, sort],
  )

  const loadList = useCallback(() => {
    const request = ++listRequest.current
    setListLoading(true)
    setListError('')
    apiAdminCandidates(params(0))
      .then((result) => {
        if (request === listRequest.current) setList(result)
      })
      .catch(() => {
        if (request === listRequest.current) setListError('Impossible de charger les comptes candidats.')
      })
      .finally(() => {
        if (request === listRequest.current) setListLoading(false)
      })
  }, [params])

  useEffect(loadList, [loadList])

  const loadMore = async () => {
    if (!list) return
    const request = listRequest.current
    setMoreLoading(true)
    try {
      const next = await apiAdminCandidates(params(list.candidates.length))
      if (request !== listRequest.current) return
      setList({ ...next, candidates: [...list.candidates, ...next.candidates] })
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
    apiAdminCandidate(selectedId)
      .then((result) => {
        if (request === detailRequest.current) setDetail(result)
      })
      .catch((err) => {
        if (request !== detailRequest.current) return
        setDetailError(
          err?.status === 404 || err?.status === 400
            ? 'Ce compte candidat est introuvable.'
            : 'Impossible de charger le détail de ce candidat.',
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

  const filtering = Boolean(q || status || cv || consent)

  return (
    <div className="page">
      <div className="container">
        <header className="page-header">
          <h1>Candidats</h1>
          <p>
            Comptes candidats, leur profil, leur CV et l’avancement de leurs dossiers. Page de consultation : les
            actions se font depuis la vérification des CV, la mise en relation ou la modération.
          </p>
        </header>

        <div className={`acan-layout${selectedId ? ' acan-has-detail' : ''}`}>
          <section className="acan-list-col" aria-label="Comptes candidats">
            <div className="acan-toolbar">
              <label className="acan-search">
                <Search size={16} aria-hidden />
                <Input
                  type="search"
                  placeholder="Nom, email ou compétence"
                  aria-label="Rechercher un candidat"
                  value={search}
                  maxLength={80}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </label>
              <Select aria-label="Trier" value={sort} onChange={(e) => setSort(e.target.value as AdminCandidateSort)}>
                {(Object.keys(SORT_LABELS) as AdminCandidateSort[]).map((value) => (
                  <option key={value} value={value}>
                    {SORT_LABELS[value]}
                  </option>
                ))}
              </Select>
            </div>

            <div className="acan-toolbar">
              <Select
                aria-label="Filtrer par CV"
                value={cv}
                onChange={(e) => setCv(e.target.value as AdminCandidateCvFilter | '')}
              >
                {CV_FILTERS.map((f) => (
                  <option key={f.value || 'all'} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </Select>
              <Select
                aria-label="Filtrer par accord de matching"
                value={consent}
                onChange={(e) => setConsent(e.target.value as AdminCandidateConsentFilter | '')}
              >
                {CONSENT_FILTERS.map((f) => (
                  <option key={f.value || 'all'} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </Select>
            </div>

            <div className="acan-filters" role="group" aria-label="Statut du compte">
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f.value || 'all'}
                  type="button"
                  className={`chip ${status === f.value ? 'active' : ''}`}
                  aria-pressed={status === f.value}
                  onClick={() => setStatus(f.value)}
                >
                  {f.label}
                  {statusCount(f.value) !== null && <span className="acan-count">{statusCount(f.value)}</span>}
                </button>
              ))}
            </div>

            {listError && !list ? (
              <div className="acan-error">
                <p>{listError}</p>
                <Button size="sm" onClick={loadList}>
                  Réessayer
                </Button>
              </div>
            ) : !list ? (
              <Loading />
            ) : list.candidates.length === 0 ? (
              <EmptyState
                icon={GraduationCap}
                title={list.totalCandidates === 0 ? 'Aucun compte candidat' : 'Aucun résultat'}
                description={
                  list.totalCandidates === 0
                    ? 'Aucun candidat ne s’est encore inscrit.'
                    : 'Aucun compte ne correspond à cette recherche ou à ces filtres.'
                }
              />
            ) : (
              <>
                <p className="acan-result-line" aria-live="polite">
                  {plural(list.total, 'compte', 'comptes')}
                  {filtering && list.total !== list.totalCandidates ? ` sur ${list.totalCandidates}` : ''}
                  {listLoading ? ' · mise à jour…' : ''}
                </p>
                <ul className={`acan-list${listLoading ? ' acan-list-loading' : ''}`} aria-busy={listLoading}>
                  {list.candidates.map((c) => (
                    <li key={c.id}>
                      <CandidateRow candidate={c} active={c.id === selectedId} onSelect={() => select(c.id)} />
                    </li>
                  ))}
                </ul>
                {listError && <p className="acan-inline-error">{listError}</p>}
                {list.candidates.length < list.total && (
                  <Button variant="outline" size="sm" disabled={moreLoading} onClick={loadMore}>
                    {moreLoading ? 'Chargement…' : `Afficher plus (${list.total - list.candidates.length} restants)`}
                  </Button>
                )}
              </>
            )}
          </section>

          <section className="acan-detail-col" aria-label="Détail du candidat">
            {!selectedId ? (
              <div className="acan-placeholder">
                <GraduationCap size={22} aria-hidden />
                <p>Sélectionnez un candidat pour voir son profil, son CV et ses dossiers.</p>
              </div>
            ) : (
              <>
                <Button variant="ghost" size="sm" className="acan-back" onClick={() => select(null)}>
                  <ArrowLeft size={16} aria-hidden />
                  Retour à la liste
                </Button>
                {detailError ? (
                  <div className="acan-error">
                    <p>{detailError}</p>
                    <Button size="sm" onClick={loadDetail}>
                      Réessayer
                    </Button>
                  </div>
                ) : !detail ? (
                  <Loading />
                ) : (
                  <CandidateDetail detail={detail} />
                )}
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}

function CandidateRow({
  candidate: c,
  active,
  onSelect,
}: {
  candidate: AdminCandidateSummary
  active: boolean
  onSelect: () => void
}) {
  const transmitted = c.counts.proposee_recruteur + c.counts.interet_recruteur + c.counts.mise_en_relation
  return (
    <button
      type="button"
      className={`acan-row${active ? ' acan-row-active' : ''}`}
      aria-current={active ? 'true' : undefined}
      onClick={onSelect}
    >
      <span className="acan-row-head">
        <span className="acan-row-name">{c.displayName}</span>
        <StatusBadge status={c.status} />
      </span>
      <span className="acan-row-meta">
        {c.email}
        {c.profile
          ? ` · ${c.profile.city} · ${shortLevel(EXPERIENCE_LABELS[c.profile.experienceLevel] ?? c.profile.experienceLevel)}`
          : ''}
      </span>
      <span className="acan-row-pills">
        <CvPill cv={c.cv} />
        <ConsentPill at={c.matchingConsentAt} />
        {c.completion !== null && (
          <Pill tone={c.completion === 100 ? 'ok' : 'neutral'}>Profil {c.completion} %</Pill>
        )}
      </span>
      <span className="acan-row-stats">
        <span>
          <strong>{transmitted}</strong> {transmitted > 1 ? 'dossiers transmis' : 'dossier transmis'}
        </span>
        <span>
          <strong>{c.counts.mise_en_relation}</strong>{' '}
          {c.counts.mise_en_relation > 1 ? 'mises en relation' : 'mise en relation'}
        </span>
        {c.counts.suggeree > 0 && (
          <span className="acan-row-pending">
            <strong>{c.counts.suggeree}</strong> à valider
          </span>
        )}
      </span>
      <span className="acan-row-date">Dernière activité : {formatDate(c.lastActivityAt)}</span>
    </button>
  )
}

function CandidateDetail({ detail }: { detail: AdminCandidateAccountDetail }) {
  const c = detail.candidate
  const p = detail.profile
  const counts = c.counts
  const counters: { label: string; value: number; tone: string; hint?: string }[] = [
    ...DOSSIER_STEPS.map((step) => ({ label: step.label, value: counts[step.key], tone: step.tone })),
    { label: 'Signalements ouverts', value: counts.openReports, tone: 'alert', hint: 'visant ce compte' },
  ]

  return (
    <div className="acan-detail">
      <Card className="acan-card">
        <div className="acan-detail-head">
          <div className="acan-detail-title">
            <h2>{c.displayName}</h2>
            <p className="acan-muted">
              {c.email}
              {p?.phone ? ` · ${p.phone}` : ''}
            </p>
          </div>
          <StatusBadge status={c.status} />
        </div>

        <div className="acan-row-pills acan-head-pills">
          <CvPill cv={c.cv} />
          <ConsentPill at={c.matchingConsentAt} />
        </div>

        {!p ? (
          <p className="acan-muted acan-gap">Ce compte n’a pas de profil candidat.</p>
        ) : (
          <>
            <dl className="acan-facts">
              <div>
                <dt>Inscription</dt>
                <dd>{formatDate(c.createdAt)}</dd>
              </div>
              <div>
                <dt>Dernière activité</dt>
                <dd>{formatDate(c.lastActivityAt)}</dd>
              </div>
              <div>
                <dt>Localisation</dt>
                <dd>{[p.city, p.province].filter(Boolean).join(', ') || '—'}</dd>
              </div>
              <div>
                <dt>Niveau d’études</dt>
                <dd>{EDUCATION_LABELS[p.educationLevel] ?? p.educationLevel}</dd>
              </div>
              <div>
                <dt>Expérience</dt>
                <dd>{EXPERIENCE_LABELS[p.experienceLevel] ?? p.experienceLevel}</dd>
              </div>
              <div>
                <dt>Secteur d’intérêt</dt>
                <dd>{p.sector ? (SECTOR_LABELS[p.sector] ?? p.sector) : 'Non renseigné'}</dd>
              </div>
              <div>
                <dt>Types recherchés</dt>
                <dd>
                  {p.desiredOpportunityTypes.map((t) => OPPORTUNITY_TYPE_LABELS[t] ?? t).join(', ') || 'Non renseigné'}
                </dd>
              </div>
              <div>
                <dt>Disponibilité</dt>
                <dd>{AVAILABILITY_LABELS[p.availability] ?? p.availability}</dd>
              </div>
              <div>
                <dt>Genre</dt>
                <dd>{GENDER_LABELS[p.gender] ?? p.gender}</dd>
              </div>
              <div>
                <dt>Accord de matching</dt>
                <dd>{p.matchingConsentAt ? `Donné le ${formatDate(p.matchingConsentAt)}` : 'Non donné ou retiré'}</dd>
              </div>
              <div>
                <dt>Complétude du profil</dt>
                <dd>
                  {c.completion ?? 0} %
                  {detail.completionMissing.length > 0 && (
                    <span className="acan-muted acan-block">Manque : {detail.completionMissing.join(', ')}</span>
                  )}
                </dd>
              </div>
            </dl>

            <p className="acan-label">Compétences confirmées ({p.skills.length})</p>
            {p.skills.length > 0 ? (
              <div className="acan-badges">
                {p.skills.map((skill) => (
                  <Badge key={skill} variant="primary">
                    {skill}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="acan-muted">Aucune compétence renseignée.</p>
            )}
          </>
        )}

        <div className="acan-actions">
          {detail.cv.url && (
            <a href={apiFileUrl(detail.cv.url)} target="_blank" rel="noreferrer" className="btn btn-outline btn-sm">
              <FileText size={14} aria-hidden />
              Ouvrir le CV
            </a>
          )}
          {detail.cv.url && (
            <Link to={`/verification-cv?candidat=${c.id}`} className="btn btn-outline btn-sm">
              <FileCheck2 size={14} aria-hidden />
              Vérification du CV
            </Link>
          )}
          <Link to={`/admin/moderation?compte=${encodeURIComponent(c.email)}`} className="btn btn-outline btn-sm">
            <AlertTriangle size={14} aria-hidden />
            Modération
            {counts.openReports > 0 && <span className="acan-count acan-count-alert">{counts.openReports}</span>}
          </Link>
        </div>
      </Card>

      <dl className="acan-counters">
        {counters.map((counter) => (
          <div key={counter.label} className={`acan-counter acan-counter-${counter.tone}`}>
            <dt>{counter.label}</dt>
            <dd>{counter.value}</dd>
            {counter.hint && <span>{counter.hint}</span>}
          </div>
        ))}
      </dl>
      {counts.legacy > 0 && (
        <p className="acan-muted">+ {plural(counts.legacy, 'dossier', 'dossiers')} de l’ancien parcours (candidature par offre).</p>
      )}

      <CvBlock detail={detail} />
      <ExtractedBlock detail={detail} />

      <h3 className="acan-section-title">
        Dossiers
        <span className="acan-count">{detail.dossiersTotal}</span>
      </h3>
      {detail.dossiers.length === 0 ? (
        <EmptyState
          icon={Handshake}
          title="Aucun dossier"
          description="Ce candidat n’a encore été retenu pour aucune offre."
        />
      ) : (
        <>
          {detail.dossiersTotal > detail.dossiers.length && (
            <p className="acan-muted">
              {detail.dossiers.length} dossiers affichés sur {detail.dossiersTotal} (les compteurs portent sur tous).
            </p>
          )}
          <ul className="acan-dossiers">
            {detail.dossiers.map((d) => (
              <li key={d.id}>
                <DossierCard dossier={d} />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

function CvBlock({ detail }: { detail: AdminCandidateAccountDetail }) {
  const cv = detail.cv
  return (
    <Card className="acan-card">
      <div className="acan-card-head">
        <h3 className="acan-card-title">CV</h3>
        {cv.url && cv.verificationStatus ? <CvStatusBadge status={cv.verificationStatus} /> : <Pill tone="muted">Sans CV</Pill>}
      </div>
      {!cv.url ? (
        <p className="acan-muted">Aucun CV déposé.</p>
      ) : (
        <>
          <dl className="acan-facts">
            <div>
              <dt>Déposé le</dt>
              <dd>{cv.submittedAt ? formatDate(cv.submittedAt) : '—'}</dd>
            </div>
            <div>
              <dt>Attestation sur l’honneur</dt>
              <dd>{cv.attestedAt ? `Cochée le ${formatDate(cv.attestedAt)}` : 'Non tracée'}</dd>
            </div>
            <div>
              <dt>Vérification</dt>
              <dd>
                {cv.verificationStatus === 'non_verifie'
                  ? 'En attente de relecture'
                  : cv.verifiedAt
                    ? `${cv.verificationStatus === 'verifie' ? 'Vérifié' : 'Rejeté'} le ${formatDate(cv.verifiedAt)}`
                    : '—'}
              </dd>
            </div>
          </dl>
          {cv.verificationNote && <p className="acan-note">Note : {cv.verificationNote}</p>}

          <p className="acan-label">Points relevés automatiquement</p>
          {cv.flags.length > 0 ? (
            <CvFlagList flags={cv.flags} />
          ) : (
            <p className="acan-muted">Aucun point relevé. Cela ne dispense pas de relire le CV.</p>
          )}
        </>
      )}

      {cv.history.length > 0 && (
        <>
          <p className="acan-label">Historique des décisions</p>
          <ul className="acan-timeline">
            {cv.history.map((h, i) => (
              <li key={`${h.createdAt}-${i}`}>
                <strong>{h.decision === 'verifie' ? 'Vérifié' : 'Rejeté'}</strong>
                <span>
                  {formatDate(h.createdAt)} · {h.verifierName}
                </span>
                {h.note && <span className="acan-muted">« {h.note} »</span>}
              </li>
            ))}
          </ul>
        </>
      )}

      {cv.submissions.length > 0 && (
        <>
          <p className="acan-label">Dépôts ({cv.submissions.length})</p>
          <ul className="acan-timeline">
            {cv.submissions.map((s, i) => (
              <li key={`${s.submittedAt}-${i}`}>
                <strong>
                  {formatDate(s.submittedAt)}
                  {s.current ? ' · CV en vigueur' : ''}
                </strong>
                <span>{s.flagCount > 0 ? plural(s.flagCount, 'point relevé', 'points relevés') : 'Aucun point relevé'}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      {cv.url && (
        <div className="acan-actions">
          <a href={apiFileUrl(cv.url)} target="_blank" rel="noreferrer" className="btn btn-outline btn-sm">
            <FileText size={14} aria-hidden />
            Ouvrir le CV (PDF)
          </a>
          <Link to={`/verification-cv?candidat=${detail.candidate.id}`} className="btn btn-ghost btn-sm">
            <FileCheck2 size={14} aria-hidden />
            Ouvrir dans la vérification des CV
          </Link>
        </div>
      )}
    </Card>
  )
}

function ExtractedBlock({ detail }: { detail: AdminCandidateAccountDetail }) {
  const x = detail.extracted
  if (!x) return null
  const empty =
    !x.professionalTitle &&
    !x.professionalSummary &&
    x.yearsOfExperience === null &&
    x.skillsNotInProfile.length === 0 &&
    x.technologies.length === 0 &&
    x.experiences.length === 0 &&
    x.education.length === 0 &&
    x.certifications.length === 0 &&
    x.languages.length === 0 &&
    x.projects.length === 0

  return (
    <section className="acan-extracted" aria-labelledby="acan-extracted-title">
      <div className="acan-card-head">
        <h3 className="acan-card-title" id="acan-extracted-title">
          <Sparkles size={16} aria-hidden />
          Suggestions extraites du CV, non confirmées
        </h3>
        <Pill tone="neutral">Confiance {CONFIDENCE_LABELS[x.confidence]}</Pill>
      </div>
      <p className="acan-extracted-notice">
        Lues automatiquement dans le CV{x.extractedAt ? ` le ${formatDate(x.extractedAt)}` : ''}. Le candidat ne les a
        pas confirmées : elles ne modifient pas son profil et n’entrent dans aucun score de matching.
      </p>

      {empty ? (
        <p className="acan-muted">
          Aucune donnée structurée extraite de ce CV (extraction automatique indisponible ou sans résultat lors du
          dépôt).
        </p>
      ) : (
        <div className="acan-extracted-grid">
          {(x.professionalTitle || x.yearsOfExperience !== null || x.professionalSummary) && (
            <div className="acan-extracted-item acan-extracted-wide">
              <p className="acan-label">Titre et résumé</p>
              {x.professionalTitle && <p className="acan-strong">{x.professionalTitle}</p>}
              {x.yearsOfExperience !== null && (
                <p>{plural(x.yearsOfExperience, 'an d’expérience', 'ans d’expérience')}</p>
              )}
              {x.professionalSummary && <p className="acan-muted">{x.professionalSummary}</p>}
            </div>
          )}

          <div className="acan-extracted-item acan-extracted-wide">
            <p className="acan-label">Compétences détectées, absentes du profil ({x.skillsNotInProfile.length})</p>
            {x.skillsNotInProfile.length > 0 ? (
              <div className="acan-badges">
                {x.skillsNotInProfile.map((skill) => (
                  <Badge key={skill} variant="muted">
                    {skill}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="acan-muted">Aucune : les compétences détectées figurent déjà dans le profil.</p>
            )}
            {x.technologies.length > 0 && (
              <p className="acan-muted acan-gap-sm">Outils cités : {x.technologies.join(', ')}</p>
            )}
          </div>

          <ExtractedList
            title="Expériences"
            items={x.experiences.map((e) => ({
              title: e.jobTitle ?? 'Poste non précisé',
              meta: [e.company, e.location, cvPeriod(e.startDate, e.endDate, e.isCurrent)].filter(Boolean).join(' · '),
            }))}
          />
          <ExtractedList
            title="Formations"
            items={x.education.map((e) => ({
              title: e.degree ?? 'Diplôme non précisé',
              meta: [e.school, e.field, cvDate(e.graduationDate)].filter(Boolean).join(' · '),
            }))}
          />
          <ExtractedList
            title="Langues"
            items={x.languages.map((l) => ({ title: l.name ?? '—', meta: l.level ?? '' }))}
          />
          {x.certifications.length > 0 && (
            <ExtractedList
              title="Certifications"
              items={x.certifications.map((cert) => ({
                title: cert.name ?? '—',
                meta: [cert.issuer, cvDate(cert.issueDate)].filter(Boolean).join(' · '),
              }))}
            />
          )}
          {x.projects.length > 0 && (
            <ExtractedList
              title="Projets"
              items={x.projects.map((pr) => ({ title: pr.name ?? '—', meta: [pr.role, pr.description].filter(Boolean).join(' · ') }))}
            />
          )}
        </div>
      )}
    </section>
  )
}

function ExtractedList({ title, items }: { title: string; items: { title: string; meta: string }[] }) {
  return (
    <div className="acan-extracted-item">
      <p className="acan-label">
        {title} ({items.length})
      </p>
      {items.length === 0 ? (
        <p className="acan-muted">Aucune donnée extraite.</p>
      ) : (
        <ul className="acan-timeline">
          {items.map((item, i) => (
            <li key={i}>
              <strong>{item.title}</strong>
              {item.meta && <span>{item.meta}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function DossierCard({ dossier: d }: { dossier: AdminCandidateDossier }) {
  const state = DOSSIER_STATUS[d.status]
  return (
    <Card className="acan-card acan-dossier">
      <div className="acan-dossier-head">
        <div className="acan-dossier-main">
          <p className="acan-dossier-title">{d.opportunity.title}</p>
          <p className="acan-muted">
            {d.opportunity.companyName} · {d.opportunity.city}
            {d.opportunity.expired ? ' · offre expirée' : ''}
          </p>
        </div>
        <span className={`acan-dossier-state acan-tone-${state.tone}`}>{state.label}</span>
      </div>

      <dl className="acan-dossier-facts">
        <div>
          <dt>Score</dt>
          <dd>{d.score}/100</dd>
        </div>
        <div>
          <dt>Origine</dt>
          <dd>{d.origin === 'systeme' ? 'Moteur de matching' : 'Admin'}</dd>
        </div>
        {d.preselectionRank !== null && (
          <div>
            <dt>Rang en présélection</dt>
            <dd>{d.preselectionRank}</dd>
          </div>
        )}
        <div>
          <dt>Créé le</dt>
          <dd>{formatDate(d.createdAt)}</dd>
        </div>
        <div>
          <dt>Mis à jour le</dt>
          <dd>{formatDate(d.updatedAt)}</dd>
        </div>
      </dl>
      {d.reasons.length > 0 && (
        <ul className="acan-reasons">
          {d.reasons.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
      )}

      <div className="acan-actions">
        <Link to={`/admin/mise-en-relation?offre=${d.opportunity.id}`} className="btn btn-outline btn-sm">
          <Handshake size={14} aria-hidden />
          Mise en relation de l’offre
        </Link>
        <Link to={`/admin/recruteurs?id=${d.recruiter.id}`} className="btn btn-ghost btn-sm">
          <BriefcaseBusiness size={14} aria-hidden />
          {d.recruiter.displayName}
        </Link>
      </div>
    </Card>
  )
}

