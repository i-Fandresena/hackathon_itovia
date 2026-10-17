import { useState } from 'react'
import { AlertTriangle, CalendarClock, CalendarDays, Sparkles, Users, X } from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { MatchFitDetail } from '../../components/matching/MatchFitDetail'
import { InterviewScheduleModal } from '../../components/interview/InterviewScheduleModal'
import { RecruiterInterviewDetail } from '../../components/interview/RecruiterInterviewDetail'
import { useApp } from '../../context/AppContext'
import type { ReceivedSuggestion } from '../../lib/api'
import { INTERVIEW_STATUS_LABELS, formatMadagascarDateTime, formatMadagascarShortDateTime } from '../../lib/interview'
import type { Interview, MatchSuggestionStatus } from '../../types'
import './RecruiterApplications.css'

/** Seuls statuts que le serveur transmet au recruteur : une suggestion en
 *  attente de validation (`suggeree`), héritée ou écartée ne lui parvient
 *  jamais, et ne s'affiche donc pas. */
const STATUS_DISPLAY: Partial<Record<MatchSuggestionStatus, { label: string; variant: 'primary' | 'success' }>> = {
  proposee_recruteur: { label: 'Nouveau profil proposé', variant: 'primary' },
  interet_recruteur: { label: 'Intérêt marqué', variant: 'primary' },
  mise_en_relation: { label: 'Mis en relation', variant: 'success' },
}

/** État qui doit rester visible sur la carte sans ouvrir le détail. */
function interviewFlag(interview: Interview): string | null {
  if (interview.status === 'empechement') return 'Empêchement signalé'
  if (interview.status !== 'annule' && interview.meetStatus === 'en_attente') return 'Lien Meet en attente'
  return null
}

function ordinal(rank: number): string {
  return rank === 1 ? '1er' : `${rank}e`
}

/** Horodatage de publication de l'offre ; 0 (rangée en dernier) si le
 *  serveur ne l'a pas transmise. */
function publishedTime(iso: string | null | undefined): number {
  const t = iso ? Date.parse(iso) : NaN
  return Number.isNaN(t) ? 0 : t
}

/** « 3 oct. 2026 » — date courte de publication dans l'en-tête de section. */
function formatPublishedShort(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

/** Regroupe par offre, de la plus récemment publiée (`createdAt`) à la plus
 *  ancienne, id de l'offre en départage ; dans une offre, meilleurs scores
 *  d'abord, id du dossier en départage. */
function groupByOffer(suggestions: ReceivedSuggestion[]) {
  const groups = new Map<
    string,
    { id: string; title: string; publishedAt: string | null; items: ReceivedSuggestion[] }
  >()
  for (const s of suggestions) {
    const group = groups.get(s.opportunity.id) ?? {
      id: s.opportunity.id,
      title: s.opportunity.title,
      publishedAt: s.opportunity.createdAt ?? null,
      items: [],
    }
    group.items.push(s)
    groups.set(s.opportunity.id, group)
  }
  return [...groups.values()]
    .sort(
      (a, b) =>
        publishedTime(b.publishedAt) - publishedTime(a.publishedAt) ||
        a.id.localeCompare(b.id),
    )
    .map((group) => ({ ...group, items: group.items.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id)) }))
}

const candidateLabel = (s: ReceivedSuggestion) => s.candidate.candidateProfile?.fullName ?? 'ce candidat'

/**
 * OffRec est l'intermédiaire (décisions produit 2026-09-02 / 2026-10-08) :
 * les candidats ne postulent pas, c'est OffRec qui propose leur profil.
 * Depuis la décision 2026-10-14, « Ce profil m'intéresse » fixe un
 * entretien : la mise en relation est faite tout de suite, le candidat est
 * notifié et confirme ou signale un empêchement ; l'admin est informé. Le
 * lien Google Meet vient de l'agenda d'OffRec, sans échange d'adresses.
 *
 * Le détail de l'entretien s'ouvre dans une modale (« Voir l'entretien »),
 * pas dans la carte : `RecruiterInterviewDetail`, partagée avec l'onglet
 * « Entretiens ». Elle relit le dossier par son id, donc revient à jour
 * après une reprogrammation ou une annulation.
 */
export function RecruiterApplications() {
  const { receivedSuggestions: received, hydrated, declineSuggestion, refreshDossiers } = useApp()
  const [scheduling, setScheduling] = useState<ReceivedSuggestion | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null)

  if (!hydrated) return null

  const groups = groupByOffer(received.filter((s) => STATUS_DISPLAY[s.status]))
  const detail = detailId ? received.find((s) => s.id === detailId && s.interview) ?? null : null

  const handleDecline = async (s: ReceivedSuggestion) => {
    setFeedback(null)
    const result = await declineSuggestion(s.id)
    if (!result.ok) setFeedback({ ok: false, text: result.error ?? 'Action impossible.' })
  }

  const handleScheduled = async (text: string) => {
    setScheduling(null)
    setFeedback({ ok: true, text })
    await refreshDossiers()
  }

  const openDetail = (s: ReceivedSuggestion) => {
    setFeedback(null)
    setDetailId(s.id)
  }

  /** Reprogrammation ou annulation depuis la modale de détail. */
  const handleDetailChanged = async (text: string) => {
    setFeedback({ ok: true, text })
    await refreshDossiers()
  }

  return (
    <div className="page">
      <div className="container">
        <header className="page-header">
          <h1>Candidats proposés</h1>
          <p>
            Profils présélectionnés par OffRec pour vos offres, de la plus récente à la plus ancienne, classés par
            adéquation. « Ce profil m’intéresse »
            fixe un entretien : OffRec vous met en relation, prévient le candidat et transmet le lien de visio à
            chacun.
          </p>
        </header>

        {!detail && feedback && (
          <p className={`rapp-feedback ${feedback.ok ? 'is-ok' : 'is-error'}`} role="status">
            {feedback.text}
          </p>
        )}

        {groups.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Aucun candidat proposé pour l’instant"
            description="OffRec vous proposera des profils dès qu’une correspondance pertinente sera identifiée."
          />
        ) : (
          groups.map((group) => (
            <section key={group.id} className="rapp-group">
              <h2 className="rapp-group-title">
                {group.title}
                {group.publishedAt && (
                  <time className="rapp-group-date" dateTime={group.publishedAt}>
                    publiée le {formatPublishedShort(group.publishedAt)}
                  </time>
                )}
                <span className="rapp-group-count">
                  {group.items.length} profil{group.items.length > 1 ? 's' : ''}
                </span>
              </h2>
              <div className="rapp-list">
                {group.items.map((s) => {
                  const interview = s.interview ?? null
                  const canSchedule = s.status === 'proposee_recruteur' || s.status === 'interet_recruteur'
                  const flag = interview ? interviewFlag(interview) : null
                  const flagId = `rapp-iv-flag-${s.id}`
                  const viewButton = interview && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="rapp-iv-btn"
                      aria-haspopup="dialog"
                      aria-describedby={flag ? flagId : undefined}
                      title={`Entretien : ${INTERVIEW_STATUS_LABELS[interview.status]} · ${formatMadagascarDateTime(interview.scheduledAt)} (heure de Madagascar)`}
                      onClick={() => openDetail(s)}
                    >
                      <CalendarDays size={14} aria-hidden />
                      Voir l’entretien
                      <span className={`rapp-iv-when${interview.status === 'annule' ? ' is-cancelled' : ''}`}>
                        · {interview.status === 'annule' ? 'annulé' : formatMadagascarShortDateTime(interview.scheduledAt)}
                      </span>
                      {flag && <span className="rapp-iv-dot" aria-hidden />}
                    </Button>
                  )
                  const flagNote = flag && (
                    <span className="rapp-iv-flag" id={flagId}>
                      <AlertTriangle size={13} aria-hidden />
                      {flag}
                    </span>
                  )
                  return (
                    <Card key={s.id} className="rapp-card">
                      <div className="rapp-head">
                        <div className="rapp-id">
                          <strong>{s.candidate.candidateProfile?.fullName ?? 'Candidat'}</strong>
                          {s.preselectionRank != null && (
                            <p className="rapp-rank">{ordinal(s.preselectionRank)} profil de la présélection OffRec</p>
                          )}
                        </div>
                        <div className="rapp-head-side">
                          <Badge variant={STATUS_DISPLAY[s.status]?.variant}>{STATUS_DISPLAY[s.status]?.label}</Badge>
                          <span className="rapp-score" title="Adéquation avec votre offre">
                            {s.score}%
                          </span>
                        </div>
                      </div>

                      {s.fit ? (
                        <MatchFitDetail fit={s.fit} />
                      ) : (
                        s.reasons.length > 0 && <p className="rapp-note">{s.reasons.slice(0, 2).join(' · ')}</p>
                      )}

                      {s.status === 'interet_recruteur' && (
                        <p className="rapp-note">
                          Vous avez marqué votre intérêt pour ce profil. Proposez une date d’entretien pour finaliser la
                          mise en relation.
                        </p>
                      )}

                      {s.status === 'mise_en_relation' && interview && (
                        <div className="rapp-actions">
                          {viewButton}
                          {flagNote}
                        </div>
                      )}

                      {s.status === 'mise_en_relation' && !interview && (
                        <div className="rapp-actions">
                          <p className="rapp-note">Mise en relation confirmée par OffRec, sans entretien fixé.</p>
                          <Button size="sm" onClick={() => setScheduling(s)}>
                            <CalendarClock size={14} aria-hidden />
                            Proposer un entretien
                          </Button>
                        </div>
                      )}

                      {canSchedule && (
                        <div className="rapp-actions">
                          <Button size="sm" onClick={() => setScheduling(s)}>
                            <Sparkles size={14} aria-hidden />
                            Ce profil m’intéresse
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => handleDecline(s)}>
                            <X size={14} aria-hidden />
                            Écarter
                          </Button>
                          {viewButton}
                          {flagNote}
                        </div>
                      )}
                    </Card>
                  )
                })}
              </div>
            </section>
          ))
        )}

        {detail?.interview && (
          <RecruiterInterviewDetail
            target={{
              suggestionId: detail.id,
              candidateName: candidateLabel(detail),
              opportunityTitle: detail.opportunity.title,
              interview: detail.interview,
              canManage: detail.status === 'mise_en_relation',
            }}
            onClose={() => setDetailId(null)}
            onChanged={handleDetailChanged}
          />
        )}

        {scheduling && (
          <InterviewScheduleModal
            mode="schedule"
            suggestionId={scheduling.id}
            candidateName={candidateLabel(scheduling)}
            opportunityTitle={scheduling.opportunity.title}
            current={scheduling.interview}
            onClose={() => setScheduling(null)}
            onDone={handleScheduled}
          />
        )}
      </div>
    </div>
  )
}
