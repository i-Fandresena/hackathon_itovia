import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  CalendarDays,
  CalendarPlus,
  ClipboardCheck,
  ExternalLink,
  FileSignature,
  Inbox,
  ListChecks,
  Search,
  Send,
  Sparkles,
  Users,
  X,
} from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { Input } from '../../components/ui/Form'
import { Loading } from '../../components/ui/Loading'
import { MatchFitDetail } from '../../components/matching/MatchFitDetail'
import { InterviewScheduleModal } from '../../components/interview/InterviewScheduleModal'
import {
  RecruiterInterviewDetail,
  type RecruiterInterviewEntry,
} from '../../components/interview/RecruiterInterviewDetail'
import { HiringPhaseBadge } from '../../components/hiring/HiringPhaseBadge'
import {
  connectedDossierState,
  dossierGroup,
  pendingProposal,
  proposalsOf,
  roundsOf,
} from '../../components/hiring/hiringState'
import { useApp } from '../../context/AppContext'
import { apiMyOpportunities, type ReceivedSuggestion, type RecruiterOpportunity } from '../../lib/api'
import { checkHiringAction, nextRoundNumber, positionsFillLabel } from '../../lib/hiring'
import { INTERVIEW_STATUS_LABELS, formatMadagascarDateTime, formatMadagascarShortDateTime } from '../../lib/interview'
import type { MatchSuggestionStatus } from '../../types'
import './RecruiterApplications.css'

/** Seuls statuts que le serveur transmet au recruteur : une suggestion en
 *  attente de validation (`suggeree`), héritée ou écartée ne lui parvient
 *  jamais, et ne s'affiche donc pas. */
const STATUS_DISPLAY: Partial<Record<MatchSuggestionStatus, { label: string; variant: 'primary' | 'success' }>> = {
  proposee_recruteur: { label: 'Nouveau profil proposé', variant: 'primary' },
  interet_recruteur: { label: 'Intérêt marqué', variant: 'primary' },
  mise_en_relation: { label: 'Mis en relation', variant: 'success' },
}

/** Filtre de statut du panneau de droite. Pas d'« Écartés » : un dossier
 *  écarté sort de `GET /match-suggestions/received`. Les dossiers mis en
 *  relation se répartissent en « En cours / Embauchés / Clos » d'après la
 *  phase du serveur (sous-lot 6). */
type StatusFilter = 'all' | 'review' | 'connected' | 'hired' | 'closed'

const STATUS_FILTERS: { value: StatusFilter; label: string; empty: string }[] = [
  { value: 'all', label: 'Tous', empty: 'Aucun profil pour cette offre.' },
  { value: 'review', label: 'À examiner', empty: 'Aucun profil à examiner pour cette offre.' },
  { value: 'connected', label: 'En cours', empty: 'Aucun dossier mis en relation en cours pour cette offre.' },
  { value: 'hired', label: 'Embauchés', empty: 'Aucune embauche pour cette offre pour l’instant.' },
  { value: 'closed', label: 'Clos', empty: 'Aucun dossier clos pour cette offre.' },
]

/** Au-delà de ce nombre d'offres, la colonne de gauche propose une recherche. */
const SEARCH_MIN_OFFERS = 6

/** Point de rupture de la mise en page (aligné sur l'onglet admin
 *  « Recruteurs ») : en dessous, la liste OU le détail. */
const NARROW_QUERY = '(max-width: 1279px)'

const isToReview = (s: ReceivedSuggestion) => s.status === 'proposee_recruteur' || s.status === 'interet_recruteur'

/** Groupe d'un dossier mis en relation : en cours, embauché ou clos. */
const groupOf = (s: ReceivedSuggestion) => (s.status === 'mise_en_relation' ? dossierGroup(s.phase) : null)

function matchesFilter(s: ReceivedSuggestion, filter: StatusFilter): boolean {
  if (filter === 'review') return isToReview(s)
  if (filter === 'connected') return groupOf(s) === 'en_cours'
  if (filter === 'hired') return groupOf(s) === 'embauche'
  if (filter === 'closed') return groupOf(s) === 'clos'
  return true
}

/** État du dossier pour les règles de src/lib/hiring.ts (tours, propositions, placement). */
function dossierState(s: ReceivedSuggestion) {
  return connectedDossierState(roundsOf(s), { proposals: proposalsOf(s), placement: s.placement, phase: s.phase })
}

/** Proposition en attente de réponse du candidat, ou `undefined`. */
const pendingOf = (s: ReceivedSuggestion) => (s.status === 'mise_en_relation' ? pendingProposal(proposalsOf(s)) : undefined)

/** « Faire une proposition » : dossier « Retenu » où l'envoi est permis (le serveur reste juge). */
function canSendProposal(s: ReceivedSuggestion): boolean {
  if (s.status !== 'mise_en_relation' || s.phase !== 'retenu') return false
  return checkHiringAction({ actor: 'recruiter', action: 'send_proposal', state: dossierState(s), now: new Date() }).ok
}

/** État qui doit rester visible sur la carte sans ouvrir le détail. */
function interviewFlag(s: ReceivedSuggestion): string | null {
  const interview = s.interview
  if (!interview) return null
  if (s.phase === 'issue_a_renseigner') return 'Issue à renseigner'
  const pending = pendingOf(s)
  if (pending) return `Proposition : réponse avant le ${formatMadagascarShortDateTime(pending.expiresAt)}`
  if (interview.outcome) return null
  if (interview.status === 'empechement') return 'Empêchement signalé'
  if (interview.status !== 'annule' && interview.meetStatus === 'en_attente') return 'Lien Meet en attente'
  return null
}

/** Tour suivant possible (après « Second entretien » ou une absence) : son
 *  numéro, ou `null`. Règle de src/lib/hiring.ts, le serveur reste juge. */
function plannableRound(s: ReceivedSuggestion): number | null {
  if (s.status !== 'mise_en_relation') return null
  if (s.phase !== 'second_entretien_a_planifier' && s.phase !== 'absent') return null
  const state = dossierState(s)
  return checkHiringAction({ actor: 'recruiter', action: 'schedule_round', state, now: new Date() }).ok
    ? nextRoundNumber(state.rounds)
    : null
}

function ordinal(rank: number): string {
  return rank === 1 ? '1er' : `${rank}e`
}

function plural(count: number, singular: string, pluralForm: string): string {
  return `${count} ${count > 1 ? pluralForm : singular}`
}

/** Horodatage de publication de l'offre ; 0 (rangée en dernier) si le
 *  serveur ne l'a pas transmise. */
function publishedTime(iso: string | null | undefined): number {
  const t = iso ? Date.parse(iso) : NaN
  return Number.isNaN(t) ? 0 : t
}

/** « 3 oct. 2026 » — date courte de publication. */
function formatPublishedShort(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

/** Recherche sur le titre, sans tenir compte de la casse ni des accents. */
function normalize(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

interface OfferGroup {
  id: string
  title: string
  publishedAt: string | null
  items: ReceivedSuggestion[]
  toReview: number
  connected: number
  /** Dossiers embauchés (placement lié non annulé). */
  hired: number
  /** Dossiers clos (non retenu, proposition déclinée, poste pourvu…). */
  closed: number
  /** Dossiers dont l'entretien demande l'attention (empêchement, lien Meet en attente, issue à renseigner). */
  flagged: number
  /** Dossiers dont l'issue d'entretien est à renseigner. */
  toRecord: number
}

/** Regroupe par offre, de la plus récemment publiée (`createdAt`) à la plus
 *  ancienne, id de l'offre en départage ; dans une offre, meilleurs scores
 *  d'abord, id du dossier en départage. */
function groupByOffer(suggestions: ReceivedSuggestion[]): OfferGroup[] {
  const groups = new Map<string, OfferGroup>()
  for (const s of suggestions) {
    const group = groups.get(s.opportunity.id) ?? {
      id: s.opportunity.id,
      title: s.opportunity.title,
      publishedAt: s.opportunity.createdAt ?? null,
      items: [],
      toReview: 0,
      connected: 0,
      hired: 0,
      closed: 0,
      flagged: 0,
      toRecord: 0,
    }
    group.items.push(s)
    if (isToReview(s)) group.toReview += 1
    if (s.status === 'mise_en_relation') group.connected += 1
    if (groupOf(s) === 'embauche') group.hired += 1
    if (groupOf(s) === 'clos') group.closed += 1
    if (interviewFlag(s)) group.flagged += 1
    if (s.phase === 'issue_a_renseigner') group.toRecord += 1
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

const rowDomId = (offerId: string) => `rcand-row-${offerId}`

function isNarrow(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(NARROW_QUERY).matches
}

/**
 * OffRec est l'intermédiaire (décisions produit 2026-09-02 / 2026-10-08) :
 * les candidats ne postulent pas, c'est OffRec qui propose leur profil.
 * Depuis la décision 2026-10-14, « Ce profil m'intéresse » fixe un
 * entretien : la mise en relation est faite tout de suite, le candidat est
 * notifié et confirme ou signale un empêchement ; l'admin est informé. Le
 * lien Google Meet vient de l'agenda d'OffRec, sans échange d'adresses.
 *
 * Mise en page reprise de l'onglet admin « Recruteurs » : les offres ayant
 * au moins un dossier à gauche (la plus récente d'abord), les profils
 * proposés pour l'offre choisie à droite (meilleur score d'abord). L'offre
 * affichée est dans l'URL (`?offre=`) ; sans paramètre, c'est la plus
 * récente. Sur écran étroit : la liste OU le détail, avec un retour.
 *
 * Le détail de l'entretien s'ouvre dans une modale (« Voir l'entretien »),
 * pas dans la carte : `RecruiterInterviewDetail`, partagée avec l'onglet
 * « Entretiens ». Elle relit le dossier par son id, donc revient à jour
 * après une reprogrammation ou une annulation.
 */
export function RecruiterApplications() {
  const {
    receivedSuggestions: received,
    hydrated,
    dossiersLoadFailed,
    declineSuggestion,
    refreshDossiers,
  } = useApp()
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedId = searchParams.get('offre')
  /** Lien direct vers un dossier (`?dossier=` ; `&etape=proposition` ouvre la proposition). */
  const requestedDossier = searchParams.get('dossier')
  const requestedStep = searchParams.get('etape')

  const [scheduling, setScheduling] = useState<ReceivedSuggestion | null>(null)
  const [detailTarget, setDetailTarget] = useState<{ id: string; entry: RecruiterInterviewEntry } | null>(null)
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null)
  const [filter, setFilter] = useState<StatusFilter>('all')
  const [search, setSearch] = useState('')
  const [retrying, setRetrying] = useState(false)
  /** Dossier en cours d'écartement : évite le double clic. */
  const [declining, setDeclining] = useState<string | null>(null)
  /** Offres du recruteur (postes, offre pourvue) — `/received` ne les porte pas. */
  const [myOffers, setMyOffers] = useState<RecruiterOpportunity[]>([])

  const loadOffers = async () => {
    try {
      setMyOffers(await apiMyOpportunities())
    } catch {
      // Information de confort (« Pourvue ») : la page reste utilisable sans.
    }
  }

  useEffect(() => {
    void loadOffers()
  }, [])

  const panelTitleRef = useRef<HTMLHeadingElement>(null)
  /** Focus à poser après un changement d'offre sur écran étroit : le titre
   *  du panneau (ouverture) ou la ligne de l'offre quittée (retour). */
  const pendingFocus = useRef<{ kind: 'panel' } | { kind: 'row'; id: string } | null>(null)

  const groups = useMemo(() => groupByOffer(received.filter((s) => STATUS_DISPLAY[s.status])), [received])
  const selected = groups.find((g) => g.id === requestedId) ?? groups[0] ?? null
  /** Paramètre valide : sur écran étroit, on affiche le détail plutôt que la liste. */
  const hasExplicitSelection = !!requestedId && selected?.id === requestedId

  // Offre du paramètre disparue (lien ancien, dernier profil écarté) :
  // retour à la première de la liste, sans empiler d'entrée d'historique.
  useEffect(() => {
    if (!hydrated || !requestedId || groups.length === 0) return
    if (!groups.some((g) => g.id === requestedId)) {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev)
        next.set('offre', groups[0].id)
        return next
      }, { replace: true })
    }
  }, [hydrated, requestedId, groups, setSearchParams])

  // `?dossier=<id>` (shortlist, placements) : ouvre le détail de ce dossier
  // une fois les données chargées, puis retire le paramètre de l'URL.
  useEffect(() => {
    if (!hydrated || !requestedDossier) return
    const dossier = received.find((s) => s.id === requestedDossier)
    if (dossier?.interview) {
      setFeedback(null)
      setDetailTarget({ id: dossier.id, entry: requestedStep === 'proposition' ? 'proposal' : 'detail' })
    }
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.delete('dossier')
        next.delete('etape')
        if (dossier && !next.get('offre')) next.set('offre', dossier.opportunity.id)
        return next
      },
      { replace: true },
    )
  }, [hydrated, requestedDossier, requestedStep, received, setSearchParams])

  useEffect(() => {
    const target = pendingFocus.current
    pendingFocus.current = null
    if (!target) return
    if (target.kind === 'panel') panelTitleRef.current?.focus()
    else document.getElementById(rowDomId(target.id))?.focus()
  }, [requestedId])

  const select = (id: string) => {
    setFeedback(null)
    if (id === requestedId) return
    const narrow = isNarrow()
    if (narrow) pendingFocus.current = { kind: 'panel' }
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.set('offre', id)
      return next
    })
    if (narrow) window.scrollTo({ top: 0 })
  }

  const backToList = () => {
    if (selected) pendingFocus.current = { kind: 'row', id: selected.id }
    setFeedback(null)
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.delete('offre')
      return next
    })
    window.scrollTo({ top: 0 })
  }

  /** Flèches haut/bas, Début/Fin : déplacent le focus entre les offres
   *  (Entrée ou Espace sélectionne, comme tout bouton). */
  const onListKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
    const rows = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('.rcand-row'))
    if (rows.length === 0) return
    const current = rows.indexOf(document.activeElement as HTMLButtonElement)
    let next = current
    if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = rows.length - 1
    else if (event.key === 'ArrowDown') next = current < 0 ? 0 : Math.min(rows.length - 1, current + 1)
    else next = current < 0 ? 0 : Math.max(0, current - 1)
    event.preventDefault()
    rows[next].focus()
  }

  const retry = async () => {
    setRetrying(true)
    await refreshDossiers()
    setRetrying(false)
  }

  const handleDecline = async (s: ReceivedSuggestion) => {
    if (declining) return
    setFeedback(null)
    setDeclining(s.id)
    const result = await declineSuggestion(s.id)
    setDeclining(null)
    if (!result.ok) setFeedback({ ok: false, text: result.error ?? 'Action impossible.' })
    else setFeedback({ ok: true, text: `Profil de ${candidateLabel(s)} écarté.` })
  }

  const handleScheduled = async (text: string) => {
    setScheduling(null)
    setFeedback({ ok: true, text })
    await refreshDossiers()
  }

  const openDetail = (s: ReceivedSuggestion, entry: RecruiterInterviewEntry = 'detail') => {
    setFeedback(null)
    setDetailTarget({ id: s.id, entry })
  }

  /** Action enregistrée depuis la modale de détail (issue, tour suivant,
   *  reprogrammation, annulation, proposition). Une acceptation peut pourvoir
   *  l'offre : les offres sont relues aussi. */
  const handleDetailChanged = async (text: string) => {
    setFeedback({ ok: true, text })
    await Promise.all([refreshDossiers(), loadOffers()])
  }

  /** Proposition changée entre-temps (409) : relecture sans message. */
  const handleDetailRefresh = async () => {
    await Promise.all([refreshDossiers(), loadOffers()])
  }

  const header = (
    <header className="page-header">
      <h1>Candidats proposés</h1>
      <p>
        Vos offres à gauche, de la plus récente à la plus ancienne ; à droite, les profils présélectionnés par OffRec
        pour l’offre choisie, classés par adéquation. « Ce profil m’intéresse » fixe un entretien : OffRec vous met en
        relation, prévient le candidat et transmet le lien de visio à chacun.
      </p>
    </header>
  )

  if (!hydrated) {
    return (
      <div className="page">
        <div className="container">
          {header}
          <Loading label="Chargement des profils proposés…" />
        </div>
      </div>
    )
  }

  const detail = detailTarget ? received.find((s) => s.id === detailTarget.id && s.interview) ?? null : null
  const query = normalize(search)
  const visibleGroups = query ? groups.filter((g) => normalize(g.title).includes(query)) : groups
  const items = selected ? selected.items.filter((s) => matchesFilter(s, filter)) : []
  const filterCount = (value: StatusFilter) => {
    if (!selected) return 0
    switch (value) {
      case 'review':
        return selected.toReview
      case 'connected':
        return selected.connected - selected.hired - selected.closed
      case 'hired':
        return selected.hired
      case 'closed':
        return selected.closed
      default:
        return selected.items.length
    }
  }
  const offerById = new Map(myOffers.map((o) => [o.id, o]))
  const selectedOffer = selected ? offerById.get(selected.id) : undefined

  let body
  if (dossiersLoadFailed && groups.length === 0) {
    body = (
      <div className="rcand-error" role="alert">
        <p>Impossible de charger les profils proposés pour vos offres.</p>
        <Button size="sm" disabled={retrying} onClick={retry}>
          {retrying ? 'Chargement…' : 'Réessayer'}
        </Button>
      </div>
    )
  } else if (!selected) {
    body = (
      <EmptyState
        icon={Users}
        title="Aucun candidat proposé pour l’instant"
        description="OffRec vous proposera des profils dès qu’une correspondance pertinente sera identifiée."
      />
    )
  } else {
    body = (
      <>
        {dossiersLoadFailed && (
          <div className="rcand-stale" role="status">
            <AlertTriangle size={14} aria-hidden />
            <span>La mise à jour a échoué : la liste affichée est celle du dernier chargement.</span>
            <Button variant="ghost" size="sm" disabled={retrying} onClick={retry}>
              {retrying ? 'Chargement…' : 'Réessayer'}
            </Button>
          </div>
        )}

        <div className={`rcand-layout${hasExplicitSelection ? ' rcand-has-detail' : ''}`}>
          <section className="rcand-list-col" aria-label="Vos offres">
            {groups.length >= SEARCH_MIN_OFFERS && (
              <label className="rcand-search">
                <Search size={16} aria-hidden />
                <Input
                  type="search"
                  placeholder="Rechercher une offre"
                  aria-label="Rechercher une offre par son titre"
                  value={search}
                  maxLength={80}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </label>
            )}
            <p className="rcand-result-line" aria-live="polite">
              {query
                ? `${plural(visibleGroups.length, 'offre', 'offres')} sur ${groups.length}`
                : `${plural(groups.length, 'offre', 'offres')} avec des profils proposés`}
            </p>
            {visibleGroups.length === 0 ? (
              <p className="rcand-no-result">Aucune offre ne correspond à « {search.trim()} ».</p>
            ) : (
              <ul className="rcand-list" onKeyDown={onListKeyDown}>
                {visibleGroups.map((g) => (
                  <li key={g.id}>
                    <OfferRow group={g} active={g.id === selected.id} onSelect={() => select(g.id)} />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section id="rcand-panel" className="rcand-detail-col" aria-labelledby="rcand-panel-title">
            <Button
              variant="ghost"
              size="sm"
              className="rcand-back"
              aria-label="Retour à la liste des offres"
              onClick={backToList}
            >
              <ArrowLeft size={16} aria-hidden />
              Offres
            </Button>

            <Card className="rcand-panel-head">
              <h2 id="rcand-panel-title" ref={panelTitleRef} tabIndex={-1}>
                {selected.title}
              </h2>
              {selected.publishedAt && (
                <p className="rcand-muted">
                  Publiée le{' '}
                  <time dateTime={selected.publishedAt}>{formatPublishedShort(selected.publishedAt)}</time>
                  {selectedOffer && (
                    <>
                      {' · '}
                      <span className={selectedOffer.filledAt ? 'rcand-filled' : undefined}>
                        {positionsFillLabel({
                          positions: selectedOffer.positions ?? 1,
                          activePlacements: selectedOffer.activePlacements,
                          filledAt: selectedOffer.filledAt ?? null,
                        })}
                      </span>
                    </>
                  )}
                </p>
              )}
              <dl className="rcand-counters">
                <div className={`rcand-counter${selected.toReview > 0 ? ' rcand-counter-review' : ''}`}>
                  <dt>À examiner</dt>
                  <dd>{selected.toReview}</dd>
                </div>
                <div className="rcand-counter rcand-counter-done">
                  <dt>Mis en relation</dt>
                  <dd>{selected.connected}</dd>
                </div>
                <div className={`rcand-counter${selected.hired > 0 ? ' rcand-counter-done' : ''}`}>
                  <dt>Embauchés</dt>
                  <dd>{selected.hired}</dd>
                </div>
                <div className="rcand-counter">
                  <dt>Profils proposés</dt>
                  <dd>{selected.items.length}</dd>
                </div>
              </dl>
              {selected.flagged > 0 && (
                <p className="rcand-flag-line">
                  <AlertTriangle size={14} aria-hidden />
                  {selected.flagged > 1
                    ? `${selected.flagged} entretiens demandent votre attention (issue à renseigner, empêchement ou lien Meet en attente).`
                    : '1 entretien demande votre attention (issue à renseigner, empêchement ou lien Meet en attente).'}
                </p>
              )}
              <div className="rcand-links">
                <Link to={`/offres/${selected.id}`} className="btn btn-outline btn-sm">
                  <ExternalLink size={14} aria-hidden />
                  Voir l’offre
                </Link>
                <Link to={`/recruteur/offres/${selected.id}/shortlist`} className="btn btn-outline btn-sm">
                  <ListChecks size={14} aria-hidden />
                  Shortlist de l’offre
                </Link>
              </div>
            </Card>

            <div className="rcand-filters" role="group" aria-label="Filtrer les profils par statut">
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  className={`chip ${filter === f.value ? 'active' : ''}`}
                  aria-pressed={filter === f.value}
                  onClick={() => setFilter(f.value)}
                >
                  {f.label}
                  <span className="rcand-count">{filterCount(f.value)}</span>
                </button>
              ))}
            </div>

            {!detail && feedback && (
              <p className={`rapp-feedback ${feedback.ok ? 'is-ok' : 'is-error'}`} role="status">
                {feedback.text}
              </p>
            )}

            {items.length === 0 ? (
              <div className="rcand-filter-empty">
                <Inbox size={20} aria-hidden />
                <p>{STATUS_FILTERS.find((f) => f.value === filter)?.empty}</p>
                <Button variant="outline" size="sm" onClick={() => setFilter('all')}>
                  Afficher tous les profils
                </Button>
              </div>
            ) : (
              <div className="rapp-list">
                {items.map((s) => {
                  const interview = s.interview ?? null
                  const canSchedule = isToReview(s)
                  const flag = interviewFlag(s)
                  const recordDue = s.status === 'mise_en_relation' && s.phase === 'issue_a_renseigner'
                  const nextRound = plannableRound(s)
                  const sendable = canSendProposal(s)
                  const latestProposal = s.status === 'mise_en_relation' ? s.proposal ?? null : null
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
                          {s.status === 'mise_en_relation' && s.phase ? (
                            <HiringPhaseBadge audience="recruiter" phase={s.phase} />
                          ) : (
                            <Badge variant={STATUS_DISPLAY[s.status]?.variant}>{STATUS_DISPLAY[s.status]?.label}</Badge>
                          )}
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
                          {recordDue && (
                            <Button size="sm" aria-haspopup="dialog" onClick={() => openDetail(s, 'outcome')}>
                              <ClipboardCheck size={14} aria-hidden />
                              Renseigner l’issue
                            </Button>
                          )}
                          {nextRound !== null && (
                            <Button size="sm" aria-haspopup="dialog" onClick={() => openDetail(s, 'next_round')}>
                              <CalendarPlus size={14} aria-hidden />
                              Planifier le tour {nextRound}
                            </Button>
                          )}
                          {sendable && (
                            <Button size="sm" aria-haspopup="dialog" onClick={() => openDetail(s, 'proposal')}>
                              <Send size={14} aria-hidden />
                              {latestProposal ? 'Nouvelle proposition' : 'Faire une proposition'}
                            </Button>
                          )}
                          {latestProposal && (
                            <Button variant="outline" size="sm" aria-haspopup="dialog" onClick={() => openDetail(s)}>
                              <FileSignature size={14} aria-hidden />
                              Voir la proposition
                            </Button>
                          )}
                          {s.phase === 'embauche' && (
                            <Link to="/recruteur/placements" className="btn btn-ghost btn-sm">
                              <ExternalLink size={14} aria-hidden />
                              Voir le placement
                            </Link>
                          )}
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
                          <Button size="sm" disabled={declining === s.id} onClick={() => setScheduling(s)}>
                            <Sparkles size={14} aria-hidden />
                            Ce profil m’intéresse
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={declining !== null}
                            onClick={() => handleDecline(s)}
                          >
                            <X size={14} aria-hidden />
                            {declining === s.id ? 'Écartement…' : 'Écarter'}
                          </Button>
                          {viewButton}
                          {flagNote}
                        </div>
                      )}
                    </Card>
                  )
                })}
              </div>
            )}
          </section>
        </div>
      </>
    )
  }

  return (
    <div className="page">
      <div className="container">
        {header}
        {body}

        {detail?.interview && detailTarget && (
          <RecruiterInterviewDetail
            target={{
              suggestionId: detail.id,
              candidateName: candidateLabel(detail),
              opportunityTitle: detail.opportunity.title,
              interview: detail.interview,
              rounds: roundsOf(detail),
              phase: detail.phase,
              proposals: proposalsOf(detail),
              placement: detail.placement ?? null,
              filledAt: offerById.get(detail.opportunity.id)?.filledAt ?? undefined,
              canManage: detail.status === 'mise_en_relation',
            }}
            initialStep={detailTarget.entry}
            onClose={() => setDetailTarget(null)}
            onChanged={handleDetailChanged}
            onRefresh={handleDetailRefresh}
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

function OfferRow({ group: g, active, onSelect }: { group: OfferGroup; active: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      id={rowDomId(g.id)}
      className={`rcand-row${active ? ' rcand-row-active' : ''}`}
      aria-current={active ? 'true' : undefined}
      aria-controls="rcand-panel"
      onClick={onSelect}
    >
      <span className="rcand-row-title">{g.title}</span>
      {g.publishedAt && (
        <span className="rcand-row-date">publiée le {formatPublishedShort(g.publishedAt)}</span>
      )}
      <span className="rcand-row-stats">
        <span>{plural(g.items.length, 'profil', 'profils')}</span>
        {g.toReview > 0 && <span className="rcand-row-review">{g.toReview} à examiner</span>}
        {g.toRecord > 0 && (
          <span className="rcand-row-flag">
            <AlertTriangle size={12} aria-hidden />
            {g.toRecord > 1 ? `${g.toRecord} issues à renseigner` : '1 issue à renseigner'}
          </span>
        )}
        {g.flagged - g.toRecord > 0 && (
          <span className="rcand-row-flag">
            <AlertTriangle size={12} aria-hidden />
            {g.flagged - g.toRecord > 1 ? `${g.flagged - g.toRecord} entretiens à traiter` : '1 entretien à traiter'}
          </span>
        )}
      </span>
    </button>
  )
}
