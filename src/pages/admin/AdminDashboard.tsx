import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Banknote,
  BadgeCheck,
  Bell,
  Briefcase,
  BriefcaseBusiness,
  Building2,
  ClipboardCheck,
  CreditCard,
  FileSearch,
  FileText,
  Flag,
  GraduationCap,
  HandHelping,
  Handshake,
  HardHat,
  ListTodo,
  MessageSquareMore,
  Radar,
  Receipt,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Store,
  ThumbsUp,
  TrendingUp,
  UserPlus,
  Users,
  Venus,
  Wallet,
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
  type KpiSection as Section,
  type TodoItem,
} from '../../components/dashboard/DashboardParts'
import {
  ariary,
  csvPreamble,
  downloadCsv,
  fmt,
  formatPercent,
  longDay,
  percent,
  plural,
  seriesLabel,
  shortDay,
  type CsvRow,
} from '../../components/dashboard/dashboardFormat'
import { FadeUp } from '../../components/motion/Motion'
import { Card } from '../../components/ui/Card'
import { apiAdminStats, type AdminStats } from '../../lib/api'
import { formatDateTime } from '../../lib/format'
import { AdminHiringSection } from './AdminHiringSection'
import type { UserRole } from '../../types'
import './AdminDashboard.css'

/* ------------------------------------------------------------------ */
/* Modèle d'affichage (partagé par l'écran et l'export CSV)            */
/* ------------------------------------------------------------------ */

/** Ordre fixe des rôles dans l'anneau et les séries (jamais recyclé). */
const ROLE_ORDER: UserRole[] = ['candidate', 'recruiter', 'particulier', 'agent', 'talent', 'admin']
const ROLE_COLOR: Record<UserRole, string> = {
  candidate: 'var(--ochart-cat-1)',
  recruiter: 'var(--ochart-cat-2)',
  particulier: 'var(--ochart-cat-3)',
  agent: 'var(--ochart-cat-4)',
  talent: 'var(--ochart-cat-5)',
  admin: 'var(--ochart-cat-6)',
}
const ROLE_PLURAL: Record<UserRole, string> = {
  candidate: 'Candidats',
  recruiter: 'Recruteurs',
  particulier: 'Particuliers',
  agent: 'Agents de terrain',
  talent: 'Comptes de suivi',
  admin: 'Administrateurs',
}

const SIGNUP: [string, string] = ['inscription', 'inscriptions']
const CONNECTION: [string, string] = ['mise en relation', 'mises en relation']

function buildModel(s: AdminStats) {
  const days = s.seriesDays
  const c = s.candidates
  const m = s.matching
  const v = s.verifiedEmployment
  const sanctioned = s.accounts.byStatus.warned + s.accounts.byStatus.restricted + s.accounts.byStatus.suspended + s.accounts.byStatus.banned

  const todo: TodoItem[] = [
    { id: 'cv', label: 'CV à vérifier', hint: 'Vérification humaine avant transmission directe', count: c.cvToVerify, icon: FileSearch, to: '/verification-cv' },
    { id: 'suggestions', label: 'Suggestions à valider', hint: 'Dossiers du moteur en attente d’un admin', count: m.toValidate, icon: Sparkles, to: '/admin/mise-en-relation' },
    { id: 'connect', label: 'Mises en relation à confirmer', hint: 'Le recruteur a marqué son intérêt', count: m.interest, icon: Handshake, to: '/admin/mise-en-relation' },
    { id: 'reports', label: 'Signalements ouverts', hint: 'Modération en attente', count: s.openReports, icon: Flag, to: '/admin/moderation' },
    { id: 'proofs', label: 'Documents d’entreprise à examiner', hint: 'Preuves jointes aux recommandations', count: s.trust.companyProofsToReview, icon: FileText, to: '/admin/entreprises' },
  ]
  const agentTodo: TodoItem[] = [
    { id: 'signals', label: 'Signaux de talents à prendre en charge', hint: 'File partagée des agents', count: v.signalsToProcess, icon: Radar, to: '/admin/talents' },
    { id: 'contacts', label: 'Demandes de contact nouvelles', hint: 'Traitées par l’agent du talent', count: v.contactRequestsNew, icon: MessageSquareMore, to: '/admin/talents' },
    { id: 'leads', label: 'Demandes « sans diplôme » nouvelles', hint: 'Déposées en libre-service, reprises par un agent', count: v.talentLeadsNew, icon: HandHelping },
  ]
  const todoTotal = todo.reduce((sum, t) => sum + t.count, 0)
  const agentTotal = agentTodo.reduce((sum, t) => sum + t.count, 0)

  const overview: Kpi[] = [
    {
      id: 'accounts', label: 'Comptes inscrits', value: s.accounts.total, display: fmt(s.accounts.total), icon: Users, tone: 'accent',
      to: '/admin/activite?famille=comptes', trend: { counts: { last7: s.signups.last7, prev7: s.signups.prev7 }, noun: SIGNUP },
      series: s.signups.total, seriesLabel: seriesLabel(s.signups.total, SIGNUP, days),
    },
    {
      id: 'candidates', label: 'Candidats', value: c.total, display: fmt(c.total), icon: GraduationCap, tone: 'accent', to: '/admin/candidats',
      trend: { counts: s.signups.weeksByRole.candidate, noun: SIGNUP },
      series: s.signups.byRole.candidate, seriesLabel: seriesLabel(s.signups.byRole.candidate, ['inscription de candidat', 'inscriptions de candidats'], days),
      sub: `${fmt(c.withCv)} avec CV · ${plural(c.withConsent, 'accord de matching', 'accords de matching')}`,
    },
    {
      id: 'recruiters', label: 'Recruteurs', value: s.accounts.byRole.recruiter, display: fmt(s.accounts.byRole.recruiter), icon: BriefcaseBusiness, tone: 'violet',
      to: '/admin/recruteurs', trend: { counts: s.signups.weeksByRole.recruiter, noun: SIGNUP },
      series: s.signups.byRole.recruiter, seriesLabel: seriesLabel(s.signups.byRole.recruiter, ['inscription de recruteur', 'inscriptions de recruteurs'], days),
      sub: `${fmt(s.offers.recruitersWithOpenOffer)} avec une offre ouverte`,
    },
    {
      id: 'connected', label: 'Mises en relation', value: m.connected, display: fmt(m.connected), icon: Handshake, tone: 'success',
      to: '/admin/mise-en-relation', trend: { counts: { last7: m.connectedLast7, prev7: m.connectedPrev7 }, noun: CONNECTION },
      series: m.connectedSeries, seriesLabel: seriesLabel(m.connectedSeries, CONNECTION, days),
      sub: `${fmt(m.connectedLast30)} sur les 30 derniers jours`,
    },
    {
      id: 'talents', label: 'Talents suivis', value: v.talentsTotal, display: fmt(v.talentsTotal), icon: HardHat, tone: 'warning', to: '/admin/talents',
      chip: { text: plural(v.talentsByStatus.place, 'placé', 'placés'), tone: 'info' },
      sub: `${plural(v.talentsByStatus.verifie, 'vérifié', 'vérifiés')} · ${plural(v.talentsByStatus.recommande, 'proposé', 'proposés')} à une offre`,
    },
    {
      id: 'todo', label: 'À traiter', value: todoTotal, display: fmt(todoTotal), icon: ListTodo, tone: todoTotal > 0 ? 'danger' : 'success', anchor: '#odash-todo',
      chip: todoTotal > 0 ? { text: 'action requise', tone: 'warning' } : { text: 'rien en attente', tone: 'up' },
      sub: agentTotal > 0 ? `+ ${plural(agentTotal, 'élément', 'éléments')} en file chez les agents` : 'Aucune file en attente chez les agents',
    },
  ]

  const sections: Section[] = [
    {
      id: 'portail',
      title: 'Portail d’opportunités',
      subtitle: 'Offres, profils diplômés et matching — OffRec reste l’intermédiaire.',
      kpis: [
        {
          id: 'offers', label: 'Offres ouvertes', value: s.offers.open, display: fmt(s.offers.open), icon: Briefcase, tone: 'accent', to: '/admin/recruteurs',
          trend: { counts: { last7: s.offers.newLast7, prev7: s.offers.newPrev7 }, noun: ['nouvelle offre', 'nouvelles offres'] },
          sub: `${plural(s.offers.expired, 'expirée', 'expirées')} · ${plural(s.offers.total, 'publiée', 'publiées')} au total`,
        },
        {
          id: 'withCv', label: 'Candidats avec CV', value: c.withCv, display: fmt(c.withCv), icon: FileText, tone: 'accent', to: '/admin/candidats',
          chip: { text: `${percent(c.withCv, c.total)} des candidats`, tone: 'info' },
          sub: `${plural(c.cvVerified, 'vérifié', 'vérifiés')} · ${plural(c.cvRejected, 'rejeté', 'rejetés')}`,
        },
        {
          id: 'consent', label: 'Accord de matching', value: c.withConsent, display: fmt(c.withConsent), icon: ShieldCheck, tone: 'success', to: '/admin/candidats',
          chip: { text: `${percent(c.withConsent, c.total)} des candidats`, tone: 'info' },
          sub: 'Accord global, horodaté et révocable',
        },
        {
          id: 'cvToVerify', label: 'CV à vérifier', value: c.cvToVerify, display: fmt(c.cvToVerify), icon: FileSearch, tone: c.cvToVerify > 0 ? 'warning' : 'neutral',
          to: '/verification-cv', sub: 'Dépôts en attente d’une vérification humaine',
        },
        {
          id: 'toValidate', label: 'Suggestions à valider', value: m.toValidate, display: fmt(m.toValidate), icon: Sparkles, tone: m.toValidate > 0 ? 'warning' : 'neutral',
          to: '/admin/mise-en-relation', sub: `${plural(m.createdLast7, 'suggestion créée', 'suggestions créées')} sur 7 jours (${fmt(m.createdPrev7)} les 7 jours précédents)`,
        },
        {
          id: 'conversion', label: 'Taux de transformation', value: m.conversionPercent, unit: '%',
          display: m.conversionPercent === null ? '—' : `${m.conversionPercent.toLocaleString('fr-FR')} %`, icon: TrendingUp, tone: 'success',
          to: '/admin/mise-en-relation',
          sub: `${plural(m.connected, 'mise en relation', 'mises en relation')} sur ${plural(m.sentToRecruiter, 'dossier transmis', 'dossiers transmis')} encore actifs ou aboutis`,
        },
      ],
    },
    {
      id: 'emploi',
      title: 'Emploi vérifié',
      subtitle: 'Talents non diplômés vérifiés sur le terrain par les agents.',
      kpis: [
        {
          id: 'talentsWaiting', label: 'Talents en attente', value: v.talentsByStatus.en_attente, display: fmt(v.talentsByStatus.en_attente), icon: BadgeCheck, tone: 'warning',
          to: '/admin/talents', sub: `de vérification · ${plural(v.talentsTotal, 'talent', 'talents')} au total`,
        },
        {
          id: 'signals', label: 'Signaux à traiter', value: v.signalsToProcess, display: fmt(v.signalsToProcess), icon: Radar, tone: v.signalsToProcess > 0 ? 'warning' : 'neutral',
          to: '/admin/talents', sub: `${plural(v.signalsInProgress, 'pris en charge', 'pris en charge')} par un agent`,
        },
        {
          id: 'contacts', label: 'Demandes de contact', value: v.contactRequestsOpen, display: fmt(v.contactRequestsOpen), icon: MessageSquareMore, tone: 'accent',
          to: '/admin/talents', sub: `ouvertes, dont ${plural(v.contactRequestsNew, 'nouvelle', 'nouvelles')}`,
        },
        {
          id: 'leads', label: 'Demandes « sans diplôme »', value: v.talentLeadsNew, display: fmt(v.talentLeadsNew), icon: HandHelping, tone: 'neutral',
          sub: 'Nouvelles demandes déposées en libre-service',
        },
        {
          id: 'agents', label: 'Agents de terrain', value: s.accounts.byRole.agent, display: fmt(s.accounts.byRole.agent), icon: UserPlus, tone: 'violet',
          to: '/admin/agents', sub: 'Comptes agents provisionnés par un admin',
        },
        {
          id: 'women', label: 'Profils recommandés — femmes', value: s.employment.femalePercent, unit: '%',
          display: s.employment.genderPoolSize > 0 ? `${s.employment.femalePercent.toLocaleString('fr-FR')} %` : '—', icon: Venus, tone: 'accent',
          sub: `${plural(s.employment.genderPoolSize, 'profil mesuré', 'profils mesurés')}`,
        },
      ],
    },
    {
      id: 'confiance',
      title: 'Confiance et modération',
      kpis: [
        {
          id: 'reports', label: 'Signalements ouverts', value: s.openReports, display: fmt(s.openReports), icon: Flag, tone: s.openReports > 0 ? 'danger' : 'neutral',
          to: '/admin/moderation', sub: s.openReports > 0 ? 'En attente de traitement' : 'Aucun signalement en attente',
        },
        {
          id: 'sanctioned', label: 'Comptes sous mesure', value: sanctioned, display: fmt(sanctioned), icon: ShieldAlert, tone: sanctioned > 0 ? 'warning' : 'neutral',
          to: '/admin/moderation',
          sub: `${fmt(s.accounts.byStatus.warned)} avertis · ${fmt(s.accounts.byStatus.restricted)} restreints · ${fmt(s.accounts.byStatus.suspended)} suspendus · ${fmt(s.accounts.byStatus.banned)} bannis`,
        },
        {
          id: 'unread', label: 'Notifications non lues', value: s.notifications.adminUnread, display: fmt(s.notifications.adminUnread), icon: Bell, tone: 'accent',
          to: '/admin/notifications', sub: 'Sur votre compte administrateur',
        },
        {
          id: 'companies', label: 'Entreprises recommandées', value: s.trust.companiesVisible, display: fmt(s.trust.companiesVisible), icon: Building2, tone: 'violet',
          to: '/admin/entreprises',
          sub: `${plural(s.trust.companyEndorsements, 'recommandation', 'recommandations')} · ${plural(s.trust.companyProofsToReview, 'document à examiner', 'documents à examiner')}`,
        },
        {
          id: 'talentEndorsements', label: 'Recommandations de talents', value: s.trust.talentEndorsements, display: fmt(s.trust.talentEndorsements), icon: ThumbsUp, tone: 'success',
          to: '/admin/talents', sub: 'Signaux privés, jamais publics',
        },
        {
          id: 'directory', label: 'Annuaire des artisans', value: s.providers, display: fmt(s.providers), icon: Store, tone: 'neutral', to: '/annuaire',
          sub: `${plural(s.recommendations, 'recommandation', 'recommandations')} · ${plural(s.members, 'membre', 'membres')}`,
        },
      ],
    },
    {
      id: 'revenus',
      title: 'Abonnements et placements',
      subtitle:
        'Paiements simulés et success fee déclaratif : aucun montant ci-dessous n’est un encaissement réel. Les prix viennent du catalogue des abonnements.',
      kpis: [
        {
          id: 'paidSubs', label: 'Abonnements payants', value: s.billing.paidSubscriptions, display: fmt(s.billing.paidSubscriptions), icon: CreditCard, tone: 'violet',
          to: '/admin/recruteurs',
          sub:
            s.billing.plans.filter((p) => p.priceAr > 0 && p.subscribers > 0).map((p) => `${p.name} ${fmt(p.subscribers)}`).join(' · ') ||
            'Aucun abonnement payant en cours',
        },
        {
          id: 'mrr', label: 'Revenu mensuel théorique', value: s.billing.monthlyCatalogAr, unit: 'Ar', display: ariary(s.billing.monthlyCatalogAr), icon: Wallet,
          tone: 'success', sub: 'Prix catalogue × abonnements en cours',
        },
        {
          id: 'payments', label: 'Paiements simulés', value: s.revenue.totalAr, unit: 'Ar', display: ariary(s.revenue.totalAr), icon: Receipt, tone: 'accent',
          sub: `${plural(s.revenue.transactionCount, 'transaction', 'transactions')} · ${ariary(s.billing.transactionsLast30Ar)} sur 30 jours`,
        },
        {
          id: 'placements', label: 'Placements déclarés', value: s.placements.total, display: fmt(s.placements.total), icon: ClipboardCheck, tone: 'success',
          to: '/admin/placements', chip: { text: `+${fmt(s.placements.last30)} sur 30 jours`, tone: 'info' },
          sub: `${fmt(s.placements.inProgress)} en cours · ${fmt(s.placements.completed)} finalisés · ${fmt(s.placements.cancelled)} annulés`,
        },
        {
          id: 'feeDue', label: 'Étapes de success fee dues', value: s.placements.byStage.etape1_due + s.placements.byStage.etape2_due,
          display: fmt(s.placements.byStage.etape1_due + s.placements.byStage.etape2_due), icon: Banknote, tone: 'warning', to: '/admin/placements',
          sub: `${fmt(s.placements.byStage.etape1_due)} à la signature · ${fmt(s.placements.byStage.etape2_due)} à la confirmation`,
        },
      ],
    },
  ]

  const signupPoints: AreaPoint[] = days.map((d, i) => ({
    key: d,
    axisLabel: shortDay(d),
    fullLabel: longDay(d),
    value: s.signups.total[i],
    details: ROLE_ORDER.map((r) => ({ key: r, label: ROLE_PLURAL[r], value: s.signups.byRole[r][i], color: ROLE_COLOR[r] })),
  }))

  const roleSegments: DonutSegment[] = ROLE_ORDER.map((r) => ({
    key: r,
    label: ROLE_PLURAL[r],
    value: s.accounts.byRole[r],
    color: ROLE_COLOR[r],
  }))

  const pipeline: BarItem[] = [
    { key: 'suggeree', label: 'À valider', hint: 'Suggestions en attente d’un admin', value: m.toValidate, to: '/admin/mise-en-relation' },
    { key: 'proposee_recruteur', label: 'Transmis au recruteur', hint: 'En attente de sa réponse', value: m.transmitted, to: '/admin/mise-en-relation' },
    { key: 'interet_recruteur', label: 'Intérêt du recruteur', hint: 'À confirmer par un admin', value: m.interest, to: '/admin/mise-en-relation' },
    { key: 'mise_en_relation', label: 'Mis en relation', hint: 'Candidat notifié', value: m.connected },
    { key: 'ecartee', label: 'Écartés', hint: 'Hors parcours', value: m.dismissed, muted: true },
  ]

  // Libellés de `TALENT_STATUS_LABELS` (src/data/endorsements.ts), au pluriel.
  const talentBars: BarItem[] = [
    { key: 'en_attente', label: 'En attente de vérification', value: v.talentsByStatus.en_attente, to: '/admin/talents' },
    { key: 'verifie', label: 'Vérifiés', value: v.talentsByStatus.verifie, to: '/admin/talents' },
    { key: 'recommande', label: 'Proposés à une offre', value: v.talentsByStatus.recommande, to: '/admin/talents' },
    { key: 'place', label: 'Placés', value: v.talentsByStatus.place, to: '/admin/talents' },
  ]

  return { overview, sections, todo, agentTodo, todoTotal, signupPoints, roleSegments, pipeline, talentBars }
}

/* ------------------------------------------------------------------ */
/* Export CSV (Excel en français : `;`, BOM UTF-8, virgule décimale)    */
/* ------------------------------------------------------------------ */

function buildCsv(s: AdminStats, model: ReturnType<typeof buildModel>): CsvRow[] {
  const rows: CsvRow[] = csvPreamble(
    'Tableau de bord OffRec',
    s.computedAt,
    'Jours au calendrier de Madagascar (UTC+3) ; montants simulés ou déclaratifs, aucun encaissement réel.',
  )
  rows.push(['Section', 'Indicateur', 'Valeur', 'Unité', 'Détail', '7 derniers jours', '7 jours précédents'])
  const kpiRow = (section: string, k: Kpi) =>
    rows.push([section, k.label, k.value, k.unit ?? '', [k.chip?.text, k.sub].filter(Boolean).join(' — '), k.trend?.counts.last7 ?? null, k.trend?.counts.prev7 ?? null])
  model.overview.forEach((k) => kpiRow('Vue d’ensemble', k))
  model.sections.forEach((sec) => sec.kpis.forEach((k) => kpiRow(sec.title, k)))
  ;[...model.todo, ...model.agentTodo].forEach((t) => rows.push(['À traiter', t.label, t.count, '', t.hint, null, null]))
  rows.push([])
  rows.push(['Inscriptions par jour', 'Jour', 'Total', ...ROLE_ORDER.map((r) => ROLE_PLURAL[r])])
  model.signupPoints.forEach((p) => rows.push(['', p.key, p.value, ...(p.details ?? []).map((d) => d.value)]))
  rows.push([])
  rows.push(['Répartition des comptes', 'Rôle', 'Comptes', 'Part'])
  model.roleSegments.forEach((seg) =>
    rows.push(['', seg.label, seg.value, s.accounts.total > 0 ? Math.round((seg.value / s.accounts.total) * 1000) / 10 : 0]),
  )
  rows.push([])
  rows.push(['Pipeline du matching', 'Statut', 'Dossiers'])
  model.pipeline.forEach((b) => rows.push(['', b.label, b.value]))
  return rows
}

/**
 * Tableau de bord admin : indicateurs calculés côté serveur à un instant
 * donné (`computedAt`, `GET /admin/stats`), regroupés par verticale, avec
 * les files qui demandent une action. Chaque carte mène à l'écran admin
 * correspondant. Le journal d'activité a sa propre page (`/admin/activite`).
 */
export function AdminDashboard() {
  const { data: stats, error, loading, load } = useDashboardData<AdminStats>(
    apiAdminStats,
    // Serveur plus ancien que le client (déploiement décalé) : pas
    // d'indicateurs étendus — on le dit plutôt que de planter la page.
    (s) =>
      !Array.isArray(s.seriesDays) || !s.signups || !s.matching
        ? 'Le serveur ne fournit pas encore les indicateurs du tableau de bord : mettez à jour le backend.'
        : null,
    'Impossible de charger les statistiques.',
  )

  const model = useMemo(() => (stats ? buildModel(stats) : null), [stats])

  const header = (
    <DashboardHeader
      eyebrow="Administration"
      title="Tableau de bord"
      loading={loading}
      hasData={Boolean(stats)}
      onRefresh={load}
      onExport={() => stats && model && downloadCsv(buildCsv(stats, model), 'offrec-tableau-de-bord', stats.computedAt)}
      computed={
        <>
          {stats ? (
            <>
              Calculé le {formatDateTime(stats.computedAt)} — toutes les données de la base, comptes de test compris. Jours au calendrier
              de Madagascar (UTC+3).{' '}
            </>
          ) : (
            'Vue d’ensemble de la plateforme. '
          )}
          <Link to="/admin/activite" className="admin-activity-link">
            Voir le journal d’activité
            <ArrowRight size={14} aria-hidden />
          </Link>
        </>
      }
    />
  )

  return (
    <div className="page odash">
      <div className="container">
        {header}

        <DashboardErrors error={error} computedAt={stats?.computedAt ?? null} loading={loading} onRetry={load} />

        {!stats && !error && <DashboardSkeleton />}

        {stats && model && (
          <div className={`odash-body ${loading ? 'is-refreshing' : ''}`.trim()} aria-busy={loading}>
            <FadeUp eager index={0}>
              <section aria-label="Indicateurs clés" className="odash-grid">
                {model.overview.map((k) => (
                  <KpiCard key={k.id} kpi={k} />
                ))}
              </section>
            </FadeUp>

            <FadeUp eager index={1}>
              <div className="odash-charts">
                <Card className="odash-panel odash-panel-wide">
                  <div className="odash-panel-head">
                    <div>
                      <h2>Inscriptions — 30 derniers jours</h2>
                      <p>Nouveaux comptes par jour, tous rôles</p>
                    </div>
                    <div className="odash-panel-figure">
                      <strong>{fmt(stats.signups.last30)}</strong>
                      <TrendChip counts={{ last7: stats.signups.last7, prev7: stats.signups.prev7 }} noun={SIGNUP} />
                    </div>
                  </div>
                  <AreaChart
                    points={model.signupPoints}
                    title="Inscriptions par jour sur 30 jours"
                    formatValue={(n) => plural(n, 'inscription', 'inscriptions')}
                    valueHeader="Total"
                    emptyMessage="Aucune inscription sur les 30 derniers jours."
                  />
                </Card>
                <Card className="odash-panel">
                  <div className="odash-panel-head">
                    <div>
                      <h2>Répartition des comptes</h2>
                      <p>Par rôle, tous statuts confondus</p>
                    </div>
                  </div>
                  <DonutChart segments={model.roleSegments} title="Répartition des comptes par rôle" centerLabel="comptes" />
                </Card>
              </div>
            </FadeUp>

            <FadeUp eager index={2}>
              <div className="odash-charts">
                <Card className="odash-panel odash-panel-wide">
                  <div className="odash-panel-head">
                    <div>
                      <h2>Pipeline du matching</h2>
                      <p>Dossiers par statut actuel — un dossier n’est compté qu’à une étape</p>
                    </div>
                    <div className="odash-panel-figure">
                      <strong>{formatPercent(stats.matching.conversionPercent)}</strong>
                      <span className="odash-panel-figure-note">transmis → mis en relation</span>
                    </div>
                  </div>
                  <BarList items={model.pipeline} title="Dossiers de matching par statut" />
                  <div className="odash-panel-split">
                    <div className="odash-panel-head">
                      <div>
                        <h2>Talents vérifiés par statut</h2>
                        <p>Emploi vérifié — profils créés et suivis par les agents</p>
                      </div>
                      <div className="odash-panel-figure">
                        <strong>{fmt(stats.verifiedEmployment.talentsTotal)}</strong>
                        <span className="odash-panel-figure-note">talents suivis</span>
                      </div>
                    </div>
                    <BarList items={model.talentBars} title="Talents par statut" />
                  </div>
                </Card>
                <Card className="odash-panel odash-todo">
                  <div className="odash-panel-head" id="odash-todo">
                    <div>
                      <h2>À traiter</h2>
                      <p>{model.todoTotal > 0 ? `${plural(model.todoTotal, 'élément attend', 'éléments attendent')} une action d’un admin` : 'Rien n’attend d’action d’un admin'}</p>
                    </div>
                  </div>
                  <ul className="odash-todo-list">
                    {model.todo.map((t) => (
                      <TodoRow key={t.id} item={t} />
                    ))}
                  </ul>
                  <h3 className="odash-todo-sub">Suivi des agents</h3>
                  <ul className="odash-todo-list">
                    {model.agentTodo.map((t) => (
                      <TodoRow key={t.id} item={t} />
                    ))}
                  </ul>
                </Card>
              </div>
            </FadeUp>

            <FadeUp eager index={3}>
              <AdminHiringSection />
            </FadeUp>

            {model.sections.map((sec, i) => (
              <FadeUp eager index={4 + i} key={sec.id}>
                <section className="odash-section" aria-labelledby={`odash-sec-${sec.id}`}>
                  <div className="odash-section-head">
                    <h2 id={`odash-sec-${sec.id}`}>{sec.title}</h2>
                    {sec.subtitle && <p>{sec.subtitle}</p>}
                  </div>
                  <div className="odash-grid">
                    {sec.kpis.map((k) => (
                      <KpiCard key={k.id} kpi={k} />
                    ))}
                  </div>
                </section>
              </FadeUp>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
