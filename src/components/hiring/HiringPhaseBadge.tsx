import { HIRING_PHASE_LABELS, type CandidateHiringPhase, type HiringPhase } from '../../lib/hiring'
import './HiringPhaseBadge.css'

type Tone = 'info' | 'warning' | 'success' | 'muted'

const PHASE_TONE: Record<HiringPhase, Tone> = {
  entretien_a_planifier: 'info',
  tour_planifie: 'info',
  tour_annule: 'muted',
  issue_a_renseigner: 'warning',
  second_entretien_a_planifier: 'warning',
  absent: 'warning',
  retenu: 'success',
  proposition_envoyee: 'info',
  embauche: 'success',
  embauche_annulee: 'muted',
  clos_proposition_refusee: 'muted',
  non_retenu: 'muted',
  poste_pourvu: 'muted',
}

const CANDIDATE_TONE: Record<CandidateHiringPhase, Tone> = {
  entretien_a_planifier: 'info',
  entretien_prevu: 'info',
  entretien_annule: 'muted',
  suite_en_attente: 'info',
  suite_favorable: 'success',
  entretien_manque: 'warning',
  proposition_recue: 'warning',
  embauche: 'success',
  clos: 'muted',
}

type HiringPhaseBadgeProps =
  | { audience: 'recruiter' | 'admin'; phase: HiringPhase }
  | { audience: 'candidate'; phase: CandidateHiringPhase }

/** Libellé de phase selon le lecteur (`HIRING_PHASE_LABELS`) : jamais l'issue brute côté candidat. */
export function hiringPhaseLabel(props: HiringPhaseBadgeProps): string {
  return props.audience === 'candidate'
    ? HIRING_PHASE_LABELS.candidate[props.phase]
    : HIRING_PHASE_LABELS[props.audience][props.phase]
}

/**
 * Badge de la phase dérivée d'un dossier mis en relation (`hiringPhase` /
 * `candidateHiringPhase`, calculées par le serveur). Le candidat ne lit que
 * les libellés neutres (« En attente de la suite », « Dossier clos »…).
 */
export function HiringPhaseBadge(props: HiringPhaseBadgeProps) {
  const tone = props.audience === 'candidate' ? CANDIDATE_TONE[props.phase] : PHASE_TONE[props.phase]
  return <span className={`hpb hpb-${tone}`}>{hiringPhaseLabel(props)}</span>
}
