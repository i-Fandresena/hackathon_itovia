import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CalendarDays, Eye, RotateCcw } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { Field, Select } from '../../components/ui/Form'
import { Loading } from '../../components/ui/Loading'
import {
  INTERVIEW_STATUSES,
  InterviewPeriodTabs,
  InterviewRow,
  InterviewStat,
  groupInterviewsByOffer,
  pluralize,
} from '../../components/interview/InterviewList'
import { RecruiterInterviewDetail } from '../../components/interview/RecruiterInterviewDetail'
import { useApp } from '../../context/AppContext'
import {
  ApiError,
  apiRecruiterInterviews,
  type RecruiterInterviewItem,
  type RecruiterInterviewList,
} from '../../lib/api'
import { INTERVIEW_STATUS_LABELS } from '../../lib/interview'
import type { InterviewPeriod, InterviewStatus } from '../../types'
import './RecruiterInterviews.css'

const PERIODS: InterviewPeriod[] = ['a_venir', 'passes', 'annules', 'tous']

const readPeriod = (value: string | null): InterviewPeriod =>
  PERIODS.includes(value as InterviewPeriod) ? (value as InterviewPeriod) : 'a_venir'
const readStatus = (value: string | null): InterviewStatus | '' =>
  INTERVIEW_STATUSES.includes(value as InterviewStatus) ? (value as InterviewStatus) : ''

const candidateLabel = (item: RecruiterInterviewItem) => item.candidate.fullName || 'Candidat'

/**
 * Onglet « Entretiens » du recruteur : les entretiens de ses offres,
 * groupés par offre, filtrés par période (à venir par défaut), statut et
 * offre. Le détail s'ouvre dans la même modale que « Candidats proposés »
 * (`RecruiterInterviewDetail`). Les entretiens se créent depuis « Candidats
 * proposés » → « Ce profil m'intéresse ». Filtres repris dans l'URL
 * (`?periode=`, `?statut=`, `?offre=`) pour pouvoir partager ou revenir.
 */
export function RecruiterInterviews() {
  const navigate = useNavigate()
  const { refreshDossiers } = useApp()
  const [searchParams, setSearchParams] = useSearchParams()
  const period = readPeriod(searchParams.get('periode'))
  const status = readStatus(searchParams.get('statut'))
  const offerId = searchParams.get('offre') ?? ''

  const [data, setData] = useState<RecruiterInterviewList | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [detailId, setDetailId] = useState<string | null>(null)
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
      })
      if (requestId !== requestRef.current) return
      setData(result)
    } catch (err) {
      if (requestId !== requestRef.current) return
      setError(err instanceof ApiError ? err.message : 'Impossible de charger les entretiens.')
    } finally {
      if (requestId === requestRef.current) setLoading(false)
    }
  }, [period, status, offerId])

  useEffect(() => {
    void load()
  }, [load])

  /** Applique un ou plusieurs filtres d'un coup (valeur par défaut = retirée de l'URL). */
  const setFilters = (patch: Partial<Record<'periode' | 'statut' | 'offre', string>>) => {
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

  const items = data?.interviews ?? []
  const groups = groupInterviewsByOffer(items)
  const offerById = new Map((data?.offers ?? []).map((offer) => [offer.id, offer]))
  const detail = detailId ? items.find((item) => item.suggestionId === detailId) ?? null : null
  const filtered = period !== 'a_venir' || status !== '' || offerId !== ''
  const counts = data?.counts

  return (
    <div className="page">
      <div className="container">
        <header className="page-header">
          <h1>Entretiens</h1>
          <p>
            Les entretiens fixés avec les candidats que vous a proposés OffRec, groupés par offre. Dates et heures en
            heure de Madagascar.
          </p>
        </header>

        {counts && counts.total > 0 && (
          <div className="ivl-stats" aria-label="Compteurs">
            <InterviewStat
              value={counts.upcoming}
              label={counts.upcoming > 1 ? 'entretiens à venir' : 'entretien à venir'}
              active={period === 'a_venir' && !status}
              onClick={() => setFilters({ periode: 'a_venir', statut: '' })}
            />
            <InterviewStat
              value={counts.toHandle}
              label="à traiter (empêchement signalé)"
              tone="warning"
              active={status === 'empechement'}
              onClick={() => setFilters({ periode: 'tous', statut: 'empechement' })}
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
              period === 'a_venir'
                ? 'Aucun entretien à venir ne correspond. Les nouveaux entretiens se fixent depuis « Candidats proposés » → « Ce profil m’intéresse ».'
                : 'Modifiez la période, le statut ou l’offre pour voir d’autres entretiens.'
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
                        {offer.toHandle > 0 && (
                          <span className="ivl-chip is-warning">{pluralize(offer.toHandle, 'à traiter', 'à traiter')}</span>
                        )}
                      </div>
                    )}
                  </div>
                  <ul className="ivl-list">
                    {group.items.map((item) => (
                      <InterviewRow
                        key={item.interview.id}
                        audience="recruiter"
                        interview={item.interview}
                        heading={candidateLabel(item)}
                        actions={
                          <Button
                            variant="outline"
                            size="sm"
                            aria-haspopup="dialog"
                            aria-label={`Voir l’entretien avec ${candidateLabel(item)}`}
                            onClick={() => {
                              setNotice('')
                              setDetailId(item.suggestionId)
                            }}
                          >
                            <Eye size={14} aria-hidden />
                            Voir
                          </Button>
                        }
                      />
                    ))}
                  </ul>
                </section>
              )
            })}
          </div>
        )}

        {detail && (
          <RecruiterInterviewDetail
            target={{
              suggestionId: detail.suggestionId,
              candidateName: candidateLabel(detail),
              opportunityTitle: detail.opportunity.title,
              interview: detail.interview,
              canManage: true,
            }}
            onClose={() => setDetailId(null)}
            onChanged={handleChanged}
          />
        )}
      </div>
    </div>
  )
}
