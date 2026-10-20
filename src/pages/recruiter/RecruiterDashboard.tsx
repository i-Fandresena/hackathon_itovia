import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Banknote,
  Bell,
  Briefcase,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  ClipboardCheck,
  CreditCard,
  FilePlus2,
  Handshake,
  Hourglass,
  Inbox,
  MessageCircle,
  PlusCircle,
  TriangleAlert,
  UserX,
  Users,
} from 'lucide-react'
import { AreaChart, type AreaPoint } from '../../components/charts/AreaChart'
import { BarList, type BarItem } from '../../components/charts/BarList'
import { DonutChart, type DonutSegment } from '../../components/charts/DonutChart'
import {
  DashboardErrors,
  DashboardHeader,
  DashboardSkeleton,
  KpiCard,
  TodoRow,
  TrendChip,
  useDashboardData,
  type Kpi,
  type KpiSection,
  type TodoItem,
} from '../../components/dashboard/DashboardParts'
import {
  ariary,
  csvPreamble,
  downloadCsv,
  fmt,
  formatPercent,
  longDay,
  plural,
  seriesLabel,
  shortDay,
  type CsvRow,
} from '../../components/dashboard/dashboardFormat'
import { FadeUp } from '../../components/motion/Motion'
import { Card } from '../../components/ui/Card'
import { useApp } from '../../context/AppContext'
import { apiRecruiterStats, type RecruiterStats } from '../../lib/api'
import { formatDate, formatDateTime } from '../../lib/format'
import { INTERVIEW_STATUS_LABELS, formatMadagascarDateTime } from '../../lib/interview'
import { LinkedCompanyCard } from '../companies/LinkedCompanyCard'
import { RecruiterHiringSection } from './RecruiterHiringSection'
import './RecruiterDashboard.css'

/* ------------------------------------------------------------------ */
/* Modèle d'affichage (partagé par l'écran et l'export CSV)            */
/* ------------------------------------------------------------------ */

const RECEIVED: [string, string] = ['profil reçu', 'profils reçus']
const CONNECTION: [string, string] = ['mise en relation', 'mises en relation']
const NEW_OFFER: [string, string] = ['nouvelle offre', 'nouvelles offres']

/** Statuts des profils reçus, dans un ordre et des couleurs fixes. */
const STATUS_GROUPS = [
  { key: 'toReview', label: 'À examiner', color: 'var(--ochart-cat-1)' },
  { key: 'connected', label: 'Mis en relation', color: 'var(--ochart-cat-3)' },
  { key: 'dismissed', label: 'Écartés', color: 'var(--ochart-neutral)' },
] as const

const STAGE_LABELS = {
  etape1_due: 'Étape 1 due (signature)',
  etape1_payee: 'Étape 1 payée',
  etape2_due: 'Étape 2 due (confirmation)',
  etape2_payee: 'Étape 2 payée',
  annule: 'Annulé',
} as const

/** Nombre de barres du classement par offre. */
const OFFER_BARS = 6

function buildModel(s: RecruiterStats) {
  const days = s.seriesDays
  const p = s.profiles
  const iv = s.interviews
  const pl = s.placements

  const todo: (TodoItem & { waiting?: boolean })[] = [
    { id: 'review', label: 'Profils à examiner', hint: 'Transmis par OffRec, en attente de votre décision', count: p.toReview, icon: Inbox, to: '/recruteur/candidatures' },
    { id: 'impediments', label: 'Empêchements d’entretien', hint: 'Le candidat ne peut pas venir : reprogrammez ou annulez', count: iv?.toHandle ?? 0, icon: TriangleAlert, to: '/recruteur/entretiens?statut=empechement' },
    { id: 'replies', label: 'Réponses attendues', hint: 'Entretiens en attente de la confirmation du candidat', count: iv?.awaitingReply ?? 0, icon: Hourglass, to: '/recruteur/entretiens?statut=planifie', waiting: true },
    { id: 'fees', label: 'Étapes de success fee dues', hint: 'Suivi déclaratif de vos placements', count: pl.feeStepsDue, icon: Banknote, to: '/recruteur/placements' },
    { id: 'messages', label: 'Messages non lus', hint: 'Discussion avec OffRec', count: s.messages.unread, icon: MessageCircle, to: '/messages' },
  ]
  // Les réponses attendues dépendent du candidat : affichées, pas comptées.
  const todoTotal = todo.filter((t) => !t.waiting).reduce((sum, t) => sum + t.count, 0)

  const overview: Kpi[] = [
    {
      id: 'offers', label: 'Offres ouvertes', value: s.offers.open, display: fmt(s.offers.open), icon: Briefcase, tone: 'accent', to: '/recruteur/offres',
      trend: { counts: { last7: s.offers.newLast7, prev7: s.offers.newPrev7 }, noun: NEW_OFFER },
      sub: `${plural(s.offers.expired, 'expirée', 'expirées')} · ${plural(s.offers.total, 'publiée', 'publiées')} au total`,
    },
    {
      id: 'received', label: 'Profils reçus', value: p.received, display: fmt(p.received), icon: Users, tone: 'accent', to: '/recruteur/candidatures',
      trend: { counts: { last7: p.receivedLast7, prev7: p.receivedPrev7 }, noun: RECEIVED },
      series: p.receivedSeries, seriesLabel: seriesLabel(p.receivedSeries, RECEIVED, days, false),
      sub: `${fmt(p.receivedLast30)} sur les 30 derniers jours · transmis par OffRec`,
    },
    {
      id: 'toReview', label: 'À examiner', value: p.toReview, display: fmt(p.toReview), icon: Inbox, tone: p.toReview > 0 ? 'warning' : 'neutral',
      to: '/recruteur/candidatures',
      chip: p.toReview > 0 ? { text: 'décision attendue', tone: 'warning' } : { text: 'rien en attente', tone: 'up' },
      sub: p.interest > 0 ? `dont ${plural(p.interest, 'profil', 'profils')} avec intérêt déjà marqué` : 'Profils transmis qui attendent votre décision',
    },
    {
      id: 'connected', label: 'Mises en relation', value: p.connected, display: fmt(p.connected), icon: Handshake, tone: 'success', to: '/recruteur/candidatures',
      trend: { counts: { last7: p.connectedLast7, prev7: p.connectedPrev7 }, noun: CONNECTION },
      series: p.connectedSeries, seriesLabel: seriesLabel(p.connectedSeries, CONNECTION, days),
      sub: `${p.connectionRate === null ? 'Aucun profil reçu' : `${formatPercent(p.connectionRate)} des profils reçus`} · ${fmt(p.connectedLast30)} sur 30 jours`,
    },
    iv
      ? {
          id: 'interviews', label: 'Entretiens à venir', value: iv.upcoming, display: fmt(iv.upcoming), icon: CalendarDays, tone: 'violet', to: '/recruteur/entretiens',
          chip: iv.toHandle > 0 ? { text: plural(iv.toHandle, 'empêchement', 'empêchements'), tone: 'warning' } : undefined,
          sub: `${plural(iv.upcomingConfirmed, 'confirmé', 'confirmés')} · ${fmt(iv.awaitingReply)} en attente de réponse`,
        }
      : {
          id: 'interviews', label: 'Entretiens à venir', value: null, display: '—', icon: CalendarDays, tone: 'neutral', to: '/recruteur/entretiens',
          sub: 'Entretiens pas encore activés sur ce serveur',
        },
    {
      id: 'placements', label: 'Placements déclarés', value: pl.total, display: fmt(pl.total), icon: ClipboardCheck, tone: 'success', to: '/recruteur/placements',
      chip: { text: `+${fmt(pl.last30)} sur 30 jours`, tone: 'info' },
      sub: `${fmt(pl.inProgress)} en cours · ${plural(pl.completed, 'finalisé', 'finalisés')} · ${plural(pl.cancelled, 'annulé', 'annulés')}`,
    },
  ]

  const sub = s.subscription
  const follow: KpiSection = {
    id: 'suivi',
    title: 'Suivi et compte',
    subtitle: 'Placements et success fee : suivi déclaratif. Abonnement : paiement simulé, aucun encaissement réel.',
    kpis: [
      {
        id: 'feeDue', label: 'Étapes de success fee dues', value: pl.feeStepsDue, display: fmt(pl.feeStepsDue), icon: Banknote,
        tone: pl.feeStepsDue > 0 ? 'warning' : 'neutral', to: '/recruteur/placements',
        sub: `${fmt(pl.byStage.etape1_due)} à la signature · ${fmt(pl.byStage.etape2_due)} à la confirmation`,
      },
      iv
        ? {
            id: 'pastInterviews', label: 'Entretiens passés', value: iv.pastLast30, display: fmt(iv.pastLast30), icon: CalendarCheck, tone: 'neutral',
            to: '/recruteur/entretiens?periode=passes',
            sub: `sur les 30 derniers jours · ${plural(iv.cancelled, 'annulé', 'annulés')} au total`,
          }
        : {
            id: 'pastInterviews', label: 'Entretiens passés', value: null, display: '—', icon: CalendarCheck, tone: 'neutral',
            sub: 'Entretiens pas encore activés sur ce serveur',
          },
      {
        id: 'dismissed', label: 'Profils écartés', value: p.dismissed, display: fmt(p.dismissed), icon: UserX, tone: 'neutral',
        sub: `Après transmission · dont ${plural(p.declinedByYou, 'décliné', 'déclinés')} par vous`,
      },
      {
        id: 'subscription', label: 'Abonnement', value: sub ? sub.priceAr : null, unit: 'Ar / mois', display: sub ? sub.planName : 'Aucun',
        icon: CreditCard, tone: 'violet', to: '/recruteur/abonnement',
        chip: { text: 'paiement simulé', tone: 'info' },
        sub: sub
          ? `${ariary(sub.priceAr)} par mois · depuis le ${formatDate(sub.startedAt)} · sans échéance enregistrée`
          : 'Aucun abonnement souscrit',
      },
      {
        id: 'notifications', label: 'Notifications non lues', value: s.notifications.unread, display: fmt(s.notifications.unread), icon: Bell, tone: 'accent',
        to: '/recruteur/notifications', sub: 'Sur votre compte recruteur',
      },
      {
        id: 'messages', label: 'Messages non lus', value: s.messages.unread, display: fmt(s.messages.unread), icon: MessageCircle, tone: 'accent',
        to: '/messages', sub: 'Discussion avec OffRec',
      },
    ],
  }

  const receivedPoints: AreaPoint[] = days.map((d, i) => ({
    key: d,
    axisLabel: shortDay(d),
    fullLabel: longDay(d),
    value: p.receivedSeries[i],
    details: STATUS_GROUPS.map((g) => ({
      key: g.key,
      label: `${g.label} (statut actuel)`,
      value: p.receivedSeriesByStatus[g.key][i],
      color: g.color,
    })),
  }))

  const statusSegments: DonutSegment[] = STATUS_GROUPS.map((g) => ({
    key: g.key,
    label: g.label,
    value: g.key === 'toReview' ? p.toReview : g.key === 'connected' ? p.connected : p.dismissed,
    color: g.color,
  }))

  const offerBars: BarItem[] = s.byOffer.slice(0, OFFER_BARS).map((o) => ({
    key: o.id,
    label: o.title,
    value: o.received,
    to: `/recruteur/offres/${o.id}/shortlist`,
    muted: !o.open,
    hint: [
      plural(o.connected, 'mis en relation', 'mis en relation'),
      plural(o.toReview, 'à examiner', 'à examiner'),
      o.open ? `jusqu’au ${formatDate(o.deadline)}` : 'expirée',
    ].join(' · '),
  }))

  return { overview, follow, todo, todoTotal, receivedPoints, statusSegments, offerBars }
}

/* ------------------------------------------------------------------ */
/* Export CSV                                                          */
/* ------------------------------------------------------------------ */

function buildCsv(s: RecruiterStats, model: ReturnType<typeof buildModel>): CsvRow[] {
  const rows = csvPreamble(
    'Tableau de bord recruteur OffRec',
    s.computedAt,
    'Vos offres et les profils que OffRec vous a transmis uniquement. Jours au calendrier de Madagascar (UTC+3) ; placements déclaratifs, paiements simulés.',
  )
  rows.push(['Section', 'Indicateur', 'Valeur', 'Unité', 'Détail', '7 derniers jours', '7 jours précédents'])
  const kpiRow = (section: string, k: Kpi) =>
    rows.push([section, k.label, k.value, k.unit ?? '', [k.id === 'subscription' ? k.display : null, k.chip?.text, k.sub].filter(Boolean).join(' — '), k.trend?.counts.last7 ?? null, k.trend?.counts.prev7 ?? null])
  model.overview.forEach((k) => kpiRow('Vue d’ensemble', k))
  model.follow.kpis.forEach((k) => kpiRow(model.follow.title, k))
  rows.push(['Taux de mise en relation', 'Mises en relation / profils reçus', s.profiles.connectionRate, '%', '', null, null])
  model.todo.forEach((t) => rows.push(['À traiter', t.label, t.count, '', t.hint, null, null]))
  rows.push([])
  rows.push(['Profils reçus par jour', 'Jour', 'Reçus', ...STATUS_GROUPS.map((g) => `${g.label} (statut actuel)`), 'Mises en relation du jour'])
  model.receivedPoints.forEach((pt, i) =>
    rows.push(['', pt.key, pt.value, ...(pt.details ?? []).map((d) => d.value), s.profiles.connectedSeries[i]]),
  )
  rows.push([])
  rows.push(['Statut des profils reçus', 'Statut', 'Profils'])
  model.statusSegments.forEach((seg) => rows.push(['', seg.label, seg.value]))
  rows.push([])
  rows.push(['Par offre', 'Offre', 'Ouverte', 'Date limite', 'Profils reçus', 'À examiner', 'Mis en relation', 'Écartés'])
  s.byOffer.forEach((o) =>
    rows.push(['', o.title, o.open ? 'oui' : 'non', formatDate(o.deadline), o.received, o.toReview, o.connected, o.dismissed]),
  )
  rows.push([])
  rows.push(['Placements (déclaratif)', 'Étape', 'Placements'])
  ;(Object.keys(STAGE_LABELS) as (keyof typeof STAGE_LABELS)[]).forEach((k) => rows.push(['', STAGE_LABELS[k], s.placements.byStage[k]]))
  const next = s.interviews?.next
  if (next) {
    rows.push([])
    rows.push(['Prochain entretien', formatMadagascarDateTime(next.scheduledAt), `${next.durationMinutes} min`, next.opportunity.title])
  }
  return rows
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

function NextInterview({ stats }: { stats: RecruiterStats }) {
  const iv = stats.interviews
  const next = iv?.next ?? null
  return (
    <Card className="odash-panel rdash-next">
      <div className="odash-panel-head">
        <div>
          <h2>Prochain entretien</h2>
          <p>Heure de Madagascar</p>
        </div>
      </div>
      {!iv ? (
        <p className="rdash-muted">Les entretiens ne sont pas encore activés sur ce serveur.</p>
      ) : !next ? (
        <div className="rdash-next-empty">
          <CalendarClock size={20} aria-hidden />
          <p>
            Aucun entretien à venir. Fixez-en un depuis <Link to="/recruteur/candidatures">Candidats proposés</Link> avec
            « Ce profil m’intéresse ».
          </p>
        </div>
      ) : (
        <div className="rdash-next-body">
          <p className="rdash-next-date">
            <CalendarClock size={18} aria-hidden />
            <span>{formatMadagascarDateTime(next.scheduledAt)}</span>
          </p>
          <dl className="rdash-next-facts">
            <div>
              <dt>Candidat</dt>
              <dd>{next.candidateName || 'Candidat'}</dd>
            </div>
            <div>
              <dt>Offre</dt>
              <dd>{next.opportunity.title}</dd>
            </div>
            <div>
              <dt>Durée</dt>
              <dd>{next.durationMinutes} min</dd>
            </div>
            <div>
              <dt>Statut</dt>
              <dd>{INTERVIEW_STATUS_LABELS[next.status]}</dd>
            </div>
          </dl>
          <Link to={`/recruteur/entretiens?offre=${encodeURIComponent(next.opportunity.id)}`} className="rdash-link">
            Voir dans Entretiens
            <ArrowRight size={14} aria-hidden />
          </Link>
        </div>
      )}
    </Card>
  )
}

/**
 * Tableau de bord recruteur, même présentation que celui de l'admin
 * (`components/dashboard`) : indicateurs calculés côté serveur à un instant
 * donné (`GET /recruiter/stats`), limités aux offres du recruteur et aux
 * profils que OffRec lui a transmis — jamais la file interne de l'admin.
 * Chaque carte mène à l'écran recruteur correspondant.
 */
export function RecruiterDashboard() {
  const { currentUser } = useApp()
  const companyName = currentUser?.recruiterProfile?.companyName
  const { data: stats, error, loading, load } = useDashboardData<RecruiterStats>(
    apiRecruiterStats,
    (s) =>
      !Array.isArray(s.seriesDays) || !s.profiles || !s.offers
        ? 'Le serveur ne fournit pas encore les indicateurs du tableau de bord : mettez à jour le backend.'
        : null,
    'Impossible de charger vos statistiques.',
  )
  const model = useMemo(() => (stats ? buildModel(stats) : null), [stats])
  const noOffer = stats?.offers.total === 0

  return (
    <div className="page odash rdash">
      <div className="container">
        <DashboardHeader
          eyebrow={companyName ? `Espace recruteur · ${companyName}` : 'Espace recruteur'}
          title="Tableau de bord"
          loading={loading}
          hasData={Boolean(stats)}
          onRefresh={load}
          onExport={() => stats && model && downloadCsv(buildCsv(stats, model), 'offrec-tableau-de-bord-recruteur', stats.computedAt)}
          actions={
            <Link to="/recruteur/publier" className="btn btn-primary btn-sm rdash-publish">
              <PlusCircle size={15} aria-hidden />
              Publier une offre
            </Link>
          }
          computed={
            stats ? (
              <>
                Calculé le {formatDateTime(stats.computedAt)} — vos offres et les profils que OffRec vous a transmis. Jours au calendrier
                de Madagascar (UTC+3).
              </>
            ) : (
              'Vos offres, les profils proposés par OffRec et leur suivi.'
            )
          }
        />

        <DashboardErrors error={error} computedAt={stats?.computedAt ?? null} loading={loading} onRetry={load} />

        {!stats && !error && <DashboardSkeleton grids={1} />}

        {stats && model && (
          <div className={`odash-body ${loading ? 'is-refreshing' : ''}`.trim()} aria-busy={loading}>
            <FadeUp eager index={0}>
              <section aria-label="Indicateurs clés" className="odash-grid">
                {model.overview.map((k) => (
                  <KpiCard key={k.id} kpi={k} />
                ))}
              </section>
            </FadeUp>

            {noOffer ? (
              <FadeUp eager index={1}>
                <Card className="rdash-empty">
                  <span className="rdash-empty-icon" aria-hidden="true">
                    <FilePlus2 size={26} />
                  </span>
                  <div className="rdash-empty-text">
                    <h2>Publiez votre première offre</h2>
                    <p>
                      OffRec étudie ensuite les profils correspondants et vous transmet les plus pertinents : ils apparaîtront ici, avec
                      leur suivi jusqu’à l’entretien et au placement.
                    </p>
                  </div>
                  <Link to="/recruteur/publier" className="btn btn-primary btn-md">
                    <PlusCircle size={18} aria-hidden />
                    Publier une offre
                  </Link>
                </Card>
              </FadeUp>
            ) : (
              <>
                <FadeUp eager index={1}>
                  <div className="odash-charts">
                    <Card className="odash-panel odash-panel-wide">
                      <div className="odash-panel-head">
                        <div>
                          <h2>Profils reçus — 30 derniers jours</h2>
                          <p>Profils transmis par OffRec, par jour de réception</p>
                        </div>
                        <div className="odash-panel-figure">
                          <strong>{fmt(stats.profiles.receivedLast30)}</strong>
                          <TrendChip counts={{ last7: stats.profiles.receivedLast7, prev7: stats.profiles.receivedPrev7 }} noun={RECEIVED} />
                        </div>
                      </div>
                      <AreaChart
                        points={model.receivedPoints}
                        title="Profils reçus par jour sur 30 jours"
                        formatValue={(n) => plural(n, 'profil reçu', 'profils reçus')}
                        valueHeader="Reçus"
                        emptyMessage="Aucun profil reçu sur les 30 derniers jours."
                      />
                    </Card>
                    <Card className="odash-panel">
                      <div className="odash-panel-head">
                        <div>
                          <h2>Statut des profils reçus</h2>
                          <p>Statut actuel de chaque profil transmis</p>
                        </div>
                      </div>
                      <DonutChart segments={model.statusSegments} title="Statut des profils reçus" centerLabel="profils reçus" />
                    </Card>
                  </div>
                </FadeUp>

                <FadeUp eager index={2}>
                  <div className="odash-charts">
                    <Card className="odash-panel odash-panel-wide">
                      <div className="odash-panel-head">
                        <div>
                          <h2>Par offre</h2>
                          <p>Profils reçus par offre — mises en relation et profils à examiner en détail</p>
                        </div>
                        <div className="odash-panel-figure">
                          <strong>{formatPercent(stats.profiles.connectionRate)}</strong>
                          <span className="odash-panel-figure-note">reçus → mis en relation</span>
                        </div>
                      </div>
                      <BarList items={model.offerBars} title="Profils reçus par offre" />
                      {stats.byOffer.length > OFFER_BARS && (
                        <p className="rdash-more">
                          <Link to="/recruteur/offres" className="rdash-link">
                            Voir mes {fmt(stats.offers.total)} offres
                            <ArrowRight size={14} aria-hidden />
                          </Link>
                        </p>
                      )}
                    </Card>
                    <div className="rdash-stack">
                      <Card className="odash-panel">
                        <div className="odash-panel-head" id="rdash-todo">
                          <div>
                            <h2>À traiter</h2>
                            <p>
                              {model.todoTotal > 0
                                ? `${plural(model.todoTotal, 'élément attend', 'éléments attendent')} une action de votre part`
                                : 'Rien n’attend d’action de votre part'}
                            </p>
                          </div>
                        </div>
                        <ul className="odash-todo-list">
                          {model.todo.map((t) => (
                            <TodoRow key={t.id} item={t} />
                          ))}
                        </ul>
                      </Card>
                      <NextInterview stats={stats} />
                    </div>
                  </div>
                </FadeUp>
              </>
            )}

            {!noOffer && (
              <FadeUp eager index={3}>
                <RecruiterHiringSection />
              </FadeUp>
            )}

            <div className="rdash-company">
              <LinkedCompanyCard />
            </div>

            <FadeUp eager index={4}>
              <section className="odash-section" aria-labelledby="rdash-sec-suivi">
                <div className="odash-section-head">
                  <h2 id="rdash-sec-suivi">{model.follow.title}</h2>
                  {model.follow.subtitle && <p>{model.follow.subtitle}</p>}
                </div>
                <div className="odash-grid">
                  {model.follow.kpis.map((k) => (
                    <KpiCard key={k.id} kpi={k} />
                  ))}
                </div>
              </section>
            </FadeUp>
          </div>
        )}
      </div>
    </div>
  )
}
