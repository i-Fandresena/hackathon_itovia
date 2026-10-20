import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, Download } from 'lucide-react'
import { BarList } from '../../components/charts/BarList'
import {
  HIRING_PERIOD_LABELS,
  HIRING_PERIODS,
  HiringFunnel,
  delayText,
  formatDays,
  funnelCsvRows,
  situationItems,
} from '../../components/dashboard/HiringFunnel'
import { csvPreamble, downloadCsv, fmt, formatPercent, plural } from '../../components/dashboard/dashboardFormat'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Field, Select } from '../../components/ui/Form'
import { ApiError, apiRecruiterHiringStats, type HiringPeriod, type RecruiterHiringStats } from '../../lib/api'

/**
 * Tableau de bord recruteur — « Votre recrutement » (sous-lot 7) : entonnoir
 * de SES offres (`GET /recruiter/stats/hiring`), à partir des profils que
 * OffRec lui a transmis — jamais une suggestion en file interne ni rien de
 * la présélection —, délais et classement par offre (retenus, embauchés).
 */

/** Lignes du classement affichées (le CSV les contient toutes). */
const OFFER_ROWS = 8

export function RecruiterHiringSection() {
  const [period, setPeriod] = useState<HiringPeriod>('all')
  const [opportunityId, setOpportunityId] = useState('')
  const [data, setData] = useState<RecruiterHiringStats | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const request = useRef(0)

  const load = useCallback(() => {
    const id = ++request.current
    setLoading(true)
    setError('')
    apiRecruiterHiringStats({
      period,
      opportunityId: opportunityId || undefined,
    })
      .then((res) => {
        if (id !== request.current) return
        if (!res?.funnel?.stages) {
          setError('Le serveur ne fournit pas encore le suivi du recrutement : mettez à jour le backend.')
          return
        }
        setData(res)
      })
      .catch((err) => {
        if (id === request.current)
          setError(err instanceof ApiError ? err.message : 'Impossible de charger le suivi du recrutement.')
      })
      .finally(() => {
        if (id === request.current) setLoading(false)
      })
  }, [period, opportunityId])

  useEffect(load, [load])

  const funnel = data?.funnel
  const proposed = funnel?.stages[0]?.count ?? 0
  const hired = funnel?.stages.find((s) => s.key === 'embauches')?.count ?? 0
  const overall = funnel?.stages.find((s) => s.key === 'embauches')?.rateFromStart ?? null

  const exportCsv = () => {
    if (!data) return
    const offer = data.offers.find((o) => o.id === data.opportunityId)
    const rows = csvPreamble(
      'Votre recrutement OffRec',
      data.computedAt,
      `Profils que OffRec vous a transmis — ${HIRING_PERIOD_LABELS[data.period]}. Offre : ${offer?.title ?? 'toutes'}.`,
    )
    rows.push(...funnelCsvRows(data.funnel))
    rows.push([])
    rows.push(['Par offre', 'Proposés', 'Mis en relation', 'Entretien passé', 'Retenus', 'Propositions', 'Embauchés'])
    data.byOffer.forEach((o) => rows.push([o.title, o.proposed, o.connected, o.interviewed, o.retained, o.offered, o.hired]))
    downloadCsv(rows, 'offrec-recrutement', data.computedAt)
  }

  return (
    <section className="odash-section" aria-labelledby="hdash-rec-title">
      <div className="odash-section-head">
        <h2 id="hdash-rec-title">Votre recrutement</h2>
        <p>
          Profils que OffRec vous a transmis pendant la période, suivis jusqu’à l’embauche. Un profil ne compte à une étape que
          s’il a franchi la précédente.
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
        <Field label="Offre">
          <Select value={opportunityId} onChange={(e) => setOpportunityId(e.target.value)}>
            <option value="">Toutes mes offres</option>
            {data?.offers.map((o) => (
              <option key={o.id} value={o.id}>
                {o.title}
              </option>
            ))}
          </Select>
        </Field>
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
          <span className="odash-sr">Chargement du suivi du recrutement…</span>
          <div className="odash-skel odash-skel-chart" />
          <div className="odash-skel odash-skel-chart" />
        </div>
      )}

      {data && funnel && (
        <div className={`odash-body ${loading ? 'is-refreshing' : ''}`.trim()} aria-busy={loading}>
          <div className="odash-charts">
            <Card className="odash-panel odash-panel-wide">
              <div className="odash-panel-head">
                <div>
                  <h2>Entonnoir de recrutement</h2>
                  <p>{HIRING_PERIOD_LABELS[data.period]} · profils transmis par OffRec</p>
                </div>
                <div className="odash-panel-figure">
                  <strong>{formatPercent(overall)}</strong>
                  <span className="odash-panel-figure-note">
                    proposés → embauchés ({fmt(hired)} sur {fmt(proposed)})
                  </span>
                </div>
              </div>
              {proposed === 0 ? (
                <p className="hdash-empty">
                  Aucun profil transmis sur cette période. OffRec vous transmet les profils pertinents pour vos offres ouvertes.
                </p>
              ) : (
                <HiringFunnel funnel={funnel} title="Votre entonnoir de recrutement, de la transmission à l’embauche" />
              )}
              <div className="hdash-panel-actions">
                <Button variant="outline" size="sm" onClick={exportCsv}>
                  <Download size={15} aria-hidden />
                  Exporter en CSV
                </Button>
              </div>
            </Card>

            <div className="hdash-stack">
              <Card className="odash-panel">
                <div className="odash-panel-head">
                  <div>
                    <h2>Délais</h2>
                    <p>En jours, sur vos profils concernés</p>
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
                    <dt>Mise en relation → 1er entretien</dt>
                    <dd>{delayText(funnel.delays.connectionToFirstInterview)}</dd>
                  </div>
                  <div>
                    <dt>Fin d’entretien → issue renseignée</dt>
                    <dd>{delayText(funnel.delays.interviewToOutcome)}</dd>
                  </div>
                </dl>
              </Card>
              <Card className="odash-panel">
                <div className="odash-panel-head">
                  <div>
                    <h2>Où en sont ces profils</h2>
                    <p>Situation actuelle, une seule case par profil</p>
                  </div>
                </div>
                {proposed === 0 ? (
                  <p className="hdash-empty">Aucun profil à répartir.</p>
                ) : (
                  <BarList items={situationItems(funnel)} title="Situation actuelle des profils transmis" />
                )}
              </Card>
            </div>
          </div>

          <Card className="odash-panel">
            <div className="odash-panel-head">
              <div>
                <h2>Par offre</h2>
                <p>Profils transmis pendant la période, par étape atteinte</p>
              </div>
            </div>
            {data.byOffer.length === 0 ? (
              <p className="hdash-empty">Aucune offre avec un profil transmis sur cette période.</p>
            ) : (
              <>
                <p className="hdash-table-note">
                  {data.byOffer.length > OFFER_ROWS
                    ? `${OFFER_ROWS} offres sur ${fmt(data.byOffer.length)}, classées par embauchés puis retenus — toutes dans l’export CSV.`
                    : 'Classées par embauchés, puis retenus, puis profils proposés.'}
                </p>
                <div
                  className="hdash-table-wrap"
                  role="region"
                  aria-label="Tableau par offre (défilement horizontal)"
                  tabIndex={0}
                >
                  <table className="hdash-table">
                    <caption className="odash-sr">Profils transmis par offre et par étape atteinte</caption>
                    <thead>
                      <tr>
                        <th scope="col">Offre</th>
                        <th scope="col">Proposés</th>
                        <th scope="col">Mis en relation</th>
                        <th scope="col">Entretien passé</th>
                        <th scope="col">Retenus</th>
                        <th scope="col">Propositions</th>
                        <th scope="col">Embauchés</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.byOffer.slice(0, OFFER_ROWS).map((o) => (
                        <tr key={o.id}>
                          <th scope="row">
                            <Link to={`/recruteur/candidatures?offre=${encodeURIComponent(o.id)}`}>{o.title}</Link>
                          </th>
                          <td>{fmt(o.proposed)}</td>
                          <td>{fmt(o.connected)}</td>
                          <td>{fmt(o.interviewed)}</td>
                          <td className="is-key">{fmt(o.retained)}</td>
                          <td>{fmt(o.offered)}</td>
                          <td className="is-key">{fmt(o.hired)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
            <p className="hdash-note">
              {plural(proposed, 'profil proposé', 'profils proposés')} au total sur la période ·{' '}
              {plural(hired, 'embauche', 'embauches')} née
              {hired > 1 ? 's' : ''} d’une proposition acceptée.
            </p>
          </Card>
        </div>
      )}
    </section>
  )
}
