import { useState } from 'react'
import {
  ArrowRight,
  Building2,
  CalendarDays,
  CheckCircle2,
  CircleAlert,
  Clock,
  FileSignature,
  MapPin,
  Send,
} from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { WithdrawDossierButton } from '../../components/candidate/WithdrawDossierButton'
import { HiringPhaseBadge } from '../../components/hiring/HiringPhaseBadge'
import {
  CandidateHireProposalCard,
  CandidateHireProposalDialog,
  type CandidateProposalStep,
} from '../../components/hiring/CandidateHireProposalCard'
import {
  ABSENCE_FLAG,
  absenceToExplain,
  candidateInterviewFlag,
} from '../../components/interview/CandidateInterviewCard'
import { CandidateInterviewDetail } from '../../components/interview/CandidateInterviewDetail'
import { interviewStatusLabel } from '../../components/interview/InterviewSummary'
import type { MatchSuggestionWithOpportunity } from '../../lib/api'
import { FadeUp } from '../../components/motion/Motion'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { useApp } from '../../context/AppContext'
import { OPPORTUNITY_TYPE_LABELS } from '../../data/constants'
import {
  CANDIDATE_PHASE_TEXT,
  canWithdrawFromDossier,
  dossierStatusInfo,
  isClosedDossier,
  isTransmitted,
} from '../../lib/candidateDossier'
import { formatDate } from '../../lib/format'
import { formatCivilDate } from '../../lib/hiring'
import { formatMadagascarDateTime, formatMadagascarShortDateTime } from '../../lib/interview'
import type { CandidateProfile } from '../../types'
import './CandidateDashboard.css'

const PROFILE_PATH = '/candidat/profil'

type StepState = 'ok' | 'pending' | 'missing'

interface ReadinessStep {
  key: string
  state: StepState
  title: string
  detail: string
  /** Libellé du lien vers le profil — absent quand il n'y a rien à faire. */
  action?: string
  /** Ce qui manque, formulé pour la phrase de synthèse. */
  missing?: string
}

/**
 * État de préparation. Le serveur ne propose un profil que si le candidat a
 * donné son consentement ET déposé un CV, puis calcule le score sur le
 * profil confirmé : sans compétence en commun avec une offre, rien n'est
 * proposé. La vérification du CV ne bloque pas — elle décide seulement si
 * un bon score part directement à l'entreprise ou passe par OffRec.
 */
function readinessSteps(profile: CandidateProfile): ReadinessStep[] {
  const hasCv = Boolean(profile.cvUrl)
  const cvStatus = profile.cvVerificationStatus ?? 'non_verifie'

  const profileGaps = [
    profile.skills.length === 0 && 'vos compétences',
    profile.desiredOpportunityTypes.length === 0 && 'les types d’opportunités recherchés',
    profile.phone.trim() === '' && 'votre téléphone',
  ].filter((gap): gap is string => Boolean(gap))

  const cvStep: ReadinessStep = hasCv
    ? { key: 'cv', state: 'ok', title: 'CV déposé', detail: 'Votre CV est enregistré.' }
    : {
        key: 'cv',
        state: 'missing',
        title: 'CV non déposé',
        detail: 'Sans CV, le système ne peut pas proposer votre profil.',
        action: 'Déposer mon CV',
        missing: 'déposer votre CV',
      }

  let verificationStep: ReadinessStep
  if (!hasCv) {
    verificationStep = {
      key: 'verification',
      state: 'pending',
      title: 'Vérification du CV',
      detail: 'Elle commence dès que votre CV est déposé.',
    }
  } else if (cvStatus === 'verifie') {
    verificationStep = {
      key: 'verification',
      state: 'ok',
      title: 'CV vérifié par OffRec',
      detail: profile.cvVerifiedAt
        ? `Vérifié le ${formatDate(profile.cvVerifiedAt)}. Les meilleures correspondances partent directement à l’entreprise.`
        : 'Les meilleures correspondances partent directement à l’entreprise.',
    }
  } else if (cvStatus === 'rejete') {
    verificationStep = {
      key: 'verification',
      state: 'missing',
      title: 'CV non validé par OffRec',
      detail: profile.cvVerificationNote
        ? `Motif indiqué : ${profile.cvVerificationNote}`
        : 'Déposez un CV corrigé pour qu’il soit relu.',
      action: 'Déposer un CV corrigé',
      missing: 'déposer un CV corrigé',
    }
  } else {
    verificationStep = {
      key: 'verification',
      state: 'pending',
      title: 'CV en cours de vérification',
      detail:
        'Rien à faire de votre côté. En attendant, chaque proposition est validée par OffRec avant de partir à l’entreprise.',
    }
  }

  const consentStep: ReadinessStep = profile.matchingConsentAt
    ? {
        key: 'consent',
        state: 'ok',
        title: 'Consentement donné',
        detail: `Le ${formatDate(profile.matchingConsentAt)}. Vous pouvez le retirer à tout moment depuis votre profil.`,
      }
    : {
        key: 'consent',
        state: 'missing',
        title: 'Consentement non donné',
        detail: 'OffRec ne propose jamais votre profil à une entreprise sans votre accord.',
        action: 'Donner mon accord',
        missing: 'accepter qu’OffRec propose votre profil aux entreprises',
      }

  const profileStep: ReadinessStep =
    profileGaps.length === 0
      ? {
          key: 'profile',
          state: 'ok',
          title: 'Profil complet',
          detail: 'Le matching se base sur les compétences et préférences de votre profil.',
        }
      : {
          key: 'profile',
          state: 'missing',
          title: 'Profil à compléter',
          detail: `À renseigner : ${profileGaps.join(', ')}.`,
          action: 'Compléter mon profil',
          missing: `renseigner ${profileGaps.join(', ')}`,
        }

  return [cvStep, verificationStep, consentStep, profileStep]
}

const STEP_ICONS = { ok: CheckCircle2, pending: Clock, missing: CircleAlert } as const

export function CandidateDashboard() {
  const { currentUser, mySuggestions, refreshDossiers } = useApp()
  const navigate = useNavigate()
  const [withdrawnTitle, setWithdrawnTitle] = useState('')
  const [detailId, setDetailId] = useState<string | null>(null)
  /** Réponse à une proposition d'embauche (une modale à la fois). */
  const [proposalDialog, setProposalDialog] = useState<{ id: string; step: CandidateProposalStep } | null>(null)
  const [proposalFeedback, setProposalFeedback] = useState('')
  const profile = currentUser?.candidateProfile

  if (!profile) {
    return (
      <div className="page">
        <div className="container">
          <EmptyState
            icon={Send}
            title="Complétez votre profil"
            description="Renseignez votre profil, déposez votre CV et donnez votre accord : OffRec pourra alors proposer votre profil aux entreprises."
            actionLabel="Configurer mon profil"
            onAction={() => navigate(PROFILE_PATH)}
          />
        </div>
      </div>
    )
  }

  const steps = readinessSteps(profile)
  const missing = steps.flatMap((s) => (s.missing ? [s.missing] : []))
  const ready = missing.length === 0

  // `mySuggestions` ne contient déjà que les dossiers visibles du candidat ;
  // le filtre ne fait que se prémunir d'une ligne écartée restée en mémoire.
  const dossiers = mySuggestions
    .filter((s) => s.status !== 'ecartee' && s.status !== 'suggeree')
    .slice()
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  const transmitted = dossiers.filter((s) => isTransmitted(s.status)).length
  const interested = dossiers.filter((s) => s.status === 'interet_recruteur').length
  const connected = dossiers.filter((s) => s.status === 'mise_en_relation').length
  // Propositions d'embauche (sous-lot 6) : en attente de réponse, puis embauches confirmées.
  const pendingProposals = dossiers.filter((s) => s.status === 'mise_en_relation' && s.proposal?.status === 'envoyee')
  const hires = dossiers.filter((s) => s.status === 'mise_en_relation' && s.candidatePhase === 'embauche').length
  // Dossiers clos (« Dossier clos » : non retenu, poste pourvu…) : rangés à
  // part, repliés, sans action possible.
  const openDossiers = dossiers.filter((s) => !isClosedDossier(s))
  const closedDossiers = dossiers.filter((s) => isClosedDossier(s))
  // Relu à chaque rendu : la modale revient à jour après une réponse.
  const detail = detailId
    ? dossiers.find((s) => s.id === detailId && s.status === 'mise_en_relation' && s.interview) ?? null
    : null
  // Relue à chaque rendu : après un 409, la nouvelle version de la proposition.
  const proposalDossier = proposalDialog
    ? dossiers.find((s) => s.id === proposalDialog.id && s.status === 'mise_en_relation' && s.proposal) ?? null
    : null

  const openProposal = (id: string, step: CandidateProposalStep) => {
    setProposalFeedback('')
    setProposalDialog({ id, step })
  }

  const renderDossier = (s: MatchSuggestionWithOpportunity) => {
    const status = dossierStatusInfo(s.status)
    const detailPath = `/candidat/offres/${s.opportunityId}`
    // Le serveur ne renvoie le nom qu'à la mise en relation ; on
    // le conditionne aussi au statut, par défense.
    const connectedDossier = s.status === 'mise_en_relation'
    const company = connectedDossier ? s.opportunity.companyName : null
    const interview = connectedDossier ? s.interview ?? null : null
    const phase = connectedDossier ? s.candidatePhase ?? null : null
    const absence = connectedDossier ? absenceToExplain(s.interviews ?? []) : undefined
    const flag = absence ? ABSENCE_FLAG : interview ? candidateInterviewFlag(interview) : null
    const flagId = `dossier-iv-flag-${s.id}`
    return (
      <Card key={s.id} className="dossier-card">
        <div className="dossier-head">
          <div className="dossier-title">
            <h3>
              <Link to={detailPath}>{s.opportunity.title}</Link>
            </h3>
            <p className="dossier-company">
              <Building2 size={14} aria-hidden />
              {company ?? 'Entreprise communiquée à la mise en relation'}
            </p>
          </div>
          {phase ? (
            <HiringPhaseBadge audience="candidate" phase={phase} />
          ) : (
            <Badge variant={status.variant}>{status.label}</Badge>
          )}
        </div>

        <div className="dossier-meta">
          <Badge variant="muted">{s.opportunity.category}</Badge>
          <Badge variant="muted">{OPPORTUNITY_TYPE_LABELS[s.opportunity.opportunityType]}</Badge>
          <span className="dossier-location">
            <MapPin size={14} aria-hidden />
            {s.opportunity.city}, {s.opportunity.province}
          </span>
        </div>

        <p className="dossier-status-text">{phase ? CANDIDATE_PHASE_TEXT[phase] : status.description}</p>

        {connectedDossier && s.proposal?.status === 'acceptee' && (
          <p className="dossier-hired">
            <CheckCircle2 size={14} aria-hidden />
            Embauche confirmée — début le {formatCivilDate(s.proposal.startDate)}.
          </p>
        )}

        {(interview || canWithdrawFromDossier(s.status)) && (
          <div className="dossier-actions">
            {canWithdrawFromDossier(s.status) && (
              <WithdrawDossierButton
                suggestionId={s.id}
                opportunityTitle={s.opportunity.title}
                onWithdrawn={setWithdrawnTitle}
              />
            )}
            {/* Entretien fixé par l'entreprise (décision 2026-10-14),
                envoyé par le serveur à partir de la mise en relation
                seulement : détail, réponse et explication d'absence dans
                une modale. */}
            {interview && s.proposal && (
              <Button variant="outline" size="sm" aria-haspopup="dialog" onClick={() => setDetailId(s.id)}>
                <FileSignature size={14} aria-hidden />
                Voir la proposition
              </Button>
            )}
            {interview && (
              <Button
                variant="outline"
                size="sm"
                className="dossier-iv-btn"
                aria-haspopup="dialog"
                aria-describedby={flag ? flagId : undefined}
                title={`Entretien : ${interviewStatusLabel(interview.status, 'candidate')} · ${formatMadagascarDateTime(interview.scheduledAt)} (heure de Madagascar)`}
                onClick={() => setDetailId(s.id)}
              >
                <CalendarDays size={14} aria-hidden />
                Voir l’entretien
                <span className={`dossier-iv-when${interview.status === 'annule' ? ' is-cancelled' : ''}`}>
                  · {interview.status === 'annule' ? 'annulé' : formatMadagascarShortDateTime(interview.scheduledAt)}
                </span>
                {flag && <span className="dossier-iv-dot" aria-hidden />}
              </Button>
            )}
            {flag && (
              <span className="dossier-iv-flag" id={flagId}>
                <Clock size={13} aria-hidden />
                {flag}
              </span>
            )}
          </div>
        )}
      </Card>
    )
  }

  return (
    <div className="page">
      <div className="container">
        <FadeUp eager>
          <header className="page-header">
            <p className="eyebrow">Espace candidat</p>
            <h1>Bonjour, {profile.fullName.split(' ')[0]}</h1>
            <p>
              Vous n’avez pas à postuler : OffRec propose votre profil aux entreprises dont les
              offres vous correspondent. Suivez ici l’avancement de vos dossiers.
            </p>
          </header>
        </FadeUp>

        {pendingProposals.length > 0 && (
          <section className="dash-proposals" aria-labelledby="dash-proposals-title">
            <div className="dash-block-head">
              <h2 id="dash-proposals-title">
                {pendingProposals.length > 1 ? 'Propositions d’embauche à traiter' : 'Proposition d’embauche à traiter'}
              </h2>
            </div>
            {pendingProposals.map((s) => (
              <Card key={s.id} className="dash-proposal-card">
                <CandidateHireProposalCard
                  proposal={s.proposal!}
                  opportunityTitle={s.opportunity.title}
                  companyName={s.opportunity.companyName}
                  onAccept={() => openProposal(s.id, 'accept')}
                  onDecline={() => openProposal(s.id, 'decline')}
                />
              </Card>
            ))}
          </section>
        )}

        {proposalFeedback && (
          <p className="dash-feedback" role="status">
            {proposalFeedback}
          </p>
        )}

        <FadeUp eager index={0}>
          <Card className="dash-readiness">
            <div className="dash-block-head">
              <h2>Préparation de votre profil</h2>
              <span className={`dash-readiness-tag ${ready ? 'is-ready' : 'is-missing'}`}>
                {ready ? 'Prêt' : 'À compléter'}
              </span>
            </div>
            <p className="dash-readiness-summary">
              {ready
                ? 'Tout est en place : le système peut proposer votre profil dès qu’une offre correspond à vos compétences.'
                : `Pour que le système puisse proposer votre profil, il vous reste à ${missing.join(' ; ')}.`}
            </p>
            <ul className="dash-steps">
              {steps.map((step) => {
                const Icon = STEP_ICONS[step.state]
                return (
                  <li key={step.key} className={`dash-step dash-step-${step.state}`}>
                    <Icon size={18} className="dash-step-icon" aria-hidden />
                    <div className="dash-step-body">
                      <strong>{step.title}</strong>
                      <p>{step.detail}</p>
                    </div>
                    {step.action && (
                      <Link to={PROFILE_PATH} className="dash-step-action">
                        {step.action} <ArrowRight size={14} aria-hidden />
                      </Link>
                    )}
                  </li>
                )
              })}
            </ul>
          </Card>
        </FadeUp>

        <div className="dash-stats dash-stats-grid">
          <FadeUp eager index={1}>
            <Card className="stat-card">
              <strong>{transmitted}</strong>
              <span>
                {transmitted > 1 ? 'Offres pour lesquelles' : 'Offre pour laquelle'} votre profil a été
                transmis à une entreprise
              </span>
            </Card>
          </FadeUp>
          <FadeUp eager index={2}>
            <Card className="stat-card">
              <strong>{interested}</strong>
              <span>{interested > 1 ? 'Entreprises intéressées' : 'Entreprise intéressée'}, en attente de mise en relation</span>
            </Card>
          </FadeUp>
          <FadeUp eager index={3}>
            <Card className="stat-card">
              <strong>{connected}</strong>
              <span>{connected > 1 ? 'Mises en relation confirmées' : 'Mise en relation confirmée'}</span>
            </Card>
          </FadeUp>
          <FadeUp eager index={4}>
            <Card className={`stat-card${pendingProposals.length > 0 ? ' dash-stat-warning' : ''}`}>
              <strong>{pendingProposals.length}</strong>
              <span>{pendingProposals.length > 1 ? 'Propositions à traiter' : 'Proposition à traiter'}</span>
            </Card>
          </FadeUp>
          <FadeUp eager index={5}>
            <Card className="stat-card">
              <strong>{hires}</strong>
              <span>{hires > 1 ? 'Embauches confirmées' : 'Embauche confirmée'}</span>
            </Card>
          </FadeUp>
        </div>

        <div className="dash-block-head dash-dossiers-head">
          <h2>Mes dossiers en cours</h2>
        </div>

        {withdrawnTitle && (
          <p className="dash-feedback" role="status">
            Vous vous êtes retiré·e du dossier « {withdrawnTitle} ».
          </p>
        )}

        {dossiers.length === 0 ? (
          <EmptyState
            icon={Send}
            title="Aucun dossier en cours"
            description={
              ready
                ? 'Votre profil n’a pas encore été transmis à une entreprise. Vous serez notifié·e ici et par email dès qu’une mise en relation sera confirmée.'
                : 'Votre profil ne peut pas encore être proposé aux entreprises. Complétez les éléments ci-dessus pour lancer le matching.'
            }
            actionLabel={ready ? undefined : 'Compléter mon profil'}
            onAction={ready ? undefined : () => navigate(PROFILE_PATH)}
          />
        ) : (
          <>
            {openDossiers.length > 0 ? (
              <div className="dash-dossiers">{openDossiers.map(renderDossier)}</div>
            ) : (
              <p className="dash-closed-empty">Aucun dossier en cours : vos dossiers clos sont rangés ci-dessous.</p>
            )}
            {closedDossiers.length > 0 && (
              <details className="dash-closed">
                <summary className="dash-closed-summary">
                  Dossiers clos ({closedDossiers.length})
                </summary>
                <p className="dash-closed-text">
                  Ces dossiers sont clos. Votre profil reste proposé par OffRec pour d’autres offres qui correspondent à
                  vos compétences.
                </p>
                <div className="dash-dossiers">{closedDossiers.map(renderDossier)}</div>
              </details>
            )}
          </>
        )}

        {detail?.interview && (
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
          />
        )}

        {proposalDialog && proposalDossier?.proposal && (
          <CandidateHireProposalDialog
            step={proposalDialog.step}
            suggestionId={proposalDossier.id}
            proposal={proposalDossier.proposal}
            opportunityTitle={proposalDossier.opportunity.title}
            companyName={proposalDossier.opportunity.companyName}
            onClose={() => setProposalDialog(null)}
            onRefresh={refreshDossiers}
            onDone={setProposalFeedback}
          />
        )}
      </div>
    </div>
  )
}
