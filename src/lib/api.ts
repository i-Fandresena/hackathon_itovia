import type {
  AgentProfile,
  Availability,
  CandidateProfile,
  CvFlag,
  CvVerificationStatus,
  EducationLevel,
  ExperienceLevel,
  Gender,
  IndividualProfile,
  Notification,
  Member,
  MatchFit,
  MatchSuggestion,
  MatchSuggestionStatus,
  Opportunity,
  OpportunityType,
  Placement,
  PlacementStage,
  PreselectionFilters,
  PreselectionResult,
  PreselectionTop,
  PreselectionTransmitOutcome,
  Provider,
  Recommendation,
  RecruiterProfile,
  Sector,
  SourcingLead,
  SourcingLeadType,
  TalentAccountProfile,
  TalentLead,
  TalentProfile,
  TalentVerification,
  User,
  UserRole,
} from '../types/index.js'

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:4000/api'

export class ApiError extends Error {
  status: number
  body?: any
  constructor(message: string, status: number, body?: any) {
    super(message)
    this.status = status
    this.body = body
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (res.status === 204) return undefined as T
  const isJson = res.headers.get('content-type')?.includes('application/json')
  const body = isJson ? await res.json() : undefined
  if (!res.ok) {
    let errorMsg = body?.error ?? `Erreur ${res.status}`
    if (body?.details?.fieldErrors) {
      const fieldDetails = Object.entries(body.details.fieldErrors)
        .map(([field, msgs]) => `${field}: ${(msgs as string[]).join(', ')}`)
        .join(' ; ')
      if (fieldDetails && !errorMsg.includes('(')) {
        errorMsg = `${errorMsg} (${fieldDetails})`
      }
    }
    throw new ApiError(errorMsg, res.status, body?.details)
  }
  return body as T
}

/* ------------------------------------------------------------------ */
/* Auth                                                                */
/* ------------------------------------------------------------------ */

/** `canVerifyCv` est calculé par le serveur (admin, ou rôle autorisé par
 *  l'admin) — absent si le serveur est plus ancien que le client. */
export type ApiUser = User & { memberId: string | null; canVerifyCv?: boolean }

/** URL absolue d'un fichier servi par l'API hors `/api` (ex. `/uploads/cv/…`,
 *  protégé par la session : à ouvrir dans le même navigateur). */
export function apiFileUrl(path: string): string {
  return `${API_BASE.replace(/\/api\/?$/, '')}${path}`
}

export async function apiMe(): Promise<ApiUser | null> {
  try {
    const { user } = await request<{ user: ApiUser }>('/auth/me')
    return user
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) return null
    throw err
  }
}

export function apiLogin(email: string, password: string) {
  return request<{ user: ApiUser }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
}

export function apiRegister(payload: {
  email: string
  password: string
  role: UserRole
  verificationToken: string
  candidateProfile?: CandidateProfile
  recruiterProfile?: RecruiterProfile
  individualProfile?: IndividualProfile
  talentAccountProfile?: Omit<TalentAccountProfile, 'email'>
}) {
  return request<{ user: ApiUser }>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

/* ------------------------------------------------------------------ */
/* Vérification d'email                                               */
/* ------------------------------------------------------------------ */

export function apiSendVerificationCode(email: string) {
  return request<{ ok: true }>('/verification/send-code', {
    method: 'POST',
    body: JSON.stringify({ email }),
  })
}

export function apiVerifyCode(email: string, code: string) {
  return request<{ token: string }>('/verification/verify-code', {
    method: 'POST',
    body: JSON.stringify({ email, code }),
  })
}

/** Sondé pendant que la modale est ouverte : détecte une vérification
 *  faite via le lien cliqué dans l'email, dans un autre onglet. */
export function apiVerificationStatus(email: string) {
  return request<{ verified: boolean; token?: string }>(
    `/verification/status?email=${encodeURIComponent(email)}`,
  )
}

export function apiConfirmVerificationLink(token: string) {
  return request<{ ok: true; email: string }>(
    `/verification/confirm?token=${encodeURIComponent(token)}`,
  )
}

export function apiLogout() {
  return request<void>('/auth/logout', { method: 'POST' })
}

export function apiUpdateCandidateProfile(profile: CandidateProfile) {
  return request<{ candidateProfile: CandidateProfile }>('/auth/profile/candidate', {
    method: 'PUT',
    body: JSON.stringify(profile),
  }).then((r) => r.candidateProfile)
}

/** Donner le consentement global de matching : « j'accepte qu'OffRec propose
 *  mon profil aux entreprises ». Idempotent (la date d'origine est conservée).
 *  Renvoie le profil à jour, avec `matchingConsentAt` renseigné. */
export function apiGiveMatchingConsent() {
  return request<{ candidateProfile: CandidateProfile }>('/auth/profile/candidate/matching-consent', {
    method: 'POST',
  }).then((r) => r.candidateProfile)
}

/** Retirer le consentement : plus aucune nouvelle proposition, et les
 *  suggestions encore en attente de validation OffRec sont écartées
 *  (`withdrawnSuggestions`). Les dossiers déjà transmis à une entreprise ne
 *  sont pas retirés : le candidat s'en retire un par un
 *  (`apiDeclineSuggestion`). */
export function apiWithdrawMatchingConsent() {
  return request<{ candidateProfile: CandidateProfile; withdrawnSuggestions: number }>(
    '/auth/profile/candidate/matching-consent',
    { method: 'DELETE' },
  )
}

export interface CvUploadResult {
  cvUrl: string
  suggestedSkills: string[]
  extractedData: Record<string, any>
  validationWarnings: string[]
  /** Points relevés automatiquement, à contrôler par un vérificateur. */
  flags: CvFlag[]
  verificationStatus: CvVerificationStatus
  /** Consentement de matching en vigueur après ce dépôt (date ISO) ou `null`. */
  matchingConsentAt: string | null
}

/** Dépôt de CV : extraction simple + suggestions de compétences, jamais
 *  appliquées automatiquement au profil (le candidat confirme dans l'UI).
 *  `attestation` : le candidat certifie l'exactitude de son CV — exigée par
 *  le serveur, qui refuse le dépôt sans elle. En cas de 400, `err.body`
 *  porte `validationErrors: string[]` quand le CV contredit le profil.
 *  `matchingConsent: true` (case cochée au dépôt) donne en même temps le
 *  consentement de matching ; `false`/absent ne retire jamais un consentement
 *  existant (voir `apiWithdrawMatchingConsent`). */
export async function apiUploadCv(
  file: File,
  attestation: boolean,
  matchingConsent = false,
): Promise<CvUploadResult> {
  const form = new FormData()
  form.append('cv', file)
  form.append('attestation', attestation ? 'true' : 'false')
  if (matchingConsent) form.append('matchingConsent', 'true')
  const res = await fetch(`${API_BASE}/auth/profile/candidate/cv`, {
    method: 'POST',
    credentials: 'include',
    body: form,
  })
  const body = await res.json().catch(() => undefined)
  if (!res.ok) {
    throw new ApiError(body?.error ?? `Erreur ${res.status}`, res.status, body)
  }
  return {
    ...body,
    flags: body?.flags ?? [],
    verificationStatus: body?.verificationStatus ?? 'non_verifie',
    matchingConsentAt: body?.matchingConsentAt ?? null,
  }
}

/* ------------------------------------------------------------------ */
/* Opportunités / candidatures / favoris                              */
/* ------------------------------------------------------------------ */

export async function apiListOpportunities(): Promise<Opportunity[]> {
  const { opportunities } = await request<{ opportunities: { opportunity: Opportunity }[] }>(
    '/opportunities',
  )
  return opportunities.map((o) => o.opportunity)
}

export function apiCreateOpportunity(data: Omit<Opportunity, 'id' | 'createdAt' | 'recruiterId' | 'companyName'>) {
  return request<{ opportunity: Opportunity }>('/opportunities', {
    method: 'POST',
    body: JSON.stringify(data),
  }).then((r) => r.opportunity)
}

export function apiUpdateOpportunity(
  id: string,
  data: Omit<Opportunity, 'id' | 'createdAt' | 'recruiterId' | 'companyName'>,
) {
  return request<{ opportunity: Opportunity }>(`/opportunities/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }).then((r) => r.opportunity)
}

export function apiDeleteOpportunity(id: string) {
  return request<void>(`/opportunities/${id}`, { method: 'DELETE' })
}

export function apiAddBookmark(opportunityId: string) {
  return request<void>(`/opportunities/${opportunityId}/bookmark`, { method: 'POST' })
}

export function apiRemoveBookmark(opportunityId: string) {
  return request<void>(`/opportunities/${opportunityId}/bookmark`, { method: 'DELETE' })
}

export async function apiMyBookmarks(): Promise<string[]> {
  const { bookmarks } = await request<{ bookmarks: { opportunityId: string }[] }>(
    '/applications/mine/bookmarks',
  )
  return bookmarks.map((b) => b.opportunityId)
}

export interface ShortlistMatched {
  source: 'matche_ia'
  suggestionId: string
  candidateId: string
  fullName: string
  email: string
  status: MatchSuggestionStatus
  match: { score: number; reasons: string[] }
}

export interface ShortlistProposed {
  source: 'verifie_humain'
  talentId: string
  fullName: string
  trade: string
  status: string
}

export function apiShortlist(opportunityId: string) {
  return request<{ matched: ShortlistMatched[]; proposed: ShortlistProposed[] }>(
    `/opportunities/${opportunityId}/shortlist`,
  )
}

/* ------------------------------------------------------------------ */
/* Mise en relation — OffRec intermédiaire (décisions 2026-09-02 / 2026-10-08) */
/* ------------------------------------------------------------------ */

/** Offre telle que le serveur la transmet au candidat dans ses dossiers :
 *  jamais de `recruiterId`, et `companyName` vaut `null` tant que le statut
 *  n'est pas `mise_en_relation`. */
export type CandidateSuggestionOpportunity = Omit<Opportunity, 'recruiterId' | 'companyName'> & {
  companyName: string | null
}

export interface MatchSuggestionWithOpportunity extends MatchSuggestion {
  opportunity: CandidateSuggestionOpportunity
}

/** Adapte l'offre d'un dossier candidat aux composants qui attendent une
 *  `Opportunity` complète (ex. `OpportunityCard`). `recruiterId` est vide et
 *  `companyName` vaut `''` avant la mise en relation : à afficher avec
 *  `hideCompany`, jamais comme une vraie identité d'entreprise. */
export function toDisplayOpportunity(opportunity: CandidateSuggestionOpportunity): Opportunity {
  return { ...opportunity, recruiterId: '', companyName: opportunity.companyName ?? '' }
}

/** Dossiers du candidat : uniquement ceux qu'OffRec a transmis à une
 *  entreprise (`proposee_recruteur`, `interet_recruteur`, `mise_en_relation`),
 *  plus les lignes héritées `proposee_candidat` / `interet_candidat` encore
 *  actives. Jamais les suggestions en attente de validation (`suggeree`),
 *  jamais les dossiers écartés, jamais le catalogue complet. */
export function apiMySuggestions() {
  return request<{ suggestions: MatchSuggestionWithOpportunity[] }>('/match-suggestions/mine').then(
    (r) => r.suggestions,
  )
}

export interface ReceivedSuggestion {
  id: string
  status: MatchSuggestionStatus
  score: number
  reasons: string[]
  opportunity: { id: string; title: string }
  /** Adéquation critère par critère avec l'offre du recruteur — `null` si le
   *  profil candidat est introuvable, absent si le serveur est plus ancien. */
  fit?: MatchFit | null
  /** Rang dans la présélection OffRec au moment de la transmission, s'il a
   *  été enregistré. */
  preselectionRank?: number | null
  /** Le serveur ne transmet au recruteur qu'une liste blanche du profil :
   *  ni téléphone, ni CV, ni statut de vérification du CV. */
  candidate: {
    id: string
    email: string
    candidateProfile: Pick<
      CandidateProfile,
      | 'fullName'
      | 'province'
      | 'city'
      | 'educationLevel'
      | 'experienceLevel'
      | 'skills'
      | 'desiredOpportunityTypes'
      | 'availability'
      | 'sector'
    > | null
  }
}

export function apiReceivedSuggestions() {
  return request<{ suggestions: ReceivedSuggestion[] }>('/match-suggestions/received').then(
    (r) => r.suggestions,
  )
}

/** Exprimer un intérêt — jamais un contact direct, ça notifie l'admin.
 *  Recruteur : sur un profil `proposee_recruteur`. Candidat : uniquement sur
 *  une ligne héritée `proposee_candidat` (400 sinon) — le consentement global
 *  remplace l'intérêt par offre. */
export function apiExpressInterest(suggestionId: string) {
  return request<{ suggestion: MatchSuggestion }>(`/match-suggestions/${suggestionId}/interest`, {
    method: 'POST',
  })
}

/** Décliner — désélectionne le profil (sort de la liste), décision
 *  journalisée pour le suivi admin. Côté candidat : se retirer d'un dossier,
 *  possible à tout moment avant `mise_en_relation` (400 ensuite). */
export function apiDeclineSuggestion(suggestionId: string) {
  return request<{ suggestion: MatchSuggestion }>(`/match-suggestions/${suggestionId}/decline`, {
    method: 'POST',
  })
}

/* ------------------------------------------------------------------ */
/* Mise en relation — pilotage admin                                   */
/* ------------------------------------------------------------------ */

/** Présélection ATS d'une offre : filtres éliminatoires, classement, puis
 *  les `top` meilleurs profils (5 ou 10) avec le détail par critère. Lecture
 *  seule. Les filtres optionnels non cochés ne sont pas envoyés. */
export function apiAdminPreselection(
  opportunityId: string,
  options: { top: PreselectionTop; filters: PreselectionFilters },
) {
  const params = new URLSearchParams({ top: String(options.top) })
  for (const [name, enabled] of Object.entries(options.filters)) {
    if (enabled) params.set(name, 'true')
  }
  return request<{ preselection: PreselectionResult }>(
    `/admin/matching/opportunities/${opportunityId}/preselection?${params}`,
  ).then((r) => r.preselection)
}

/** Transmission groupée au recruteur d'une sélection de la présélection. Le
 *  serveur recalcule la présélection avec les mêmes options et répond
 *  candidat par candidat : un refus n'annule pas les autres envois. */
export function apiAdminTransmitPreselection(
  opportunityId: string,
  payload: { candidateIds: string[]; top: PreselectionTop; filters: PreselectionFilters },
) {
  return request<{ outcomes: PreselectionTransmitOutcome[]; transmitted: number; refused: number }>(
    `/admin/matching/opportunities/${opportunityId}/preselection/transmit`,
    { method: 'POST', body: JSON.stringify(payload) },
  )
}

/** Fiche détaillée d'un candidat, pour aperçu avant de le proposer. */
export interface AdminCandidateDetail {
  fullName: string
  email: string
  phone: string
  province: string
  city: string
  gender: Gender
  educationLevel: EducationLevel
  skills: string[]
  experienceLevel: ExperienceLevel
  desiredOpportunityTypes: OpportunityType[]
  availability: Availability
  cvUrl?: string | null
  sector?: Sector | null
  memberSince: string
  cvVerificationStatus?: CvVerificationStatus | null
  cvFlags?: CvFlag[] | null
  /** Date ISO du consentement de matching, `null` si absent ou retiré. */
  matchingConsentAt: string | null
}

export function apiAdminCandidateDetail(candidateId: string) {
  return request<{ candidate: AdminCandidateDetail }>(`/admin/matching/candidates/${candidateId}`).then(
    (r) => r.candidate,
  )
}

/** Mise en file manuelle : crée (ou réactive une ligne écartée) en
 *  `suggeree`, origine `admin`. Rien n'est envoyé au candidat ni au
 *  recruteur. Seule façon de remettre en jeu un candidat écarté pour une
 *  offre. */
export function apiAdminCreateSuggestion(opportunityId: string, candidateId: string) {
  return request<{ suggestion: MatchSuggestion }>('/admin/matching/match-suggestions', {
    method: 'POST',
    body: JSON.stringify({ opportunityId, candidateId }),
  })
}

export interface AdminMatchSuggestion extends MatchSuggestion {
  opportunity: { id: string; title: string; companyName: string }
  candidate: { id: string; email: string; candidateProfile: { fullName: string } | null }
  /** `null` si le candidat n'a pas déposé de CV. */
  cvVerificationStatus: CvVerificationStatus | null
  cvFlagCount: number
  /** `false` : le serveur refusera (409) la transmission au recruteur. */
  matchingConsent: boolean
}

/** Suivi des suggestions. `apiAdminMatchSuggestions('suggeree')` = file de
 *  validation, triée par score décroissant ; sans argument = tout, par date
 *  de mise à jour décroissante. */
export function apiAdminMatchSuggestions(status?: MatchSuggestionStatus) {
  const qs = status ? `?status=${status}` : ''
  return request<{ suggestions: AdminMatchSuggestion[] }>(`/admin/matching/match-suggestions${qs}`).then(
    (r) => r.suggestions,
  )
}

/** Transitions admin : `suggeree` → `proposee_recruteur` | `ecartee` ;
 *  `proposee_recruteur` → `ecartee` ; `interet_recruteur` → `mise_en_relation`
 *  | `ecartee` ; hérités `proposee_candidat` / `interet_candidat` →
 *  `proposee_recruteur` | `ecartee`. 400 si la transition est interdite, 409
 *  si le candidat n'a pas (ou plus) donné son consentement pour un passage à
 *  `proposee_recruteur`. */
export function apiAdminUpdateSuggestionStatus(id: string, status: MatchSuggestionStatus) {
  return request<{ suggestion: MatchSuggestion }>(`/admin/matching/match-suggestions/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })
}

export interface MatchingRunResult {
  scope: 'candidate' | 'opportunity'
  eligible: boolean
  reason?: string
  /** Paires (offre, candidat) évaluées. */
  evaluated: number
  /** Créées en `suggeree` (file de validation). */
  queued: number
  /** Créées directement en `proposee_recruteur` (score élevé + CV vérifié). */
  sentDirect: number
  /** Lignes `suggeree` promues en `proposee_recruteur`. */
  promoted: number
  /** Lignes `suggeree` dont le score a été rafraîchi. */
  refreshed: number
  /** Paires sans effet (sous le seuil, sans compétence commune, déjà traitées, écartées, plafond atteint). */
  ignored: number
}

export interface MatchingConfig {
  threshold: number
  autoThreshold: number
  maxPerRun: number
}

/** Relance manuelle du moteur de matching pour une offre. 409 si l'offre est
 *  expirée ou si le compte du recruteur est inactif. */
export function apiAdminRunMatching(opportunityId: string) {
  return request<{ result: MatchingRunResult; config: MatchingConfig }>(
    `/admin/matching/opportunities/${opportunityId}/run-matching`,
    { method: 'POST' },
  )
}

/* ------------------------------------------------------------------ */
/* Vérification humaine des CV                                         */
/* ------------------------------------------------------------------ */

export interface CvQueueEntry {
  candidateId: string
  fullName: string
  email: string
  cvUrl: string | null
  submittedAt: string | null
  verificationStatus: CvVerificationStatus
  flags: CvFlag[] | null
}

/** File des CV — réservée aux comptes dont `canVerifyCv` est vrai (le
 *  serveur revalide). */
export function apiCvVerificationQueue(status: CvVerificationStatus) {
  return request<{ candidates: CvQueueEntry[] }>(`/cv-verification/queue?status=${status}`).then(
    (r) => r.candidates,
  )
}

export interface CvVerificationDecisionEntry {
  decision: Exclude<CvVerificationStatus, 'non_verifie'>
  note: string | null
  verifierName: string
  createdAt: string
}

/** Données déclarées du profil + données extraites du CV, pour comparaison. */
export interface CvVerificationCandidate {
  candidateId: string
  fullName: string
  email: string
  phone: string
  province: string
  city: string
  educationLevel: EducationLevel
  experienceLevel: ExperienceLevel
  skills: string[]
  cvUrl: string | null
  cvProfessionalTitle: string | null
  cvExperiences: CandidateProfile['cvExperiences'] | null
  cvEducation: CandidateProfile['cvEducation'] | null
  cvCertifications: CandidateProfile['cvCertifications'] | null
  cvYearsOfExperience: number | null
  flags: CvFlag[] | null
  verificationStatus: CvVerificationStatus
  verifiedAt: string | null
  verificationNote: string | null
  history: CvVerificationDecisionEntry[]
}

export function apiCvVerificationCandidate(candidateId: string) {
  return request<{ candidate: CvVerificationCandidate }>(
    `/cv-verification/candidates/${candidateId}`,
  ).then((r) => r.candidate)
}

/** Une note est obligatoire pour un rejet (revalidé côté serveur). */
export function apiCvVerificationDecide(
  candidateId: string,
  decision: 'verifie' | 'rejete',
  note?: string,
  /** `cvUrl` de la fiche affichée : le serveur refuse (409) si le candidat a
   *  déposé un autre fichier entre-temps. */
  cvUrl?: string | null,
) {
  return request<{ verificationStatus: CvVerificationStatus }>(
    `/cv-verification/candidates/${candidateId}/decision`,
    {
      method: 'POST',
      body: JSON.stringify({ decision, note: note || undefined, cvUrl: cvUrl || undefined }),
    },
  )
}

/** `roles` : rôles autorisés en plus de l'admin (toujours autorisé).
 *  `grantable` : rôles que l'admin a le droit d'autoriser. */
export interface CvVerifierRoles {
  roles: UserRole[]
  grantable: UserRole[]
}

export function apiAdminCvVerifierRoles() {
  return request<CvVerifierRoles>('/admin/cv-verifier-roles')
}

export function apiAdminSetCvVerifierRoles(roles: UserRole[]) {
  return request<CvVerifierRoles>('/admin/cv-verifier-roles', {
    method: 'PUT',
    body: JSON.stringify({ roles }),
  })
}

/* ------------------------------------------------------------------ */
/* Notifications                                                      */
/* ------------------------------------------------------------------ */

export function apiMyNotifications() {
  return request<{ notifications: Notification[] }>('/notifications/mine').then(
    (r) => r.notifications,
  )
}

export function apiMarkNotificationRead(id: string) {
  return request<void>(`/notifications/${id}/read`, { method: 'POST' })
}

/* ------------------------------------------------------------------ */
/* Annuaire de confiance                                               */
/* ------------------------------------------------------------------ */

export function apiDirectoryRaw() {
  return request<{ providers: Provider[]; recommendations: Recommendation[]; members: Member[] }>(
    '/directory/raw',
  )
}

export interface CreateProviderPayload {
  authorDisplayName: string
  authorDistrict: string
  name: string
  trade: string
  description: string
  district: string
  city: string
  province: string
  phone: string
  whatsapp?: string
}

export function apiCreateProvider(payload: CreateProviderPayload) {
  return request<{ provider: Provider }>('/directory/providers', {
    method: 'POST',
    body: JSON.stringify(payload),
  }).then((r) => r.provider)
}

export interface CreateRecommendationPayload {
  authorDisplayName: string
  authorDistrict: string
  rating: number
  wouldUseAgain: boolean
  jobLabel: string
  jobDate: string
  pricePaid?: number
  priceUnit?: string
  comment: string
  proof: 'facture' | 'photo' | 'aucune'
}

export function apiCreateRecommendation(providerId: string, payload: CreateRecommendationPayload) {
  return request<{ recommendation: Recommendation }>(
    `/directory/providers/${providerId}/recommendations`,
    { method: 'POST', body: JSON.stringify(payload) },
  )
}

export function apiConfirmRecommendation(recommendationId: string) {
  return request<void>(`/directory/recommendations/${recommendationId}/confirm`, {
    method: 'POST',
  })
}

/* ------------------------------------------------------------------ */
/* IA                                                                  */
/* ------------------------------------------------------------------ */

export function apiAiMatchExplanation(opportunityId: string) {
  return request<{ score: number; reasons: string[]; aiExplanation: string | null; aiUnavailable?: string }>(
    '/ai/match-explanation',
    { method: 'POST', body: JSON.stringify({ opportunityId }) },
  )
}

export function apiAiAssistant(message: string) {
  return request<{ reply: string | null; unavailable?: string }>('/ai/assistant', {
    method: 'POST',
    body: JSON.stringify({ message }),
  })
}

export function apiAiSummarizeProfile() {
  return request<{ summary: string | null; unavailable?: string }>('/ai/summarize-profile', {
    method: 'POST',
  })
}

/* ------------------------------------------------------------------ */
/* Messagerie                                                          */
/* ------------------------------------------------------------------ */

export interface ConversationSummary {
  id: string
  opportunityId: string | null
  otherUser: { id: string; email: string; displayName: string }
  lastMessage: { content: string; createdAt: string } | null
  unreadCount: number
}

export interface ConversationMessage {
  id: string
  senderId: string
  content: string
  createdAt: string
  mine: boolean
}

export function apiMyConversations() {
  return request<{ conversations: ConversationSummary[] }>('/messages/conversations').then(
    (r) => r.conversations,
  )
}

export function apiConversationMessages(conversationId: string) {
  return request<{ messages: ConversationMessage[] }>(
    `/messages/conversations/${conversationId}`,
  ).then((r) => r.messages)
}

export function apiStartConversation(toUserId: string, message: string, opportunityId?: string) {
  return request<{ conversationId: string }>('/messages/conversations', {
    method: 'POST',
    body: JSON.stringify({ toUserId, message, opportunityId }),
  })
}

export function apiSendMessage(conversationId: string, content: string) {
  return request<{ message: ConversationMessage }>(
    `/messages/conversations/${conversationId}/messages`,
    { method: 'POST', body: JSON.stringify({ content }) },
  )
}

/** Espace recruteur : point d'entrée unique pour joindre OffRec, sans avoir
 *  à connaître l'identité d'un compte admin. */
export function apiContactOffrec(message: string) {
  return request<{ conversationId: string }>('/messages/contact-offrec', {
    method: 'POST',
    body: JSON.stringify({ message }),
  })
}

/* ------------------------------------------------------------------ */
/* Abonnements / paiement simulé                                       */
/* ------------------------------------------------------------------ */

export interface SubscriptionPlan {
  code: string
  name: string
  priceAr: number
  maxActiveOpportunities: number | null
  features: string[]
}

export interface Subscription {
  id: string
  recruiterId: string
  planCode: string
  startedAt: string
  plan: SubscriptionPlan
}

export function apiBillingPlans() {
  return request<{ plans: SubscriptionPlan[] }>('/billing/plans').then((r) => r.plans)
}

export function apiMySubscription() {
  return request<{ subscription: Subscription | null }>('/billing/subscription').then(
    (r) => r.subscription,
  )
}

export function apiSubscribe(planCode: string) {
  return request<{ subscription: Subscription }>('/billing/subscribe', {
    method: 'POST',
    body: JSON.stringify({ planCode }),
  }).then((r) => r.subscription)
}

/* ------------------------------------------------------------------ */
/* Agent de terrain (verticale emploi vérifié)                         */
/* ------------------------------------------------------------------ */

export function apiMyTalents() {
  return request<{ talents: TalentProfile[] }>('/agent/talents').then((r) => r.talents)
}

export interface TalentDetail extends TalentProfile {
  verifications: TalentVerification[]
  proposals: { id: string; opportunityId: string; proposedAt: string; opportunity: Opportunity }[]
}

export function apiTalentDetail(id: string) {
  return request<{ talent: TalentDetail }>(`/agent/talents/${id}`).then((r) => r.talent)
}

export interface TalentInput {
  fullName: string
  phone: string
  province: string
  city: string
  gender: 'femme' | 'homme' | 'autre'
  trade: string
  sector: Sector
  skills: string[]
  availability: string
  fromLeadId?: string
  fromSourcingLeadId?: string
}

export function apiCreateTalent(input: TalentInput) {
  return request<{ talent: TalentProfile }>('/agent/talents', {
    method: 'POST',
    body: JSON.stringify(input),
  }).then((r) => r.talent)
}

export function apiUpdateTalent(id: string, input: TalentInput) {
  return request<{ talent: TalentProfile }>(`/agent/talents/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  }).then((r) => r.talent)
}

export function apiVerifyTalent(
  id: string,
  payload: { trade: string; checklist: Record<string, boolean>; note?: string },
) {
  return request<{ verification: TalentVerification }>(`/agent/talents/${id}/verify`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function apiProposeTalent(id: string, opportunityId: string) {
  return request<void>(`/agent/talents/${id}/propose`, {
    method: 'POST',
    body: JSON.stringify({ opportunityId }),
  })
}

export function apiAgentStats() {
  return request<{
    profilesCreated: number
    verificationRate: number
    placements: number
    sourcingLeadsCount: number
  }>('/agent/stats')
}

/**
 * Veille : signaux qu'un agent a repérés en ligne ou sur le terrain — pas
 * un profil ni une offre publiés en soi, juste une piste à vérifier
 * soi-même (§7.3.15). Voir aussi `apiCreateTalent`'s `fromSourcingLeadId`.
 */
export interface SourcingLeadInput {
  type: SourcingLeadType
  source: string
  sourceUrl?: string
  trade: string
  sector: Sector
  province: string
  city: string
  description: string
}

export function apiListSourcingLeads(filters?: { status?: string; type?: string }) {
  const params = new URLSearchParams()
  if (filters?.status) params.set('status', filters.status)
  if (filters?.type) params.set('type', filters.type)
  const qs = params.toString()
  return request<{ leads: SourcingLead[] }>(`/agent/sourcing${qs ? `?${qs}` : ''}`).then((r) => r.leads)
}

export function apiSourcingLeadDetail(id: string) {
  return request<{ lead: SourcingLead }>(`/agent/sourcing/${id}`).then((r) => r.lead)
}

export function apiCreateSourcingLead(input: SourcingLeadInput) {
  return request<{ lead: SourcingLead }>('/agent/sourcing', {
    method: 'POST',
    body: JSON.stringify(input),
  }).then((r) => r.lead)
}

export function apiUpdateSourcingLeadStatus(id: string, status: SourcingLead['status']) {
  return request<{ lead: SourcingLead }>(`/agent/sourcing/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  }).then((r) => r.lead)
}

/**
 * Demande de contact "non-diplômé" — endpoint public, aucun compte requis
 * ni créé (§7.3.14) : un agent reprend la demande depuis /agent/leads.
 */
export interface TalentLeadInput {
  fullName: string
  phone: string
  province: string
  city: string
  gender: 'femme' | 'homme' | 'autre'
  trade: string
  sector: Sector
  message?: string
}

export function apiSubmitTalentLead(input: TalentLeadInput) {
  return request<{ lead: TalentLead }>('/talent-leads', {
    method: 'POST',
    body: JSON.stringify(input),
  }).then((r) => r.lead)
}

export function apiListLeads() {
  return request<{ leads: TalentLead[] }>('/agent/leads').then((r) => r.leads)
}

export function apiLeadDetail(id: string) {
  return request<{ lead: TalentLead }>(`/agent/leads/${id}`).then((r) => r.lead)
}

export function apiUpdateLeadStatus(id: string, status: TalentLead['status']) {
  return request<{ lead: TalentLead }>(`/agent/leads/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  }).then((r) => r.lead)
}

/* ------------------------------------------------------------------ */
/* Compte de suivi (talent non-diplômé)                               */
/* ------------------------------------------------------------------ */

export interface TalentAccountMe {
  fullName: string
  phone: string
  province: string
  city: string
  gender: 'femme' | 'homme' | 'autre'
  lead: TalentLead | null
  talent: TalentDetail | null
}

export function apiTalentAccountMe() {
  return request<{ account: TalentAccountMe }>('/talent-account/me').then((r) => r.account)
}

/* ------------------------------------------------------------------ */
/* Placements et success fee                                          */
/* ------------------------------------------------------------------ */

export interface PlacementInput {
  opportunityId?: string
  candidateId?: string
  talentId?: string
  monthlySalaryAr?: number
}

export function apiCreatePlacement(input: PlacementInput) {
  return request<{ placement: Placement }>('/placements', {
    method: 'POST',
    body: JSON.stringify(input),
  }).then((r) => r.placement)
}

export function apiMyPlacements() {
  return request<{ placements: Placement[] }>('/placements/mine').then((r) => r.placements)
}

export function apiUpdatePlacementStage(id: string, stage: PlacementStage) {
  return request<{ placement: Placement }>(`/placements/${id}/stage`, {
    method: 'PUT',
    body: JSON.stringify({ stage }),
  }).then((r) => r.placement)
}

/** Vue admin : tous les placements, tous recruteurs confondus — le seul
 *  point de contrôle qui existait jusque-là était le compteur agrégé du
 *  tableau de bord. */
export interface AdminPlacement extends Placement {
  opportunity: { id: string; title: string; companyName: string } | null
  recruiter: { id: string; email: string; recruiterProfile: { companyName: string } | null }
  candidate: { id: string; email: string; candidateProfile: { fullName: string } | null } | null
  talent: { id: string; fullName: string } | null
}

export function apiAdminPlacements() {
  return request<{ placements: AdminPlacement[] }>('/placements').then((r) => r.placements)
}

/* ------------------------------------------------------------------ */
/* Admin                                                               */
/* ------------------------------------------------------------------ */

export interface AdminStats {
  users: { candidates: number; recruiters: number; individuals: number; agents: number }
  opportunities: number
  applications: number
  providers: number
  recommendations: number
  members: number
  openReports: number
  revenue: { payingRecruiters: number; totalAr: number; transactionCount: number }
  employment: {
    femalePercent: number
    genderPoolSize: number
    placements: number
    placementsByStage: Record<string, number>
    activePartnerCompanies: number
  }
  recentActivity: {
    id: string
    action: string
    userEmail: string | null
    userRole: string | null
    metadata: Record<string, unknown> | null
    createdAt: string
  }[]
  /** Connexions/déconnexions des 7 derniers jours — résumées, pas listées. */
  recentLoginCount: number
}

export function apiAdminStats() {
  return request<AdminStats>('/admin/stats')
}

export function apiAdminCreateAgent(payload: {
  email: string
  password: string
  agentProfile: Omit<AgentProfile, 'email'>
}) {
  return request<{ agent: { id: string; email: string; agentProfile: AgentProfile } }>(
    '/admin/agents',
    { method: 'POST', body: JSON.stringify(payload) },
  )
}

export type ReportTargetType = 'opportunity' | 'provider' | 'recommendation' | 'user'
export type ModerationActionType = 'dismiss' | 'warning' | 'restriction' | 'suspension' | 'ban'

export function apiCreateReport(targetType: ReportTargetType, targetId: string, reason: string) {
  return request<void>('/reports', {
    method: 'POST',
    body: JSON.stringify({ targetType, targetId, reason }),
  })
}

export interface AdminReport {
  id: string
  targetType: ReportTargetType
  targetId: string
  reason: string
  createdAt: string
  reporterEmail: string
  targetUser: { email: string; role: string; status: string } | null
}

export function apiAdminReports() {
  return request<{ reports: AdminReport[] }>('/admin/reports').then((r) => r.reports)
}

export function apiAdminResolveReport(id: string, action: ModerationActionType, note?: string) {
  return request<void>(`/admin/reports/${id}/resolve`, {
    method: 'POST',
    body: JSON.stringify({ action, note }),
  })
}

export function apiAiSummarizeProvider(providerId: string) {
  return request<{ summary: string | null; unavailable?: string }>(
    `/ai/summarize-provider/${providerId}`,
    { method: 'POST' },
  )
}
