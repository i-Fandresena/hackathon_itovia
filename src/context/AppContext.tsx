import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  ApiError,
  apiAddBookmark,
  apiApplyToOpportunity,
  apiConfirmRecommendation,
  apiCreateOpportunity,
  apiCreateProvider,
  apiCreateRecommendation,
  apiDeleteOpportunity,
  apiDirectoryRaw,
  apiListOpportunities,
  apiLogin,
  apiLogout,
  apiMarkNotificationRead,
  apiMe,
  apiMyApplications,
  apiMyBookmarks,
  apiMyNotifications,
  apiReceivedApplications,
  apiRegister,
  apiRemoveBookmark,
  apiUpdateCandidateProfile,
  apiUpdateOpportunity,
  type ApiUser,
  type CreateProviderPayload,
  type CreateRecommendationPayload,
} from '../lib/api'
import { canRecommend } from '../lib/trust'
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
  TalentAccountProfile,
  User,
  UserRole,
} from '../types'

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

type OpportunityInput = Omit<Opportunity, 'id' | 'createdAt' | 'recruiterId' | 'companyName'>

interface Result {
  ok: boolean
  error?: string
}

interface AppContextValue {
  currentUser: User | null
  opportunities: Opportunity[]
  applications: Application[]
  bookmarks: string[]
  notifications: Notification[]
  members: Member[]
  providers: Provider[]
  recommendations: Recommendation[]
  hydrated: boolean

  login: (email: string, password: string) => Promise<Result & { user?: User }>
  logout: () => Promise<void>
  register: (
    email: string,
    password: string,
    role: UserRole,
    profile: CandidateProfile | RecruiterProfile | IndividualProfile | TalentAccountProfile,
    verificationToken: string,
  ) => Promise<Result>
  updateCandidateProfile: (profile: CandidateProfile) => Promise<Result>
  addOpportunity: (opp: OpportunityInput) => Promise<Result & { opportunity?: Opportunity }>
  updateOpportunity: (id: string, data: OpportunityInput) => Promise<Result>
  deleteOpportunity: (id: string) => Promise<Result>
  toggleBookmark: (opportunityId: string) => Promise<void>
  isBookmarked: (opportunityId: string) => boolean
  applyToOpportunity: (opportunityId: string, message?: string) => Promise<Result>
  hasApplied: (opportunityId: string) => boolean
  getApplicationsForOpportunity: (opportunityId: string) => Application[]
  getApplicationsForRecruiter: (recruiterId: string) => Application[]
  markNotificationRead: (id: string) => Promise<void>
  unreadCount: number

  /** Identité communautaire du compte connecté (porte la réputation). */
  currentMemberId: string | null
  membersById: Map<string, Member>
  getProvider: (id: string) => Provider | undefined
  addProvider: (input: ProviderInput, authorDistrict: string) => Promise<Provider | null>
  addRecommendation: (input: RecommendationInput) => Promise<Result>
  canRecommendProvider: (providerId: string) => Result
  toggleConfirmation: (recommendationId: string) => Promise<void>
  hasConfirmed: (recommendationId: string) => boolean
}

const AppContext = createContext<AppContextValue | null>(null)

function displayNameFor(user: ApiUser): string {
  const full = user.candidateProfile?.fullName ?? user.recruiterProfile?.companyName
  if (!full) return 'Membre'
  const [first, ...rest] = full.trim().split(/\s+/)
  return rest.length ? `${first} ${rest[rest.length - 1][0]}.` : first
}

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<ApiUser | null>(null)
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [applications, setApplications] = useState<Application[]>([])
  const [bookmarks, setBookmarks] = useState<string[]>([])
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [providers, setProviders] = useState<Provider[]>([])
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const [hydrated, setHydrated] = useState(false)

  const loadDirectory = useCallback(async () => {
    const { providers: p, recommendations: r, members: m } = await apiDirectoryRaw()
    setProviders(p)
    setRecommendations(r)
    setMembers(m)
  }, [])

  const loadRoleScopedData = useCallback(async (user: ApiUser | null) => {
    if (!user) {
      setApplications([])
      setBookmarks([])
      setNotifications([])
      return
    }
    if (user.role === 'candidate') {
      const [apps, marks, notifs] = await Promise.all([
        apiMyApplications(),
        apiMyBookmarks(),
        apiMyNotifications(),
      ])
      const profile = user.candidateProfile
      setApplications(
        apps.map((a) => ({
          id: a.id,
          opportunityId: a.opportunityId,
          candidateId: a.candidateId,
          candidateName: profile?.fullName ?? '',
          candidateEmail: profile?.email ?? user.email,
          candidatePhone: profile?.phone ?? '',
          candidateProvince: profile?.province ?? '',
          message: a.message,
          status: a.status,
          createdAt: a.createdAt,
        })),
      )
      setBookmarks(marks)
      setNotifications(notifs)
    } else if (user.role === 'recruiter') {
      const [apps, notifs] = await Promise.all([apiReceivedApplications(), apiMyNotifications()])
      setApplications(apps)
      setBookmarks([])
      setNotifications(notifs)
    } else {
      const notifs = await apiMyNotifications()
      setApplications([])
      setBookmarks([])
      setNotifications(notifs)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    async function init() {
      const [user] = await Promise.all([
        apiMe().catch(() => null),
        apiListOpportunities()
          .then((opps) => !cancelled && setOpportunities(opps))
          .catch(() => undefined),
        loadDirectory().catch(() => undefined),
      ])
      if (cancelled) return
      setCurrentUser(user)
      await loadRoleScopedData(user).catch(() => undefined)
      if (!cancelled) setHydrated(true)
    }
    init()
    return () => {
      cancelled = true
    }
  }, [loadDirectory, loadRoleScopedData])

  const login = useCallback(
    async (email: string, password: string) => {
      try {
        const { user } = await apiLogin(email, password)
        setCurrentUser(user)
        await loadRoleScopedData(user)
        return { ok: true, user }
      } catch (err) {
        return { ok: false, error: errorMessage(err, 'Email ou mot de passe incorrect.') }
      }
    },
    [loadRoleScopedData],
  )

  const logout = useCallback(async () => {
    try {
      await apiLogout()
    } catch {
      // La déconnexion locale doit réussir même si l'appel réseau échoue.
    }
    setCurrentUser(null)
    setApplications([])
    setBookmarks([])
    setNotifications([])
  }, [])

  const register = useCallback(
    async (
      email: string,
      password: string,
      role: UserRole,
      profile: CandidateProfile | RecruiterProfile | IndividualProfile | TalentAccountProfile,
      verificationToken: string,
    ) => {
      try {
        const { user } = await apiRegister({
          email,
          password,
          role,
          verificationToken,
          candidateProfile: role === 'candidate' ? (profile as CandidateProfile) : undefined,
          recruiterProfile: role === 'recruiter' ? (profile as RecruiterProfile) : undefined,
          individualProfile: role === 'particulier' ? (profile as IndividualProfile) : undefined,
          talentAccountProfile: role === 'talent' ? (profile as TalentAccountProfile) : undefined,
        })
        setCurrentUser(user)
        await loadRoleScopedData(user)
        return { ok: true }
      } catch (err) {
        return { ok: false, error: errorMessage(err, 'Un compte existe déjà avec cet email.') }
      }
    },
    [loadRoleScopedData],
  )

  const updateCandidateProfile = useCallback(
    async (profile: CandidateProfile) => {
      try {
        const saved = await apiUpdateCandidateProfile(profile)
        setCurrentUser((u) => (u ? { ...u, candidateProfile: saved } : u))
        return { ok: true }
      } catch (err) {
        return { ok: false, error: errorMessage(err, 'Enregistrement impossible.') }
      }
    },
    [],
  )

  const addOpportunity = useCallback(async (data: OpportunityInput) => {
    try {
      const opportunity = await apiCreateOpportunity(data)
      setOpportunities((s) => [opportunity, ...s])
      return { ok: true, opportunity }
    } catch (err) {
      return { ok: false, error: errorMessage(err, 'Publication impossible.') }
    }
  }, [])

  const updateOpportunity = useCallback(async (id: string, data: OpportunityInput) => {
    try {
      const opportunity = await apiUpdateOpportunity(id, data)
      setOpportunities((s) => s.map((o) => (o.id === id ? opportunity : o)))
      return { ok: true }
    } catch (err) {
      return { ok: false, error: errorMessage(err, 'Modification impossible.') }
    }
  }, [])

  const deleteOpportunity = useCallback(async (id: string) => {
    try {
      await apiDeleteOpportunity(id)
      setOpportunities((s) => s.filter((o) => o.id !== id))
      return { ok: true }
    } catch (err) {
      return { ok: false, error: errorMessage(err, 'Suppression impossible.') }
    }
  }, [])

  const toggleBookmark = useCallback(
    async (opportunityId: string) => {
      const has = bookmarks.includes(opportunityId)
      try {
        if (has) {
          await apiRemoveBookmark(opportunityId)
          setBookmarks((b) => b.filter((id) => id !== opportunityId))
        } else {
          await apiAddBookmark(opportunityId)
          setBookmarks((b) => [...b, opportunityId])
        }
      } catch (err) {
        console.error('toggleBookmark', err)
      }
    },
    [bookmarks],
  )

  const isBookmarked = useCallback(
    (opportunityId: string) => bookmarks.includes(opportunityId),
    [bookmarks],
  )

  const applyToOpportunity = useCallback(
    async (opportunityId: string, message?: string) => {
      try {
        await apiApplyToOpportunity(opportunityId, message)
        await loadRoleScopedData(currentUser)
        return { ok: true }
      } catch (err) {
        return { ok: false, error: errorMessage(err, 'Envoi impossible.') }
      }
    },
    [currentUser, loadRoleScopedData],
  )

  const hasApplied = useCallback(
    (opportunityId: string) => {
      if (!currentUser) return false
      return applications.some(
        (a) => a.opportunityId === opportunityId && a.candidateId === currentUser.id,
      )
    },
    [applications, currentUser],
  )

  const getApplicationsForOpportunity = useCallback(
    (opportunityId: string) => applications.filter((a) => a.opportunityId === opportunityId),
    [applications],
  )

  const getApplicationsForRecruiter = useCallback(
    (recruiterId: string) => {
      const oppIds = new Set(
        opportunities.filter((o) => o.recruiterId === recruiterId).map((o) => o.id),
      )
      return applications.filter((a) => oppIds.has(a.opportunityId))
    },
    [applications, opportunities],
  )

  const markNotificationRead = useCallback(async (id: string) => {
    setNotifications((s) => s.map((n) => (n.id === id ? { ...n, read: true } : n)))
    try {
      await apiMarkNotificationRead(id)
    } catch (err) {
      console.error('markNotificationRead', err)
    }
  }, [])

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications],
  )

  /* ---------------------------------------------------------------------
   * Annuaire de confiance
   * ------------------------------------------------------------------ */

  const currentMemberId = currentUser?.memberId ?? null

  const membersById = useMemo(() => new Map(members.map((m) => [m.id, m])), [members])

  const getProvider = useCallback(
    (id: string) => providers.find((p) => p.id === id),
    [providers],
  )

  const canRecommendProvider = useCallback(
    (providerId: string): Result => {
      if (!currentUser) {
        return { ok: false, error: 'Connectez-vous pour publier une recommandation.' }
      }
      const provider = providers.find((p) => p.id === providerId)
      if (!provider) return { ok: false, error: 'Prestataire introuvable.' }
      if (!currentMemberId) return { ok: true }
      return canRecommend(currentMemberId, provider, recommendations)
    },
    [currentUser, currentMemberId, providers, recommendations],
  )

  const addProvider = useCallback(
    async (input: ProviderInput, authorDistrict: string) => {
      if (!currentUser) return null
      const payload: CreateProviderPayload = {
        ...input,
        authorDisplayName: displayNameFor(currentUser),
        authorDistrict,
      }
      try {
        const provider = await apiCreateProvider(payload)
        await loadDirectory()
        return provider
      } catch (err) {
        console.error('addProvider', err)
        return null
      }
    },
    [currentUser, loadDirectory],
  )

  const addRecommendation = useCallback(
    async (input: RecommendationInput) => {
      if (!currentUser) {
        return { ok: false, error: 'Connectez-vous pour publier une recommandation.' }
      }
      const payload: CreateRecommendationPayload = {
        authorDisplayName: displayNameFor(currentUser),
        authorDistrict: input.authorDistrict,
        rating: input.rating,
        wouldUseAgain: input.wouldUseAgain,
        jobLabel: input.jobLabel,
        jobDate: input.jobDate,
        pricePaid: input.pricePaid,
        priceUnit: input.priceUnit,
        comment: input.comment,
        proof: input.proof,
      }
      try {
        await apiCreateRecommendation(input.providerId, payload)
        await loadDirectory()
        return { ok: true }
      } catch (err) {
        return { ok: false, error: errorMessage(err, 'Publication impossible.') }
      }
    },
    [currentUser, loadDirectory],
  )

  const toggleConfirmation = useCallback(
    async (recommendationId: string) => {
      if (!currentUser) return
      const rec = recommendations.find((r) => r.id === recommendationId)
      if (!rec || rec.authorMemberId === currentMemberId) return
      try {
        await apiConfirmRecommendation(recommendationId)
        await loadDirectory()
      } catch (err) {
        console.error('toggleConfirmation', err)
      }
    },
    [currentUser, currentMemberId, recommendations, loadDirectory],
  )

  const hasConfirmed = useCallback(
    (recommendationId: string) => {
      if (!currentMemberId) return false
      const rec = recommendations.find((r) => r.id === recommendationId)
      return !!rec?.confirmations.includes(currentMemberId)
    },
    [currentMemberId, recommendations],
  )

  const value: AppContextValue = {
    currentUser,
    opportunities,
    applications,
    bookmarks,
    notifications,
    members,
    providers,
    recommendations,
    hydrated,
    login,
    logout,
    register,
    updateCandidateProfile,
    addOpportunity,
    updateOpportunity,
    deleteOpportunity,
    toggleBookmark,
    isBookmarked,
    applyToOpportunity,
    hasApplied,
    getApplicationsForOpportunity,
    getApplicationsForRecruiter,
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
