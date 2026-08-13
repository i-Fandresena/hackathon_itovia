import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { SEED_APPLICATIONS, SEED_OPPORTUNITIES, SEED_USERS } from '../data/seed'
import {
  SEED_MEMBERS,
  SEED_PROVIDERS,
  SEED_RECOMMENDATIONS,
} from '../data/seedDirectory'
import { loadJson, saveJson } from '../lib/storage'
import { canRecommend } from '../lib/trust'
import type {
  Application,
  CandidateProfile,
  Member,
  Notification,
  Opportunity,
  Provider,
  Recommendation,
  RecruiterProfile,
  User,
  UserRole,
} from '../types'

interface AppState {
  users: User[]
  opportunities: Opportunity[]
  applications: Application[]
  bookmarks: string[]
  notifications: Notification[]
  members: Member[]
  providers: Provider[]
  recommendations: Recommendation[]
  currentUserId: string | null
  hydrated: boolean
}

/** Champs saisis par le membre ; le reste est dérivé du contexte. */
export type RecommendationInput = Pick<
  Recommendation,
  | 'providerId'
  | 'rating'
  | 'wouldUseAgain'
  | 'jobLabel'
  | 'jobDate'
  | 'comment'
  | 'proof'
> &
  Partial<Pick<Recommendation, 'pricePaid' | 'priceUnit'>> & {
    authorDistrict: string
  }

export type ProviderInput = Omit<
  Provider,
  'id' | 'createdAt' | 'addedByMemberId' | 'claimedByMemberId'
>

interface AppContextValue extends AppState {
  currentUser: User | null
  login: (
    email: string,
    password: string,
  ) => { ok: boolean; error?: string; user?: User }
  logout: () => void
  register: (
    email: string,
    password: string,
    role: UserRole,
    profile: CandidateProfile | RecruiterProfile,
  ) => { ok: boolean; error?: string }
  updateCandidateProfile: (profile: CandidateProfile) => void
  updateRecruiterProfile: (profile: RecruiterProfile) => void
  addOpportunity: (opp: Omit<Opportunity, 'id' | 'createdAt'>) => Opportunity
  updateOpportunity: (id: string, data: Partial<Opportunity>) => void
  deleteOpportunity: (id: string) => void
  toggleBookmark: (opportunityId: string) => void
  isBookmarked: (opportunityId: string) => boolean
  applyToOpportunity: (
    opportunityId: string,
    message?: string,
  ) => { ok: boolean; error?: string }
  hasApplied: (opportunityId: string) => boolean
  getApplicationsForOpportunity: (opportunityId: string) => Application[]
  getApplicationsForRecruiter: (recruiterId: string) => Application[]
  addNotification: (userId: string, title: string, message: string) => void
  markNotificationRead: (id: string) => void
  unreadCount: number

  /** Identité communautaire du compte connecté (porte la réputation). */
  currentMemberId: string | null
  membersById: Map<string, Member>
  getProvider: (id: string) => Provider | undefined
  addProvider: (input: ProviderInput, authorDistrict: string) => Provider | null
  addRecommendation: (input: RecommendationInput) => { ok: boolean; error?: string }
  canRecommendProvider: (providerId: string) => { ok: boolean; error?: string }
  toggleConfirmation: (recommendationId: string) => void
  hasConfirmed: (recommendationId: string) => boolean
}

const AppContext = createContext<AppContextValue | null>(null)

const STORAGE_KEY = 'app_state_v1'

function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function defaultState(): AppState {
  return {
    users: SEED_USERS,
    opportunities: SEED_OPPORTUNITIES,
    applications: SEED_APPLICATIONS,
    bookmarks: [],
    notifications: [],
    members: SEED_MEMBERS,
    providers: SEED_PROVIDERS,
    recommendations: SEED_RECOMMENDATIONS,
    currentUserId: null,
    hydrated: false,
  }
}

/** Un compte utilisateur donne accès à une seule identité communautaire. */
function memberIdFor(userId: string): string {
  return `member-user-${userId}`
}

function displayNameFor(user: User): string {
  const full = user.candidateProfile?.fullName ?? user.recruiterProfile?.companyName
  if (!full) return 'Membre'
  const [first, ...rest] = full.trim().split(/\s+/)
  return rest.length ? `${first} ${rest[rest.length - 1][0]}.` : first
}

/** Le quartier déclaré à la dernière contribution fait foi. */
function upsertMember(members: Member[], user: User, district: string): Member[] {
  const id = memberIdFor(user.id)
  if (members.some((m) => m.id === id)) {
    return members.map((m) => (m.id === id ? { ...m, district } : m))
  }
  return [
    ...members,
    {
      id,
      displayName: displayNameFor(user),
      district,
      city: user.candidateProfile?.city ?? user.recruiterProfile?.city ?? 'Antananarivo',
      joinedAt: user.createdAt,
      phoneVerified: false,
    },
  ]
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(defaultState)

  useEffect(() => {
    const saved = loadJson<Partial<AppState>>(STORAGE_KEY, {})
    setState((prev) => ({
      ...prev,
      users: saved.users?.length ? saved.users : prev.users,
      opportunities: saved.opportunities?.length
        ? saved.opportunities
        : prev.opportunities,
      applications: saved.applications ?? prev.applications,
      bookmarks: saved.bookmarks ?? [],
      notifications: saved.notifications ?? [],
      members: saved.members?.length ? saved.members : prev.members,
      providers: saved.providers?.length ? saved.providers : prev.providers,
      recommendations: saved.recommendations?.length
        ? saved.recommendations
        : prev.recommendations,
      currentUserId: saved.currentUserId ?? null,
      hydrated: true,
    }))
  }, [])

  useEffect(() => {
    if (!state.hydrated) return
    saveJson(STORAGE_KEY, {
      users: state.users,
      opportunities: state.opportunities,
      applications: state.applications,
      bookmarks: state.bookmarks,
      notifications: state.notifications,
      members: state.members,
      providers: state.providers,
      recommendations: state.recommendations,
      currentUserId: state.currentUserId,
    })
  }, [state])

  const currentUser = useMemo(
    () => state.users.find((u) => u.id === state.currentUserId) ?? null,
    [state.users, state.currentUserId],
  )

  const login = useCallback((email: string, password: string) => {
    const user = state.users.find(
      (u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password,
    )
    if (!user) {
      return { ok: false, error: 'Email ou mot de passe incorrect.' }
    }
    setState((s) => ({ ...s, currentUserId: user.id }))
    return { ok: true, user }
  }, [state.users])

  const logout = useCallback(() => {
    setState((s) => ({ ...s, currentUserId: null }))
  }, [])

  const register = useCallback(
    (
      email: string,
      password: string,
      role: UserRole,
      profile: CandidateProfile | RecruiterProfile,
    ) => {
      if (state.users.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
        return { ok: false, error: 'Un compte existe déjà avec cet email.' }
      }
      const user: User = {
        id: uid(),
        email,
        password,
        role,
        createdAt: new Date().toISOString(),
        ...(role === 'candidate'
          ? { candidateProfile: profile as CandidateProfile }
          : { recruiterProfile: profile as RecruiterProfile }),
      }
      setState((s) => ({
        ...s,
        users: [...s.users, user],
        currentUserId: user.id,
      }))
      return { ok: true }
    },
    [state.users],
  )

  const updateCandidateProfile = useCallback(
    (profile: CandidateProfile) => {
      if (!state.currentUserId) return
      setState((s) => ({
        ...s,
        users: s.users.map((u) =>
          u.id === s.currentUserId ? { ...u, candidateProfile: profile } : u,
        ),
      }))
    },
    [state.currentUserId],
  )

  const updateRecruiterProfile = useCallback(
    (profile: RecruiterProfile) => {
      if (!state.currentUserId) return
      setState((s) => ({
        ...s,
        users: s.users.map((u) =>
          u.id === s.currentUserId ? { ...u, recruiterProfile: profile } : u,
        ),
      }))
    },
    [state.currentUserId],
  )

  const addOpportunity = useCallback(
    (data: Omit<Opportunity, 'id' | 'createdAt'>) => {
      const opp: Opportunity = {
        ...data,
        id: uid(),
        createdAt: new Date().toISOString(),
      }
      setState((s) => ({ ...s, opportunities: [opp, ...s.opportunities] }))
      return opp
    },
    [],
  )

  const updateOpportunity = useCallback((id: string, data: Partial<Opportunity>) => {
    setState((s) => ({
      ...s,
      opportunities: s.opportunities.map((o) =>
        o.id === id ? { ...o, ...data } : o,
      ),
    }))
  }, [])

  const deleteOpportunity = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      opportunities: s.opportunities.filter((o) => o.id !== id),
      applications: s.applications.filter((a) => a.opportunityId !== id),
      bookmarks: s.bookmarks.filter((b) => b !== id),
    }))
  }, [])

  const toggleBookmark = useCallback((opportunityId: string) => {
    setState((s) => {
      const has = s.bookmarks.includes(opportunityId)
      return {
        ...s,
        bookmarks: has
          ? s.bookmarks.filter((b) => b !== opportunityId)
          : [...s.bookmarks, opportunityId],
      }
    })
  }, [])

  const isBookmarked = useCallback(
    (opportunityId: string) => state.bookmarks.includes(opportunityId),
    [state.bookmarks],
  )

  const addNotification = useCallback(
    (userId: string, title: string, message: string) => {
      const n: Notification = {
        id: uid(),
        userId,
        title,
        message,
        read: false,
        createdAt: new Date().toISOString(),
      }
      setState((s) => ({ ...s, notifications: [n, ...s.notifications] }))
    },
    [],
  )

  const applyToOpportunity = useCallback(
    (opportunityId: string, message?: string) => {
      const user = state.users.find((u) => u.id === state.currentUserId)
      if (!user?.candidateProfile) {
        return { ok: false, error: 'Profil candidat requis.' }
      }
      if (
        state.applications.some(
          (a) =>
            a.opportunityId === opportunityId && a.candidateId === user.id,
        )
      ) {
        return { ok: false, error: 'Vous avez déjà manifesté votre intérêt.' }
      }
      const app: Application = {
        id: uid(),
        opportunityId,
        candidateId: user.id,
        candidateName: user.candidateProfile.fullName,
        candidateEmail: user.candidateProfile.email,
        candidatePhone: user.candidateProfile.phone,
        candidateProvince: user.candidateProfile.province,
        message,
        createdAt: new Date().toISOString(),
      }
      setState((s) => ({ ...s, applications: [...s.applications, app] }))
      const opp = state.opportunities.find((o) => o.id === opportunityId)
      if (opp) {
        addNotification(
          opp.recruiterId,
          'Nouvelle candidature',
          `${user.candidateProfile.fullName} s’est intéressé·e à « ${opp.title} ».`,
        )
      }
      addNotification(
        user.id,
        'Candidature envoyée',
        `Votre intérêt pour « ${opp?.title ?? 'cette offre'} » a été enregistré.`,
      )
      return { ok: true }
    },
    [state, addNotification],
  )

  const hasApplied = useCallback(
    (opportunityId: string) => {
      if (!state.currentUserId) return false
      return state.applications.some(
        (a) =>
          a.opportunityId === opportunityId &&
          a.candidateId === state.currentUserId,
      )
    },
    [state.applications, state.currentUserId],
  )

  const getApplicationsForOpportunity = useCallback(
    (opportunityId: string) =>
      state.applications.filter((a) => a.opportunityId === opportunityId),
    [state.applications],
  )

  const getApplicationsForRecruiter = useCallback(
    (recruiterId: string) => {
      const oppIds = new Set(
        state.opportunities
          .filter((o) => o.recruiterId === recruiterId)
          .map((o) => o.id),
      )
      return state.applications.filter((a) => oppIds.has(a.opportunityId))
    },
    [state.applications, state.opportunities],
  )

  const markNotificationRead = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      notifications: s.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n,
      ),
    }))
  }, [])

  const unreadCount = useMemo(
    () =>
      state.notifications.filter(
        (n) => n.userId === state.currentUserId && !n.read,
      ).length,
    [state.notifications, state.currentUserId],
  )

  /* ---------------------------------------------------------------------
   * Annuaire de confiance
   * ------------------------------------------------------------------ */

  const currentMemberId = useMemo(
    () => (state.currentUserId ? memberIdFor(state.currentUserId) : null),
    [state.currentUserId],
  )

  const membersById = useMemo(
    () => new Map(state.members.map((m) => [m.id, m])),
    [state.members],
  )

  const getProvider = useCallback(
    (id: string) => state.providers.find((p) => p.id === id),
    [state.providers],
  )

  const canRecommendProvider = useCallback(
    (providerId: string) => {
      if (!currentMemberId) {
        return { ok: false, error: 'Connectez-vous pour publier une recommandation.' }
      }
      const provider = state.providers.find((p) => p.id === providerId)
      if (!provider) return { ok: false, error: 'Prestataire introuvable.' }
      return canRecommend(currentMemberId, provider, state.recommendations)
    },
    [currentMemberId, state.providers, state.recommendations],
  )

  const addProvider = useCallback(
    (input: ProviderInput, authorDistrict: string) => {
      const user = state.users.find((u) => u.id === state.currentUserId)
      if (!user) return null
      const provider: Provider = {
        ...input,
        id: uid(),
        addedByMemberId: memberIdFor(user.id),
        createdAt: new Date().toISOString(),
      }
      setState((s) => ({
        ...s,
        members: upsertMember(s.members, user, authorDistrict),
        providers: [provider, ...s.providers],
      }))
      return provider
    },
    [state.users, state.currentUserId],
  )

  const addRecommendation = useCallback(
    (input: RecommendationInput) => {
      const user = state.users.find((u) => u.id === state.currentUserId)
      if (!user) {
        return { ok: false, error: 'Connectez-vous pour publier une recommandation.' }
      }
      const provider = state.providers.find((p) => p.id === input.providerId)
      if (!provider) return { ok: false, error: 'Prestataire introuvable.' }

      const memberId = memberIdFor(user.id)
      const guard = canRecommend(memberId, provider, state.recommendations)
      if (!guard.ok) return guard

      const rec: Recommendation = {
        id: uid(),
        providerId: input.providerId,
        authorMemberId: memberId,
        authorName: displayNameFor(user),
        authorDistrict: input.authorDistrict,
        rating: input.rating,
        wouldUseAgain: input.wouldUseAgain,
        jobLabel: input.jobLabel,
        jobDate: input.jobDate,
        pricePaid: input.pricePaid,
        priceUnit: input.priceUnit,
        comment: input.comment,
        proof: input.proof,
        confirmations: [],
        createdAt: new Date().toISOString(),
      }

      setState((s) => ({
        ...s,
        members: upsertMember(s.members, user, input.authorDistrict),
        recommendations: [rec, ...s.recommendations],
      }))

      addNotification(
        user.id,
        'Recommandation publiée',
        `Votre retour sur « ${provider.name} » est en ligne.`,
      )
      return { ok: true }
    },
    [state.users, state.currentUserId, state.providers, state.recommendations, addNotification],
  )

  const toggleConfirmation = useCallback(
    (recommendationId: string) => {
      if (!currentMemberId) return
      setState((s) => ({
        ...s,
        recommendations: s.recommendations.map((r) => {
          if (r.id !== recommendationId) return r
          // On ne confirme pas son propre retour.
          if (r.authorMemberId === currentMemberId) return r
          const has = r.confirmations.includes(currentMemberId)
          return {
            ...r,
            confirmations: has
              ? r.confirmations.filter((id) => id !== currentMemberId)
              : [...r.confirmations, currentMemberId],
          }
        }),
      }))
    },
    [currentMemberId],
  )

  const hasConfirmed = useCallback(
    (recommendationId: string) => {
      if (!currentMemberId) return false
      const rec = state.recommendations.find((r) => r.id === recommendationId)
      return !!rec?.confirmations.includes(currentMemberId)
    },
    [currentMemberId, state.recommendations],
  )

  const value: AppContextValue = {
    ...state,
    currentUser,
    login,
    logout,
    register,
    updateCandidateProfile,
    updateRecruiterProfile,
    addOpportunity,
    updateOpportunity,
    deleteOpportunity,
    toggleBookmark,
    isBookmarked,
    applyToOpportunity,
    hasApplied,
    getApplicationsForOpportunity,
    getApplicationsForRecruiter,
    addNotification,
    markNotificationRead,
    unreadCount,
    currentMemberId,
    membersById,
    getProvider,
    addProvider,
    addRecommendation,
    canRecommendProvider,
    toggleConfirmation,
    hasConfirmed,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
