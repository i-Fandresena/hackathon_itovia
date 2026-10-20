import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Download, FileSpreadsheet } from 'lucide-react'
import { BarList } from '../../components/charts/BarList'
import {
  FUNNEL_STAGE_LABELS,
  HIRING_PERIOD_LABELS,
  HIRING_PERIODS,
  HiringFunnel,
  delayText,
  formatDays,
  funnelCsvRows,
  situationItems,
} from '../../components/dashboard/HiringFunnel'
import { csvPreamble, downloadCsv, downloadCsvText, fmt, formatPercent, plural } from '../../components/dashboard/dashboardFormat'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Field, Select } from '../../components/ui/Form'
import {
  ApiError,
  apiAdminHiringStats,
  apiAdminResearchExport,
  type AdminHiringStats,
  type HiringPeriod,
  type OutcomeTimeliness,
  type ResearchExportResult,
} from '../../lib/api'

/**
 * Tableau de bord admin — « Recrutement » (sous-lot 7) : entonnoir de toute
 * la plateforme (cohorte des dossiers transmis pendant la période, filtrable
 * par recruteur, par offre et sans les comptes de test), indicateur « issue
 * renseignée sous 7 jours » (plan §11), délais et export pseudonymisé pour le
 * mémoire. Chargé à part (`GET /admin/stats/hiring`) : une erreur ici ne
 * touche pas le reste du tableau de bord.
 */

const TEST_DOMAINS = '@offrec-test.invalid, @demo.mg'

function indicatorChip(t: OutcomeTimeliness): { text: string; className: string } {
  if (t.met === null) return { text: 'Pas encore de tour mûr', className: 'odash-chip odash-chip-info' }
  return t.met
    ? { text: `Objectif atteint (≥ ${t.targetPercent} %)`, className: 'odash-chip odash-chip-up' }
    : { text: `Sous l’objectif (${t.targetPercent} %)`, className: 'odash-chip odash-chip-warning' }
}

function ResearchExportCard() {
  const [excludeTest, setExcludeTest] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<ResearchExportResult | null>(null)

  const run = async () => {
    setBusy(true)
    setError('')
    try {
      const res = await apiAdminResearchExport(excludeTest)
      downloadCsvText(res.csv, res.filename)
      setResult(res)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Export impossible. Réessayez.')
    } finally {
      setBusy(false)
    }
  }

  const g = result?.generalization
  return (
    <Card className="odash-panel hdash-export">
      <div className="odash-panel-head">
        <div>
          <h2>Export pour la recherche</h2>
          <p>Score de matching × issue réelle, une ligne par dossier transmis</p>
        </div>
      </div>
      <p>
        Fichier CSV pseudonymisé pour le chapitre « évaluation » : identifiants remplacés par une empreinte non réversible, dates
        réduites au mois, aucun nom, email, téléphone, entreprise, note, texte libre ni salaire.
      </p>
      <ul>
        <li>
          <strong>Nature des données :</strong> une partie vient de comptes de test et de démonstration. L’export démontre le dispositif
          de mesure ; ce ne sont pas des résultats de terrain.
        </li>
        <li>Les petits groupes (moins de 5 dossiers) sont généralisés ; publiez des agrégats, jamais une ligne isolée.</li>
        <li>Chaque export est inscrit au journal d’activité (volume seulement).</li>
      </ul>
      <label className="hdash-check">
        <input type="checkbox" checked={excludeTest} onChange={(e) => setExcludeTest(e.target.checked)} />
        Exclure les comptes de test ({TEST_DOMAINS})
      </label>
      <div className="hdash-panel-actions">
        <Button size="sm" onClick={() => void run()} disabled={busy} aria-busy={busy}>
          <FileSpreadsheet size={15} aria-hidden />
          {busy ? 'Préparation…' : 'Télécharger l’export anonymisé'}
        </Button>
      </div>
      {error && (
        <p className="hdash-error" role="alert">
          {error}
        </p>
      )}
      {result && g && !error && (
        <p className="hdash-export-result" role="status">
          {plural(result.rowCount, 'ligne exportée', 'lignes exportées')} dans {result.filename}
          {result.excludeTest ? ', comptes de test exclus' : `, dont ${fmt(result.testRows)} de comptes de test`}.{' '}
          Lignes généralisées : {fmt(g.offerAttributes)} avec secteur/niveau/type regroupés, {fmt(g.quarter + g.year + g.masked)} avec une période élargie ou masquée.
          {g.residualSmallGroups > 0 && ` ${plural(g.residualSmallGroups, 'ligne reste isolée', 'lignes restent isolées')} (signalé dans le fichier).`}
          {result.truncated && ' Export tronqué à la limite du serveur.'}
        </p>
      )}
    </Card>
  )
}

export function AdminHiringSection() {
  const [period, setPeriod] = useState<HiringPeriod>('all')
  const [recruiterId, setRecruiterId] = useState('')
  const [opportunityId, setOpportunityId] = useState('')
  const [excludeTest, setExcludeTest] = useState(false)
  const [data, setData] = useState<AdminHiringStats | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const request = useRef(0)

  const load = useCallback(() => {
    const id = ++request.current
    setLoading(true)
    setError('')
    apiAdminHiringStats({ period, recruiterId: recruiterId || undefined, opportunityId: opportunityId || undefined, excludeTest })
      .then((res) => {
        if (id !== request.current) return
        if (!res?.funnel?.stages) {
          setError('Le serveur ne fournit pas encore l’entonnoir de recrutement : mettez à jour le backend.')
          return
        }
        setData(res)
      })
      .catch((err) => {
        if (id === request.current) setError(err instanceof ApiError ? err.message : 'Impossible de charger l’entonnoir de recrutement.')
      })
      .finally(() => {
        if (id === request.current) setLoading(false)
      })
  }, [period, recruiterId, opportunityId, excludeTest])

  useEffect(load, [load])

  const offerOptions = useMemo(
    () => (data?.options.opportunities ?? []).filter((o) => !recruiterId || o.recruiterId === recruiterId),
    [data, recruiterId],
  )

  const funnel = data?.funnel
  const proposed = funnel?.stages[0]?.count ?? 0
  const hired = funnel?.stages.find((s) => s.key === 'embauches')?.count ?? 0
  const overall = funnel?.stages.find((s) => s.key === 'embauches')?.rateFromStart ?? null
  const ind = data?.outcomeIndicator
  const chip = ind ? indicatorChip(ind.last30) : null

  const exportFunnel = () => {
    if (!data) return
    const recruiter = data.options.recruiters.find((r) => r.id === data.filters.recruiterId)
    const offer = data.options.opportunities.find((o) => o.id === data.filters.opportunityId)
    const rows = csvPreamble(
      'Entonnoir de recrutement OffRec',
      data.computedAt,
      `Cohorte : dossiers transmis — ${HIRING_PERIOD_LABELS[data.period]}. Recruteur : ${recruiter?.companyName ?? 'tous'}. Offre : ${offer?.title ?? 'toutes'}. Comptes de test : ${data.filters.excludeTest ? 'exclus' : 'inclus'}.`,
    )
    rows.push(...funnelCsvRows(data.funnel))
    rows.push([])
    rows.push(['Issue renseignée sous 7 jours', 'Tours éligibles', 'Sous 7 jours', '%', 'Objectif (%)'])
    const { last30, allTime } = data.outcomeIndicator
    rows.push(['Fin du tour entre J-37 et J-7', last30.eligible, last30.recordedWithin7d, last30.percent, last30.targetPercent])
    rows.push(['Depuis le début (fin ≤ J-7)', allTime.eligible, allTime.recordedWithin7d, allTime.percent, allTime.targetPercent])
    downloadCsv(rows, 'offrec-entonnoir-recrutement', data.computedAt)
  }

  return (
    <section className="odash-section" aria-labelledby="hdash-admin-title">
      <div className="odash-section-head">
        <h2 id="hdash-admin-title">Recrutement : de la transmission à l’embauche</h2>
        <p>
          Cohorte des dossiers transmis aux recruteurs pendant la période, suivis jusqu’à aujourd’hui. Un dossier ne compte à une
          étape que s’il a franchi la précédente ; un dossier écarté ou clos s’arrête à la dernière étape atteinte.
        </p>
      </div>

      <div className="hdash-filters">
        <Field label="Période de transmission">
          <Select value={period} onChange={(e) => setPeriod(e.target.value as HiringPeriod)}>
            {HIRING_PERIODS.map((p) => (
              <option key={p} value={p}>
                {HIRING_PERIOD_LABELS[p]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Recruteur">
          <Select
            value={recruiterId}
            onChange={(e) => {
              setRecruiterId(e.target.value)
              setOpportunityId('')
            }}
          >
            <option value="">Tous les recruteurs</option>
            {data?.options.recruiters.map((r) => (
              <option key={r.id} value={r.id}>
                {r.companyName}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Offre">
          <Select value={opportunityId} onChange={(e) => setOpportunityId(e.target.value)}>
            <option value="">Toutes les offres</option>
            {offerOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.title} — {o.companyName}
              </option>
            ))}
          </Select>
        </Field>
        <label className="hdash-check">
          <input type="checkbox" checked={excludeTest} onChange={(e) => setExcludeTest(e.target.checked)} />
          Exclure les comptes de test
        </label>
      </div>

      {error && (
        <Card className="odash-error">
          <span className="odash-error-text" role="alert">
            <AlertTriangle size={18} aria-hidden />
            {error}
          </span>
          <Button size="sm" onClick={load} disabled={loading}>
            Réessayer
          </Button>
        </Card>
      )}

      {!data && !error && (
        <div className="odash-charts" role="status" aria-live="polite">
          <span className="odash-sr">Chargement de l’entonnoir de recrutement…</span>
          <div className="odash-skel odash-skel-chart" />
          <div className="odash-skel odash-skel-chart" />
        </div>
      )}

      {data && funnel && ind && chip && (
        <div className={`odash-body ${loading ? 'is-refreshing' : ''}`.trim()} aria-busy={loading}>
          {data.truncated && (
            <p className="hdash-warning" role="note">
              Volume au-delà de la limite de calcul : seuls les dossiers les plus récents sont comptés.
            </p>
          )}
          <div className="odash-charts">
            <Card className="odash-panel odash-panel-wide">
              <div className="odash-panel-head">
                <div>
                  <h2>Entonnoir de recrutement</h2>
                  <p>
                    {HIRING_PERIOD_LABELS[data.period]} · {data.filters.excludeTest ? 'sans les comptes de test' : 'comptes de test compris'}
                  </p>
                </div>
                <div className="odash-panel-figure">
                  <strong>{formatPercent(overall)}</strong>
                  <span className="odash-panel-figure-note">
                    proposés → embauchés ({fmt(hired)} sur {fmt(proposed)})
                  </span>
                </div>
              </div>
              {proposed === 0 ? (
                <p className="hdash-empty">Aucun dossier transmis pour ces filtres sur cette période.</p>
              ) : (
                <HiringFunnel funnel={funnel} title="Entonnoir de recrutement, de la transmission à l’embauche" />
              )}
              <div className="hdash-panel-actions">
                <Button variant="outline" size="sm" onClick={exportFunnel}>
                  <Download size={15} aria-hidden />
                  Exporter l’entonnoir en CSV
                </Button>
              </div>
            </Card>

            <div className="hdash-stack">
              <Card className="odash-panel">
                <div className="odash-panel-head">
                  <div>
                    <h2>Issues renseignées sous 7 jours</h2>
                    <p>Tours terminés entre J-37 et J-7, hors annulés et empêchements</p>
                  </div>
                </div>
                <div className="hdash-figure">
                  <strong>{formatPercent(ind.last30.percent)}</strong>
                  <span className={chip.className}>{chip.text}</span>
                </div>
                <p className="hdash-note">
                  {ind.last30.eligible > 0
                    ? `${fmt(ind.last30.recordedWithin7d)} sur ${plural(ind.last30.eligible, 'tour terminé', 'tours terminés')} avec une issue posée au plus 7 jours après la fin.`
                    : 'Aucun tour terminé dans cette fenêtre.'}{' '}
                  Depuis le début : {formatPercent(ind.allTime.percent)} ({fmt(ind.allTime.recordedWithin7d)} sur {fmt(ind.allTime.eligible)}).
                </p>
              </Card>
              <Card className="odash-panel">
                <div className="odash-panel-head">
                  <div>
                    <h2>Délais</h2>
                    <p>En jours, sur les dossiers de la cohorte concernés</p>
                  </div>
                </div>
                <dl className="hdash-facts">
                  <div>
                    <dt>Mise en relation → embauche</dt>
                    <dd>
                      {funnel.delays.connectionToHire.count === 0 ? (
                        'Aucune embauche pour l’instant'
                      ) : (
                        <>
                          <strong>{formatDays(funnel.delays.connectionToHire.medianDays)}</strong> en médiane · moyenne{' '}
                          {formatDays(funnel.delays.connectionToHire.meanDays)} ·{' '}
                          {plural(funnel.delays.connectionToHire.count, 'embauche', 'embauches')}
                        </>
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>Transmission → mise en relation</dt>
                    <dd>{delayText(funnel.delays.transmissionToConnection)}</dd>
                  </div>
                  <div>
                    <dt>Mise en relation → 1er entretien</dt>
                    <dd>{delayText(funnel.delays.connectionToFirstInterview)}</dd>
                  </div>
                  <div>
                    <dt>Fin d’entretien → issue</dt>
                    <dd>{delayText(funnel.delays.interviewToOutcome)}</dd>
                  </div>
                </dl>
              </Card>
            </div>
          </div>

          <div className="odash-charts">
            <Card className="odash-panel odash-panel-wide">
              <div className="odash-panel-head">
                <div>
                  <h2>Où en sont ces dossiers</h2>
                  <p>Situation actuelle de chaque dossier proposé — une seule case par dossier</p>
                </div>
              </div>
              {proposed === 0 ? (
                <p className="hdash-empty">Aucun dossier à répartir.</p>
              ) : (
                <BarList items={situationItems(funnel)} title="Situation actuelle des dossiers proposés" />
              )}
              <p className="hdash-note">
                {plural(funnel.closedByFilledOffer, 'dossier clos automatiquement', 'dossiers clos automatiquement')} parce que l’offre était
                pourvue. « {FUNNEL_STAGE_LABELS.embauches.label} » ne compte que les embauches nées d’une proposition acceptée.
              </p>
            </Card>
            <ResearchExportCard />
          </div>
        </div>
      )}
    </section>
  )
}
