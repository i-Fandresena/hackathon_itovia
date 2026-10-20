import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CalendarDays, Eye, FileSignature, RotateCcw } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { Field, Select } from '../../components/ui/Form'
import { Loading } from '../../components/ui/Loading'
import { ABSENCE_FLAG, candidateInterviewFlag } from '../../components/interview/CandidateInterviewCard'
import { CandidateInterviewDetail } from '../../components/interview/CandidateInterviewDetail'
import {
  INTERVIEW_PERIODS,
  INTERVIEW_STATUSES,
  InterviewPeriodTabs,
  InterviewRow,
  InterviewStat,
  RoundChips,
  groupInterviewsByOffer,
} from '../../components/interview/InterviewList'
import { interviewStatusLabel } from '../../components/interview/InterviewSummary'
import {
  ApiError,
  apiMySuggestions,
  type CandidateInterview,
  type MatchSuggestionWithOpportunity,
} from '../../lib/api'
import { sortRounds } from '../../lib/hiring'
import {
  compareInterviewsForList,
  formatMadagascarShortDateTime,
  interviewAwaitsCandidateReply,
  interviewInPeriod,
  isInterviewUpcoming,
} from '../../lib/interview'
import type { InterviewPeriod, InterviewStatus } from '../../types'
import './CandidateInterviews.css'

type InterviewDossier = MatchSuggestionWithOpportunity & { interview: CandidateInterview }

/** Une ligne par tour d'entretien, rattachée à son dossier. */
interface RoundItem {
  dossier: InterviewDossier
  interview: CandidateInterview
  opportunity: InterviewDossier['opportunity']
  rounds: CandidateInterview[]
}

const readPeriod = (value: string | null): InterviewPeriod =>
  INTERVIEW_PERIODS.includes(value as InterviewPeriod) ? (value as InterviewPeriod) : 'a_venir'
const readStatus = (value: string | null): InterviewStatus | '' =>
  INTERVIEW_STATUSES.includes(value as InterviewStatus) ? (value as InterviewStatus) : ''

/** Entretiens du candidat : le serveur ne les envoie qu'à la mise en
 *  relation ; on le revérifie ici, par défense. Un tour par ligne. */
function interviewRounds(suggestions: MatchSuggestionWithOpportunity[]): RoundItem[] {
  return suggestions
    .filter((s): s is InterviewDossier => s.status === 'mise_en_relation' && Boolean(s.interview))
    .flatMap((dossier) => {
      const rounds = dossier.interviews && dossier.interviews.length > 0 ? sortRounds(dossier.interviews) : [dossier.interview]
      return rounds.map((interview) => ({ dossier, interview, opportunity: dossier.opportunity, rounds }))
    })
    .sort((a, b) => compareInterviewsForList(a.interview, b.interview))
}

const companyLabel = (item: RoundItem) => item.opportunity.companyName || 'Entreprise'

/**
 * Onglet « Entretiens » du candidat (`/candidat/entretiens`) : ses
 * entretiens, un tour par ligne, groupés par offre, filtrés par période (à
 * venir par défaut) et statut (repris dans l'URL : `?periode=`,
 * `?statut=`). Données lues dans ses dossiers (`GET /match-suggestions/mine`,
 * liste blanche serveur : offre, entreprise révélée à la mise en relation,
 * tours — jamais l'issue, le motif ni la note, jamais de contact du
 * recruteur). Le détail, la réponse et « Expliquer mon absence » passent par
 * la même modale que le tableau de bord (`CandidateInterviewDetail`).
 */
export function CandidateInterviews() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const period = readPeriod(searchParams.get('periode'))
  const status = readStatus(searchParams.get('statut'))

  const [all, setAll] = useState<RoundItem[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [detailId, setDetailId] = useState<string | null>(null)
  const requestRef = useRef(0)

  const load = useCallback(async () => {
    const requestId = ++requestRef.current
    setLoading(true)
    setError('')
    try {
      const suggestions = await apiMySuggestions()
      if (requestId !== requestRef.current) return
      setAll(interviewRounds(suggestions))
    } catch (err) {
      if (requestId !== requestRef.current) return
      setError(err instanceof ApiError ? err.message : 'Impossible de charger vos entretiens.')
    } finally {
      if (requestId === requestRef.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  /** Applique un ou plusieurs filtres (valeur par défaut = retirée de l'URL). */
  const setFilters = (patch: Partial<Record<'periode' | 'statut', string>>) => {
    const next = new URLSearchParams(searchParams)
    for (const [name, value] of Object.entries(patch)) {
      const isDefault = !value || (name === 'periode' && value === 'a_venir')
      if (isDefault) next.delete(name)
      else next.set(name, value)
    }
    setSearchParams(next, { replace: true })
  }

  const resetFilters = () => setSearchParams(new URLSearchParams(), { replace: true })

  const items = (all ?? []).filter(
    (item) => interviewInPeriod(item.interview, period) && (!status || item.interview.status === status),
  )
  const groups = groupInterviewsByOffer(items)
  // Cherché dans la liste complète : la modale reste ouverte même si la
  // réponse fait sortir l'entretien des filtres courants.
  const detail = detailId ? all?.find((item) => item.dossier.id === detailId)?.dossier ?? null : null
  const total = all?.length ?? 0
  const upcoming = (all ?? []).filter((item) => isInterviewUpcoming(item.interview)).length
  const awaiting = (all ?? []).filter((item) => interviewAwaitsCandidateReply(item.interview)).length
  const filtered = period !== 'a_venir' || status !== ''

  return (
    <div className="page">
      <div className="container">
        <header className="page-header">
          <p className="eyebrow">Espace candidat</p>
          <h1>Entretiens</h1>
          <p>
            Les entretiens proposés par les entreprises après votre mise en relation par OffRec. Dates et heures en
            heure de Madagascar.
          </p>
        </header>

        {total > 0 && (
          <div className="ivl-stats" aria-label="Compteurs">
            <InterviewStat
              value={upcoming}
              label={upcoming > 1 ? 'entretiens à venir' : 'entretien à venir'}
              active={period === 'a_venir' && !status}
              onClick={() => setFilters({ periode: 'a_venir', statut: '' })}
            />
            <InterviewStat
              value={awaiting}
              label={awaiting > 1 ? 'réponses attendues' : 'réponse attendue'}
              tone="warning"
              active={period === 'a_venir' && status === 'planifie'}
              onClick={() => setFilters({ periode: 'a_venir', statut: 'planifie' })}
            />
          </div>
        )}

        {total > 0 && (
          <div className="ivl-filters">
            <InterviewPeriodTabs value={period} onChange={(value) => setFilters({ periode: value })} />
            <Field label="Statut">
              <Select value={status} onChange={(e) => setFilters({ statut: e.target.value })}>
                <option value="">Tous les statuts</option>
                {INTERVIEW_STATUSES.map((value) => (
                  <option key={value} value={value}>
                    {interviewStatusLabel(value, 'candidate')}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        )}

        {error ? (
          <div className="ivl-error" role="alert">
            <span>{error}</span>
            <Button variant="outline" size="sm" onClick={() => void load()}>
              <RotateCcw size={14} aria-hidden />
              Réessayer
            </Button>
          </div>
        ) : loading && !all ? (
          <Loading label="Chargement de vos entretiens…" />
        ) : total === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title="Aucun entretien pour l’instant"
            description="Un entretien apparaît ici quand une entreprise vous en propose un, après votre mise en relation par OffRec. Vous en êtes aussi prévenu·e sur la plateforme et par email."
            actionLabel="Voir mes dossiers"
            onAction={() => navigate('/candidat')}
          />
        ) : items.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title="Aucun entretien pour ces filtres"
            description={
              period === 'a_venir' && !status
                ? 'Aucun entretien à venir. Consultez les entretiens passés ou annulés, ou attendez une nouvelle proposition.'
                : 'Modifiez la période ou le statut pour voir vos autres entretiens.'
            }
            actionLabel={filtered ? 'Réinitialiser les filtres' : undefined}
            onAction={filtered ? resetFilters : undefined}
          />
        ) : (
          <div className="cint-groups" aria-busy={loading}>
            {groups.map((group) => {
              const first = group.items[0]
              const headingId = `cint-offer-${group.id}`
              // Proposition d'embauche en attente de réponse (sous-lot 6) : visible
              // sans ouvrir le détail, qui la présente avec « Accepter » / « Décliner ».
              const proposal = first.dossier.proposal?.status === 'envoyee' ? first.dossier.proposal : null
              return (
                <section key={group.id} className="ivl-group" aria-labelledby={headingId}>
                  <div className="ivl-group-head">
                    <div className="cint-group-text">
                      <h2 className="ivl-group-title" id={headingId}>
                        {first.opportunity.title}
                      </h2>
                      <p className="ivl-group-sub">{companyLabel(first)}</p>
                    </div>
                    {proposal && (
                      <div className="ivl-group-side">
                        <span className="ivl-chip is-warning">
                          Proposition reçue : réponse avant le {formatMadagascarShortDateTime(proposal.expiresAt)}
                        </span>
                        <Button
                          size="sm"
                          aria-haspopup="dialog"
                          aria-label={`Voir la proposition d’embauche de ${companyLabel(first)}`}
                          onClick={() => setDetailId(first.dossier.id)}
                        >
                          <FileSignature size={14} aria-hidden />
                          Voir la proposition
                        </Button>
                      </div>
                    )}
                  </div>
                  <ul className="ivl-list">
                    {group.items.map((item) => {
                      const flag = item.interview.canExplainAbsence
                        ? ABSENCE_FLAG
                        : candidateInterviewFlag(item.interview) ?? undefined
                      return (
                        <InterviewRow
                          key={item.interview.id}
                          audience="candidate"
                          interview={item.interview}
                          heading={companyLabel(item)}
                          meta={item.opportunity.title}
                          flag={flag}
                          badges={
                            <RoundChips interview={item.interview} showRound={item.rounds.length > 1} showOutcome={false} />
                          }
                          actions={
                            <Button
                              variant="outline"
                              size="sm"
                              aria-haspopup="dialog"
                              aria-label={`Voir l’entretien avec ${companyLabel(item)} pour « ${item.opportunity.title} »`}
                              onClick={() => setDetailId(item.dossier.id)}
                            >
                              <Eye size={14} aria-hidden />
                              Voir
                            </Button>
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

        {detail && (
          <CandidateInterviewDetail
            target={{
              suggestionId: detail.id,
              opportunityTitle: detail.opportunity.title,
              companyName: detail.opportunity.companyName,
              interview: detail.interview,
              rounds: detail.interviews && detail.interviews.length > 0 ? detail.interviews : [detail.interview],
              candidatePhase: detail.candidatePhase ?? null,
              proposal: detail.proposal ?? null,
            }}
            onClose={() => setDetailId(null)}
            onChanged={load}
          />
        )}
      </div>
    </div>
  )
}
