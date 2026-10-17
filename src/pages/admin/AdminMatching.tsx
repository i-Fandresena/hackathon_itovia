import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Bot,
  CheckCircle2,
  Eye,
  FileX,
  ListChecks,
  ListPlus,
  Lock,
  RefreshCw,
  Send,
  UserCog,
  X,
  XCircle,
} from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Select } from '../../components/ui/Form'
import { Loading } from '../../components/ui/Loading'
import { Modal } from '../../components/ui/Modal'
import { CvFlagCount, CvFlagList, CvStatusBadge } from '../../components/cv/CvStatus'
import { MatchFitDetail } from '../../components/matching/MatchFitDetail'
import { OpportunityMissions } from '../../components/opportunity/OpportunityMissions'
import { InterviewSummary } from '../../components/interview/InterviewSummary'
import { calendarActionLabel } from '../../lib/interview'
import {
  ApiError,
  apiFileUrl,
  apiAdminCandidateDetail,
  apiAdminCreateSuggestion,
  apiAdminResyncInterview,
  apiAdminMatchSuggestions,
  apiAdminPreselection,
  apiAdminRunMatching,
  apiAdminTransmitPreselection,
  apiAdminUpdateSuggestionStatus,
  apiListOpportunities,
  type AdminCandidateDetail,
  type AdminMatchSuggestion,
  type MatchingConfig,
  type MatchingRunResult,
} from '../../lib/api'
import {
  AVAILABILITY_LABELS,
  EDUCATION_LABELS,
  EXPERIENCE_LABELS,
  GENDER_LABELS,
  OPPORTUNITY_TYPE_LABELS,
  SECTOR_LABELS,
} from '../../data/constants'
import type {
  CvVerificationStatus,
  MatchSuggestionOrigin,
  MatchSuggestionStatus,
  Opportunity,
  PreselectionEliminated,
  PreselectionEntry,
  PreselectionFilters,
  PreselectionMotif,
  PreselectionResult,
  PreselectionTop,
  PreselectionTransmitOutcome,
} from '../../types'
import { formatDate } from '../../lib/format'
import './AdminMatching.css'

const STATUS_LABELS: Record<MatchSuggestionStatus, string> = {
  suggeree: 'À valider',
  proposee_candidat: 'Proposé au candidat (ancien parcours)',
  interet_candidat: 'Candidat intéressé (ancien parcours)',
  proposee_recruteur: 'Transmis au recruteur',
  interet_recruteur: 'Recruteur intéressé',
  mise_en_relation: 'Mis en relation',
  ecartee: 'Écarté',
}

/** Statuts que l'admin peut transmettre au recruteur : la file de validation
 *  et les dossiers hérités du parcours « postuler offre par offre ». */
const TRANSMITTABLE: MatchSuggestionStatus[] = ['suggeree', 'proposee_candidat', 'interet_candidat']

/** Statuts qu'un admin peut ramener à "ecartee" — jamais depuis
 *  `mise_en_relation` (état terminal, cf. `ADMIN_ALLOWED_TRANSITIONS` côté
 *  serveur, qui reste la source de vérité et revalide de toute façon). */
const CANCELLABLE: MatchSuggestionStatus[] = [...TRANSMITTABLE, 'proposee_recruteur', 'interet_recruteur']

const TOP_CHOICES: PreselectionTop[] = [5, 10]

const NO_FILTERS: PreselectionFilters = {
  verifiedOnly: false,
  sameProvince: false,
  levelMatch: false,
  desiredType: false,
}

/** Filtres éliminatoires optionnels, dans l'ordre où le serveur les évalue. */
const FILTER_OPTIONS: { key: keyof PreselectionFilters; label: string }[] = [
  { key: 'verifiedOnly', label: 'CV vérifié uniquement' },
  { key: 'sameProvince', label: 'Même province' },
  { key: 'levelMatch', label: 'Niveau conforme' },
  { key: 'desiredType', label: 'Type d’opportunité souhaité' },
]

/** Motifs pour lesquels l'admin peut passer outre en mettant le candidat en
 *  file « À valider » à la main. Jamais sans accord, sans CV, sur un compte
 *  inactif ou une offre fermée. */
const MANUAL_QUEUE_MOTIFS: PreselectionMotif[] = [
  'deja_ecarte',
  'aucune_competence_commune',
  'score_insuffisant',
  'cv_non_verifie',
  'autre_province',
  'niveau_non_conforme',
  'type_non_souhaite',
]

const NO_CONSENT_HINT =
  'Ce candidat n’a pas donné son accord pour être proposé aux entreprises : transmission impossible.'

type Notice = { kind: 'ok' | 'error'; text: string }

function errorText(err: unknown, fallback: string): string {
  return err instanceof ApiError && err.message ? err.message : fallback
}

function plural(count: number, singular: string, pluralForm: string): string {
  return `${count} ${count > 1 ? pluralForm : singular}`
}

/** Même borne que le serveur : une offre dont la date limite est aujourd'hui est encore ouverte. */
function isExpired(opportunity: Opportunity): boolean {
  const now = new Date()
  return new Date(opportunity.deadline).getTime() < Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
}

/** Niveau sans la fourchette d'années (« Junior (1–2 ans) » → « Junior »). */
function shortLevel(label: string): string {
  return label.replace(/\s*\(.*\)$/, '')
}

/** Compte rendu lisible d'une relance du moteur. */
function describeRun(result: MatchingRunResult): string {
  const effects = [
    result.queued > 0 && plural(result.queued, 'mise en file', 'mises en file'),
    result.sentDirect > 0 && plural(result.sentDirect, 'envoi direct au recruteur', 'envois directs au recruteur'),
    result.promoted > 0 && plural(result.promoted, 'suggestion promue', 'suggestions promues'),
    result.refreshed > 0 && plural(result.refreshed, 'score actualisé', 'scores actualisés'),
  ].filter(Boolean)
  const evaluated = `${plural(result.evaluated, 'candidat éligible évalué', 'candidats éligibles évalués')}`
  if (effects.length === 0) return `Aucune nouvelle suggestion (${evaluated}).`
  return `${effects.join(', ')} — ${evaluated}, ${result.ignored} sans effet.`
}

/**
 * Poste de validation du matching. Le moteur serveur crée les suggestions
 * (décision produit 2026-10-08) : les meilleures partent directement chez le
 * recruteur, les autres attendent ici qu'un admin les transmette ou les
 * écarte. La présélection par offre (type ATS : filtres éliminatoires puis
 * classement, top 5 ou 10) est l'outil principal pour choisir les profils à
 * transmettre. OffRec reste l'unique intermédiaire : c'est aussi ici que la
 * mise en relation est confirmée, seul moment où le candidat est notifié.
 */
export function AdminMatching() {
  /** `?offre=<id>` (lien depuis « Recruteurs ») : offre présélectionnée à l'ouverture. */
  const [searchParams] = useSearchParams()
  const requestedOpp = searchParams.get('offre')
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [selectedOpp, setSelectedOpp] = useState('')
  const [top, setTop] = useState<PreselectionTop>(5)
  const [filters, setFilters] = useState<PreselectionFilters>(NO_FILTERS)
  const [presel, setPresel] = useState<PreselectionResult | null>(null)
  const [preselLoading, setPreselLoading] = useState(false)
  const [preselError, setPreselError] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirmTransmit, setConfirmTransmit] = useState(false)
  const [outcomes, setOutcomes] = useState<PreselectionTransmitOutcome[] | null>(null)
  /** Ignore la réponse d'une requête dépassée (offre ou filtre changé entre-temps). */
  const preselRequest = useRef(0)

  const [queue, setQueue] = useState<AdminMatchSuggestion[] | null>(null)
  const [queueError, setQueueError] = useState('')
  const [notice, setNotice] = useState<Notice | null>(null)
  const [preselNotice, setPreselNotice] = useState<Notice | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [matchingConfig, setMatchingConfig] = useState<MatchingConfig | null>(null)
  const [confirming, setConfirming] = useState<AdminMatchSuggestion | null>(null)

  const [viewingCandidateId, setViewingCandidateId] = useState<string | null>(null)
  const [candidateDetail, setCandidateDetail] = useState<AdminCandidateDetail | null>(null)
  const [candidateDetailError, setCandidateDetailError] = useState('')

  const loadQueue = () => {
    setQueueError('')
    apiAdminMatchSuggestions()
      .then(setQueue)
      .catch(() => setQueueError('Impossible de charger les suggestions.'))
  }

  useEffect(() => {
    apiListOpportunities()
      .then((opps) => {
        setOpportunities(opps)
        // L'offre demandée dans l'URL si elle existe, sinon la première offre
        // encore ouverte : une offre expirée n'a pas de présélection.
        const requested = requestedOpp ? opps.find((o) => o.id === requestedOpp) : undefined
        const first = requested ?? opps.find((o) => !isExpired(o)) ?? opps[0]
        if (first) setSelectedOpp(first.id)
      })
      .catch(() => setPreselError('Impossible de charger les offres.'))
    loadQueue()
  }, [])

  const loadPreselection = () => {
    if (!selectedOpp) return
    const request = ++preselRequest.current
    setPreselLoading(true)
    setPreselError('')
    apiAdminPreselection(selectedOpp, { top, filters })
      .then((result) => {
        if (request !== preselRequest.current) return
        setPresel(result)
        // Une case cochée ne survit que si le candidat est toujours retenu et transmissible.
        const selectable = new Set(result.ranked.filter((e) => e.transmissible).map((e) => e.candidateId))
        setSelected((current) => new Set([...current].filter((id) => selectable.has(id))))
      })
      .catch(() => {
        if (request !== preselRequest.current) return
        setPresel(null)
        setPreselError('Impossible de charger la présélection.')
      })
      .finally(() => {
        if (request === preselRequest.current) setPreselLoading(false)
      })
  }

  useEffect(loadPreselection, [selectedOpp, top, filters])

  const reload = () => {
    loadQueue()
    loadPreselection()
  }

  /** Un seul retour à la fois : celui de la dernière action. */
  const clearNotices = () => {
    setNotice(null)
    setPreselNotice(null)
    setOutcomes(null)
  }

  const selectOpportunity = (id: string) => {
    setSelectedOpp(id)
    setPresel(null)
    setSelected(new Set())
    setPreselNotice(null)
    setOutcomes(null)
  }

  /** Mise en file manuelle d'un candidat éliminé (ou réactivation d'un candidat écarté). */
  const handleQueue = async (candidate: PreselectionEliminated) => {
    setBusy(candidate.candidateId)
    clearNotices()
    try {
      await apiAdminCreateSuggestion(selectedOpp, candidate.candidateId)
      setPreselNotice({
        kind: 'ok',
        text: `${candidate.fullName} est dans la file « À valider ». Rien n’est encore envoyé au recruteur.`,
      })
    } catch (err) {
      setPreselNotice({ kind: 'error', text: errorText(err, 'Mise en file impossible.') })
    } finally {
      setBusy(null)
      reload()
    }
  }

  const handleTransition = async (id: string, status: MatchSuggestionStatus) => {
    setBusy(id)
    clearNotices()
    try {
      await apiAdminUpdateSuggestionStatus(id, status)
      setNotice({
        kind: 'ok',
        text:
          status === 'proposee_recruteur'
            ? 'Profil transmis au recruteur.'
            : status === 'mise_en_relation'
              ? 'Mise en relation confirmée. Le candidat est notifié sur la plateforme et par email.'
              : 'Suggestion écartée.',
      })
    } catch (err) {
      // 409 : consentement absent ou retiré entre-temps ; 400 : le dossier a
      // déjà avancé ailleurs. Le message du serveur est explicite.
      setNotice({ kind: 'error', text: errorText(err, 'Action impossible.') })
    } finally {
      setBusy(null)
      reload()
    }
  }

  /** Régularisation de l'agenda Google d'un entretien (lien Meet en attente…). */
  const handleResync = async (interviewId: string) => {
    if (busy === interviewId) return
    setBusy(interviewId)
    clearNotices()
    try {
      const { interview } = await apiAdminResyncInterview(interviewId)
      setNotice({
        kind: 'ok',
        text:
          interview.meetStatus === 'disponible'
            ? 'Agenda Google à jour : le lien Meet est disponible pour le candidat et le recruteur.'
            : 'Agenda Google à jour.',
      })
    } catch (err) {
      // 409 : agenda Google non configuré, entretien terminé ou annulé ;
      // 502 : Google échoue encore. Le message du serveur est explicite.
      setNotice({ kind: 'error', text: errorText(err, 'Synchronisation impossible.') })
    } finally {
      setBusy(null)
      reload()
    }
  }

  const handleRunMatching = async () => {
    if (!selectedOpp) return
    setBusy('run')
    clearNotices()
    try {
      const { result, config } = await apiAdminRunMatching(selectedOpp)
      setMatchingConfig(config)
      setPreselNotice({ kind: 'ok', text: `Matching relancé : ${describeRun(result)}` })
    } catch (err) {
      setPreselNotice({ kind: 'error', text: errorText(err, 'Relance du matching impossible.') })
    } finally {
      setBusy(null)
      reload()
    }
  }

  const ranked = presel?.ranked ?? []
  const selectable = ranked.filter((e) => e.transmissible)
  // Dans l'ordre du classement, quel que soit l'ordre des clics.
  const selection = ranked.filter((e) => selected.has(e.candidateId))

  const toggleSelected = (candidateId: string) => {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(candidateId)) next.delete(candidateId)
      else next.add(candidateId)
      return next
    })
  }

  const toggleAll = () => {
    setSelected(selection.length === selectable.length ? new Set() : new Set(selectable.map((e) => e.candidateId)))
  }

  const handleTransmitSelection = async () => {
    setConfirmTransmit(false)
    if (!selectedOpp || selection.length === 0) return
    setBusy('transmit')
    clearNotices()
    try {
      const result = await apiAdminTransmitPreselection(selectedOpp, {
        candidateIds: selection.map((e) => e.candidateId),
        top,
        filters,
      })
      setOutcomes(result.outcomes)
      setSelected(new Set())
    } catch (err) {
      setPreselNotice({ kind: 'error', text: errorText(err, 'Transmission impossible.') })
    } finally {
      setBusy(null)
      reload()
    }
  }

  const openCandidateDetail = (candidateId: string) => {
    setViewingCandidateId(candidateId)
    setCandidateDetail(null)
    setCandidateDetailError('')
    apiAdminCandidateDetail(candidateId)
      .then(setCandidateDetail)
      .catch(() => setCandidateDetailError('Impossible de charger ce profil.'))
  }

  const all = queue ?? []
  // File de validation : meilleurs scores d'abord ; les dossiers de l'ancien
  // parcours suivent, ils se traitent avec les mêmes actions.
  const toValidate = [
    ...all.filter((s) => s.status === 'suggeree').sort((a, b) => b.score - a.score),
    ...all.filter((s) => s.status === 'interet_candidat' || s.status === 'proposee_candidat'),
  ]
  const toConfirm = all.filter((s) => s.status === 'interet_recruteur')
  const withRecruiter = all.filter((s) => s.status === 'proposee_recruteur')
  const connected = all.filter((s) => s.status === 'mise_en_relation')

  const renderSuggestion = (s: AdminMatchSuggestion) => {
    const legacy = s.status === 'interet_candidat' || s.status === 'proposee_candidat'
    const canTransmit = TRANSMITTABLE.includes(s.status)
    const isBusy = busy === s.id
    const calendarAction = s.interview ? calendarActionLabel(s.interview) : null
    return (
      <Card key={s.id} className="match-card">
        <div className="match-card-head">
          <div className="match-card-id">
            <strong>{s.candidate.candidateProfile?.fullName ?? s.candidate.email}</strong>
            <p className="match-card-offer">
              {s.opportunity.title} — {s.opportunity.companyName}
            </p>
          </div>
          <span className="match-card-score">{s.score}%</span>
        </div>

        <div className="match-chips">
          {legacy && <Badge variant="muted">{STATUS_LABELS[s.status]}</Badge>}
          <OriginChip origin={s.origin} />
          {/* CV et accord éclairent une décision à prendre : inutiles une
              fois la mise en relation faite (état terminal). */}
          {s.status !== 'mise_en_relation' && (
            <>
              <CvChips hasCv={s.cvVerificationStatus !== null} status={s.cvVerificationStatus} flagCount={s.cvFlagCount} />
              <ConsentChip given={s.matchingConsent} />
            </>
          )}
        </div>

        {s.reasons.length > 0 && (
          <ul className="match-card-reasons">
            {s.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        )}

        {canTransmit && !s.matchingConsent && <p className="match-hint match-hint-warning">{NO_CONSENT_HINT}</p>}

        {/* Entretien fixé par le recruteur (décision 2026-10-14). */}
        {s.status === 'mise_en_relation' &&
          (s.interview ? (
            <InterviewSummary interview={s.interview} audience="admin">
              {calendarAction && (
                <Button
                  size="sm"
                  disabled={busy === s.interview.id}
                  aria-busy={busy === s.interview.id}
                  onClick={() => handleResync(s.interview!.id)}
                >
                  <RefreshCw size={14} aria-hidden />
                  {busy === s.interview.id ? 'Synchronisation…' : calendarAction}
                </Button>
              )}
            </InterviewSummary>
          ) : (
            <p className="match-hint">Aucun entretien fixé par le recruteur.</p>
          ))}

        <div className="match-actions">
          {canTransmit && (
            <Button
              size="sm"
              disabled={isBusy || !s.matchingConsent}
              onClick={() => handleTransition(s.id, 'proposee_recruteur')}
            >
              <Send size={14} aria-hidden />
              Transmettre au recruteur
            </Button>
          )}
          {s.status === 'interet_recruteur' && (
            <Button size="sm" disabled={isBusy} onClick={() => setConfirming(s)}>
              <CheckCircle2 size={14} aria-hidden />
              Confirmer la mise en relation
            </Button>
          )}
          {CANCELLABLE.includes(s.status) && (
            <Button size="sm" variant="outline" disabled={isBusy} onClick={() => handleTransition(s.id, 'ecartee')}>
              <X size={14} aria-hidden />
              Écarter
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => openCandidateDetail(s.candidate.id)}>
            <Eye size={14} aria-hidden />
            Voir le profil
          </Button>
        </div>
      </Card>
    )
  }

  const renderRanked = (entry: PreselectionEntry) => {
    const checkboxId = `presel-pick-${entry.candidateId}`
    const isSelected = selected.has(entry.candidateId)
    return (
      <li key={entry.candidateId} className={`presel-row${isSelected ? ' presel-row-selected' : ''}`}>
        <div className="presel-row-pick">
          {entry.transmissible ? (
            <input
              id={checkboxId}
              type="checkbox"
              className="presel-checkbox"
              checked={isSelected}
              disabled={busy === 'transmit'}
              onChange={() => toggleSelected(entry.candidateId)}
              aria-label={`Sélectionner ${entry.fullName} pour la transmission`}
            />
          ) : (
            <span className="presel-lock" title={entry.blockedReason ?? undefined}>
              <Lock size={14} aria-hidden />
            </span>
          )}
          <span className="presel-rank" aria-label={`Rang ${entry.rank}`}>
            {entry.rank}
          </span>
        </div>

        <div className="presel-row-body">
          <div className="presel-row-head">
            <div className="presel-row-id">
              <label htmlFor={entry.transmissible ? checkboxId : undefined} className="presel-name">
                {entry.fullName}
              </label>
              <div className="match-chips">
                <CvStatusBadge status={entry.cvVerificationStatus} />
                <CvFlagCount count={entry.cvFlagCount} />
                {entry.suggestion ? (
                  <>
                    <Badge variant={entry.transmissible ? 'default' : 'primary'}>
                      {STATUS_LABELS[entry.suggestion.status]}
                    </Badge>
                    <OriginChip origin={entry.suggestion.origin} />
                  </>
                ) : (
                  <Badge variant="muted">Pas encore proposé</Badge>
                )}
                {entry.sectorMatch === 'identique' && (
                  <span className="match-chip" title="Information seulement : le secteur n’est pas un critère">
                    Même secteur d’intérêt
                  </span>
                )}
              </div>
            </div>
            <span className="presel-score" title="Score de compatibilité (inchangé par la présélection)">
              {entry.score}%
            </span>
          </div>

          <MatchFitDetail fit={entry.fit} cvHintSkills={entry.cvHintSkills} />

          <div className="presel-row-foot">
            {!entry.transmissible && entry.blockedReason && (
              <p className="presel-blocked">
                <Lock size={13} aria-hidden />
                {entry.blockedReason}
              </p>
            )}
            <Button variant="ghost" size="sm" onClick={() => openCandidateDetail(entry.candidateId)}>
              <Eye size={14} aria-hidden />
              Voir le profil
            </Button>
          </div>
        </div>
      </li>
    )
  }

  const offer = presel?.opportunity

  return (
    <div className="page">
      <div className="container">
        <header className="page-header">
          <p className="eyebrow">Back-office OffRec</p>
          <h1>Mise en relation</h1>
          <p>
            Pour chaque offre, la présélection filtre puis classe les candidats qui ont déposé un CV et donné leur
            accord. Transmettez les meilleurs profils au recruteur, puis confirmez la mise en relation quand il est
            intéressé : le candidat n’est prévenu qu’à ce moment-là.
          </p>
        </header>

        <Card className="presel">
          <h2 className="presel-title">
            <ListChecks size={18} aria-hidden />
            Présélection par offre
          </h2>
          <p className="match-section-intro">
            Filtres éliminatoires, puis classement selon les critères de l’offre. Le score de compatibilité n’est pas
            modifié : la présélection départage et explique. Rien n’est envoyé au recruteur tant que vous ne
            transmettez pas une sélection.
          </p>

          <div className="presel-toolbar">
            <Select aria-label="Offre" value={selectedOpp} onChange={(e) => selectOpportunity(e.target.value)}>
              {opportunities.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.title} — {o.companyName}
                  {isExpired(o) ? ' (expirée)' : ''}
                </option>
              ))}
            </Select>
            <div className="presel-top" role="group" aria-label="Nombre de profils retenus">
              {TOP_CHOICES.map((choice) => (
                <button
                  key={choice}
                  type="button"
                  className={`presel-top-btn${top === choice ? ' presel-top-btn-active' : ''}`}
                  aria-pressed={top === choice}
                  onClick={() => setTop(choice)}
                >
                  Top {choice}
                </button>
              ))}
            </div>
            <Button variant="outline" size="sm" disabled={!selectedOpp || busy === 'run'} onClick={handleRunMatching}>
              <RefreshCw size={14} aria-hidden />
              {busy === 'run' ? 'Matching en cours…' : 'Relancer le matching'}
            </Button>
          </div>

          {matchingConfig && (
            <p className="match-hint">
              Seuils du moteur : mise en file à partir de {matchingConfig.threshold}%, envoi direct au recruteur à
              partir de {matchingConfig.autoThreshold}% avec un CV vérifié, {matchingConfig.maxPerRun} créations au
              plus par relance.
            </p>
          )}
          {preselNotice && <NoticeLine notice={preselNotice} />}

          {preselError ? (
            <div>
              <p className="match-empty">{preselError}</p>
              <Button size="sm" onClick={loadPreselection}>
                Réessayer
              </Button>
            </div>
          ) : !selectedOpp && opportunities.length === 0 ? (
            <p className="match-empty">Aucune offre publiée.</p>
          ) : !presel || !offer ? (
            <Loading />
          ) : (
            <div className={`presel-content${preselLoading ? ' presel-content-loading' : ''}`} aria-busy={preselLoading}>
              <div className="presel-criteria">
                <p className="presel-subtitle">Critères de l’offre</p>
                <dl className="presel-criteria-list">
                  <div className="presel-criterion presel-criterion-wide">
                    <dt>Compétences requises</dt>
                    <dd>
                      {offer.requiredSkills.length === 0 ? (
                        '—'
                      ) : (
                        <span className="match-chips">
                          {offer.requiredSkills.map((skill) => (
                            <Badge key={skill} variant="primary">
                              {skill}
                            </Badge>
                          ))}
                        </span>
                      )}
                    </dd>
                  </div>
                  <div className="presel-criterion">
                    <dt>Niveau</dt>
                    <dd>{shortLevel(EXPERIENCE_LABELS[offer.level] ?? offer.level)}</dd>
                  </div>
                  <div className="presel-criterion">
                    <dt>Lieu</dt>
                    <dd>
                      {offer.city}, {offer.province}
                    </dd>
                  </div>
                  <div className="presel-criterion">
                    <dt>Type</dt>
                    <dd>{OPPORTUNITY_TYPE_LABELS[offer.opportunityType] ?? offer.opportunityType}</dd>
                  </div>
                  <div className="presel-criterion">
                    <dt>Date limite</dt>
                    <dd>{formatDate(offer.deadline)}</dd>
                  </div>
                  <div className="presel-criterion">
                    <dt>Secteur (information)</dt>
                    <dd>
                      {SECTOR_LABELS[offer.sector] ?? offer.sector}
                      {offer.category ? ` · ${offer.category}` : ''}
                    </dd>
                  </div>
                  <div className="presel-criterion presel-criterion-wide">
                    <dt>Missions (information, hors score)</dt>
                    <dd>
                      {(offer.missions ?? []).length === 0 ? '—' : <OpportunityMissions missions={offer.missions} compact />}
                    </dd>
                  </div>
                </dl>
              </div>

              <fieldset className="presel-filters">
                <legend className="presel-subtitle">Filtres éliminatoires optionnels</legend>
                {FILTER_OPTIONS.map(({ key, label }) => (
                  <label key={key} className="presel-filter">
                    <input
                      type="checkbox"
                      className="presel-checkbox"
                      checked={filters[key]}
                      onChange={(e) => setFilters((current) => ({ ...current, [key]: e.target.checked }))}
                    />
                    {label}
                  </label>
                ))}
              </fieldset>

              {!offer.open && (
                <p className="match-hint match-hint-warning">
                  Offre fermée : {offer.closedReason} Aucun profil ne peut être présélectionné ni transmis.
                </p>
              )}

              <div className="presel-counts">
                <Count value={presel.counts.evaluated} label="candidats évalués" />
                <Count value={presel.counts.eliminated} label="éliminés" />
                <Count value={presel.counts.qualified} label={`qualifiés (score ≥ ${presel.threshold}%)`} />
                <Count value={presel.counts.retained} label={`retenus (top ${presel.top})`} strong />
              </div>
              {presel.counts.byMotif.length > 0 && (
                <ul className="presel-motifs" aria-label="Éliminés par motif">
                  {presel.counts.byMotif.map((m) => (
                    <li key={m.motif} className="presel-motif">
                      <strong>{m.count}</strong> {m.label}
                    </li>
                  ))}
                </ul>
              )}

              {outcomes && <TransmitReport outcomes={outcomes} />}

              {ranked.length === 0 ? (
                <p className="match-empty">
                  {offer.open
                    ? 'Aucun candidat ne passe les filtres pour cette offre.'
                    : 'Aucune présélection pour une offre fermée.'}
                </p>
              ) : (
                <>
                  <div className="presel-bar">
                    <label className="presel-filter">
                      <input
                        type="checkbox"
                        className="presel-checkbox"
                        checked={selectable.length > 0 && selection.length === selectable.length}
                        disabled={selectable.length === 0 || busy === 'transmit'}
                        onChange={toggleAll}
                      />
                      Tout sélectionner
                    </label>
                    <span className="presel-bar-count">
                      {selectable.length === 0
                        ? 'Aucun profil transmissible'
                        : `${plural(selection.length, 'profil sélectionné', 'profils sélectionnés')} sur ${selectable.length}`}
                    </span>
                    <Button
                      size="sm"
                      disabled={selection.length === 0 || busy === 'transmit'}
                      onClick={() => setConfirmTransmit(true)}
                    >
                      <Send size={14} aria-hidden />
                      {busy === 'transmit' ? 'Transmission…' : 'Transmettre la sélection au recruteur'}
                    </Button>
                  </div>
                  <ol className="presel-list">{ranked.map(renderRanked)}</ol>
                  {presel.counts.qualified > presel.counts.retained && (
                    <p className="match-hint">
                      {plural(
                        presel.counts.qualified - presel.counts.retained,
                        'autre candidat qualifié',
                        'autres candidats qualifiés',
                      )}{' '}
                      hors du top {presel.top}.
                    </p>
                  )}
                </>
              )}

              {presel.eliminated.length > 0 && (
                <details className="presel-eliminated">
                  <summary>Candidats éliminés ({presel.eliminated.length})</summary>
                  <ul className="presel-eliminated-list">
                    {presel.eliminated.map((c) => {
                      const canQueue =
                        MANUAL_QUEUE_MOTIFS.includes(c.motif) && (!c.suggestion || c.suggestion.status === 'ecartee')
                      return (
                        <li key={c.candidateId} className="presel-eliminated-row">
                          <div className="presel-eliminated-id">
                            <strong>{c.fullName}</strong>
                            <span className="presel-eliminated-motif">
                              {c.motifLabel} · score {c.score}%
                              {c.suggestion && c.suggestion.status !== 'ecartee'
                                ? ` · ${STATUS_LABELS[c.suggestion.status]}`
                                : ''}
                            </span>
                          </div>
                          <div className="match-actions">
                            {canQueue && (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={busy === c.candidateId}
                                onClick={() => handleQueue(c)}
                              >
                                <ListPlus size={14} aria-hidden />
                                {c.motif === 'deja_ecarte' ? 'Remettre en file' : 'Mettre en file'}
                              </Button>
                            )}
                            <Button variant="ghost" size="sm" onClick={() => openCandidateDetail(c.candidateId)}>
                              <Eye size={14} aria-hidden />
                              Voir le profil
                            </Button>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                  <p className="match-hint">
                    « Mettre en file » ajoute le candidat à la file « À valider » malgré le motif indiqué ; il réintègre
                    alors le circuit normal. Impossible sans accord, sans CV, ou sur un compte inactif.
                  </p>
                </details>
              )}
            </div>
          )}
        </Card>

        {notice && <NoticeLine notice={notice} />}

        {queueError ? (
          <div className="match-section">
            <p className="match-empty">{queueError}</p>
            <Button size="sm" onClick={loadQueue}>
              Réessayer
            </Button>
          </div>
        ) : !queue ? (
          <Loading />
        ) : (
          <>
            <Section
              title="À valider"
              count={toValidate.length}
              intro="Suggestions du moteur sous le seuil d’envoi direct ou au CV non vérifié, et candidats mis en file à la main. Rien n’est visible du recruteur avant la transmission."
              empty="Aucune suggestion en attente de validation."
            >
              {toValidate.map(renderSuggestion)}
            </Section>

            <Section
              title="Mises en relation à confirmer"
              count={toConfirm.length}
              intro="Le recruteur a marqué son intérêt pour ces profils."
              empty="Aucun recruteur n’attend de mise en relation."
            >
              {toConfirm.map(renderSuggestion)}
            </Section>

            <Section
              title="En attente du recruteur"
              count={withRecruiter.length}
              intro="Profils transmis, sans réponse du recruteur pour l’instant."
              empty="Aucun profil en attente chez un recruteur."
            >
              {withRecruiter.map(renderSuggestion)}
            </Section>

            {connected.length > 0 && (
              <Section title="Mis en relation" count={connected.length} empty="">
                {connected.map(renderSuggestion)}
              </Section>
            )}
          </>
        )}

        {confirmTransmit && offer && (
          <Modal title="Transmettre la sélection" onClose={() => setConfirmTransmit(false)}>
            <div className="match-confirm">
              <p>
                {plural(selection.length, 'profil sera transmis', 'profils seront transmis')} à{' '}
                <strong>{offer.companyName}</strong> pour « {offer.title} » :
              </p>
              <ol className="presel-confirm-list">
                {selection.map((entry) => (
                  <li key={entry.candidateId}>
                    <span className="presel-rank">{entry.rank}</span>
                    <span>{entry.fullName}</span>
                    <span className="presel-confirm-score">{entry.score}%</span>
                  </li>
                ))}
              </ol>
              <p className="match-hint match-hint-warning">
                Le recruteur est notifié et voit ces profils dans « Candidats proposés », avec leur rang et le détail
                par critère. Les candidats ne sont pas prévenus à ce stade.
              </p>
              <div className="match-actions">
                <Button size="sm" onClick={handleTransmitSelection}>
                  <Send size={14} aria-hidden />
                  Transmettre au recruteur
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirmTransmit(false)}>
                  Annuler
                </Button>
              </div>
            </div>
          </Modal>
        )}

        {confirming && (
          <Modal title="Confirmer la mise en relation" onClose={() => setConfirming(null)}>
            <div className="match-confirm">
              <p>
                <strong>{confirming.candidate.candidateProfile?.fullName ?? confirming.candidate.email}</strong> et{' '}
                <strong>{confirming.opportunity.companyName}</strong> seront mis en relation pour «{' '}
                {confirming.opportunity.title} ».
              </p>
              <p className="match-hint match-hint-warning">
                Le candidat sera notifié sur la plateforme et par email, et découvrira le nom de l’entreprise. Cette
                action est définitive.
              </p>
              <div className="match-actions">
                <Button
                  size="sm"
                  onClick={() => {
                    const { id } = confirming
                    setConfirming(null)
                    handleTransition(id, 'mise_en_relation')
                  }}
                >
                  <CheckCircle2 size={14} aria-hidden />
                  Confirmer et notifier le candidat
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirming(null)}>
                  Annuler
                </Button>
              </div>
            </div>
          </Modal>
        )}

        {viewingCandidateId && (
          <Modal title="Profil candidat" onClose={() => setViewingCandidateId(null)}>
            {candidateDetailError ? (
              <p>{candidateDetailError}</p>
            ) : !candidateDetail ? (
              <Loading />
            ) : (
              <div className="match-detail">
                <div>
                  <strong className="match-detail-name">{candidateDetail.fullName}</strong>
                  <p className="match-detail-contact">
                    {candidateDetail.email} · {candidateDetail.phone}
                  </p>
                </div>
                <dl className="match-detail-rows">
                  <Row label="Localisation" value={`${candidateDetail.city}, ${candidateDetail.province}`} />
                  <Row label="Genre" value={GENDER_LABELS[candidateDetail.gender]} />
                  <Row label="Niveau d’études" value={EDUCATION_LABELS[candidateDetail.educationLevel]} />
                  <Row label="Expérience" value={EXPERIENCE_LABELS[candidateDetail.experienceLevel]} />
                  <Row label="Disponibilité" value={AVAILABILITY_LABELS[candidateDetail.availability]} />
                  {candidateDetail.sector && <Row label="Secteur" value={SECTOR_LABELS[candidateDetail.sector]} />}
                  <Row
                    label="Types recherchés"
                    value={candidateDetail.desiredOpportunityTypes.map((t) => OPPORTUNITY_TYPE_LABELS[t]).join(', ') || '—'}
                  />
                  <Row label="Membre depuis" value={formatDate(candidateDetail.memberSince)} />
                  <Row
                    label="Accord de matching"
                    value={
                      candidateDetail.matchingConsentAt
                        ? `Donné le ${formatDate(candidateDetail.matchingConsentAt)}`
                        : 'Non donné ou retiré'
                    }
                  />
                </dl>
                {candidateDetail.skills.length > 0 && (
                  <div>
                    <p className="match-detail-label">Compétences</p>
                    <div className="match-chips">
                      {candidateDetail.skills.map((s) => (
                        <Badge key={s} variant="primary">
                          {s}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                {candidateDetail.cvUrl ? (
                  <div className="match-detail-cv">
                    <div className="match-chips">
                      <p className="match-detail-label">CV</p>
                      <CvStatusBadge status={candidateDetail.cvVerificationStatus ?? 'non_verifie'} />
                      <a href={apiFileUrl(candidateDetail.cvUrl)} target="_blank" rel="noreferrer">
                        Voir le CV
                      </a>
                    </div>
                    {candidateDetail.cvFlags && candidateDetail.cvFlags.length > 0 && (
                      <>
                        <p className="match-hint">Points à vérifier relevés automatiquement :</p>
                        <CvFlagList flags={candidateDetail.cvFlags} />
                      </>
                    )}
                  </div>
                ) : (
                  <p className="match-empty">Aucun CV déposé.</p>
                )}
              </div>
            )}
          </Modal>
        )}
      </div>
    </div>
  )
}

function Section({
  title,
  count,
  intro,
  empty,
  children,
}: {
  title: string
  count: number
  intro?: string
  empty: string
  children: ReactNode
}) {
  return (
    <section className="match-section">
      <h2 className="match-section-title">
        {title} <span className="match-section-count">{count}</span>
      </h2>
      {intro && <p className="match-section-intro">{intro}</p>}
      {count === 0 ? <p className="match-empty">{empty}</p> : <div className="match-grid">{children}</div>}
    </section>
  )
}

function NoticeLine({ notice }: { notice: Notice }) {
  return (
    <p className={`match-notice match-notice-${notice.kind}`} role={notice.kind === 'error' ? 'alert' : 'status'}>
      {notice.text}
    </p>
  )
}

function Count({ value, label, strong = false }: { value: number; label: string; strong?: boolean }) {
  return (
    <div className={`presel-count${strong ? ' presel-count-strong' : ''}`}>
      <span className="presel-count-value">{value}</span>
      <span className="presel-count-label">{label}</span>
    </div>
  )
}

/** Compte rendu, candidat par candidat, de la dernière transmission groupée. */
function TransmitReport({ outcomes }: { outcomes: PreselectionTransmitOutcome[] }) {
  const transmitted = outcomes.filter((o) => o.transmitted).length
  const refused = outcomes.length - transmitted
  return (
    <div className="presel-report" role="status">
      <p className="presel-report-title">
        {plural(transmitted, 'profil transmis', 'profils transmis')} au recruteur
        {refused > 0 ? `, ${plural(refused, 'refusé', 'refusés')}` : ''}.
      </p>
      <ul className="presel-report-list">
        {outcomes.map((o) => (
          <li key={o.candidateId} className={o.transmitted ? 'presel-report-ok' : 'presel-report-ko'}>
            {o.transmitted ? <CheckCircle2 size={14} aria-hidden /> : <XCircle size={14} aria-hidden />}
            <span>
              <strong>{o.fullName ?? 'Candidat inconnu'}</strong>
              {o.transmitted
                ? ` — transmis${o.rank ? ` (rang ${o.rank} de la présélection)` : ''}.`
                : ` — non transmis : ${o.reason ?? 'raison inconnue.'}`}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function OriginChip({ origin }: { origin: MatchSuggestionOrigin }) {
  const Icon = origin === 'systeme' ? Bot : UserCog
  return (
    <span className="match-chip" title="Origine de la suggestion">
      <Icon size={13} aria-hidden />
      {origin === 'systeme' ? 'Moteur' : 'Admin'}
    </span>
  )
}

function CvChips({
  hasCv,
  status,
  flagCount,
}: {
  hasCv: boolean
  status: CvVerificationStatus | null
  flagCount: number
}) {
  if (!hasCv) {
    return (
      <span className="match-chip match-chip-warning">
        <FileX size={13} aria-hidden />
        Aucun CV
      </span>
    )
  }
  return (
    <>
      <CvStatusBadge status={status ?? 'non_verifie'} />
      <CvFlagCount count={flagCount} />
    </>
  )
}

function ConsentChip({ given }: { given: boolean }) {
  const Icon = given ? CheckCircle2 : XCircle
  return (
    <span className={`match-chip ${given ? 'match-chip-success' : 'match-chip-warning'}`}>
      <Icon size={13} aria-hidden />
      {given ? 'Accord donné' : 'Sans accord'}
    </span>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="match-detail-row">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}
