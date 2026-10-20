import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowUpRight, CalendarDays, CalendarSync, Eye, RotateCcw, Undo2 } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { Field, Select } from '../../components/ui/Form'
import { Loading } from '../../components/ui/Loading'
import { Modal } from '../../components/ui/Modal'
import {
  INTERVIEW_STATUSES,
  InterviewPeriodTabs,
  InterviewRow,
  InterviewStat,
  OUTCOME_FILTER_LABELS,
  RoundChips,
  groupInterviewsByOffer,
  pluralize,
  readOutcomeFilter,
} from '../../components/interview/InterviewList'
import { InterviewSummary } from '../../components/interview/InterviewSummary'
import { HiringPhaseBadge, hiringPhaseLabel } from '../../components/hiring/HiringPhaseBadge'
import { outcomeIsLastStep } from '../../components/hiring/hiringState'
import {
  ApiError,
  apiAdminInterviews,
  apiAdminResetOutcome,
  apiAdminResyncInterview,
  type AdminInterviewFilters,
  type AdminInterviewItem,
  type AdminInterviewList,
  type AdminRoundInterview,
} from '../../lib/api'
import { INTERVIEW_OUTCOME_FILTERS, INTERVIEW_RESULT_LABELS, RESULT_REASON_LABELS } from '../../lib/hiring'
import { INTERVIEW_STATUS_LABELS, calendarActionLabel, formatMadagascarDateTime } from '../../lib/interview'
import type { AdminInterview, InterviewPeriod, InterviewStatus } from '../../types'
import './AdminInterviews.css'

const PERIODS: InterviewPeriod[] = ['a_venir', 'passes', 'annules', 'tous']
const PAGE_SIZE = 30

type FilterName = 'periode' | 'statut' | 'offre' | 'recruteur' | 'agenda' | 'issue'
type Meta = Omit<AdminInterviewList, 'interviews'>
type Notice = { ok: boolean; text: string }

const readPeriod = (value: string | null): InterviewPeriod =>
  PERIODS.includes(value as InterviewPeriod) ? (value as InterviewPeriod) : 'a_venir'
const readStatus = (value: string | null): InterviewStatus | '' =>
  INTERVIEW_STATUSES.includes(value as InterviewStatus) ? (value as InterviewStatus) : ''

const candidateLabel = (item: AdminInterviewItem) => item.candidate.fullName || 'Candidat sans nom'

function errorText(err: unknown, fallback: string): string {
  return err instanceof ApiError && err.message ? err.message : fallback
}

/** Ligne dont l'issue est attendue : le tour actif d'un dossier « Issue à renseigner ». */
const isOutcomeRow = (item: AdminInterviewItem) =>
  item.phase === 'issue_a_renseigner' &&
  !item.interview.outcome &&
  item.interview.status !== 'annule' &&
  item.interview.status !== 'empechement'

function providerLabel(interview: AdminInterview): string {
  return interview.provider === 'google' ? 'Agenda : Google Calendar (OffRec)' : 'Agenda : simulé (Google non configuré)'
}

/**
 * Onglet « Entretiens » de l'admin : tous les entretiens de la plateforme,
 * groupés par offre (entreprise, recruteur), filtrés par période, statut,
 * offre, recruteur et « problème d'agenda ». Chaque ligne porte le
 * fournisseur d'agenda, l'erreur éventuelle et l'action de régularisation
 * (`calendarActionLabel`, même endpoint que « Mise en relation » : 409 en
 * mode simulé, affiché tel quel). Pagination « Charger plus ». Filtres
 * repris dans l'URL (`?periode=`, `?statut=`, `?offre=`, `?recruteur=`,
 * `?agenda=1`).
 */
export function AdminInterviews() {
  const [searchParams, setSearchParams] = useSearchParams()
  const period = readPeriod(searchParams.get('periode'))
  const status = readStatus(searchParams.get('statut'))
  const offerId = searchParams.get('offre') ?? ''
  const recruiterId = searchParams.get('recruteur') ?? ''
  const calendarIssue = searchParams.get('agenda') === '1'
  const outcome = readOutcomeFilter(searchParams.get('issue'))

  const [items, setItems] = useState<AdminInterviewItem[]>([])
  const [meta, setMeta] = useState<Meta | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [moreError, setMoreError] = useState('')
  const [notice, setNotice] = useState<Notice | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)
  /** Confirmation « Annuler l'issue » (remplace la modale de détail). */
  const [resetting, setResetting] = useState(false)
  const [resetBusy, setResetBusy] = useState(false)
  const [resetError, setResetError] = useState('')
  const requestRef = useRef(0)

  const filters: AdminInterviewFilters = {
    period,
    status: status || undefined,
    opportunityId: offerId || undefined,
    recruiterId: recruiterId || undefined,
    calendarIssue: calendarIssue || undefined,
    outcome: outcome || undefined,
  }
  const filtersKey = JSON.stringify(filters)

  /** Recharge depuis le début (`keep` : autant de lignes que déjà affichées, 100 au plus). */
  const load = useCallback(
    async (keep = 0) => {
      const requestId = ++requestRef.current
      setLoading(true)
      setError('')
      setMoreError('')
      try {
        const result = await apiAdminInterviews(JSON.parse(filtersKey) as AdminInterviewFilters, {
          limit: Math.min(100, Math.max(PAGE_SIZE, keep)),
        })
        if (requestId !== requestRef.current) return
        const { interviews, ...rest } = result
        setItems(interviews)
        setMeta(rest)
      } catch (err) {
        if (requestId !== requestRef.current) return
        setError(errorText(err, 'Impossible de charger les entretiens.'))
      } finally {
        if (requestId === requestRef.current) setLoading(false)
      }
    },
    [filtersKey],
  )

  useEffect(() => {
    void load()
  }, [load])

  const loadMore = async () => {
    if (!meta?.nextOffset || loadingMore) return
    const requestId = requestRef.current
    setLoadingMore(true)
    setMoreError('')
    try {
      const result = await apiAdminInterviews(filters, { offset: meta.nextOffset, limit: PAGE_SIZE })
      if (requestId !== requestRef.current) return
      const { interviews, ...rest } = result
      setItems((current) => {
        const seen = new Set(current.map((item) => item.interview.id))
        return [...current, ...interviews.filter((item) => !seen.has(item.interview.id))]
      })
      setMeta(rest)
    } catch (err) {
      if (requestId === requestRef.current) setMoreError(errorText(err, 'Impossible de charger la suite.'))
    } finally {
      setLoadingMore(false)
    }
  }

  const setFilters = (patch: Partial<Record<FilterName, string>>) => {
    setNotice(null)
    const next = new URLSearchParams(searchParams)
    for (const [name, value] of Object.entries(patch)) {
      const isDefault = !value || (name === 'periode' && value === 'a_venir')
      if (isDefault) next.delete(name)
      else next.set(name, value)
    }
    // Une offre d'un autre recruteur ne reste pas sélectionnée.
    const nextRecruiter = next.get('recruteur')
    const nextOffer = next.get('offre')
    if (nextRecruiter && nextOffer) {
      const offer = meta?.offers.find((o) => o.id === nextOffer)
      if (offer && offer.recruiterId !== nextRecruiter) next.delete('offre')
    }
    setSearchParams(next, { replace: true })
  }

  const resetFilters = () => {
    setNotice(null)
    setSearchParams(new URLSearchParams(), { replace: true })
  }

  const handleResync = async (interview: AdminInterview) => {
    if (busyId) return
    setBusyId(interview.id)
    setNotice(null)
    try {
      const { interview: updated } = await apiAdminResyncInterview(interview.id)
      setNotice({
        ok: true,
        text:
          updated.meetStatus === 'disponible'
            ? 'Agenda Google à jour : le lien Meet est disponible pour le candidat et le recruteur.'
            : 'Agenda Google à jour.',
      })
    } catch (err) {
      // 409 : agenda Google non configuré (mode simulé), entretien terminé ou
      // annulé sans événement ; 502 : Google échoue encore. Message du serveur.
      setNotice({ ok: false, text: errorText(err, 'Synchronisation impossible.') })
    } finally {
      setBusyId(null)
      void load(items.length)
    }
  }

  const openDetail = (id: string) => {
    setNotice(null)
    setResetting(false)
    setResetError('')
    setDetailId(id)
  }

  const closeDetail = () => {
    if (resetBusy) return
    if (resetting) {
      // Échap ou « Garder l'issue » : retour au détail, un seul niveau.
      setResetting(false)
      setResetError('')
      return
    }
    setDetailId(null)
  }

  const confirmReset = async (interview: AdminRoundInterview) => {
    if (resetBusy) return
    setResetBusy(true)
    setResetError('')
    try {
      await apiAdminResetOutcome(interview.id)
      setResetting(false)
      setNotice({
        ok: true,
        text: 'Issue annulée : le tour redevient « Issue à renseigner » et le recruteur est prévenu. Le candidat n’est pas notifié.',
      })
      await load(items.length)
    } catch (err) {
      // 409 : une suite existe déjà (tour suivant ou proposition), ou l'issue a changé.
      setResetError(errorText(err, 'Annulation impossible. Réessayez.'))
    } finally {
      setResetBusy(false)
    }
  }

  const groups = groupInterviewsByOffer(items)
  const detail = detailId ? items.find((item) => item.interview.id === detailId) ?? null : null
  const filtered =
    period !== 'a_venir' || status !== '' || offerId !== '' || recruiterId !== '' || calendarIssue || outcome !== ''
  const offerOptions = (meta?.offers ?? []).filter((o) => !recruiterId || o.recruiterId === recruiterId)
  const counts = meta?.counts
  const scoped = offerId !== '' || recruiterId !== ''

  const noticeBlock = notice && (
    <p className={`ivl-notice ${notice.ok ? 'is-ok' : 'is-error'}`} role={notice.ok ? 'status' : 'alert'}>
      {notice.text}
    </p>
  )

  const calendarButton = (interview: AdminInterview) => {
    const label = calendarActionLabel(interview)
    if (!label) return null
    const busy = busyId === interview.id
    return (
      <Button
        variant="outline"
        size="sm"
        disabled={busyId !== null}
        aria-busy={busy}
        onClick={() => void handleResync(interview)}
      >
        <CalendarSync size={14} aria-hidden />
        {busy ? 'Synchronisation…' : label}
      </Button>
    )
  }

  return (
    <div className="page">
      <div className="container">
        <header className="page-header">
          <h1>Entretiens</h1>
          <p>
            Tous les entretiens fixés par les recruteurs, groupés par offre. Dates et heures en heure de Madagascar.
            Les problèmes d’agenda (lien simulé, lien en attente, échec Google) se régularisent ici ou depuis « Mise en
            relation ».
          </p>
        </header>

        {counts && (
          <div className="ivl-stats" aria-label={scoped ? 'Compteurs de la sélection' : 'Compteurs de la plateforme'}>
            <InterviewStat
              value={counts.upcoming}
              label={counts.upcoming > 1 ? 'entretiens à venir' : 'entretien à venir'}
              active={period === 'a_venir' && !status && !calendarIssue && !outcome}
              onClick={() => setFilters({ periode: 'a_venir', statut: '', agenda: '', issue: '' })}
            />
            <InterviewStat
              value={counts.toRecord ?? 0}
              label={(counts.toRecord ?? 0) > 1 ? 'issues à renseigner' : 'issue à renseigner'}
              tone="warning"
              active={outcome === 'a_renseigner' && !status && !calendarIssue}
              onClick={() => setFilters({ periode: 'tous', statut: '', agenda: '', issue: 'a_renseigner' })}
            />
            <InterviewStat
              value={counts.noShows ?? 0}
              label={(counts.noShows ?? 0) > 1 ? 'absences' : 'absence'}
              tone="warning"
              active={outcome === 'absent' && !status && !calendarIssue}
              onClick={() => setFilters({ periode: 'tous', statut: '', agenda: '', issue: 'absent' })}
            />
            <InterviewStat
              value={counts.impediments}
              label={counts.impediments > 1 ? 'empêchements signalés' : 'empêchement signalé'}
              tone="warning"
              active={status === 'empechement' && !calendarIssue && !outcome}
              onClick={() => setFilters({ periode: 'tous', statut: 'empechement', agenda: '', issue: '' })}
            />
            <InterviewStat
              value={counts.calendarIssues}
              label={counts.calendarIssues > 1 ? 'problèmes d’agenda' : 'problème d’agenda'}
              tone="danger"
              active={calendarIssue && !outcome}
              onClick={() => setFilters({ periode: 'tous', statut: '', agenda: '1', issue: '' })}
            />
          </div>
        )}

        <div className="ivl-filters">
          <InterviewPeriodTabs value={period} onChange={(value) => setFilters({ periode: value })} />
          <Field label="Statut">
            <Select value={status} onChange={(e) => setFilters({ statut: e.target.value })}>
              <option value="">Tous les statuts</option>
              {INTERVIEW_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {INTERVIEW_STATUS_LABELS[value]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Issue">
            <Select value={outcome} onChange={(e) => setFilters({ issue: e.target.value })}>
              <option value="">Toutes les issues</option>
              {INTERVIEW_OUTCOME_FILTERS.map((value) => (
                <option key={value} value={value}>
                  {OUTCOME_FILTER_LABELS[value]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Recruteur">
            <Select value={recruiterId} onChange={(e) => setFilters({ recruteur: e.target.value })}>
              <option value="">Tous les recruteurs</option>
              {meta?.recruiters.map((recruiter) => (
                <option key={recruiter.id} value={recruiter.id}>
                  {recruiter.companyName}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Offre">
            <Select value={offerId} onChange={(e) => setFilters({ offre: e.target.value })}>
              <option value="">Toutes les offres</option>
              {offerOptions.map((offer) => (
                <option key={offer.id} value={offer.id}>
                  {offer.title} — {offer.companyName}
                </option>
              ))}
            </Select>
          </Field>
          <label className="ivl-check">
            <input
              type="checkbox"
              checked={calendarIssue}
              onChange={(e) => setFilters({ agenda: e.target.checked ? '1' : '' })}
            />
            Problème d’agenda uniquement
          </label>
        </div>

        {!detail && noticeBlock}

        {error ? (
          <div className="ivl-error" role="alert">
            <span>{error}</span>
            <Button variant="outline" size="sm" onClick={() => void load()}>
              <RotateCcw size={14} aria-hidden />
              Réessayer
            </Button>
          </div>
        ) : loading && !meta ? (
          <Loading label="Chargement des entretiens…" />
        ) : items.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title={filtered ? 'Aucun entretien pour ces filtres' : 'Aucun entretien à venir'}
            description={
              filtered
                ? 'Modifiez la période, le statut, l’issue, l’offre, le recruteur ou le filtre agenda.'
                : 'Les recruteurs fixent les entretiens depuis « Candidats proposés » → « Ce profil m’intéresse » ; la mise en relation est faite en même temps.'
            }
            actionLabel={filtered ? 'Réinitialiser les filtres' : undefined}
            onAction={filtered ? resetFilters : undefined}
          />
        ) : (
          <div className="aint-groups" aria-busy={loading}>
            {groups.map((group) => {
              const first = group.items[0]
              const headingId = `aint-offer-${group.id}`
              return (
                <section key={group.id} className="ivl-group" aria-labelledby={headingId}>
                  <div className="ivl-group-head">
                    <div>
                      <h2 className="ivl-group-title" id={headingId}>
                        {first.opportunity.title}
                      </h2>
                      <p className="ivl-group-sub">
                        {first.opportunity.companyName}
                        {first.recruiter.companyName !== first.opportunity.companyName &&
                          ` · recruteur : ${first.recruiter.companyName}`}
                      </p>
                    </div>
                    <div className="ivl-group-side">
                      <span className="ivl-chip">{pluralize(group.items.length, 'entretien affiché', 'entretiens affichés')}</span>
                      <Link
                        className="ivl-group-link"
                        to={`/admin/mise-en-relation?offre=${encodeURIComponent(group.id)}`}
                        aria-label={`Ouvrir le dossier de l’offre « ${first.opportunity.title} » dans Mise en relation`}
                      >
                        Dossier
                        <ArrowUpRight size={14} aria-hidden />
                      </Link>
                    </div>
                  </div>
                  <ul className="ivl-list">
                    {group.items.map((item) => (
                      <InterviewRow
                        key={item.interview.id}
                        audience="admin"
                        interview={item.interview}
                        heading={candidateLabel(item)}
                        meta={
                          item.suggestionStatus !== 'mise_en_relation'
                            ? 'Dossier sorti de la mise en relation'
                            : item.phase
                              ? `Dossier : ${hiringPhaseLabel({ audience: 'admin', phase: item.phase })}`
                              : undefined
                        }
                        flag={isOutcomeRow(item) ? 'Issue à renseigner' : undefined}
                        badges={<RoundChips interview={item.interview} showRound showOutcome />}
                        extra={
                          <>
                            <span>{providerLabel(item.interview)}</span>
                            {item.interview.calendarError && (
                              <span className="aint-calendar-error"> · À régulariser : {item.interview.calendarError}</span>
                            )}
                            {item.interview.outcomeReason && (
                              <span className="aint-outcome-line">
                                Motif : {RESULT_REASON_LABELS[item.interview.outcomeReason]}
                              </span>
                            )}
                            {item.interview.absenceReply && (
                              <span className="aint-outcome-line">
                                Explication du candidat : « {item.interview.absenceReply} »
                              </span>
                            )}
                          </>
                        }
                        actions={
                          <>
                            {calendarButton(item.interview)}
                            <Button
                              variant="outline"
                              size="sm"
                              aria-haspopup="dialog"
                              aria-label={`Voir l’entretien de ${candidateLabel(item)}`}
                              onClick={() => openDetail(item.interview.id)}
                            >
                              <Eye size={14} aria-hidden />
                              Voir
                            </Button>
                          </>
                        }
                      />
                    ))}
                  </ul>
                </section>
              )
            })}

            <div className="ivl-more">
              <span>
                {items.length} sur {meta?.total ?? items.length} {(meta?.total ?? 0) > 1 ? 'entretiens' : 'entretien'}
              </span>
              {moreError && (
                <span className="aint-more-error" role="alert">
                  {moreError}
                </span>
              )}
              {meta?.nextOffset != null && (
                <Button variant="outline" size="sm" disabled={loadingMore} aria-busy={loadingMore} onClick={() => void loadMore()}>
                  {loadingMore ? 'Chargement…' : 'Charger plus'}
                </Button>
              )}
            </div>
          </div>
        )}

        {detail && resetting && detail.interview.outcome && (
          <Modal key="reset" title="Annuler l’issue ?" onClose={closeDetail}>
            <p className="aint-modal-text">
              L’issue « {INTERVIEW_RESULT_LABELS[detail.interview.outcome]} » du tour {detail.interview.round ?? 1}{' '}
              (entretien de <strong>{candidateLabel(detail)}</strong> du{' '}
              {formatMadagascarDateTime(detail.interview.scheduledAt)}) sera effacée, avec son motif et la note du
              recruteur. Le tour redevient « Issue à renseigner » et le recruteur est prévenu ; le candidat n’est pas
              notifié. À réserver à une erreur de saisie.
            </p>
            {resetError && (
              <p className="ivl-notice is-error" role="alert">
                {resetError}
              </p>
            )}
            <div className="aint-modal-actions">
              <Button variant="ghost" size="sm" disabled={resetBusy} onClick={closeDetail}>
                Garder l’issue
              </Button>
              <Button
                variant="danger"
                size="sm"
                disabled={resetBusy}
                aria-busy={resetBusy}
                onClick={() => void confirmReset(detail.interview)}
              >
                {resetBusy ? 'Annulation…' : 'Annuler l’issue'}
              </Button>
            </div>
          </Modal>
        )}

        {detail && !resetting && (
          <Modal key="detail" title={`Entretien de ${candidateLabel(detail)}`} onClose={closeDetail}>
            <div className="aint-modal-head">
              <p className="aint-modal-offer">
                {detail.opportunity.title} · {detail.opportunity.companyName}
              </p>
              {detail.phase && <HiringPhaseBadge audience="admin" phase={detail.phase} />}
            </div>
            {noticeBlock}
            {(detail.interview.outcome || (detail.interview.round ?? 1) > 1) && (
              <dl className="aint-outcome">
                <div>
                  <dt>Tour</dt>
                  <dd>{detail.interview.round ?? 1}</dd>
                </div>
                {detail.interview.outcome && (
                  <div>
                    <dt>Issue</dt>
                    <dd>{INTERVIEW_RESULT_LABELS[detail.interview.outcome]}</dd>
                  </div>
                )}
                {detail.interview.outcomeReason && (
                  <div>
                    <dt>Motif</dt>
                    <dd>{RESULT_REASON_LABELS[detail.interview.outcomeReason]}</dd>
                  </div>
                )}
                {detail.interview.absenceReply && (
                  <div>
                    <dt>Explication du candidat</dt>
                    <dd>« {detail.interview.absenceReply} »</dd>
                  </div>
                )}
              </dl>
            )}
            <InterviewSummary interview={detail.interview} audience="admin" title="Récapitulatif">
              {outcomeIsLastStep(detail.interview, detail.phase) && (
                <Button
                  variant="outline"
                  size="sm"
                  aria-haspopup="dialog"
                  onClick={() => {
                    setNotice(null)
                    setResetError('')
                    setResetting(true)
                  }}
                >
                  <Undo2 size={14} aria-hidden />
                  Annuler l’issue
                </Button>
              )}
              {calendarButton(detail.interview)}
              <Link
                className="aint-modal-link"
                to={`/admin/mise-en-relation?offre=${encodeURIComponent(detail.opportunity.id)}`}
              >
                Ouvrir le dossier dans Mise en relation
                <ArrowUpRight size={14} aria-hidden />
              </Link>
            </InterviewSummary>
          </Modal>
        )}
      </div>
    </div>
  )
}
