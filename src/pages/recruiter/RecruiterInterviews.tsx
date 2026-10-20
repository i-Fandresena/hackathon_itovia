import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CalendarDays, ClipboardCheck, Eye, RotateCcw, Send } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { Field, Select } from '../../components/ui/Form'
import { Loading } from '../../components/ui/Loading'
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
import {
  RecruiterInterviewDetail,
  type RecruiterInterviewEntry,
} from '../../components/interview/RecruiterInterviewDetail'
import { connectedDossierState, pendingProposal, proposalsOf, roundsOf } from '../../components/hiring/hiringState'
import { useApp } from '../../context/AppContext'
import {
  ApiError,
  apiRecruiterInterviews,
  type RecruiterInterviewItem,
  type RecruiterInterviewList,
} from '../../lib/api'
import { INTERVIEW_OUTCOME_FILTERS, checkHiringAction, sortRounds } from '../../lib/hiring'
import { INTERVIEW_STATUS_LABELS, formatMadagascarShortDateTime } from '../../lib/interview'
import type { InterviewPeriod, InterviewStatus } from '../../types'
import './RecruiterInterviews.css'

const PERIODS: InterviewPeriod[] = ['a_venir', 'passes', 'annules', 'tous']

type FilterName = 'periode' | 'statut' | 'offre' | 'issue'

const readPeriod = (value: string | null): InterviewPeriod =>
  PERIODS.includes(value as InterviewPeriod) ? (value as InterviewPeriod) : 'a_venir'
const readStatus = (value: string | null): InterviewStatus | '' =>
  INTERVIEW_STATUSES.includes(value as InterviewStatus) ? (value as InterviewStatus) : ''

const candidateLabel = (item: RecruiterInterviewItem) => item.candidate.fullName || 'Candidat'

/** Ligne dont l'issue est attendue : le tour actif d'un dossier « Issue à renseigner ». */
const isOutcomeRow = (item: RecruiterInterviewItem) =>
  item.phase === 'issue_a_renseigner' &&
  !item.interview.outcome &&
  item.interview.status !== 'annule' &&
  item.interview.status !== 'empechement'

/**
 * Onglet « Entretiens » du recruteur : les entretiens de ses offres (un
 * tour par ligne), groupés par offre, filtrés par période (à venir par
 * défaut), statut, offre et issue. Le détail s'ouvre dans la même modale que
 * « Candidats proposés » (`RecruiterInterviewDetail`), avec l'historique des
 * tours du dossier lu dans `receivedSuggestions`. Les entretiens se créent
 * depuis « Candidats proposés » → « Ce profil m'intéresse ». Filtres repris
 * dans l'URL (`?periode=`, `?statut=`, `?offre=`, `?issue=`).
 */
export function RecruiterInterviews() {
  const navigate = useNavigate()
  const { refreshDossiers, receivedSuggestions } = useApp()
  const [searchParams, setSearchParams] = useSearchParams()
  const period = readPeriod(searchParams.get('periode'))
  const status = readStatus(searchParams.get('statut'))
  const offerId = searchParams.get('offre') ?? ''
  const outcome = readOutcomeFilter(searchParams.get('issue'))

  const [data, setData] = useState<RecruiterInterviewList | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [detail, setDetail] = useState<{ suggestionId: string; entry: RecruiterInterviewEntry } | null>(null)
  const [notice, setNotice] = useState('')
  const requestRef = useRef(0)

  const load = useCallback(async () => {
    const requestId = ++requestRef.current
    setLoading(true)
    setError('')
    try {
      const result = await apiRecruiterInterviews({
        period,
        status: status || undefined,
        opportunityId: offerId || undefined,
        outcome: outcome || undefined,
      })
      if (requestId !== requestRef.current) return
      setData(result)
    } catch (err) {
      if (requestId !== requestRef.current) return
      setError(err instanceof ApiError ? err.message : 'Impossible de charger les entretiens.')
    } finally {
      if (requestId === requestRef.current) setLoading(false)
    }
  }, [period, status, offerId, outcome])

  useEffect(() => {
    void load()
  }, [load])

  /** Applique un ou plusieurs filtres d'un coup (valeur par défaut = retirée de l'URL). */
  const setFilters = (patch: Partial<Record<FilterName, string>>) => {
    setNotice('')
    const next = new URLSearchParams(searchParams)
    for (const [name, value] of Object.entries(patch)) {
      const isDefault = !value || (name === 'periode' && value === 'a_venir')
      if (isDefault) next.delete(name)
      else next.set(name, value)
    }
    setSearchParams(next, { replace: true })
  }

  const resetFilters = () => {
    setNotice('')
    setSearchParams(new URLSearchParams(), { replace: true })
  }

  const handleChanged = async (text: string) => {
    setNotice(text)
    await Promise.all([load(), refreshDossiers()])
  }

  /** Proposition changée entre-temps (409) : relecture sans message. */
  const handleRefresh = async () => {
    await Promise.all([load(), refreshDossiers()])
  }

  const openDetail = (item: RecruiterInterviewItem, entry: RecruiterInterviewEntry = 'detail') => {
    setNotice('')
    setDetail({ suggestionId: item.suggestionId, entry })
  }

  const items = data?.interviews ?? []
  const groups = groupInterviewsByOffer(items)
  const offerById = new Map((data?.offers ?? []).map((offer) => [offer.id, offer]))
  const dossierById = new Map(receivedSuggestions.map((s) => [s.id, s]))
  const roundCount = (suggestionId: string) => {
    const dossier = dossierById.get(suggestionId)
    return dossier ? roundsOf(dossier).length : items.filter((item) => item.suggestionId === suggestionId).length
  }
  /** Propositions du dossier : toutes les versions (`receivedSuggestions`), sinon la dernière de la ligne. */
  const proposalsFor = (item: RecruiterInterviewItem) => {
    const dossier = dossierById.get(item.suggestionId)
    return dossier ? proposalsOf(dossier) : proposalsOf({ proposal: item.proposal })
  }
  /** « Faire une proposition » sur la ligne du tour « Retenu » (règles de src/lib/hiring.ts). */
  const canPropose = (item: RecruiterInterviewItem) => {
    if (item.phase !== 'retenu' || item.interview.outcome !== 'retenu') return false
    const dossier = dossierById.get(item.suggestionId)
    const state = connectedDossierState(dossier ? roundsOf(dossier) : [item.interview], {
      proposals: proposalsFor(item),
      placement: dossier?.placement ?? null,
      phase: item.phase,
    })
    return checkHiringAction({ actor: 'recruiter', action: 'send_proposal', state, now: new Date() }).ok
  }
  const filtered = period !== 'a_venir' || status !== '' || offerId !== '' || outcome !== ''
  const counts = data?.counts
  const toRecord = counts?.toRecord ?? 0

  // Détail : le dossier complet (tous ses tours) vient de `receivedSuggestions` ;
  // à défaut, les tours de la liste. Relu à chaque rendu.
  const detailItem = detail ? items.find((item) => item.suggestionId === detail.suggestionId) ?? null : null
  const detailDossier = detail ? dossierById.get(detail.suggestionId) ?? null : null
  const detailRounds = detailDossier
    ? roundsOf(detailDossier)
    : sortRounds(items.filter((item) => item.suggestionId === detail?.suggestionId).map((item) => item.interview))
  const detailInterview = detailDossier?.interview ?? detailRounds[detailRounds.length - 1] ?? null
  const detailName = detailItem
    ? candidateLabel(detailItem)
    : detailDossier?.candidate.candidateProfile?.fullName || 'Candidat'
  const detailTitle = detailItem?.opportunity.title ?? detailDossier?.opportunity.title ?? ''

  return (
    <div className="page">
      <div className="container">
        <header className="page-header">
          <h1>Entretiens</h1>
          <p>
            Les entretiens fixés avec les candidats que vous a proposés OffRec, groupés par offre. Dates et heures en
            heure de Madagascar. Une fois l’heure de fin passée, renseignez l’issue de chaque entretien.
          </p>
        </header>

        {counts && counts.total > 0 && (
          <div className="ivl-stats" aria-label="Compteurs">
            <InterviewStat
              value={counts.upcoming}
              label={counts.upcoming > 1 ? 'entretiens à venir' : 'entretien à venir'}
              active={period === 'a_venir' && !status && !outcome}
              onClick={() => setFilters({ periode: 'a_venir', statut: '', issue: '' })}
            />
            <InterviewStat
              value={toRecord}
              label={toRecord > 1 ? 'issues à renseigner' : 'issue à renseigner'}
              tone="warning"
              active={outcome === 'a_renseigner'}
              onClick={() => setFilters({ periode: 'tous', statut: '', issue: 'a_renseigner' })}
            />
            <InterviewStat
              value={counts.toHandle}
              label="à traiter (empêchement signalé)"
              tone="warning"
              active={status === 'empechement' && !outcome}
              onClick={() => setFilters({ periode: 'tous', statut: 'empechement', issue: '' })}
            />
          </div>
        )}

        {counts && counts.total > 0 && (
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
            {(data?.offers.length ?? 0) > 1 && (
              <Field label="Offre">
                <Select value={offerId} onChange={(e) => setFilters({ offre: e.target.value })}>
                  <option value="">Toutes mes offres</option>
                  {data?.offers.map((offer) => (
                    <option key={offer.id} value={offer.id}>
                      {offer.title}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
          </div>
        )}

        {notice && !detail && (
          <p className="ivl-notice is-ok" role="status">
            {notice}
          </p>
        )}

        {error ? (
          <div className="ivl-error" role="alert">
            <span>{error}</span>
            <Button variant="outline" size="sm" onClick={() => void load()}>
              <RotateCcw size={14} aria-hidden />
              Réessayer
            </Button>
          </div>
        ) : loading && !data ? (
          <Loading label="Chargement des entretiens…" />
        ) : counts && counts.total === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title="Aucun entretien pour l’instant"
            description="Les entretiens se créent depuis « Candidats proposés » : cliquez sur « Ce profil m’intéresse » sur un profil, puis choisissez une date. La mise en relation est faite en même temps."
            actionLabel="Voir les candidats proposés"
            onAction={() => navigate('/recruteur/candidatures')}
          />
        ) : items.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title="Aucun entretien pour ces filtres"
            description={
              outcome === 'a_renseigner'
                ? 'Aucune issue à renseigner : chaque entretien terminé a déjà son issue.'
                : period === 'a_venir'
                  ? 'Aucun entretien à venir ne correspond. Les nouveaux entretiens se fixent depuis « Candidats proposés » → « Ce profil m’intéresse ».'
                  : 'Modifiez la période, le statut, l’issue ou l’offre pour voir d’autres entretiens.'
            }
            actionLabel={filtered ? 'Réinitialiser les filtres' : undefined}
            onAction={filtered ? resetFilters : undefined}
          />
        ) : (
          <div className="rint-groups" aria-busy={loading}>
            {data?.truncated && (
              <p className="rint-truncated">Seuls vos 1 000 entretiens les plus anciens sont pris en compte.</p>
            )}
            {groups.map((group) => {
              const offer = offerById.get(group.id)
              const title = offer?.title ?? group.items[0].opportunity.title
              const headingId = `rint-offer-${group.id}`
              return (
                <section key={group.id} className="ivl-group" aria-labelledby={headingId}>
                  <div className="ivl-group-head">
                    <h2 className="ivl-group-title" id={headingId}>
                      {title}
                    </h2>
                    {offer && (
                      <div className="ivl-group-side">
                        <span className="ivl-chip">{pluralize(offer.upcoming, 'à venir', 'à venir')}</span>
                        {(offer.toRecord ?? 0) > 0 && (
                          <span className="ivl-chip is-warning">
                            {pluralize(offer.toRecord ?? 0, 'issue à renseigner', 'issues à renseigner')}
                          </span>
                        )}
                        {offer.toHandle > 0 && (
                          <span className="ivl-chip is-warning">{pluralize(offer.toHandle, 'à traiter', 'à traiter')}</span>
                        )}
                      </div>
                    )}
                  </div>
                  <ul className="ivl-list">
                    {group.items.map((item) => {
                      const due = isOutcomeRow(item)
                      const propose = !due && canPropose(item)
                      const pending = item.interview.outcome === 'retenu' ? pendingProposal(proposalsFor(item)) : undefined
                      return (
                        <InterviewRow
                          key={item.interview.id}
                          audience="recruiter"
                          interview={item.interview}
                          heading={candidateLabel(item)}
                          flag={
                            due
                              ? 'Issue à renseigner'
                              : pending
                                ? `Proposition : réponse avant le ${formatMadagascarShortDateTime(pending.expiresAt)}`
                                : undefined
                          }
                          badges={
                            <RoundChips
                              interview={item.interview}
                              showRound={roundCount(item.suggestionId) > 1 || (item.interview.round ?? 1) > 1}
                              showOutcome
                            />
                          }
                          actions={
                            <>
                              {due && (
                                <Button
                                  size="sm"
                                  aria-haspopup="dialog"
                                  aria-label={`Renseigner l’issue de l’entretien avec ${candidateLabel(item)}`}
                                  onClick={() => openDetail(item, 'outcome')}
                                >
                                  <ClipboardCheck size={14} aria-hidden />
                                  Renseigner l’issue
                                </Button>
                              )}
                              {propose && (
                                <Button
                                  size="sm"
                                  aria-haspopup="dialog"
                                  aria-label={`Faire une proposition d’embauche à ${candidateLabel(item)}`}
                                  onClick={() => openDetail(item, 'proposal')}
                                >
                                  <Send size={14} aria-hidden />
                                  Faire une proposition
                                </Button>
                              )}
                              <Button
                                variant="outline"
                                size="sm"
                                aria-haspopup="dialog"
                                aria-label={`Voir l’entretien avec ${candidateLabel(item)}`}
                                onClick={() => openDetail(item)}
                              >
                                <Eye size={14} aria-hidden />
                                Voir
                              </Button>
                            </>
                          }
                        />
                      )
                    })}
                  </ul>
                </section>
              )
            })}
          </div>
        )}

        {detail && detailInterview && (
          <RecruiterInterviewDetail
            target={{
              suggestionId: detail.suggestionId,
              candidateName: detailName,
              opportunityTitle: detailTitle,
              interview: detailInterview,
              rounds: detailRounds,
              phase: detailDossier?.phase ?? detailItem?.phase ?? null,
              proposals: detailDossier ? proposalsOf(detailDossier) : proposalsOf({ proposal: detailItem?.proposal }),
              placement: detailDossier?.placement ?? null,
              canManage: true,
            }}
            initialStep={detail.entry}
            onClose={() => setDetail(null)}
            onChanged={handleChanged}
            onRefresh={handleRefresh}
          />
        )}
      </div>
    </div>
  )
}
