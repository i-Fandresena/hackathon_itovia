import type {
  Application,
  CandidateProfile,
  IndividualProfile,
  Member,
  Notification,
  Opportunity,
  Provider,
  Recommendation,
  RecruiterProfile,
  User,
  UserRole,
} from '../types/index.js'

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:4000/api'

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
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
    throw new ApiError(body?.error ?? `Erreur ${res.status}`, res.status)
  }
  return body as T
}

/* ------------------------------------------------------------------ */
/* Auth                                                                */
/* ------------------------------------------------------------------ */

export type ApiUser = User & { memberId: string | null }

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
  candidateProfile?: CandidateProfile
  recruiterProfile?: RecruiterProfile
  individualProfile?: IndividualProfile
}) {
  return request<{ user: ApiUser }>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
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

export function apiApplyToOpportunity(id: string, message?: string) {
  return request<{ application: Application }>(`/opportunities/${id}/apply`, {
    method: 'POST',
    body: JSON.stringify({ message }),
  })
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

export interface MyApplicationRaw {
  id: string
  opportunityId: string
  candidateId: string
  message?: string
  createdAt: string
  opportunity: Opportunity
}

export function apiMyApplications() {
  return request<{ applications: MyApplicationRaw[] }>('/applications/mine').then(
    (r) => r.applications,
  )
}

export function apiReceivedApplications() {
  return request<{ applications: Application[] }>('/applications/received').then(
    (r) => r.applications,
  )
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
/* Admin                                                               */
/* ------------------------------------------------------------------ */

export interface AdminStats {
  users: { candidates: number; recruiters: number; individuals: number }
  opportunities: number
  applications: number
  providers: number
  recommendations: number
  members: number
  openReports: number
  revenue: { payingRecruiters: number; totalAr: number; transactionCount: number }
  recentActivity: {
    id: string
    action: string
    userEmail: string | null
    userRole: string | null
    createdAt: string
  }[]
}

export function apiAdminStats() {
  return request<AdminStats>('/admin/stats')
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
