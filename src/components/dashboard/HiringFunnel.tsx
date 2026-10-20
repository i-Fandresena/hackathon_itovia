import type { BarItem } from '../charts/BarList'
import type { DelaySummary, FunnelSituation, FunnelStage, HiringFunnelData, HiringPeriod } from '../../lib/api'
import { fmt, formatPercent, plural, type CsvRow } from './dashboardFormat'
import './HiringFunnel.css'

/**
 * Entonnoir de recrutement (sous-lot 7) : de la transmission d'un profil au
 * recruteur jusqu'à l'embauche, pour une COHORTE de dossiers transmis pendant
 * la période. Barres horizontales d'une seule couleur (une grandeur), longueur
 * relative aux dossiers proposés ; chaque étape écrit son effectif et sa part
 * de l'étape précédente : la liste est elle-même l'alternative textuelle, et
 * un résumé complet est lu par les lecteurs d'écran. Définitions des étapes :
 * server/src/lib/hiring-metrics.ts (une seule définition, admin et recruteur).
 */

export const HIRING_PERIODS: HiringPeriod[] = ['30', '90', '365', 'all']

export const HIRING_PERIOD_LABELS: Record<HiringPeriod, string> = {
  '30': '30 derniers jours',
  '90': '90 derniers jours',
  '365': '12 derniers mois',
  all: 'Depuis le début',
}

export const FUNNEL_STAGE_LABELS: Record<FunnelStage, { label: string; hint: string; plural: [string, string] }> = {
  proposes: {
    label: 'Proposés',
    hint: 'Profils transmis au recruteur (écartés après transmission compris)',
    plural: ['profil proposé', 'profils proposés'],
  },
  mis_en_relation: {
    label: 'Mis en relation',
    hint: 'Entretien proposé ou mise en relation confirmée',
    plural: ['mis en relation', 'mis en relation'],
  },
  entretien_passe: {
    label: 'Entretien passé',
    hint: 'Au moins un tour terminé, ni annulé ni en empêchement',
    plural: ['entretien passé', 'entretiens passés'],
  },
  retenus: {
    label: 'Retenus',
    hint: 'Au moins un tour avec l’issue « Retenu »',
    plural: ['retenu', 'retenus'],
  },
  proposition: {
    label: 'Proposition d’embauche',
    hint: 'Au moins une proposition envoyée',
    plural: ['proposition', 'propositions'],
  },
  embauches: {
    label: 'Embauchés',
    hint: 'Proposition acceptée, placement non annulé',
    plural: ['embauché', 'embauchés'],
  },
}

export const FUNNEL_SITUATION_LABELS: Record<FunnelSituation, string> = {
  embauche: 'Embauchés',
  en_cours: 'En cours',
  ecarte_avant_mise_en_relation: 'Écartés avant la mise en relation',
  non_retenu: 'Non retenus',
  proposition_declinee: 'Proposition déclinée',
  poste_pourvu: 'Poste pourvu par un autre candidat',
  embauche_annulee: 'Embauche annulée',
  placement_declare: 'Placement déclaré hors proposition',
}

const SITUATION_HINTS: Partial<Record<FunnelSituation, string>> = {
  en_cours: 'Décision du recruteur, entretien, issue ou proposition en attente',
  placement_declare: 'Déclaration antérieure au flux de proposition : hors entonnoir',
}

const SITUATION_ORDER: FunnelSituation[] = [
  'embauche',
  'en_cours',
  'non_retenu',
  'proposition_declinee',
  'poste_pourvu',
  'ecarte_avant_mise_en_relation',
  'embauche_annulee',
  'placement_declare',
]

/** « 12,5 j », ou « — » sans valeur. */
export const formatDays = (days: number | null) => (days === null ? '—' : `${days.toLocaleString('fr-FR')} j`)

/** « médiane 12 j · moyenne 14,5 j · 3 dossiers ». */
export function delayText(delay: DelaySummary): string {
  if (delay.count === 0) return 'Aucun dossier concerné pour l’instant'
  return `médiane ${formatDays(delay.medianDays)} · moyenne ${formatDays(delay.meanDays)} · ${plural(delay.count, 'dossier', 'dossiers')}`
}

/** Résumé complet pour les lecteurs d'écran (et l'export). */
export function funnelSummary(funnel: HiringFunnelData): string {
  const [first, ...rest] = funnel.stages
  if (!first || first.count === 0) return 'Aucun dossier transmis sur cette période.'
  const parts = rest.map((s) => {
    const share = s.ratePrevious === null ? '' : ` (${formatPercent(s.ratePrevious)} de l’étape précédente)`
    return `${fmt(s.count)} ${FUNNEL_STAGE_LABELS[s.key].label.toLowerCase()}${share}`
  })
  return `Sur ${plural(first.count, 'profil proposé', 'profils proposés')} : ${parts.join(', ')}.`
}

export function situationItems(funnel: HiringFunnelData): BarItem[] {
  return SITUATION_ORDER.filter((k) => k !== 'placement_declare' || funnel.situations[k] > 0).map((key) => ({
    key,
    label: FUNNEL_SITUATION_LABELS[key],
    value: funnel.situations[key],
    hint: SITUATION_HINTS[key],
    muted: key !== 'embauche' && key !== 'en_cours',
  }))
}

/** Lignes CSV de l'entonnoir (export du panneau). */
export function funnelCsvRows(funnel: HiringFunnelData): CsvRow[] {
  const rows: CsvRow[] = [['Étape', 'Définition', 'Dossiers', 'Part de l’étape précédente (%)', 'Part des proposés (%)']]
  funnel.stages.forEach((s) =>
    rows.push([FUNNEL_STAGE_LABELS[s.key].label, FUNNEL_STAGE_LABELS[s.key].hint, s.count, s.ratePrevious, s.rateFromStart]),
  )
  rows.push([])
  rows.push(['Situation actuelle', 'Dossiers'])
  SITUATION_ORDER.forEach((k) => rows.push([FUNNEL_SITUATION_LABELS[k], funnel.situations[k]]))
  rows.push(['dont clos automatiquement (offre pourvue)', funnel.closedByFilledOffer])
  rows.push([])
  rows.push(['Délai (jours)', 'Médiane', 'Moyenne', 'Dossiers'])
  const delays: [string, DelaySummary][] = [
    ['Mise en relation → embauche', funnel.delays.connectionToHire],
    ['Transmission → mise en relation', funnel.delays.transmissionToConnection],
    ['Mise en relation → 1er entretien', funnel.delays.connectionToFirstInterview],
    ['Fin d’entretien → issue', funnel.delays.interviewToOutcome],
  ]
  delays.forEach(([label, d]) => rows.push([label, d.medianDays, d.meanDays, d.count]))
  return rows
}

export function HiringFunnel({ funnel, title }: { funnel: HiringFunnelData; title: string }) {
  const first = funnel.stages[0]?.count ?? 0
  return (
    <figure className="ofunnel">
      <ol className="ofunnel-steps" aria-label={title}>
        {funnel.stages.map((stage, i) => {
          const meta = FUNNEL_STAGE_LABELS[stage.key]
          const pct = first > 0 ? (stage.count / first) * 100 : 0
          return (
            <li key={stage.key} className="ofunnel-step">
              <div className="ofunnel-head">
                <span className="ofunnel-label">
                  <span className="ofunnel-index" aria-hidden="true">
                    {i + 1}
                  </span>
                  <span className="ofunnel-text">
                    <span className="ofunnel-name">{meta.label}</span>
                    <span className="ofunnel-hint">{meta.hint}</span>
                  </span>
                </span>
                <span className="ofunnel-figures">
                  <strong className="ofunnel-count">{fmt(stage.count)}</strong>
                  {i > 0 && (
                    <span className="ofunnel-rate">
                      {stage.ratePrevious === null ? '—' : formatPercent(stage.ratePrevious)}
                      <span className="ofunnel-rate-note"> de l’étape précédente</span>
                    </span>
                  )}
                </span>
              </div>
              <div className="ofunnel-track" aria-hidden="true">
                {pct > 0 && <div className="ofunnel-fill" style={{ width: `${Math.max(1.5, pct)}%` }} />}
              </div>
            </li>
          )
        })}
      </ol>
      <figcaption className="odash-sr">{funnelSummary(funnel)}</figcaption>
    </figure>
  )
}
