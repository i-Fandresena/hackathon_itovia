import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  ApiError,
  apiConfirmRecommendation,
  apiCreateOpportunity,
  apiCreateProvider,
  apiCreateRecommendation,
  apiDeleteOpportunity,
  apiDirectoryRaw,
  apiDeclineSuggestion,
  apiExpressInterest,
  apiListOpportunities,
  apiLogin,
  apiLogout,
  apiMarkAllNotificationsRead,
  apiMarkNotificationRead,
  apiMe,
  apiMyNotifications,
  apiMySuggestions,
  apiReceivedSuggestions,
  apiRegister,
  apiUpdateCandidateProfile,
  apiUpdateOpportunity,
  type ApiUser,
  type CreateProviderPayload,
  type CreateRecommendationPayload,
  type MatchSuggestionWithOpportunity,
  type ReceivedSuggestion,
} from '../lib/api'
import { canRecommend } from '../lib/trust'
import type {
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
  /** Dossiers du candidat : uniquement ceux réellement transmis à une
   *  entreprise (plus les lignes héritées de l'ancien parcours). */
  mySuggestions: MatchSuggestionWithOpportunity[]
  /** Côté recruteur : candidats transmis par OffRec sur ses offres. */
  receivedSuggestions: ReceivedSuggestion[]
  /** Le dernier chargement des dossiers et notifications du compte a échoué
   *  (les données affichées sont alors celles du dernier chargement réussi,
   *  ou vides). Repasse à `false` au prochain chargement réussi. */
  dossiersLoadFailed: boolean
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
  /** Reporte dans `currentUser` des champs du profil candidat déjà
   *  enregistrés par le serveur (dépôt de CV, consentement de matching) —
   *  aucun appel réseau. */
  patchCandidateProfile: (patch: Partial<CandidateProfile>) => void
  addOpportunity: (opp: OpportunityInput) => Promise<Result & { opportunity?: Opportunity }>
  updateOpportunity: (id: string, data: OpportunityInput) => Promise<Result>
  deleteOpportunity: (id: string) => Promise<Result>
  /** Intérêt sans date : uniquement une ligne héritée `proposee_candidat`
   *  côté candidat. Le recruteur passe par un entretien
   *  (`apiScheduleInterview`, décision 2026-10-14). */
  expressInterest: (suggestionId: string) => Promise<Result>
  /** Recharge les dossiers du compte (`mySuggestions` / `receivedSuggestions`)
   *  et ses notifications, après une action sur un entretien. */
  refreshDossiers: () => Promise<void>
  declineSuggestion: (suggestionId: string) => Promise<Result>
  getSuggestionForOpportunity: (opportunityId: string) => MatchSuggestionWithOpportunity | undefined
  markNotificationRead: (id: string) => Promise<void>
  /** Un seul appel serveur, quel que soit le nombre de notifications. */
  markAllNotificationsRead: () => Promise<void>
  /** Recharge les notifications du compte (ouverture d'une page Notifications). */
  refreshNotifications: () => Promise<void>
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
  const [mySuggestions, setMySuggestions] = useState<MatchSuggestionWithOpportunity[]>([])
  const [receivedSuggestions, setReceivedSuggestions] = useState<ReceivedSuggestion[]>([])
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [providers, setProviders] = useState<Provider[]>([])
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const [hydrated, setHydrated] = useState(false)
  const [dossiersLoadFailed, setDossiersLoadFailed] = useState(false)

  const loadDirectory = useCallback(async () => {
    const { providers: p, recommendations: r, members: m } = await apiDirectoryRaw()
    setProviders(p)
    setRecommendations(r)
    setMembers(m)
  }, [])

  /** Charge les dossiers et notifications du compte ; mémorise l'échec dans
   *  `dossiersLoadFailed` puis relance l'erreur (les appelants gardent leur
   *  propre traitement). */
  const loadRoleScopedData = useCallback(async (user: ApiUser | null) => {
    try {
      await fetchRoleScopedData(user)
      setDossiersLoadFailed(false)
    } catch (err) {
      setDossiersLoadFailed(true)
      throw err
    }
  }, [])

  /** N'utilise que des setters d'état (stables) : la version capturée par
   *  `loadRoleScopedData` reste valable. */
  async function fetchRoleScopedData(user: ApiUser | null) {
    if (!user) {
      setMySuggestions([])
      setReceivedSuggestions([])
      setNotifications([])
      return
    }
    if (user.role === 'candidate') {
      const [suggestions, notifs] = await Promise.all([apiMySuggestions(), apiMyNotifications()])
      setMySuggestions(suggestions)
      setReceivedSuggestions([])
      setNotifications(notifs)
    } else if (user.role === 'recruiter') {
      const [suggestions, notifs] = await Promise.all([apiReceivedSuggestions(), apiMyNotifications()])
      setMySuggestions([])
      setReceivedSuggestions(suggestions)
      setNotifications(notifs)
    } else {
      const notifs = await apiMyNotifications()
      setMySuggestions([])
      setReceivedSuggestions([])
      setNotifications(notifs)
    }
  }

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

  // Retour sur l'onglet : on recharge notifications et dossiers, pour qu'une
  // mise en relation confirmée entre-temps apparaisse sans reconnexion. Pas
  // de polling — au plus un rechargement toutes les 15 s.
  const lastRefreshRef = useRef(0)
  useEffect(() => {
    if (!currentUser) return
    const refresh = () => {
      if (document.visibilityState !== 'visible') return
      const now = Date.now()
      if (now - lastRefreshRef.current < 15_000) return
      lastRefreshRef.current = now
      loadRoleScopedData(currentUser).catch(() => undefined)
    }
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [currentUser, loadRoleScopedData])

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
    setMySuggestions([])
    setReceivedSuggestions([])
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

  const patchCandidateProfile = useCallback((patch: Partial<CandidateProfile>) => {
    setCurrentUser((u) =>
      u?.candidateProfile ? { ...u, candidateProfile: { ...u.candidateProfile, ...patch } } : u,
    )
  }, [])

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

  const expressInterest = useCallback(
    async (suggestionId: string) => {
      try {
        await apiExpressInterest(suggestionId)
        await loadRoleScopedData(currentUser)
        return { ok: true }
      } catch (err) {
        return { ok: false, error: errorMessage(err, 'Envoi impossible.') }
      }
    },
    [currentUser, loadRoleScopedData],
  )

  /** Désélectionne le profil (sort de la liste) — décision journalisée
   *  pour le suivi admin. */
  const declineSuggestion = useCallback(
    async (suggestionId: string) => {
      try {
        await apiDeclineSuggestion(suggestionId)
        await loadRoleScopedData(currentUser)
        return { ok: true }
      } catch (err) {
        return { ok: false, error: errorMessage(err, 'Envoi impossible.') }
      }
    },
    [currentUser, loadRoleScopedData],
  )

  const refreshDossiers = useCallback(async () => {
    try {
      await loadRoleScopedData(currentUser)
    } catch {
      // Les données affichées restent celles du dernier chargement réussi.
    }
  }, [currentUser, loadRoleScopedData])

  const getSuggestionForOpportunity = useCallback(
    (opportunityId: string) => mySuggestions.find((s) => s.opportunityId === opportunityId),
    [mySuggestions],
  )

  const markNotificationRead = useCallback(async (id: string) => {
    setNotifications((s) => s.map((n) => (n.id === id ? { ...n, read: true } : n)))
    try {
      await apiMarkNotificationRead(id)
    } catch (err) {
      console.error('markNotificationRead', err)
    }
  }, [])

  const refreshNotifications = useCallback(async () => {
    try {
      setNotifications(await apiMyNotifications())
    } catch (err) {
      console.error('refreshNotifications', err)
    }
  }, [])

  const markAllNotificationsRead = useCallback(async () => {
    setNotifications((s) => s.map((n) => (n.read ? n : { ...n, read: true })))
    try {
      await apiMarkAllNotificationsRead()
    } catch (err) {
      console.error('markAllNotificationsRead', err)
      // L'état affiché ne doit pas mentir si le serveur a refusé.
      await refreshNotifications()
    }
  }, [refreshNotifications])

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
    mySuggestions,
    receivedSuggestions,
    dossiersLoadFailed,
    notifications,
    members,
    providers,
    recommendations,
    hydrated,
    login,
    logout,
    register,
    updateCandidateProfile,
    patchCandidateProfile,
    addOpportunity,
    updateOpportunity,
    deleteOpportunity,
    expressInterest,
    refreshDossiers,
    declineSuggestion,
    getSuggestionForOpportunity,
    markNotificationRead,
    markAllNotificationsRead,
    refreshNotifications,
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
