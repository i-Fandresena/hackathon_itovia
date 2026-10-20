import type {
  AdminInterview,
  ContractType,
  HireDeclineReason,
  HireProposalStatus,
  Interview,
  InterviewDuration,
  InterviewPeriod,
  InterviewResult,
  InterviewResultReason,
  InterviewStatus,
  CompanyRelation,
  LinkedCompanySummary,
  PublicCompany,
  AgentProfile,
  ContactRequestStatus,
  PublicTalent,
  PublicVisibilityState,
  Availability,
  CandidateProfile,
  CvFlag,
  CvVerificationStatus,
  EndorsementRelation,
  EducationLevel,
  ExperienceLevel,
  Gender,
  IndividualProfile,
  Notification,
  Member,
  MatchFit,
  MatchSuggestion,
  MatchSuggestionOrigin,
  MatchSuggestionStatus,
  Opportunity,
  OpportunityType,
  Placement,
  PlacementOrigin,
  PlacementStage,
  PreselectionFilters,
  PreselectionResult,
  PreselectionTop,
  PreselectionTransmitOutcome,
  ProofType,
  Provider,
  Recommendation,
  RecruiterProfile,
  Sector,
  SourcingLead,
  SourcingLeadType,
  SubjectTrust,
  TalentStatus,
  TrustLevel,
  TalentAccountProfile,
  TalentLead,
  TalentProfile,
  TalentSignalStatus,
  TalentVerification,
  User,
  UserRole,
} from '../types/index.js'
import type {
  CandidateHiringPhase,
  HireProposalFields,
  HireProposalView,
  HiringPhase,
  InterviewOutcomeFilter,
  RoundOutcomeView,
} from './hiring.js'

/** Placement lié à un dossier diplômé (sous-lot 5) : jamais le salaire ni les personnes. */
export interface DossierPlacement {
  id: string
  stage: PlacementStage
  origin: PlacementOrigin
  /** Jour civil AAAA-MM-JJ, ou `null`. */
  startDate: string | null
}

/** Champs « flux d'embauche » d'un placement (sous-lot 5) — absents d'un serveur plus ancien. */
export interface PlacementHiringFields {
  origin?: PlacementOrigin
  suggestionId?: string | null
  hireProposalId?: string | null
  jobTitle?: string | null
  /** Jour civil AAAA-MM-JJ (vue recruteur) ou date ISO (vue admin). */
  startDate?: string | null
  contractType?: ContractType | null
}

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

/** Offre du recruteur (« Mes offres ») : + `activePlacements`, placements
 *  non annulés liés à l'offre (« n / positions pourvus », D1). */
export type RecruiterOpportunity = Opportunity & { applicationCount?: number; activePlacements: number }

/** Recruteur : ses offres, pourvues comprises (sous-lot 5). */
export function apiMyOpportunities() {
  return request<{ opportunities: RecruiterOpportunity[] }>('/opportunities/mine').then((r) => r.opportunities)
}

/** « Marquer comme pourvue » (embauche faite hors OffRec) : les autres
 *  dossiers de l'offre sont clos dans la même transaction (profils transmis
 *  écartés, entretiens à venir annulés, propositions en attente retirées) et
 *  leurs candidats informés par un message neutre. 404 hors de ses offres,
 *  409 déjà pourvue, 503 suite non activée. */
export function apiMarkOpportunityFilled(id: string) {
  return request<{ opportunity: RecruiterOpportunity }>(`/opportunities/${id}/filled`, { method: 'POST' }).then(
    (r) => r.opportunity,
  )
}

/** « Rouvrir » une offre pourvue : au moins un poste libre (`positions`
 *  facultatif, sinon max(postes actuels, placements + 1)). Les dossiers clos
 *  ne sont pas réactivés. 400 nombre invalide, 409 pas pourvue. */
export function apiReopenOpportunity(id: string, positions?: number) {
  return request<{ opportunity: RecruiterOpportunity }>(`/opportunities/${id}/filled`, {
    method: 'DELETE',
    body: JSON.stringify(positions === undefined ? {} : { positions }),
  }).then((r) => r.opportunity)
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

/** Candidat diplômé transmis par OffRec, vu par le recruteur : le nom
 *  seulement — ni email ni téléphone (OffRec reste l'intermédiaire). */
export interface ShortlistMatched {
  source: 'matche_ia'
  suggestionId: string
  candidateId: string
  fullName: string
  status: MatchSuggestionStatus
  match: { score: number; reasons: string[] }
}

/** Recommandation d'un talent telle que la voit le recruteur : ni
 *  commentaire, ni nom d'auteur, ni photo, ni contact. */
export interface RecruiterEndorsement {
  id: string
  /** « Un client · Itaosy » : relation et quartier, jamais un nom. */
  authorLabel: string
  relation: EndorsementRelation
  /** Seulement si l'agent l'a revu et ne l'a pas masqué. */
  jobLabel: string | null
  jobDate: string
  highlights: string[]
  proofVerified: boolean
  createdAt: string
}

/** Dernière vérification de grille par l'agent. */
export interface VerificationSummary {
  verifiedAt: string
  trade: string
  validated: number
  total: number
}

export interface ShortlistProposed {
  source: 'verifie_humain'
  talentId: string
  fullName: string
  trade: string
  city: string
  district: string | null
  status: TalentStatus
  proposedAt: string
  /** « Adéquation à l'offre » (scoreOpportunity) — jamais additionnée à la confiance. */
  match: { score: number; reasons: string[] }
  /** « Confiance » calculée par le serveur à partir des recommandations. */
  trust: SubjectTrust
  verification: VerificationSummary | null
  endorsements: RecruiterEndorsement[]
}

export interface Shortlist {
  /** Offre de la shortlist (titre pour la modale d'entretien). */
  opportunity: { id: string; title: string }
  matched: ShortlistMatched[]
  proposed: ShortlistProposed[]
}

export function apiShortlist(opportunityId: string) {
  return request<Shortlist>(`/opportunities/${opportunityId}/shortlist`)
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

/** Tour d'entretien vu par le candidat : jamais l'issue, le motif ni la
 *  note ; son explication d'absence et `canExplainAbsence` (sous-lot 3). */
export type CandidateInterview = Interview & RoundOutcomeView

/** Tour vu par le recruteur propriétaire de l'offre : + issue et motif ; la
 *  note privée seulement s'il en est l'auteur ; jamais l'explication
 *  d'absence du candidat (décision D3). */
export type RecruiterInterview = Interview & RoundOutcomeView

/** Tour vu par l'admin : + agenda, issue, motif, explication d'absence ;
 *  jamais la note privée du recruteur. */
export type AdminRoundInterview = AdminInterview & RoundOutcomeView

export interface MatchSuggestionWithOpportunity extends MatchSuggestion {
  opportunity: CandidateSuggestionOpportunity
  /** Entretien fixé par le recruteur — uniquement à partir de
   *  `mise_en_relation` (tour actif, sinon le dernier) ; `null`/absent sinon. */
  interview?: CandidateInterview | null
  /** Tous les tours, triés (sous-lot 3) ; `[]` avant la mise en relation. */
  interviews?: CandidateInterview[]
  /** Phase neutre du dossier (`candidateHiringPhase`) ; `null` avant la mise
   *  en relation ou si la suite après l'entretien n'est pas activée. */
  candidatePhase?: CandidateHiringPhase | null
  /** Dernière proposition d'embauche (sous-lot 5, vue candidat : jamais la
   *  raison d'un retrait) ; `id` + `revision` servent à l'acceptation. */
  proposal?: HireProposalView | null
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
  /** `createdAt` : date de publication de l'offre (ISO) — absente si le
   *  serveur est plus ancien. */
  opportunity: { id: string; title: string; createdAt?: string }
  /** Adéquation critère par critère avec l'offre du recruteur — `null` si le
   *  profil candidat est introuvable, absent si le serveur est plus ancien. */
  fit?: MatchFit | null
  /** Rang dans la présélection OffRec au moment de la transmission, s'il a
   *  été enregistré. */
  preselectionRank?: number | null
  /** Entretien fixé (dossier `mise_en_relation`) : tour actif, sinon le
   *  dernier ; `null`/absent sinon. */
  interview?: RecruiterInterview | null
  /** Tous les tours, triés, avec leur issue (sous-lot 3). */
  interviews?: RecruiterInterview[]
  /** Tour actif (sans issue), `null` s'il n'y en a pas. */
  activeInterview?: RecruiterInterview | null
  /** Phase dérivée du dossier (`hiringPhase`), `null` hors `mise_en_relation`. */
  phase?: HiringPhase | null
  /** Propositions d'embauche, toutes versions (sous-lot 5, vue recruteur :
   *  catégorie d'un refus, jamais sa précision). */
  proposals?: HireProposalView[]
  /** Dernière proposition, ou `null`. */
  proposal?: HireProposalView | null
  /** Placement lié au dossier, ou `null`. */
  placement?: DossierPlacement | null
  /** Le serveur ne transmet au recruteur qu'une liste blanche du profil :
   *  ni email, ni téléphone, ni CV, ni statut de vérification du CV. */
  candidate: {
    id: string
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

/** Intérêt sans date — candidat uniquement, sur une ligne héritée
 *  `proposee_candidat` (400 sinon). Côté recruteur, l'intérêt sans date est
 *  retiré (400) : « Ce profil m'intéresse » fixe un entretien
 *  (`apiScheduleInterview`, décision 2026-10-14). */
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
/* Entretiens (décision produit 2026-10-14)                            */
/* ------------------------------------------------------------------ */

export interface InterviewInput {
  /** Instant ISO avec fuseau — l'heure de Madagascar avec `+03:00`
   *  (`madagascarInputsToIso`, src/lib/interview.ts). */
  scheduledAt: string
  durationMinutes: InterviewDuration
  message?: string | null
}

/** « Ce profil m'intéresse » : le recruteur fixe l'entretien, ce qui met
 *  directement en relation et notifie le candidat (plateforme + email).
 *  403 hors de ses offres ; 409 sans accord du candidat, compte inactif ou
 *  entretien déjà fixé ; 400 date hors fenêtre (2 h à 60 jours). */
export function apiScheduleInterview(suggestionId: string, input: InterviewInput) {
  return request<{ suggestion: MatchSuggestion; interview: Interview }>(
    `/match-suggestions/${suggestionId}/interview`,
    { method: 'POST', body: JSON.stringify(input) },
  )
}

/** Reprogrammer : l'entretien repart à « en attente de confirmation ». */
export function apiRescheduleInterview(suggestionId: string, input: InterviewInput) {
  return request<{ interview: Interview }>(`/match-suggestions/${suggestionId}/interview`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}

/** Annuler l'entretien — la mise en relation reste acquise. */
export function apiCancelInterview(suggestionId: string) {
  return request<{ interview: Interview }>(`/match-suggestions/${suggestionId}/interview/cancel`, {
    method: 'POST',
  })
}

/** Candidat : confirmer sa présence. */
export function apiConfirmInterview(suggestionId: string) {
  return request<{ interview: Interview }>(`/match-suggestions/${suggestionId}/interview/confirm`, {
    method: 'POST',
  })
}

/** Candidat : signaler un empêchement (motif court, sans coordonnées). */
export function apiReportInterviewUnavailable(suggestionId: string, reason: string) {
  return request<{ interview: Interview }>(`/match-suggestions/${suggestionId}/interview/unavailable`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  })
}

/** Admin : relancer la synchronisation de l'agenda Google d'un entretien.
 *  409 en mode simulé, 502 si Google échoue encore. */
export function apiAdminResyncInterview(interviewId: string) {
  return request<{ interview: AdminInterview }>(`/admin/matching/interviews/${interviewId}/calendar-sync`, {
    method: 'POST',
  })
}

/* ------------------------------------------------------------------ */
/* Après l'entretien : issue et tours (plan du 2026-10-16, sous-lot 3) */
/* ------------------------------------------------------------------ */

export interface InterviewOutcomeInput {
  /** Tour actif visé (404 s'il n'est plus actif, 409 si l'issue est déjà posée). */
  interviewId: string
  result: InterviewResult
  /** Liste fermée (`reasonsForResult`) : obligatoire pour `non_retenu`,
   *  `points_forts` facultatif pour `retenu` / `second_entretien`, aucun pour `absent`. */
  reason?: InterviewResultReason
  /** Note privée : relue par son seul auteur, jamais transmise au candidat. */
  note?: string
  /** Date du tour suivant, seulement avec `second_entretien`. */
  nextRound?: InterviewInput
}

export interface InterviewOutcomeResult {
  interview: RecruiterInterview
  /** Tour suivant créé dans la même transaction (`nextRound`), sinon `null`. */
  nextInterview: RecruiterInterview | null
  phase: HiringPhase | null
}

/** Recruteur : issue du tour actif, après son heure de fin. 400 avant la
 *  fin, sur un tour annulé ou en empêchement, ou au-delà de 3 tours ; 404
 *  tour non actif ; 409 issue déjà renseignée, accord retiré, compte
 *  inactif, offre pourvue ; 503 suite non activée. */
export function apiRecordInterviewOutcome(suggestionId: string, input: InterviewOutcomeInput) {
  return request<InterviewOutcomeResult>(`/match-suggestions/${suggestionId}/interview/outcome`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

/** Candidat : expliquer son absence (3 à 300 caractères, sans coordonnées),
 *  une fois par tour ; lue par les admins seuls. 409 « Vous avez déjà répondu. » */
export function apiReplyAbsence(suggestionId: string, interviewId: string, reason: string) {
  return request<{ interview: CandidateInterview }>(`/match-suggestions/${suggestionId}/interview/absence-reply`, {
    method: 'POST',
    body: JSON.stringify({ interviewId, reason }),
  })
}

/** Admin : annuler l'issue d'un tour (erreur de saisie) tant que rien n'en
 *  découle. 409 « Une suite existe déjà (tour suivant ou proposition). » */
export function apiAdminResetOutcome(interviewId: string) {
  return request<{ interview: AdminRoundInterview; phase: HiringPhase | null }>(
    `/admin/matching/interviews/${interviewId}/outcome/reset`,
    { method: 'POST' },
  )
}

export interface HiringJobsReport {
  /** Rappels « issue à renseigner » envoyés par ce passage. */
  outcomeReminders: number
  /** Issues en souffrance depuis plus de 7 jours. */
  overdueOutcomes: number
  /** Le résumé quotidien aux admins est parti à ce passage. */
  digestSent: boolean
}

/** Admin : lance à la demande les rappels « après l'entretien » (idempotent). */
export function apiAdminRunHiringJobs() {
  return request<{ report: HiringJobsReport }>('/admin/matching/hiring-jobs/run', { method: 'POST' })
}

/* ------------------------------------------------------------------ */
/* Propositions d'embauche (serveur : sous-lot 5 ; UI : sous-lot 6)     */
/* ------------------------------------------------------------------ */

/** Champs d'une proposition : jour civil AAAA-MM-JJ (Madagascar) pour
 *  `startDate`, salaire mensuel brut en Ariary (entier), durée en mois
 *  (obligatoire pour un CDD ou un stage, interdite pour un CDI), message
 *  sans coordonnées. */
export type HireProposalInput = HireProposalFields

/** Modification : champs modifiés seulement ; `null` efface la durée ou le message. */
export type HireProposalChangesInput = { [K in keyof HireProposalInput]?: HireProposalInput[K] | null }

/** Réponse au recruteur : la proposition (vue recruteur) et la phase du dossier. */
export interface HireProposalResult {
  proposal: HireProposalView
  phase: HiringPhase | null
}

/** Recruteur : envoyer une proposition après un dernier tour « Retenu ».
 *  201 ; 400 hors « Retenu » ou validation ; 409 proposition déjà en
 *  attente, réponse définitive, 3 versions atteintes, offre pourvue, accord
 *  retiré ou compte inactif ; 503 suite non activée. Échéance : 7 jours. */
export function apiSendHireProposal(suggestionId: string, input: HireProposalInput) {
  return request<HireProposalResult>(`/match-suggestions/${suggestionId}/hire-proposal`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

/** Recruteur : modifier la proposition en attente avec la `revision` lue.
 *  409 si elle a changé entre-temps (réponse, expiration, autre
 *  modification) : recharger puis ré-afficher. Le délai de 7 jours repart. */
export function apiReviseHireProposal(suggestionId: string, revision: number, changes: HireProposalChangesInput) {
  return request<HireProposalResult>(`/match-suggestions/${suggestionId}/hire-proposal`, {
    method: 'PATCH',
    body: JSON.stringify({ ...changes, revision }),
  })
}

/** Recruteur : retirer la proposition en attente (`revision` lue ; motif
 *  enregistré « Retirée par l'entreprise »). 409 si elle a changé. */
export function apiWithdrawHireProposal(suggestionId: string, revision: number) {
  return request<HireProposalResult>(`/match-suggestions/${suggestionId}/hire-proposal/withdraw`, {
    method: 'POST',
    body: JSON.stringify({ revision }),
  })
}

/** Candidat : accepter la révision AFFICHÉE (`proposalId` + `revision`) ;
 *  le placement est créé dans la même transaction. 409 proposition
 *  modifiée (relire la nouvelle version), expirée, retirée, déjà répondue,
 *  poste pourvu ou compte inactif ; 404 pas son dossier. */
export function apiAcceptHireProposal(suggestionId: string, proposalId: string, revision: number) {
  return request<{ proposal: HireProposalView; placementCreated: boolean; candidatePhase: CandidateHiringPhase | null }>(
    `/match-suggestions/${suggestionId}/hire-proposal/accept`,
    { method: 'POST', body: JSON.stringify({ proposalId, revision }) },
  )
}

/** Candidat : décliner, avec une catégorie facultative (montrée au
 *  recruteur) et une précision facultative (lue par OffRec seulement). */
export function apiDeclineHireProposal(
  suggestionId: string,
  input: { proposalId: string; revision: number; reason?: HireDeclineReason; note?: string },
) {
  return request<{ proposal: HireProposalView; candidatePhase: CandidateHiringPhase | null }>(
    `/match-suggestions/${suggestionId}/hire-proposal/decline`,
    { method: 'POST', body: JSON.stringify(input) },
  )
}

/** Ligne de l'onglet admin « Propositions » (vue admin : catégorie ET
 *  précision d'un refus, raison d'un retrait ; jamais l'auteur). */
export interface AdminHireProposalItem {
  proposal: HireProposalView
  suggestionId: string
  opportunity: { id: string; title: string; companyName: string }
  candidate: { id: string; fullName: string | null }
  phase: HiringPhase | null
}

/** Admin : propositions de la plateforme (`status` effectif : une
 *  proposition échue compte comme `expiree`), en attente d'abord par
 *  échéance, puis les plus récentes ; 200 au plus. */
export function apiAdminHireProposals(status?: HireProposalStatus) {
  return request<{ proposals: AdminHireProposalItem[] }>(
    `/admin/matching/hire-proposals${status ? `?status=${status}` : ''}`,
  ).then((r) => r.proposals)
}

/* ------------------------------------------------------------------ */
/* Onglets « Entretiens » (recruteur, admin)                           */
/* ------------------------------------------------------------------ */

export interface InterviewListFilters {
  period: InterviewPeriod
  status?: InterviewStatus
  opportunityId?: string
  /** Filtre « Issue » : `a_renseigner` ou une issue posée (sous-lot 3). */
  outcome?: InterviewOutcomeFilter
}

export interface RecruiterInterviewItem {
  interview: RecruiterInterview
  suggestionId: string
  opportunity: { id: string; title: string }
  /** Seul élément du profil transmis : le nom (ni email ni téléphone). */
  candidate: { fullName: string | null }
  /** Phase dérivée du dossier (sous-lot 3). */
  phase?: HiringPhase | null
  /** Dernière proposition d'embauche du dossier (sous-lot 5). */
  proposal?: HireProposalView | null
}

export interface InterviewOfferSummary {
  id: string
  title: string
  total: number
  upcoming: number
  /** Empêchements signalés, à reprogrammer ou annuler. */
  toHandle: number
  /** Issues à renseigner (sous-lot 3). */
  toRecord?: number
}

export interface RecruiterInterviewList {
  interviews: RecruiterInterviewItem[]
  /** Offres ayant au moins un entretien, compteurs indépendants des filtres. */
  offers: InterviewOfferSummary[]
  counts: { total: number; upcoming: number; toHandle: number; toRecord?: number }
  truncated: boolean
}

function interviewListQuery(filters: Record<string, string | number | boolean | undefined>): string {
  const q = new URLSearchParams()
  for (const [name, value] of Object.entries(filters)) {
    if (value !== undefined && value !== '' && value !== false) q.set(name, String(value))
  }
  const text = q.toString()
  return text ? `?${text}` : ''
}

/** Recruteur : entretiens de ses offres (lecture seule). */
export function apiRecruiterInterviews(filters: InterviewListFilters) {
  return request<RecruiterInterviewList>(`/match-suggestions/interviews${interviewListQuery({ ...filters })}`)
}

export interface AdminInterviewFilters extends InterviewListFilters {
  recruiterId?: string
  calendarIssue?: boolean
}

export interface AdminInterviewItem {
  interview: AdminRoundInterview
  suggestionId: string
  suggestionStatus: MatchSuggestionStatus
  opportunity: { id: string; title: string; companyName: string }
  recruiter: { id: string; companyName: string }
  candidate: { id: string; fullName: string | null }
  /** Phase dérivée du dossier (sous-lot 3). */
  phase?: HiringPhase | null
  /** Dernière proposition d'embauche du dossier (sous-lot 5, vue admin). */
  proposal?: HireProposalView | null
}

export interface AdminInterviewList {
  interviews: AdminInterviewItem[]
  total: number
  /** Décalage de la page suivante, `null` s'il n'y en a plus. */
  nextOffset: number | null
  /** Sur l'offre / le recruteur filtrés, sinon toute la plateforme. */
  counts: {
    upcoming: number
    impediments: number
    calendarIssues: number
    /** Issues à renseigner et absences (sous-lot 3). */
    toRecord?: number
    noShows?: number
  }
  offers: { id: string; title: string; companyName: string; recruiterId: string }[]
  recruiters: { id: string; companyName: string }[]
}

/** Admin : tous les entretiens, par page (`limit` 30 par défaut, 100 au plus). */
export function apiAdminInterviews(filters: AdminInterviewFilters, page: { offset?: number; limit?: number } = {}) {
  return request<AdminInterviewList>(
    `/admin/matching/interviews${interviewListQuery({ ...filters, offset: page.offset || undefined, limit: page.limit })}`,
  )
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
  /** Entretien fixé par le recruteur (dossier `mise_en_relation`). */
  interview?: AdminRoundInterview | null
  /** Phase dérivée du dossier (sous-lot 3). */
  phase?: HiringPhase | null
  /** Propositions d'embauche (sous-lot 5, vue admin) et placement lié. */
  proposals?: HireProposalView[]
  placement?: DossierPlacement | null
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

/**
 * Les notifications du compte connecté, les plus récentes d'abord — le
 * serveur en renvoie au plus `NOTIFICATIONS_PAGE_SIZE`.
 */
export const NOTIFICATIONS_PAGE_SIZE = 200

export function apiMyNotifications() {
  return request<{ notifications: Notification[] }>(`/notifications/mine?limit=${NOTIFICATIONS_PAGE_SIZE}`).then(
    (r) => r.notifications,
  )
}

export function apiMarkNotificationRead(id: string) {
  return request<void>(`/notifications/${id}/read`, { method: 'POST' })
}

/** Marque comme lues toutes les notifications du compte connecté. */
export function apiMarkAllNotificationsRead() {
  return request<{ updated: number }>('/notifications/read-all', { method: 'POST' }).then((r) => r.updated)
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

/** Résumé de confiance sans détail (listes, compte talent). */
export interface TrustSummary {
  level: TrustLevel
  recommendationCount: number
}

export type AgentTalentListItem = TalentProfile & { trust: TrustSummary }

export function apiMyTalents() {
  return request<{ talents: AgentTalentListItem[] }>('/agent/talents').then((r) => r.talents)
}

export interface TalentDetail extends TalentProfile {
  verifications: TalentVerification[]
  proposals: { id: string; opportunityId: string; proposedAt: string; opportunity: Opportunity }[]
}

/** Fiche talent vue par son agent : confiance, recommandations, adéquation par offre. */
export interface AgentTalentDetail extends TalentDetail {
  trust: SubjectTrust
  endorsements: AgentSignalEndorsement[]
  opportunityMatches: { opportunityId: string; score: number; reasons: string[] }[]
  /** Accord de visibilité publique (vitrine) et conditions manquantes. */
  publicVisibility: PublicVisibilityState
  /** Aperçu EXACT de la fiche publique (même liste blanche que la vitrine). */
  publicPreview: PublicTalent
}

export function apiTalentDetail(id: string) {
  return request<{ talent: AgentTalentDetail }>(`/agent/talents/${id}`).then((r) => r.talent)
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
  district?: string
  /** Obligatoire (`true`) à la création ; ignoré en modification. */
  consent?: boolean
  fromLeadId?: string
  fromSourcingLeadId?: string
  fromSignalId?: string
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
  /** `trust` : niveau et nombre de recommandations, sans auteurs. */
  talent:
    | (TalentDetail & {
        trust: TrustSummary & { independentSources: number }
        /** Fiche publique (lecture seule : seul l'agent la gère). */
        publicVisibility: { visible: boolean; publicConsentAt: string | null; publicRef: string | null }
      })
    | null
}

export function apiTalentAccountMe() {
  return request<{ account: TalentAccountMe }>('/talent-account/me').then((r) => r.account)
}

/* ------------------------------------------------------------------ */
/* Recommandations de talents                                          */
/* ------------------------------------------------------------------ */

/** Contenu du champ `payload` de `apiRecommendTalent`. */
export interface TalentEndorsementPayload {
  trade: string
  sector: Sector
  province: string
  city: string
  district: string
  subjectName?: string
  contactPhone?: string
  contactHint?: string
  relation: 'client' | 'employeur' | 'collegue'
  jobLabel: string
  /** `YYYY-MM-DD`, jamais dans le futur. */
  jobDate: string
  highlights: string[]
  comment?: string
  authorDistrict?: string
}

/** Construit le `FormData` attendu par `apiRecommendTalent` (photo facultative). */
export function talentEndorsementForm(payload: TalentEndorsementPayload, proof?: File | null): FormData {
  const form = new FormData()
  form.append('payload', JSON.stringify(payload))
  if (proof) form.append('proof', proof)
  return form
}

/** Réponse toujours neutre : ne dit jamais si la personne est déjà connue. */
export async function apiRecommendTalent(form: FormData): Promise<{ ok: true; message: string }> {
  const res = await fetch(`${API_BASE}/endorsements/talents`, {
    method: 'POST',
    credentials: 'include',
    body: form,
  })
  const body = await res.json().catch(() => undefined)
  if (!res.ok) {
    let message = body?.error ?? `Erreur ${res.status}`
    const fieldErrors = body?.details?.fieldErrors as Record<string, string[]> | undefined
    const first = fieldErrors ? Object.values(fieldErrors).flat()[0] : undefined
    if (first) message = first
    throw new ApiError(message, res.status, body?.details)
  }
  return body
}

/**
 * Recommandation envoyée (talent ou entreprise). Statut neutre : talent —
 * `en_cours` tant qu'un agent peut agir, `traitee` ensuite ; entreprise —
 * `en_cours` tant qu'une preuve attend la revue de l'admin.
 */
export interface MyEndorsement {
  id: string
  subjectType: 'talent' | 'entreprise'
  /** Entreprise : nom ; `null` pour un talent. */
  companyName: string | null
  /** Entreprise : id de la fiche si elle est visible (lien), sinon `null`. */
  companyId: string | null
  trade: string
  city: string
  district: string
  relation: EndorsementRelation
  jobLabel: string
  jobDate: string
  highlights: string[]
  hasProof: boolean
  proofFileUrl: string | null
  createdAt: string
  status: 'en_cours' | 'traitee'
}

export function apiMyEndorsements() {
  return request<{ endorsements: MyEndorsement[] }>('/endorsements/mine').then((r) => r.endorsements)
}

/** Signal de la file des agents (sans téléphone : voir le détail). */
export interface AgentTalentSignal {
  id: string
  trade: string
  sector: Sector
  province: string
  city: string
  district: string
  status: TalentSignalStatus
  mine: boolean
  createdAt: string
  updatedAt: string
  expiresAt: string
  contactPurged: boolean
  mergedIntoId: string | null
  talentId: string | null
  subjectName: string | null
  hasPhone: boolean
  endorsementCount: number
  proofCount: number
  mergedCount: number
  trust: SubjectTrust
  possibleDuplicateIds: string[]
}

export interface AgentSignalEndorsement {
  id: string
  signalId: string | null
  relation: EndorsementRelation
  jobLabel: string
  jobDate: string
  highlights: string[]
  comment: string | null
  proof: ProofType
  proofFileUrl: string | null
  proofAccepted: boolean | null
  reviewedAt: string | null
  hiddenJobLabel: boolean
  excludedAt: string | null
  excludedReason: string | null
  createdAt: string
  authorDistrict: string
  authorName: string
  authorRoleLabel: string
}

export interface AgentTalentSignalDetail
  extends Omit<AgentTalentSignal, 'subjectName' | 'hasPhone' | 'endorsementCount' | 'proofCount' | 'mergedCount' | 'possibleDuplicateIds'> {
  subjectName: string | null
  contactPhone: string | null
  contactHint: string | null
  endorsements: AgentSignalEndorsement[]
  merged: { id: string; createdAt: string; district: string; subjectName: string | null; contactPhone: string | null; contactHint: string | null }[]
  possibleDuplicates: { id: string; trade: string; district: string; city: string; status: TalentSignalStatus; createdAt: string; subjectName: string | null }[]
}

export function apiAgentTalentSignals(status?: TalentSignalStatus) {
  return request<{ counts: Partial<Record<TalentSignalStatus, number>>; signals: AgentTalentSignal[] }>(
    `/agent/talent-signals${status ? `?status=${status}` : ''}`,
  )
}

export function apiAgentTalentSignal(id: string) {
  return request<{ signal: AgentTalentSignalDetail }>(`/agent/talent-signals/${id}`).then((r) => r.signal)
}

/** Prise en charge atomique : 409 si un autre agent l'a prise avant. */
export function apiAgentTakeSignal(id: string) {
  return request<{ ok: true }>(`/agent/talent-signals/${id}/take`, { method: 'POST' })
}

/** `nouveau` rend le signal à la file ; `refuse` purge le contact immédiatement. */
export function apiAgentUpdateSignal(id: string, status: 'nouveau' | 'pris_en_charge' | 'injoignable' | 'refuse') {
  return request<{ ok: true }>(`/agent/talent-signals/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })
}

export function apiAgentMergeSignal(id: string, intoId: string) {
  return request<{ ok: true; intoId: string }>(`/agent/talent-signals/${id}/merge`, {
    method: 'POST',
    body: JSON.stringify({ intoId }),
  })
}

export function apiAgentReviewEndorsement(
  id: string,
  review: { proofAccepted?: boolean; reviewed?: true; hiddenJobLabel?: boolean; exclude?: { reason: string } },
) {
  return request<{ endorsement: Pick<AgentSignalEndorsement, 'id' | 'proofAccepted' | 'reviewedAt' | 'hiddenJobLabel' | 'excludedAt' | 'excludedReason'> }>(
    `/agent/endorsements/${id}`,
    { method: 'PATCH', body: JSON.stringify(review) },
  ).then((r) => r.endorsement)
}

/* ------------------------------------------------------------------ */
/* Placements et success fee                                          */
/* ------------------------------------------------------------------ */

/** Déclaration d'un placement : l'offre doit être au recruteur et la
 *  personne doit lui avoir été proposée pour cette offre (dossier transmis
 *  par OffRec, ou talent proposé par un agent) — 404 / 400 sinon, 409 si un
 *  placement non annulé existe déjà. */
export interface PlacementInput {
  opportunityId: string
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

/** Placement vu par le recruteur : le nom du candidat ou du talent, jamais
 *  son email ni son téléphone. */
export interface RecruiterPlacement extends Placement, PlacementHiringFields {
  opportunity: { id: string; title: string; companyName: string } | null
  candidate: { id: string; fullName: string | null } | null
  talent: { id: string; fullName: string } | null
}

export function apiMyPlacements() {
  return request<{ placements: RecruiterPlacement[] }>('/placements/mine').then((r) => r.placements)
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
export interface AdminPlacement extends Placement, PlacementHiringFields {
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

/** Nombre d'événements sur les 7 derniers jours glissants et les 7 précédents. */
export interface AdminWeekCounts {
  last7: number
  prev7: number
}

/** Champs historiques (`users` … `employment`) + indicateurs du tableau de
 *  bord, tous calculés en base à `computedAt`. Séries quotidiennes alignées
 *  sur `seriesDays` (30 jours, calendrier de Madagascar UTC+3, aujourd'hui
 *  inclus, jours sans événement = 0). */
export interface AdminStats {
  computedAt: string
  timezone: string
  seriesDays: string[]
  signups: {
    total: number[]
    byRole: Record<UserRole, number[]>
    last30: number
    last7: number
    prev7: number
    weeksByRole: Record<UserRole, AdminWeekCounts>
  }
  accounts: { total: number; byRole: Record<UserRole, number>; byStatus: Record<AdminUserStatus, number> }
  candidates: {
    total: number
    withCv: number
    withConsent: number
    cvToVerify: number
    cvVerified: number
    cvRejected: number
  }
  matching: {
    byStatus: Record<MatchSuggestionStatus, number>
    toValidate: number
    transmitted: number
    interest: number
    connected: number
    dismissed: number
    sentToRecruiter: number
    conversionPercent: number | null
    connectedSeries: number[]
    connectedLast30: number
    connectedLast7: number
    connectedPrev7: number
    createdLast7: number
    createdPrev7: number
  }
  offers: {
    total: number
    open: number
    expired: number
    recruitersWithOpenOffer: number
    newLast7: number
    newPrev7: number
  }
  verifiedEmployment: {
    talentsTotal: number
    talentsByStatus: Record<TalentStatus, number>
    signalsToProcess: number
    signalsInProgress: number
    contactRequestsNew: number
    contactRequestsOpen: number
    talentLeadsNew: number
  }
  trust: {
    companyProofsToReview: number
    companiesVisible: number
    talentEndorsements: number
    companyEndorsements: number
  }
  billing: {
    plans: { code: string; name: string; priceAr: number; subscribers: number }[]
    paidSubscriptions: number
    monthlyCatalogAr: number
    transactionsLast30Ar: number
    transactionsLast30Count: number
  }
  placements: {
    total: number
    byStage: Record<PlacementStage, number>
    inProgress: number
    completed: number
    cancelled: number
    last30: number
  }
  notifications: { adminUnread: number }
  /** Sous-lot 7 — absent d'un serveur plus ancien ; `outcomeIndicator` vaut
   *  `null` sans le schéma « après l'entretien ». */
  hiring?: {
    outcomeRecordedWithin7dPercent: number | null
    outcomeIndicator: OutcomeIndicator | null
  }

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
}

/** Tableau de bord du recruteur connecté (`GET /recruiter/stats`) : ses
 *  seules données, calculées en base à `computedAt`. « Profils reçus » =
 *  dossiers transmis par OffRec (à partir de `proposee_recruteur`), écartés
 *  compris seulement s'ils avaient été transmis ; jamais une suggestion en
 *  file interne. Séries alignées sur `seriesDays` (30 jours, UTC+3). */
export interface RecruiterStats {
  computedAt: string
  timezone: string
  seriesDays: string[]
  offers: { total: number; open: number; expired: number; newLast7: number; newPrev7: number }
  profiles: {
    received: number
    toReview: number
    transmitted: number
    interest: number
    connected: number
    dismissed: number
    declinedByYou: number
    connectionRate: number | null
    receivedSeries: number[]
    receivedSeriesByStatus: { toReview: number[]; connected: number[]; dismissed: number[] }
    receivedLast30: number
    receivedLast7: number
    receivedPrev7: number
    connectedSeries: number[]
    connectedLast30: number
    connectedLast7: number
    connectedPrev7: number
  }
  byOffer: {
    id: string
    title: string
    open: boolean
    deadline: string
    received: number
    toReview: number
    connected: number
    dismissed: number
  }[]
  /** `null` : entretiens pas encore activés sur ce serveur. */
  interviews: {
    total: number
    upcoming: number
    upcomingConfirmed: number
    awaitingReply: number
    toHandle: number
    pastLast30: number
    cancelled: number
    next: {
      suggestionId: string
      scheduledAt: string
      durationMinutes: number
      status: InterviewStatus
      opportunity: { id: string; title: string }
      candidateName: string | null
    } | null
  } | null
  placements: {
    total: number
    byStage: Record<PlacementStage, number>
    inProgress: number
    completed: number
    cancelled: number
    feeStepsDue: number
    last30: number
  }
  subscription: {
    planCode: string
    planName: string
    priceAr: number
    maxActiveOpportunities: number | null
    startedAt: string
  } | null
  notifications: { unread: number }
  messages: { unread: number }
}

export function apiRecruiterStats() {
  return request<RecruiterStats>('/recruiter/stats')
}

export function apiAdminStats() {
  return request<AdminStats>('/admin/stats')
}

/* ------------------------------------------------------------------ */
/* Mesure « après l'entretien » (sous-lot 7)                           */
/* ------------------------------------------------------------------ */

/** Période de la cohorte : dossiers transmis pendant les n derniers jours, ou depuis le début. */
export type HiringPeriod = '30' | '90' | '365' | 'all'

export type FunnelStage = 'proposes' | 'mis_en_relation' | 'entretien_passe' | 'retenus' | 'proposition' | 'embauches'

export type FunnelSituation =
  | 'embauche'
  | 'en_cours'
  | 'ecarte_avant_mise_en_relation'
  | 'non_retenu'
  | 'proposition_declinee'
  | 'poste_pourvu'
  | 'embauche_annulee'
  | 'placement_declare'

export interface DelaySummary {
  count: number
  medianDays: number | null
  meanDays: number | null
}

/** Entonnoir d'une cohorte de dossiers transmis (`lib/hiring-metrics.ts`). */
export interface HiringFunnelData {
  stages: { key: FunnelStage; count: number; ratePrevious: number | null; rateFromStart: number | null }[]
  situations: Record<FunnelSituation, number>
  closedByFilledOffer: number
  delays: {
    connectionToHire: DelaySummary
    transmissionToConnection: DelaySummary
    connectionToFirstInterview: DelaySummary
    interviewToOutcome: DelaySummary
  }
}

export interface OutcomeTimeliness {
  eligible: number
  recordedWithin7d: number
  percent: number | null
  targetPercent: number
  met: boolean | null
}

/** Part des tours terminés dont l'issue a été renseignée sous 7 jours (plan §11). */
export interface OutcomeIndicator {
  windowDays: number
  graceDays: number
  last30: OutcomeTimeliness
  allTime: OutcomeTimeliness
}

export interface AdminHiringStats {
  computedAt: string
  timezone: string
  period: HiringPeriod
  since: string | null
  filters: { recruiterId: string | null; opportunityId: string | null; excludeTest: boolean }
  funnel: HiringFunnelData
  outcomeIndicator: OutcomeIndicator
  truncated: boolean
  options: {
    recruiters: { id: string; companyName: string }[]
    opportunities: { id: string; title: string; recruiterId: string; companyName: string }[]
  }
}

export interface RecruiterHiringStats {
  computedAt: string
  timezone: string
  period: HiringPeriod
  since: string | null
  opportunityId: string | null
  funnel: HiringFunnelData
  byOffer: {
    id: string
    title: string
    proposed: number
    connected: number
    interviewed: number
    retained: number
    offered: number
    hired: number
  }[]
  offers: { id: string; title: string }[]
  truncated: boolean
}

export interface ResearchExportResult {
  filename: string
  generatedAt: string
  rowCount: number
  testRows: number
  excludeTest: boolean
  truncated: boolean
  generalization: { offerAttributes: number; quarter: number; year: number; masked: number; residualSmallGroups: number }
  /** Document CSV complet (BOM, `;`, CRLF). */
  csv: string
}

function hiringQuery(params: Record<string, string | boolean | undefined>): string {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === '' || value === false) continue
    query.set(key, String(value))
  }
  const text = query.toString()
  return text ? `?${text}` : ''
}

export function apiAdminHiringStats(params: {
  period: HiringPeriod
  recruiterId?: string
  opportunityId?: string
  excludeTest?: boolean
}) {
  return request<AdminHiringStats>(`/admin/stats/hiring${hiringQuery(params)}`)
}

export function apiRecruiterHiringStats(params: { period: HiringPeriod; opportunityId?: string }) {
  return request<RecruiterHiringStats>(`/recruiter/stats/hiring${hiringQuery(params)}`)
}

/** Export de recherche pseudonymisé (admin) — chaque appel est journalisé. */
export function apiAdminResearchExport(excludeTest: boolean) {
  return request<ResearchExportResult>('/admin/stats/research-export', {
    method: 'POST',
    body: JSON.stringify({ excludeTest }),
  })
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

export type ReportTargetType = 'opportunity' | 'provider' | 'recommendation' | 'user' | 'endorsement' | 'talent' | 'company'
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
  /** Fiche publique de talent : « métier · quartier, ville » ; entreprise : « nom · ville ». */
  targetLabel?: string | null
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

/* ------------------------------------------------------------------ */
/* Admin : talents et signaux (lecture seule)                         */
/* ------------------------------------------------------------------ */

export interface AdminTalent {
  id: string
  fullName: string
  trade: string
  sector: Sector
  province: string
  city: string
  district: string | null
  status: TalentStatus
  createdAt: string
  consentAt: string | null
  /** Accord de visibilité publique (vitrine) recueilli par l'agent. */
  publicConsentAt: string | null
  publicRef: string | null
  /** Réellement en ligne (accord + conditions réunies). */
  publicVisible: boolean
  /** Demandes de contact `nouvelle` ou `transmise`. */
  openContactRequests: number
  agent: { id: string; name: string }
  verification: VerificationSummary | null
  verificationCount: number
  proposalCount: number
  placementCount: number
  trust: SubjectTrust
}

export function apiAdminTalents() {
  return request<{ talents: AdminTalent[] }>('/admin/talents').then((r) => r.talents)
}

/** Modération : retire la fiche publique d'un talent (jamais la donner). */
export function apiAdminRevokePublicVisibility(talentId: string) {
  return request<{ ok: true }>(`/admin/talents/${talentId}/public-visibility`, {
    method: 'PUT',
    body: JSON.stringify({ granted: false }),
  })
}

export interface AdminTalentSignal {
  id: string
  trade: string
  sector: Sector
  province: string
  city: string
  district: string
  status: TalentSignalStatus
  createdAt: string
  expiresAt: string
  contactPurged: boolean
  subjectName: string | null
  contactPhone: string | null
  contactHint: string | null
  agentName: string | null
  talentId: string | null
  mergedIntoId: string | null
  endorsementCount: number
  trust: SubjectTrust
}

export function apiAdminTalentSignals(status?: TalentSignalStatus) {
  return request<{ counts: Partial<Record<TalentSignalStatus, number>>; signals: AdminTalentSignal[] }>(
    `/admin/talent-signals${status ? `?status=${status}` : ''}`,
  )
}

/* ------------------------------------------------------------------ */
/* Vitrine publique « Talents recommandés » et contact via OffRec      */
/* ------------------------------------------------------------------ */

export interface PublicTalentList {
  /** Niveau « Recommandé » ou « Très recommandé », triés par confiance. */
  recommended: PublicTalent[]
  /** Niveau « Nouveau » : section séparée, jamais pénalisée. */
  newcomers: PublicTalent[]
  total: { recommended: number; newcomers: number }
  /** Métiers et villes présents dans la vitrine (pour les filtres). */
  filters: { trades: string[]; cities: string[] }
}

export function apiPublicTalents(params: { trade?: string; city?: string } = {}) {
  const q = new URLSearchParams()
  if (params.trade) q.set('trade', params.trade)
  if (params.city) q.set('city', params.city)
  const qs = q.toString()
  return request<PublicTalentList>(`/talents-recommandes${qs ? `?${qs}` : ''}`)
}

export function apiPublicTalent(publicRef: string) {
  return request<{ talent: PublicTalent }>(`/talents-recommandes/${encodeURIComponent(publicRef)}`).then((r) => r.talent)
}

export function apiRequestTalentContact(publicRef: string, need: string) {
  return request<{ request: { id: string; status: ContactRequestStatus; createdAt: string }; message: string }>(
    `/talents-recommandes/${encodeURIComponent(publicRef)}/contact`,
    { method: 'POST', body: JSON.stringify({ need }) },
  )
}

export interface MyTalentContactRequest {
  id: string
  need: string
  status: ContactRequestStatus
  createdAt: string
  handledAt: string | null
  /** `publicRef` : `null` si la fiche n'est plus publique. */
  talent: { trade: string; city: string; district: string | null; publicRef: string | null }
}

export function apiMyTalentContactRequests() {
  return request<{ requests: MyTalentContactRequest[] }>('/talents-recommandes/mes-demandes').then((r) => r.requests)
}

/** Agent : donner ou retirer l'accord de visibilité publique d'un de ses talents. */
export function apiAgentSetPublicVisibility(talentId: string, granted: boolean) {
  return request<{ publicVisibility: PublicVisibilityState }>(`/agent/talents/${talentId}/public-visibility`, {
    method: 'PUT',
    body: JSON.stringify({ granted }),
  }).then((r) => r.publicVisibility)
}

export interface AgentContactRequest {
  id: string
  status: ContactRequestStatus
  need: string
  createdAt: string
  handledAt: string | null
  talent: { id: string; fullName: string; trade: string; city: string; district: string | null }
  requester: { role: UserRole; roleLabel: string; name: string | null; email: string; phone: string | null }
}

export function apiAgentContactRequests(status?: ContactRequestStatus) {
  return request<{ counts: Partial<Record<ContactRequestStatus, number>>; requests: AgentContactRequest[] }>(
    `/agent/contact-requests${status ? `?status=${status}` : ''}`,
  )
}

export function apiAgentUpdateContactRequest(id: string, status: Exclude<ContactRequestStatus, 'nouvelle'>) {
  return request<{ request: AgentContactRequest }>(`/agent/contact-requests/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  }).then((r) => r.request)
}

/* ------------------------------------------------------------------ */
/* Entreprises recommandées                                            */
/* ------------------------------------------------------------------ */

export interface PublicCompanyList {
  /** Triées par confiance, puis par nom. */
  companies: PublicCompany[]
  total: number
  filters: { cities: string[] }
}

/** Vitrine et recherche (`q` : nom, comparé sans accents, ponctuation ni forme juridique). */
export function apiPublicCompanies(params: { q?: string; city?: string; sector?: Sector; limit?: number } = {}) {
  const q = new URLSearchParams()
  if (params.q) q.set('q', params.q)
  if (params.city) q.set('city', params.city)
  if (params.sector) q.set('sector', params.sector)
  if (params.limit) q.set('limit', String(params.limit))
  const qs = q.toString()
  return request<PublicCompanyList>(`/companies${qs ? `?${qs}` : ''}`)
}

export function apiPublicCompany(id: string) {
  return request<{ company: PublicCompany }>(`/companies/${encodeURIComponent(id)}`).then((r) => r.company)
}

/** Fiche de l'entreprise qui publie une offre, `null` si aucune fiche liée et visible. */
export function apiCompanyForOpportunity(opportunityId: string) {
  return request<{ company: PublicCompany | null }>(
    `/companies/by-opportunity/${encodeURIComponent(opportunityId)}`,
  ).then((r) => r.company)
}

/** Recruteur : sa fiche entreprise liée par un admin, `null` sinon. */
export function apiMyLinkedCompany() {
  return request<{ company: LinkedCompanySummary | null }>('/companies/mine').then((r) => r.company)
}

/** Contenu du champ `payload` de `apiRecommendCompany`. */
export interface CompanyEndorsementPayload {
  /** Entreprise existante (choisie dans la recherche)… */
  companyId?: string
  /** …ou nouvelle fiche (dédoublonnée par nom normalisé et ville). */
  company?: { name: string; sector: Sector; province: string; city: string }
  relation: CompanyRelation
  jobLabel: string
  /** `YYYY-MM-DD`, jamais dans le futur. */
  jobDate: string
  highlights: string[]
  comment?: string
  authorDistrict?: string
}

/** Réponse neutre ; la preuve (photo ou PDF) est facultative. */
export async function apiRecommendCompany(payload: CompanyEndorsementPayload, proof?: File | null): Promise<{ ok: true; message: string }> {
  const form = new FormData()
  form.append('payload', JSON.stringify(payload))
  if (proof) form.append('proof', proof)
  const res = await fetch(`${API_BASE}/endorsements/companies`, { method: 'POST', credentials: 'include', body: form })
  const body = await res.json().catch(() => undefined)
  if (!res.ok) {
    let message = body?.error ?? `Erreur ${res.status}`
    const fieldErrors = body?.details?.fieldErrors as Record<string, string[]> | undefined
    const first = fieldErrors ? Object.values(fieldErrors).flat()[0] : undefined
    if (first) message = first
    throw new ApiError(message, res.status, body?.details)
  }
  return body
}

/** Admin : recommandation d'entreprise, auteur et commentaire compris. */
export interface AdminCompanyEndorsement {
  id: string
  relation: EndorsementRelation
  jobLabel: string
  jobDate: string
  highlights: string[]
  comment: string | null
  proof: 'facture' | 'photo' | 'aucune'
  /** Présent tant que la preuve attend la revue (supprimée ensuite). */
  proofFileUrl: string | null
  proofAccepted: boolean | null
  reviewedAt: string | null
  excludedAt: string | null
  excludedReason: string | null
  createdAt: string
  authorDistrict: string
  authorName: string
  authorRoleLabel: string
}

export interface AdminCompany {
  id: string
  name: string
  nameKey: string
  sector: Sector
  city: string
  province: string
  hiddenAt: string | null
  hiddenReason: string | null
  createdAt: string
  recruiter: { id: string; email: string; status: string; companyName: string | null } | null
  trust: SubjectTrust
  endorsementCount: number
  retainedCount: number
  pendingProofs: number
}

export interface AdminRecruiterOption {
  id: string
  email: string
  status: string
  companyName: string | null
  city: string | null
  linkedCompany: { id: string; name: string } | null
}

export function apiAdminCompanies() {
  return request<{ companies: AdminCompany[] }>('/admin/companies').then((r) => r.companies)
}

export function apiAdminCompanyEndorsements(id: string) {
  return request<{ endorsements: AdminCompanyEndorsement[] }>(`/admin/companies/${id}`).then((r) => r.endorsements)
}

export function apiAdminCompanyRecruiters() {
  return request<{ recruiters: AdminRecruiterOption[] }>('/admin/companies/recruiters').then((r) => r.recruiters)
}

/** Décision sur la preuve (le fichier est supprimé dans les deux cas) ou exclusion d'un auteur lié. */
export function apiAdminReviewCompanyEndorsement(
  id: string,
  review: { proofAccepted?: boolean; exclude?: { reason: string } },
) {
  return request<{ ok: true }>(`/admin/companies/endorsements/${id}`, { method: 'PATCH', body: JSON.stringify(review) })
}

export function apiAdminSetCompanyHidden(id: string, hidden: boolean, reason?: string) {
  return request<{ ok: true }>(`/admin/companies/${id}/visibility`, {
    method: 'PATCH',
    body: JSON.stringify(hidden ? { hidden: true, reason } : { hidden: false }),
  })
}

export function apiAdminLinkCompanyRecruiter(id: string, recruiterUserId: string | null) {
  return request<{ ok: true }>(`/admin/companies/${id}/recruiter`, {
    method: 'PUT',
    body: JSON.stringify({ recruiterUserId }),
  })
}

/* ------------------------------------------------------------------ */
/* Admin : comptes recruteurs (consultation)                           */
/* ------------------------------------------------------------------ */

/** Statut d'un compte (pipeline de modération). */
export type AdminUserStatus = 'active' | 'warned' | 'restricted' | 'suspended' | 'banned'

export type AdminRecruiterSort = 'activity' | 'recent' | 'name'

/** Profils d'une offre par statut ; `legacy` regroupe les statuts hérités. */
export interface AdminRecruiterSuggestionCounts {
  suggeree: number
  proposee_recruteur: number
  interet_recruteur: number
  mise_en_relation: number
  ecartee: number
  legacy: number
}

export interface AdminRecruiterSummary {
  id: string
  email: string
  /** Entreprise déclarée, ou l'email à défaut de profil. */
  displayName: string
  status: AdminUserStatus
  createdAt: string
  lastActivityAt: string
  profile: { companyName: string; sector: Sector; city: string; province: string } | null
  subscription: { planCode: string; planName: string; priceAr: number; startedAt: string } | null
  linkedCompany: {
    id: string
    name: string
    city: string
    hidden: boolean
    trust: { level: TrustLevel; index: number | null; independentSources: number } | null
  } | null
  counts: {
    offers: number
    /** Offres ouvertes — définition unique `opportunityClosedReason` : non
     *  pourvue, date limite non dépassée, compte recruteur actif. */
    openOffers: number
    /** Offres pourvues (sous-lot 6) ; absent d'un serveur plus ancien. */
    filledOffers?: number
    /** Date limite dépassée sur une offre non pourvue. */
    expiredOffers: number
    awaitingValidation: number
    proposedProfiles: number
    interests: number
    connections: number
    discarded: number
    talentProposals: number
    placements: number
    openReports: number
  }
}

export interface AdminRecruiterList {
  total: number
  totalRecruiters: number
  limit: number
  offset: number
  statusCounts: Record<AdminUserStatus, number>
  recruiters: AdminRecruiterSummary[]
}

export interface AdminRecruiterOpportunity {
  id: string
  title: string
  companyName: string
  category: string
  sector: Sector
  opportunityType: OpportunityType
  level: ExperienceLevel
  province: string
  city: string
  requiredSkills: string[]
  /** `[]` si l'offre n'en a pas (ou serveur antérieur aux missions). */
  missions: string[]
  featured: boolean
  createdAt: string
  deadline: string
  /** Date limite dépassée (offre non pourvue). */
  expired: boolean
  /** Sous-lot 6 : offre ouverte selon `opportunityClosedReason`, sinon sa
   *  raison de fermeture ; offre pourvue. Absents d'un serveur plus ancien. */
  open?: boolean
  closedReason?: string | null
  filled?: boolean
  suggestions: AdminRecruiterSuggestionCounts
  talentProposals: number
  placements: number
}

export interface AdminRecruiterDetail {
  recruiter: AdminRecruiterSummary
  /** Conversation existante entre l'admin connecté et ce recruteur (`/messages?c=…`). */
  conversationId: string | null
  opportunitiesTotal: number
  opportunities: AdminRecruiterOpportunity[]
}

export function apiAdminRecruiters(
  params: { q?: string; status?: AdminUserStatus; sort?: AdminRecruiterSort; limit?: number; offset?: number } = {},
) {
  const q = new URLSearchParams()
  if (params.q) q.set('q', params.q)
  if (params.status) q.set('status', params.status)
  if (params.sort) q.set('sort', params.sort)
  if (params.limit !== undefined) q.set('limit', String(params.limit))
  if (params.offset !== undefined) q.set('offset', String(params.offset))
  const qs = q.toString()
  return request<AdminRecruiterList>(`/admin/recruiters${qs ? `?${qs}` : ''}`)
}

export function apiAdminRecruiter(id: string) {
  return request<AdminRecruiterDetail>(`/admin/recruiters/${encodeURIComponent(id)}`)
}

/* ------------------------------------------------------------------ */
/* Admin : comptes candidats (consultation)                            */
/* ------------------------------------------------------------------ */

export type AdminCandidateSort = 'activity' | 'recent' | 'name' | 'completion'
/** `given` : consentement de matching en vigueur ; `missing` : jamais donné ou retiré. */
export type AdminCandidateConsentFilter = 'given' | 'missing'
/** `present` / `absent`, ou un statut de vérification (CV déposé dans ce statut). */
export type AdminCandidateCvFilter = 'present' | 'absent' | CvVerificationStatus

/** Dossiers d'un candidat par statut ; `legacy` regroupe les statuts hérités. */
export type AdminCandidateDossierCounts = AdminRecruiterSuggestionCounts

export interface AdminCandidateSummary {
  id: string
  email: string
  /** Nom du profil, ou l'email à défaut de profil. */
  displayName: string
  status: AdminUserStatus
  createdAt: string
  lastActivityAt: string
  profile: {
    city: string
    province: string
    educationLevel: EducationLevel
    experienceLevel: ExperienceLevel
    sector: Sector | null
    skillsCount: number
  } | null
  /** 0–100, même règle que la carte « Complétez votre profil » ; `null` sans profil. */
  completion: number | null
  cv: {
    uploaded: boolean
    /** `null` sans CV déposé. */
    verificationStatus: CvVerificationStatus | null
    submittedAt: string | null
    flagCount: number
  }
  matchingConsentAt: string | null
  counts: AdminCandidateDossierCounts & { openReports: number }
}

export interface AdminCandidateList {
  total: number
  totalCandidates: number
  limit: number
  offset: number
  statusCounts: Record<AdminUserStatus, number>
  candidates: AdminCandidateSummary[]
}

/** Suggestions extraites du CV par l'IA, NON confirmées par le candidat. */
export interface AdminCandidateExtracted {
  extractedAt: string | null
  confidence: 'high' | 'medium' | 'low'
  professionalTitle: string | null
  professionalSummary: string | null
  yearsOfExperience: number | null
  /** Compétences détectées absentes du profil confirmé. */
  skillsNotInProfile: string[]
  technologies: string[]
  experiences: {
    jobTitle: string | null
    company: string | null
    location: string | null
    startDate: string | null
    endDate: string | null
    isCurrent: boolean
    description: string | null
  }[]
  education: { degree: string | null; school: string | null; field: string | null; graduationDate: string | null }[]
  certifications: { name: string | null; issuer: string | null; issueDate: string | null }[]
  languages: { name: string | null; level: string | null }[]
  projects: { name: string | null; role: string | null; description: string | null }[]
  desiredLocations: string[]
  availability: string | null
}

export interface AdminCandidateDossier {
  id: string
  status: MatchSuggestionStatus
  score: number
  origin: MatchSuggestionOrigin
  reasons: string[]
  preselectionRank: number | null
  createdAt: string
  updatedAt: string
  opportunity: { id: string; title: string; companyName: string; city: string; deadline: string; expired: boolean }
  recruiter: { id: string; email: string; displayName: string }
}

export interface AdminCandidateAccountDetail {
  candidate: AdminCandidateSummary
  /** Profil confirmé (même forme que l'aperçu de la mise en relation) ; `null` sans profil. */
  profile: AdminCandidateDetail | null
  /** Éléments manquants pour atteindre 100 % de complétion. */
  completionMissing: string[]
  cv: {
    /** Chemin du CV en vigueur, à ouvrir avec `apiFileUrl()` (accès contrôlé par le serveur). */
    url: string | null
    submittedAt: string | null
    attestedAt: string | null
    verificationStatus: CvVerificationStatus | null
    verifiedAt: string | null
    verificationNote: string | null
    flags: CvFlag[]
    submissions: { submittedAt: string; current: boolean; flagCount: number }[]
    history: CvVerificationDecisionEntry[]
  }
  /** `null` sans CV déposé. */
  extracted: AdminCandidateExtracted | null
  dossiersTotal: number
  dossiers: AdminCandidateDossier[]
}

export function apiAdminCandidates(
  params: {
    q?: string
    status?: AdminUserStatus
    consent?: AdminCandidateConsentFilter
    cv?: AdminCandidateCvFilter
    sort?: AdminCandidateSort
    limit?: number
    offset?: number
  } = {},
) {
  const q = new URLSearchParams()
  if (params.q) q.set('q', params.q)
  if (params.status) q.set('status', params.status)
  if (params.consent) q.set('consent', params.consent)
  if (params.cv) q.set('cv', params.cv)
  if (params.sort) q.set('sort', params.sort)
  if (params.limit !== undefined) q.set('limit', String(params.limit))
  if (params.offset !== undefined) q.set('offset', String(params.offset))
  const qs = q.toString()
  return request<AdminCandidateList>(`/admin/candidates${qs ? `?${qs}` : ''}`)
}

export function apiAdminCandidate(id: string) {
  return request<AdminCandidateAccountDetail>(`/admin/candidates/${encodeURIComponent(id)}`)
}

/* ------------------------------------------------------------------ */
/* Admin : journal d'activité (consultation)                           */
/* ------------------------------------------------------------------ */

/** Familles d'actions — libellés fournis par le serveur (`families`), seule source. */
export type AdminActivityFamily =
  | 'comptes'
  | 'candidats'
  | 'matching'
  | 'recruteurs'
  | 'talents'
  | 'recommandations'
  | 'entreprises'
  | 'moderation'
  | 'placements'
  | 'administration'
  | 'autre'

export interface AdminActivityItem {
  id: string
  createdAt: string
  /** Code d'action d'`AuditLog` (jamais affiché tel quel : voir `label`). */
  action: string
  family: AdminActivityFamily
  /** Événement technique (matching, envoi de notification, purge). */
  system: boolean
  /** Libellé français de l'action. */
  label: string
  /** Complément de phrase (statut, nombre, profil concerné…) ou `null`. */
  detail: string | null
  actor: {
    id: string
    displayName: string
    role: UserRole
    email: string
    /** Fiche admin de l'acteur quand elle existe (`/admin/candidats?id=`…). */
    link: string | null
  } | null
  /** L'acteur existe mais n'est jamais exposé (auteur d'une recommandation). */
  actorMasked: boolean
  target: {
    type: 'compte' | 'offre' | 'entreprise' | 'talent' | 'signal' | 'placement'
    id: string | null
    label: string
  } | null
  /** Écran admin concerné, ou `null`. */
  link: string | null
}

export interface AdminActivityPage {
  items: AdminActivityItem[]
  nextCursor: string | null
  total: number
  families: { key: AdminActivityFamily; label: string; count: number }[]
  allCount: number
  includeSystem: boolean
}

export interface AdminActivityQuery {
  family?: AdminActivityFamily
  role?: UserRole
  q?: string
  /** ISO 8601, inclus. */
  from?: string
  /** ISO 8601, exclu. */
  to?: string
  system?: boolean
  cursor?: string
  limit?: number
}

export function apiAdminActivity(params: AdminActivityQuery = {}) {
  const q = new URLSearchParams()
  if (params.family) q.set('family', params.family)
  if (params.role) q.set('role', params.role)
  if (params.q) q.set('q', params.q)
  if (params.from) q.set('from', params.from)
  if (params.to) q.set('to', params.to)
  if (params.system) q.set('system', '1')
  if (params.cursor) q.set('cursor', params.cursor)
  if (params.limit !== undefined) q.set('limit', String(params.limit))
  const qs = q.toString()
  return request<AdminActivityPage>(`/admin/activity${qs ? `?${qs}` : ''}`)
}
