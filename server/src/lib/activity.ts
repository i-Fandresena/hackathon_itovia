import type { Prisma, UserRole } from '@prisma/client'
import { prisma } from './prisma.js'
import { clip, plural } from './notify.js'
import { ACTIVITY_FAMILY_KEYS } from './validation.js'
import { formatMadagascarDateTime } from '../../../src/lib/interview.js'
import {
  CONTRACT_TYPE_LABELS,
  DECLINE_REASON_LABELS,
  INTERVIEW_RESULT_LABELS,
  RESULT_REASON_LABELS,
  WITHDRAW_REASON_LABELS,
} from '../../../src/lib/hiring.js'
import type {
  ContractType,
  HireDeclineReason,
  HireProposalWithdrawReason,
  InterviewResult,
  InterviewResultReason,
} from '../../../src/types/index.js'

/**
 * Journal d'activité de la plateforme vu par l'admin (`GET /api/admin/activity`).
 *
 * SOURCE UNIQUE de la correspondance action d'`AuditLog` → famille → libellé
 * français, et de la phrase affichée : la page « Activité » n'a aucune table
 * de libellés côté client. Chaque ligne est construite par liste blanche :
 * jamais la `metadata` brute, seulement les éléments utiles et non sensibles
 * (statut, nombre, titre d'offre, métier et ville d'un talent, nom d'une
 * fiche entreprise…). Jamais de téléphone, de contact ni de nom d'un talent
 * recommandé, de commentaire, d'URL de fichier ni d'empreinte de CV.
 *
 * L'auteur d'une recommandation (talent ou entreprise) n'est jamais exposé :
 * ces lignes ont un acteur masqué et sont exclues dès qu'un filtre porte sur
 * l'acteur (rôle ou recherche), sans quoi le filtre suffirait à le révéler.
 */

export type ActivityFamily = (typeof ACTIVITY_FAMILY_KEYS)[number]

export const ACTIVITY_FAMILY_LABELS: Record<ActivityFamily, string> = {
  comptes: 'Comptes et connexions',
  candidats: 'Candidats et CV',
  matching: 'Matching et mise en relation',
  recruteurs: 'Offres et recruteurs',
  talents: 'Talents et agents de terrain',
  recommandations: 'Recommandations et annuaire',
  entreprises: 'Entreprises',
  moderation: 'Modération',
  placements: 'Abonnements et placements',
  administration: 'Administration',
  autre: 'Autres actions',
}

interface ActionDef {
  family: ActivityFamily
  label: string
  /** Événement technique : masqué tant que « inclure les événements système » est désactivé. */
  system?: boolean
  /** Acteur jamais exposé (auteur d'une recommandation). */
  masked?: boolean
}

/** Toutes les actions écrites dans `AuditLog` par le serveur (recherche de `auditLog.create`). */
const ACTIONS: Record<string, ActionDef> = {
  // Comptes et connexions
  register: { family: 'comptes', label: 'Compte créé' },
  login: { family: 'comptes', label: 'Connexion' },
  logout: { family: 'comptes', label: 'Déconnexion' },

  // Candidats et CV (y compris leurs décisions sur un dossier)
  matching_consent_given: { family: 'candidats', label: 'Accord de matching donné' },
  matching_consent_withdrawn: { family: 'candidats', label: 'Accord de matching retiré' },
  cv_upload: { family: 'candidats', label: 'CV déposé' },
  cv_verification: { family: 'candidats', label: 'Vérification d’un CV' },
  candidate_interested: { family: 'candidats', label: 'Candidat intéressé (ancien parcours)' },
  candidate_declined: { family: 'candidats', label: 'Candidat retiré d’un dossier' },

  // Matching et mise en relation (moteur et décisions de l'admin)
  match_suggestion_created: { family: 'matching', label: 'Profil mis en file de validation' },
  match_suggestion_status: { family: 'matching', label: 'Dossier de mise en relation mis à jour' },
  matching_run: { family: 'matching', label: 'Matching automatique exécuté', system: true },
  // Entretiens (décision 2026-10-14) : rangés avec la mise en relation qu'ils accompagnent
  interview_created: { family: 'matching', label: 'Entretien fixé par le recruteur' },
  interview_rescheduled: { family: 'matching', label: 'Entretien reprogrammé' },
  interview_cancelled: { family: 'matching', label: 'Entretien annulé par le recruteur' },
  interview_confirmed: { family: 'matching', label: 'Entretien confirmé par le candidat' },
  interview_unavailable: { family: 'matching', label: 'Empêchement signalé par le candidat' },
  interview_calendar_resync: { family: 'matching', label: 'Agenda d’un entretien régularisé' },
  // Après l'entretien (sous-lot 3)
  interview_outcome_recorded: { family: 'matching', label: 'Issue d’entretien renseignée' },
  interview_absence_reply: { family: 'matching', label: 'Absence expliquée par le candidat' },
  interview_outcome_reset: { family: 'matching', label: 'Issue d’entretien annulée par un admin' },
  hiring_jobs_run: { family: 'matching', label: 'Rappels d’issue lancés à la demande' },
  hiring_digest_sent: { family: 'matching', label: 'Résumé des issues en souffrance envoyé', system: true },
  // Propositions d'embauche (sous-lot 5)
  hire_proposal_sent: { family: 'matching', label: 'Proposition d’embauche envoyée' },
  hire_proposal_revised: { family: 'matching', label: 'Proposition d’embauche modifiée' },
  hire_proposal_withdrawn: { family: 'matching', label: 'Proposition d’embauche retirée' },
  hire_proposal_accepted: { family: 'matching', label: 'Proposition d’embauche acceptée' },
  hire_proposal_declined: { family: 'matching', label: 'Proposition d’embauche déclinée' },
  hire_proposal_expired: { family: 'matching', label: 'Proposition d’embauche expirée', system: true },

  // Offres et recruteurs (décisions des recruteurs sur les profils proposés)
  recruiter_interested: { family: 'recruteurs', label: 'Recruteur intéressé par un profil' },
  recruiter_declined: { family: 'recruteurs', label: 'Recruteur a écarté un profil' },
  // Offre pourvue (décision D1, sous-lot 5)
  opportunity_filled: { family: 'recruteurs', label: 'Offre pourvue' },
  opportunity_reopened: { family: 'recruteurs', label: 'Offre pourvue rouverte' },

  // Talents et agents de terrain
  talent_consent_profile: { family: 'talents', label: 'Profil de talent créé (accord recueilli)' },
  talent_signal_converted: { family: 'talents', label: 'Signal converti en profil de talent' },
  talent_consent_public_granted: { family: 'talents', label: 'Fiche publique de talent ouverte' },
  talent_consent_public_revoked: { family: 'talents', label: 'Fiche publique de talent retirée' },
  talent_signal_taken: { family: 'talents', label: 'Signal de talent pris en charge' },
  talent_signal_status: { family: 'talents', label: 'Statut d’un signal de talent modifié' },
  talent_signal_merged: { family: 'talents', label: 'Signaux de talent fusionnés (doublon)' },
  talent_contact_requested: { family: 'talents', label: 'Demande de contact pour un talent' },
  talent_contact_request_transmise: { family: 'talents', label: 'Demande de contact transmise' },
  talent_contact_request_close: { family: 'talents', label: 'Demande de contact close' },
  talent_signals_purged: { family: 'talents', label: 'Signaux de talent purgés', system: true },

  // Recommandations et annuaire
  talent_endorsement_created: { family: 'recommandations', label: 'Talent recommandé', masked: true },
  endorsement_reviewed: { family: 'recommandations', label: 'Recommandation de talent revue' },
  endorsement_excluded: { family: 'recommandations', label: 'Recommandation de talent écartée' },

  // Entreprises
  company_endorsement_created: { family: 'entreprises', label: 'Entreprise recommandée', masked: true },
  company_endorsement_proof_reviewed: { family: 'entreprises', label: 'Preuve d’une recommandation d’entreprise examinée' },
  company_endorsement_excluded: { family: 'entreprises', label: 'Recommandation d’entreprise écartée' },
  company_hidden: { family: 'entreprises', label: 'Fiche entreprise masquée' },
  company_unhidden: { family: 'entreprises', label: 'Fiche entreprise réaffichée' },
  company_recruiter_linked: { family: 'entreprises', label: 'Fiche entreprise liée à un recruteur' },
  company_recruiter_unlinked: { family: 'entreprises', label: 'Fiche entreprise déliée de son recruteur' },

  // Modération (`moderation:<action>`, voir aussi le préfixe ci-dessous)
  'moderation:dismiss': { family: 'moderation', label: 'Signalement classé sans suite' },
  'moderation:warning': { family: 'moderation', label: 'Avertissement' },
  'moderation:restriction': { family: 'moderation', label: 'Restriction de compte' },
  'moderation:suspension': { family: 'moderation', label: 'Suspension de compte' },
  'moderation:ban': { family: 'moderation', label: 'Bannissement' },

  // Abonnements et placements
  placement_declared: { family: 'placements', label: 'Placement déclaré par le recruteur' },
  placement_created_auto: { family: 'placements', label: 'Placement créé à l’acceptation d’une proposition' },
  placement_stage_updated: { family: 'placements', label: 'Étape de placement mise à jour par le recruteur' },
  admin_corrected_placement_stage: { family: 'placements', label: 'Étape de placement corrigée' },

  // Administration
  'admin:create_agent': { family: 'administration', label: 'Compte agent créé' },
  'admin:cv_verifier_roles': { family: 'administration', label: 'Habilitations de vérification des CV modifiées' },
  research_export: { family: 'administration', label: 'Export de recherche pseudonymisé téléchargé' },
  notification_dispatch: { family: 'administration', label: 'Envoi de notification', system: true },
}

const MODERATION_PREFIX = 'moderation:'

export const KNOWN_ACTIONS = Object.keys(ACTIONS)
export const SYSTEM_ACTIONS = KNOWN_ACTIONS.filter((a) => ACTIONS[a].system)
export const MASKED_ACTIONS = KNOWN_ACTIONS.filter((a) => ACTIONS[a].masked)

function definitionOf(action: string): ActionDef {
  const known = ACTIONS[action]
  if (known) return known
  if (action.startsWith(MODERATION_PREFIX)) return { family: 'moderation', label: 'Décision de modération' }
  return { family: 'autre', label: 'Action non répertoriée' }
}

export function familyOf(action: string): ActivityFamily {
  return definitionOf(action).family
}

/** Filtre Prisma d'une famille (les actions inconnues tombent dans `autre`). */
export function familyWhere(family: ActivityFamily): Prisma.AuditLogWhereInput {
  if (family === 'moderation') return { action: { startsWith: MODERATION_PREFIX } }
  if (family === 'autre') {
    return { AND: [{ action: { notIn: KNOWN_ACTIONS } }, { NOT: { action: { startsWith: MODERATION_PREFIX } } }] }
  }
  return { action: { in: KNOWN_ACTIONS.filter((a) => ACTIONS[a].family === family) } }
}

/* ------------------------------------------------------------------ */
/* Libellés des valeurs extraites de la metadata                      */
/* ------------------------------------------------------------------ */

const ROLE_LABELS: Record<string, string> = {
  candidate: 'candidat',
  recruiter: 'recruteur',
  particulier: 'particulier',
  admin: 'administrateur',
  agent: 'agent de terrain',
  talent: 'compte de suivi talent',
}

const SUGGESTION_STATUS_LABELS: Record<string, string> = {
  suggeree: 'à valider',
  proposee_candidat: 'proposé au candidat (ancien parcours)',
  interet_candidat: 'candidat intéressé (ancien parcours)',
  proposee_recruteur: 'transmis au recruteur',
  interet_recruteur: 'recruteur intéressé',
  mise_en_relation: 'mis en relation',
  ecartee: 'écarté',
}

const SIGNAL_STATUS_LABELS: Record<string, string> = {
  nouveau: 'nouveau',
  pris_en_charge: 'pris en charge',
  converti: 'converti',
  refuse: 'refusé',
  injoignable: 'injoignable',
  expire: 'expiré',
  fusionne: 'fusionné',
}

const PLACEMENT_STAGE_LABELS: Record<string, string> = {
  etape1_due: 'étape 1 due',
  etape1_payee: 'étape 1 payée',
  etape2_due: 'étape 2 due',
  etape2_payee: 'étape 2 payée',
  annule: 'annulé',
}

const MATCHING_TRIGGER_LABELS: Record<string, string> = {
  cv_upload: 'après un dépôt de CV',
  profile_update: 'après une mise à jour de profil',
  consent_given: 'après un accord de matching',
  cv_verified: 'après la vérification d’un CV',
  opportunity_created: 'après la publication d’une offre',
  opportunity_updated: 'après la modification d’une offre',
  admin_manual: 'relance manuelle',
}

const TALENT_ORIGIN_LABELS: Record<string, string> = {
  direct: 'saisie directe',
  lead: 'depuis une demande de contact',
  sourcing: 'depuis la veille',
  signal: 'depuis un signal de recommandation',
}

const DISPATCH_CHANNEL_LABELS: Record<string, string> = { email: 'e-mail', in_app: 'in-app' }
const DISPATCH_STATUS_LABELS: Record<string, string> = { sent: 'envoyé', skipped: 'non envoyé', failed: 'échec' }

/* ------------------------------------------------------------------ */
/* Construction des lignes                                            */
/* ------------------------------------------------------------------ */

export interface ActivityLog {
  id: string
  userId: string | null
  action: string
  metadata: Prisma.JsonValue
  createdAt: Date
}

export interface ActivityActor {
  id: string
  displayName: string
  role: UserRole
  email: string
  /** Fiche admin de l'acteur, quand elle existe. */
  link: string | null
}

export interface ActivityTarget {
  type: 'compte' | 'offre' | 'entreprise' | 'talent' | 'signal' | 'placement'
  id: string | null
  label: string
}

export interface ActivityItem {
  id: string
  createdAt: string
  action: string
  family: ActivityFamily
  system: boolean
  label: string
  detail: string | null
  actor: ActivityActor | null
  /** `true` : l'acteur existe mais n'est jamais exposé (auteur d'une recommandation). */
  actorMasked: boolean
  target: ActivityTarget | null
  link: string | null
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type Meta = Record<string, unknown>

function asMeta(value: Prisma.JsonValue): Meta {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Meta) : {}
}

function idOf(meta: Meta, key: string): string | null {
  const v = meta[key]
  return typeof v === 'string' && UUID.test(v) ? v : null
}

function str(meta: Meta, key: string): string | null {
  const v = meta[key]
  return typeof v === 'string' && v.trim() ? v : null
}

function num(meta: Meta, key: string): number | null {
  const v = meta[key]
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

function joinParts(parts: (string | null | false | undefined)[]): string | null {
  const kept = parts.filter((p): p is string => Boolean(p))
  return kept.length ? kept.join(' · ') : null
}

const userSelect = {
  id: true,
  email: true,
  role: true,
  candidateProfile: { select: { fullName: true } },
  recruiterProfile: { select: { companyName: true } },
  agentProfile: { select: { fullName: true } },
} as const

type UserLite = Prisma.UserGetPayload<{ select: typeof userSelect }>

/**
 * Nom affiché, même règle que `actorLabel()` des notifications admin : nom
 * du candidat, raison sociale du recruteur, nom de l'agent ; un particulier
 * ou un compte de suivi talent n'est jamais nommé (libellé générique).
 */
function displayNameOf(u: UserLite): string {
  if (u.role === 'candidate' && u.candidateProfile?.fullName) return clip(u.candidateProfile.fullName, 60)
  if (u.role === 'recruiter' && u.recruiterProfile?.companyName) return clip(u.recruiterProfile.companyName, 60)
  if (u.role === 'agent' && u.agentProfile?.fullName) return clip(u.agentProfile.fullName, 60)
  if (u.role === 'admin') return 'Administrateur'
  if (u.role === 'particulier') return 'Particulier'
  if (u.role === 'talent') return 'Compte de suivi talent'
  return 'Utilisateur'
}

/** Écran admin consacré à un compte, quand il en existe un. */
function userAdminLink(u: Pick<UserLite, 'id' | 'role'>): string | null {
  if (u.role === 'candidate') return `/admin/candidats?id=${u.id}`
  if (u.role === 'recruiter') return `/admin/recruteurs?id=${u.id}`
  if (u.role === 'agent') return '/admin/agents'
  return null
}

/** Clause « acteur » de la recherche : email, nom du candidat / de l'agent, raison sociale du recruteur. */
export function actorSearchWhere(q: string): Prisma.UserWhereInput {
  return {
    OR: [
      { email: { contains: q, mode: 'insensitive' } },
      { candidateProfile: { is: { fullName: { contains: q, mode: 'insensitive' } } } },
      { recruiterProfile: { is: { companyName: { contains: q, mode: 'insensitive' } } } },
      { agentProfile: { is: { fullName: { contains: q, mode: 'insensitive' } } } },
    ],
  }
}

interface Context {
  users: Map<string, UserLite>
  suggestions: Map<string, { opportunityId: string; title: string; candidateName: string | null }>
  opportunities: Map<string, { title: string }>
  companies: Map<string, { name: string; city: string }>
  talents: Map<string, { trade: string; city: string }>
  signals: Map<string, { trade: string; city: string }>
}

/** Charge en un nombre fixe de requêtes groupées tout ce que les lignes référencent (pas de N+1). */
async function loadContext(logs: ActivityLog[]): Promise<Context> {
  const userIds = new Set<string>()
  const suggestionIds = new Set<string>()
  const opportunityIds = new Set<string>()
  const companyIds = new Set<string>()
  const talentIds = new Set<string>()
  const signalIds = new Set<string>()
  const add = (set: Set<string>, id: string | null) => {
    if (id) set.add(id)
  }

  for (const log of logs) {
    const meta = asMeta(log.metadata)
    if (log.userId && !definitionOf(log.action).masked) userIds.add(log.userId)
    add(userIds, idOf(meta, 'candidateId'))
    add(userIds, idOf(meta, 'agentUserId'))
    add(userIds, idOf(meta, 'targetUserId'))
    add(userIds, idOf(meta, 'recruiterUserId'))
    add(suggestionIds, idOf(meta, 'suggestionId'))
    add(opportunityIds, idOf(meta, 'opportunityId'))
    add(companyIds, idOf(meta, 'companyId'))
    add(talentIds, idOf(meta, 'talentId'))
    add(signalIds, idOf(meta, 'signalId'))
    add(signalIds, idOf(meta, 'intoId'))
  }

  const [users, suggestions, opportunities, companies, talents, signals] = await Promise.all([
    userIds.size ? prisma.user.findMany({ where: { id: { in: [...userIds] } }, select: userSelect }) : [],
    suggestionIds.size
      ? prisma.matchSuggestion.findMany({
          where: { id: { in: [...suggestionIds] } },
          select: {
            id: true,
            opportunityId: true,
            opportunity: { select: { title: true } },
            candidate: { select: { candidateProfile: { select: { fullName: true } } } },
          },
        })
      : [],
    opportunityIds.size
      ? prisma.opportunity.findMany({ where: { id: { in: [...opportunityIds] } }, select: { id: true, title: true } })
      : [],
    companyIds.size
      ? prisma.company.findMany({ where: { id: { in: [...companyIds] } }, select: { id: true, name: true, city: true } })
      : [],
    talentIds.size
      ? prisma.talentProfile.findMany({ where: { id: { in: [...talentIds] } }, select: { id: true, trade: true, city: true } })
      : [],
    signalIds.size
      ? prisma.talentSignal.findMany({ where: { id: { in: [...signalIds] } }, select: { id: true, trade: true, city: true } })
      : [],
  ])

  return {
    users: new Map(users.map((u) => [u.id, u])),
    suggestions: new Map(
      suggestions.map((s) => [
        s.id,
        {
          opportunityId: s.opportunityId,
          title: s.opportunity.title,
          candidateName: s.candidate.candidateProfile?.fullName ?? null,
        },
      ]),
    ),
    opportunities: new Map(opportunities.map((o) => [o.id, { title: o.title }])),
    companies: new Map(companies.map((c) => [c.id, { name: c.name, city: c.city }])),
    talents: new Map(talents.map((t) => [t.id, { trade: t.trade, city: t.city }])),
    signals: new Map(signals.map((s) => [s.id, { trade: s.trade, city: s.city }])),
  }
}

interface Described {
  detail: string | null
  target: ActivityTarget | null
  link: string | null
}

const NOTHING: Described = { detail: null, target: null, link: null }

function tradeCity(v: { trade: string; city: string }): string {
  return joinParts([clip(v.trade, 40) || 'Métier non précisé', clip(v.city, 40)]) ?? 'Talent'
}

function userTarget(ctx: Context, id: string | null): ActivityTarget | null {
  if (!id) return null
  const u = ctx.users.get(id)
  return { type: 'compte', id, label: u ? `${displayNameOf(u)} (${ROLE_LABELS[u.role] ?? u.role})` : 'Compte supprimé' }
}

function offerTarget(ctx: Context, opportunityId: string | null, fallbackTitle: string | null): ActivityTarget | null {
  const title = (opportunityId && ctx.opportunities.get(opportunityId)?.title) || fallbackTitle
  if (!opportunityId && !title) return null
  return { type: 'offre', id: opportunityId, label: title ? `« ${clip(title, 70)} »` : 'Offre supprimée' }
}

function offerLink(opportunityId: string | null): string | null {
  return opportunityId ? `/admin/mise-en-relation?offre=${opportunityId}` : null
}

/** Onglet « Entretiens » de l'admin, filtré sur l'offre quand elle est connue. */
function interviewsLink(opportunityId: string | null): string {
  return opportunityId ? `/admin/entretiens?periode=tous&offre=${opportunityId}` : '/admin/entretiens?periode=tous'
}

/** Date d'entretien de la metadata (ISO), en heure de Madagascar. */
function interviewWhen(meta: Meta, key: string): string | null {
  const iso = str(meta, key)
  if (!iso || Number.isNaN(Date.parse(iso))) return null
  return formatMadagascarDateTime(iso)
}

function companyTarget(ctx: Context, id: string | null): ActivityTarget | null {
  if (!id) return null
  const c = ctx.companies.get(id)
  return { type: 'entreprise', id, label: c ? joinParts([clip(c.name, 60), clip(c.city, 40)])! : 'Fiche supprimée' }
}

function companyLink(id: string | null): string | null {
  return id ? `/admin/entreprises?entreprise=${id}` : null
}

function talentTarget(ctx: Context, id: string | null): ActivityTarget | null {
  if (!id) return null
  const t = ctx.talents.get(id)
  return { type: 'talent', id, label: t ? tradeCity(t) : 'Talent supprimé' }
}

function signalTarget(ctx: Context, id: string | null): ActivityTarget | null {
  if (!id) return null
  const s = ctx.signals.get(id)
  return { type: 'signal', id, label: s ? `Signal : ${tradeCity(s)}` : 'Signal purgé' }
}

/** Le dossier d'une suggestion : offre (cible + lien) et nom du candidat. */
function suggestionParts(ctx: Context, meta: Meta) {
  const s = idOf(meta, 'suggestionId') ? ctx.suggestions.get(idOf(meta, 'suggestionId')!) : undefined
  const opportunityId = s?.opportunityId ?? idOf(meta, 'opportunityId')
  const candidateName = s?.candidateName ?? str(meta, 'candidateName')
  if (s && opportunityId && !ctx.opportunities.has(opportunityId)) ctx.opportunities.set(opportunityId, { title: s.title })
  return {
    opportunityId,
    target: offerTarget(ctx, opportunityId, str(meta, 'opportunityTitle')),
    link: offerLink(opportunityId),
    candidate: candidateName ? `Profil : ${clip(candidateName, 60)}` : null,
  }
}

function describe(log: ActivityLog, ctx: Context): Described {
  const meta = asMeta(log.metadata)
  const actor = log.userId ? ctx.users.get(log.userId) : undefined
  const actorLink = actor ? userAdminLink(actor) : null

  switch (log.action) {
    case 'register': {
      const role = str(meta, 'role')
      return { detail: role ? `Rôle : ${ROLE_LABELS[role] ?? 'autre'}` : null, target: null, link: actorLink }
    }
    case 'login':
    case 'logout':
      return { ...NOTHING, link: actorLink }

    case 'matching_consent_given':
      return {
        detail: str(meta, 'source') === 'cv_upload' ? 'Donné au dépôt du CV' : 'Donné depuis le profil',
        target: null,
        link: actorLink,
      }
    case 'matching_consent_withdrawn': {
      const n = num(meta, 'withdrawnSuggestions') ?? 0
      return {
        detail: n > 0 ? `${plural(n, 'dossier')} en attente ${n > 1 ? 'écartés' : 'écarté'}` : null,
        target: null,
        link: actorLink,
      }
    }
    case 'cv_upload': {
      const flags = Array.isArray(meta.flagCodes) ? meta.flagCodes.length : 0
      return {
        detail: flags > 0 ? `${plural(flags, 'point')} à vérifier` : 'Aucun point signalé',
        target: null,
        link: log.userId ? `/verification-cv?candidat=${log.userId}` : null,
      }
    }
    case 'cv_verification': {
      const decision = str(meta, 'decision')
      const candidateId = idOf(meta, 'candidateId')
      return {
        detail: decision === 'verifie' ? 'CV vérifié' : decision === 'rejete' ? 'CV rejeté' : null,
        target: userTarget(ctx, candidateId),
        link: candidateId ? `/verification-cv?candidat=${candidateId}` : null,
      }
    }
    case 'candidate_interested':
    case 'candidate_declined':
    case 'recruiter_interested':
    case 'recruiter_declined': {
      const parts = suggestionParts(ctx, meta)
      return { detail: parts.candidate, target: parts.target, link: parts.link }
    }

    case 'match_suggestion_created': {
      const parts = suggestionParts(ctx, meta)
      return {
        detail: joinParts([
          parts.candidate,
          meta.reactivated === true && 'dossier écarté remis en file',
          str(meta, 'source') === 'preselection' && 'depuis la présélection',
        ]),
        target: parts.target,
        link: parts.link,
      }
    }
    case 'match_suggestion_status': {
      const parts = suggestionParts(ctx, meta)
      const from = str(meta, 'from')
      const to = str(meta, 'to')
      const rank = num(meta, 'preselectionRank')
      const top = num(meta, 'preselectionTop')
      return {
        detail: joinParts([
          parts.candidate,
          to && `${from ? `${SUGGESTION_STATUS_LABELS[from] ?? 'autre statut'} → ` : ''}${SUGGESTION_STATUS_LABELS[to] ?? 'autre statut'}`,
          rank !== null && `présélection : rang ${rank}${top !== null ? ` / top ${top}` : ''}`,
        ]),
        target: parts.target,
        link: parts.link,
      }
    }
    case 'matching_run': {
      const opportunityId = idOf(meta, 'opportunityId')
      const count = (key: string, singular: string, pluralForm: string) => {
        const n = num(meta, key)
        return n ? `${n} ${n > 1 ? pluralForm : singular}` : null
      }
      const trigger = str(meta, 'trigger')
      return {
        detail: joinParts([
          trigger && MATCHING_TRIGGER_LABELS[trigger],
          `${num(meta, 'evaluated') ?? 0} évalué${(num(meta, 'evaluated') ?? 0) > 1 ? 's' : ''}`,
          count('queued', 'mis en file', 'mis en file'),
          count('sentDirect', 'transmis directement', 'transmis directement'),
          count('promoted', 'promu', 'promus'),
          count('refreshed', 'actualisé', 'actualisés'),
        ]),
        target: offerTarget(ctx, opportunityId, null),
        link: offerLink(opportunityId),
      }
    }

    case 'interview_created': {
      const parts = suggestionParts(ctx, meta)
      const minutes = num(meta, 'durationMinutes')
      const when = interviewWhen(meta, 'scheduledAt')
      return {
        detail: joinParts([
          parts.candidate,
          when && `le ${when}`,
          minutes !== null && `${minutes} min`,
          meta.connected === true && 'mise en relation',
          str(meta, 'provider') === 'simule' && 'agenda simulé',
        ]),
        target: parts.target,
        link: interviewsLink(parts.opportunityId),
      }
    }
    case 'interview_rescheduled': {
      const parts = suggestionParts(ctx, meta)
      const when = interviewWhen(meta, 'to')
      return {
        detail: joinParts([parts.candidate, when && `nouvelle date : ${when}`]),
        target: parts.target,
        link: interviewsLink(parts.opportunityId),
      }
    }
    case 'interview_cancelled':
    case 'interview_confirmed':
    case 'interview_unavailable': {
      // Jamais le motif d'un empêchement (texte libre du candidat) : il
      // n'est d'ailleurs pas écrit dans la metadata.
      const parts = suggestionParts(ctx, meta)
      return { detail: parts.candidate, target: parts.target, link: interviewsLink(parts.opportunityId) }
    }
    case 'interview_calendar_resync': {
      const parts = suggestionParts(ctx, meta)
      return {
        detail: joinParts([
          parts.candidate,
          meta.ok === true && 'agenda à jour',
          meta.ok === false && 'échec, à relancer',
        ]),
        target: parts.target,
        link: interviewsLink(parts.opportunityId),
      }
    }

    case 'interview_outcome_recorded':
    case 'interview_outcome_reset': {
      // Issue et motif en libellés (l'admin les voit, décision D3) ; jamais
      // la note privée du recruteur, qui n'est d'ailleurs pas journalisée.
      const parts = suggestionParts(ctx, meta)
      const round = num(meta, 'round')
      const reset = log.action === 'interview_outcome_reset'
      const result = str(meta, reset ? 'previousResult' : 'result')
      const resultLabel = result ? INTERVIEW_RESULT_LABELS[result as InterviewResult] ?? null : null
      const reason = str(meta, 'reason')
      return {
        detail: joinParts([
          parts.candidate,
          round !== null && `tour ${round}`,
          resultLabel && (reset ? `issue annulée : ${resultLabel}` : resultLabel),
          reason && RESULT_REASON_LABELS[reason as InterviewResultReason],
          meta.nextRound === true && 'tour suivant fixé',
        ]),
        target: parts.target,
        link: interviewsLink(parts.opportunityId),
      }
    }
    case 'interview_absence_reply': {
      // Jamais le texte de l'explication : il n'est pas dans la metadata.
      const parts = suggestionParts(ctx, meta)
      const round = num(meta, 'round')
      return {
        detail: joinParts([parts.candidate, round !== null && `tour ${round}`]),
        target: parts.target,
        link: interviewsLink(parts.opportunityId),
      }
    }
    case 'hiring_jobs_run':
    case 'hiring_digest_sent': {
      const reminders = num(meta, 'outcomeReminders')
      const overdue = num(meta, 'overdueOutcomes') ?? num(meta, 'overdue')
      const expired = num(meta, 'proposalsExpired')
      const proposalReminders = num(meta, 'proposalReminders')
      return {
        detail: joinParts([
          reminders !== null && plural(reminders, 'rappel envoyé', 'rappels envoyés'),
          overdue !== null && plural(overdue, 'issue en souffrance', 'issues en souffrance'),
          expired !== null && expired > 0 && plural(expired, 'proposition expirée', 'propositions expirées'),
          proposalReminders !== null && proposalReminders > 0 && plural(proposalReminders, 'rappel J-2', 'rappels J-2'),
        ]),
        target: null,
        link: '/admin/entretiens',
      }
    }

    case 'hire_proposal_sent':
    case 'hire_proposal_revised':
    case 'hire_proposal_withdrawn':
    case 'hire_proposal_accepted':
    case 'hire_proposal_declined':
    case 'hire_proposal_expired': {
      // Ni salaire ni message ni précision d'un refus : codes et numéros seulement.
      const parts = suggestionParts(ctx, meta)
      const version = num(meta, 'version')
      const revision = num(meta, 'revision')
      const contract = str(meta, 'contractType')
      const reason = str(meta, 'reason')
      return {
        detail: joinParts([
          parts.candidate,
          version !== null && `version ${version}`,
          log.action === 'hire_proposal_revised' && revision !== null && `révision ${revision}`,
          contract && CONTRACT_TYPE_LABELS[contract as ContractType],
          log.action === 'hire_proposal_declined' && reason && `motif : ${DECLINE_REASON_LABELS[reason as HireDeclineReason] ?? 'autre'}`,
          log.action === 'hire_proposal_withdrawn' && reason && WITHDRAW_REASON_LABELS[reason as HireProposalWithdrawReason],
        ]),
        target: parts.target,
        link: '/admin/mise-en-relation',
      }
    }
    case 'opportunity_filled':
    case 'opportunity_reopened': {
      const opportunityId = idOf(meta, 'opportunityId')
      const positions = num(meta, 'positions')
      const active = num(meta, 'activePlacements')
      const source = str(meta, 'source')
      return {
        detail: joinParts([
          source === 'auto' && 'nombre de postes atteint',
          source === 'manuel' && 'marquée pourvue par le recruteur',
          positions !== null && `${active ?? 0}/${positions} poste${positions > 1 ? 's' : ''} pourvu${(active ?? 0) > 1 ? 's' : ''}`,
        ]),
        target: offerTarget(ctx, opportunityId, null),
        link: offerLink(opportunityId),
      }
    }

    case 'talent_consent_profile': {
      const talentId = idOf(meta, 'talentId')
      const origin = str(meta, 'origin')
      return {
        detail: origin ? TALENT_ORIGIN_LABELS[origin] ?? null : null,
        target: talentTarget(ctx, talentId),
        link: '/admin/talents',
      }
    }
    case 'talent_signal_converted': {
      const n = num(meta, 'signals')
      return {
        detail: n && n > 1 ? `${n} signaux regroupés` : null,
        target: talentTarget(ctx, idOf(meta, 'talentId')),
        link: '/admin/talents',
      }
    }
    case 'talent_consent_public_granted':
    case 'talent_consent_public_revoked':
    case 'talent_contact_requested':
    case 'talent_contact_request_transmise':
    case 'talent_contact_request_close':
      return { detail: null, target: talentTarget(ctx, idOf(meta, 'talentId')), link: '/admin/talents' }
    case 'talent_signal_taken':
    case 'talent_endorsement_created':
      return { detail: null, target: signalTarget(ctx, idOf(meta, 'signalId')), link: '/admin/talents' }
    case 'talent_signal_status': {
      const from = str(meta, 'from')
      const to = str(meta, 'to')
      return {
        detail: to ? `${from ? `${SIGNAL_STATUS_LABELS[from] ?? 'autre'} → ` : ''}${SIGNAL_STATUS_LABELS[to] ?? 'autre'}` : null,
        target: signalTarget(ctx, idOf(meta, 'signalId')),
        link: '/admin/talents',
      }
    }
    case 'talent_signal_merged': {
      const into = signalTarget(ctx, idOf(meta, 'intoId'))
      return {
        detail: into ? `Fusionné dans ${into.label.replace(/^Signal : /, 'le signal ')}` : null,
        target: signalTarget(ctx, idOf(meta, 'signalId')),
        link: '/admin/talents',
      }
    }
    case 'talent_signals_purged': {
      const n = num(meta, 'count') ?? 0
      return { detail: `${plural(n, 'signal expiré', 'signaux expirés')} (60 jours sans activité)`, target: null, link: null }
    }

    case 'endorsement_reviewed':
    case 'endorsement_excluded': {
      const proof = meta.proofAccepted
      return {
        detail: joinParts([
          proof === true && 'preuve acceptée',
          proof === false && 'preuve refusée',
          meta.hiddenJobLabel === true && 'libellé du travail masqué',
          meta.hiddenJobLabel === false && 'libellé du travail affiché',
        ]),
        target: null,
        link: '/admin/talents',
      }
    }

    case 'company_endorsement_created':
    case 'company_hidden':
    case 'company_unhidden': {
      const companyId = idOf(meta, 'companyId')
      return { detail: null, target: companyTarget(ctx, companyId), link: companyLink(companyId) }
    }
    case 'company_endorsement_proof_reviewed':
    case 'company_endorsement_excluded': {
      const companyId = idOf(meta, 'companyId')
      const proof = meta.proofAccepted
      return {
        detail: joinParts([
          proof === true && 'preuve acceptée',
          proof === false && 'preuve refusée',
          meta.proofFileDeleted === true && 'fichier supprimé',
        ]),
        target: companyTarget(ctx, companyId),
        link: companyLink(companyId),
      }
    }
    case 'company_recruiter_linked':
    case 'company_recruiter_unlinked': {
      const companyId = idOf(meta, 'companyId')
      const recruiterId = idOf(meta, 'recruiterUserId') ?? idOf(meta, 'previousRecruiterUserId')
      const recruiter = recruiterId ? ctx.users.get(recruiterId) : undefined
      return {
        detail: recruiter ? `Recruteur : ${displayNameOf(recruiter)}` : null,
        target: companyTarget(ctx, companyId),
        link: companyLink(companyId),
      }
    }

    case 'placement_declared': {
      // Jamais le nom d'un talent (métier et ville seulement) ; le nom du
      // candidat diplômé vient de son dossier, comme pour le reste du matching.
      const parts = suggestionParts(ctx, meta)
      const talentId = idOf(meta, 'talentId')
      const talent = talentId ? ctx.talents.get(talentId) : undefined
      const salary = num(meta, 'monthlySalaryAr')
      return {
        detail: joinParts([
          talentId ? `Talent vérifié${talent ? ` : ${tradeCity(talent)}` : ''}` : 'Candidat diplômé',
          !talentId && parts.candidate,
          salary !== null && `${salary.toLocaleString('fr-FR')} Ar / mois`,
        ]),
        target: parts.target,
        link: '/admin/placements',
      }
    }
    case 'placement_created_auto': {
      const parts = suggestionParts(ctx, meta)
      return { detail: joinParts(['Candidat diplômé', parts.candidate]), target: parts.target, link: '/admin/placements' }
    }
    case 'placement_stage_updated':
    case 'admin_corrected_placement_stage': {
      const from = str(meta, 'fromStage')
      const to = str(meta, 'toStage')
      return {
        detail: to ? `${from ? `${PLACEMENT_STAGE_LABELS[from] ?? 'autre'} → ` : ''}${PLACEMENT_STAGE_LABELS[to] ?? 'autre'}` : null,
        target: { type: 'placement', id: idOf(meta, 'placementId'), label: 'Placement' },
        link: '/admin/placements',
      }
    }

    case 'admin:create_agent':
      return { detail: null, target: userTarget(ctx, idOf(meta, 'agentUserId')), link: '/admin/agents' }
    case 'admin:cv_verifier_roles': {
      const roles = Array.isArray(meta.roles) ? meta.roles.filter((r): r is string => typeof r === 'string') : []
      return {
        detail: roles.length
          ? `Rôles habilités : ${roles.map((r) => ROLE_LABELS[r] ?? 'autre').join(', ')}`
          : 'Plus aucun rôle habilité en dehors de l’admin',
        target: null,
        link: '/verification-cv',
      }
    }
    case 'research_export': {
      // Volume et filtre seulement : aucune ligne ni aucun pseudonyme n'est journalisé.
      const rows = num(meta, 'rowCount')
      return {
        detail: joinParts([
          rows !== null && plural(rows, 'dossier exporté', 'dossiers exportés'),
          meta.excludeTest === true ? 'sans les comptes de test' : 'comptes de test compris',
          meta.truncated === true && 'tronqué',
        ]),
        target: null,
        link: '/admin',
      }
    }
    case 'notification_dispatch': {
      const channel = str(meta, 'channel')
      const status = str(meta, 'status')
      return {
        detail: joinParts([
          channel && `Canal : ${DISPATCH_CHANNEL_LABELS[channel] ?? 'autre'}`,
          status && (DISPATCH_STATUS_LABELS[status] ?? null),
        ]),
        target: null,
        link: null,
      }
    }

    default: {
      if (log.action.startsWith(MODERATION_PREFIX)) {
        const targetId = idOf(meta, 'targetUserId')
        const target = targetId ? ctx.users.get(targetId) : undefined
        return {
          detail: null,
          target: userTarget(ctx, targetId),
          link: target
            ? userAdminLink(target) ?? `/admin/moderation?compte=${encodeURIComponent(target.email)}`
            : '/admin/moderation',
        }
      }
      return NOTHING
    }
  }
}

/** Lignes prêtes à afficher, construites par liste blanche. */
export async function buildActivityItems(logs: ActivityLog[]): Promise<ActivityItem[]> {
  const ctx = await loadContext(logs)
  return logs.map((log) => {
    const def = definitionOf(log.action)
    const described = describe(log, ctx)
    const user = !def.masked && log.userId ? ctx.users.get(log.userId) : undefined
    return {
      id: log.id,
      createdAt: log.createdAt.toISOString(),
      action: log.action,
      family: def.family,
      system: def.system === true,
      label: def.label,
      detail: described.detail,
      actor: user
        ? { id: user.id, displayName: displayNameOf(user), role: user.role, email: user.email, link: userAdminLink(user) }
        : null,
      actorMasked: def.masked === true && log.userId !== null,
      target: described.target,
      link: described.link,
    }
  })
}

/* ------------------------------------------------------------------ */
/* Curseur de pagination                                              */
/* ------------------------------------------------------------------ */

/** Curseur `<ms depuis l'époque>_<uuid>` (voir `ACTIVITY_CURSOR_PATTERN`) : position stable dans l'ordre (createdAt desc, id desc). */
export function encodeActivityCursor(log: { createdAt: Date; id: string }): string {
  return `${log.createdAt.getTime()}_${log.id}`
}

export function activityCursorWhere(cursor: string): Prisma.AuditLogWhereInput {
  const [ms, id] = cursor.split('_')
  const at = new Date(Number(ms))
  return { OR: [{ createdAt: { lt: at } }, { createdAt: at, id: { lt: id } }] }
}
