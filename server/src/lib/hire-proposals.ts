import type { HireDeclineReason, HireProposalStatus } from '../../../src/types/index.js'
import {
  ALREADY_HIRED_ERROR,
  DECLINE_REASON_LABELS,
  HIRE_PROPOSAL_STATUS_LABELS,
  PROPOSAL_CHANGED_ERROR,
  PROPOSAL_NOT_FOUND_ERROR,
  PROPOSAL_PENDING_ERROR,
  candidateHiringPhase,
  checkHiringAction,
  civilDate,
  hireProposalExpiresAt,
  hiringPhase,
  isProposalReminderDue,
  latestProposalOf,
  mergeProposalRevision,
  nextProposalVersion,
  pendingProposalOf,
  proposalAcceptedNotice,
  proposalDeclinedNotice,
  proposalExpiredNotice,
  proposalReminderNotice,
  proposalRevisedNotice,
  proposalSentNotice,
  proposalWithdrawnNotice,
  toHireProposalView,
  type CandidateHiringPhase,
  type HireProposalChanges,
  type HireProposalFields,
  type HireProposalView,
  type HiringAudience,
  type HiringCheck,
  type HiringPhase,
} from '../../../src/lib/hiring.js'
import { prisma } from './prisma.js'
import { clip, scheduleAdminNotification, scheduleNotification } from './notify.js'
import {
  HIRING_SUPPORTED,
  HIRING_UNAVAILABLE_ERROR,
  hireProposalStore,
  placementLinkData,
  type HireProposalRow,
} from './hiring-store.js'
import { buildHiringContexts, type HiringClient, type HiringContext } from './hiring-state.js'
import {
  candidateName,
  dossierConnection,
  fail,
  interviewStore,
  isBlocked,
  isInterviewStorageError,
  isUniqueViolation,
  loadDossier,
  lockDossier,
  notifyCandidateNotice,
  notifyRecruiter,
  type Dossier,
  type ServiceResult,
} from './interviews.js'
import { applyAutoFillTx, lockOpportunity, scheduleFilledClosureEffects, type FilledClosure } from './opportunity-fill.js'

/**
 * Propositions d'embauche (plan du 2026-10-16, sous-lot 5 ; décisions D1–D3).
 *
 * Recruteur propriétaire : envoyer (depuis un dernier tour « retenu »
 * seulement), modifier (garde par `revision`, échéance relancée à 7 jours,
 * D2), retirer (motif `recruteur`). Candidat : accepter UNE révision précise,
 * ou décliner avec une catégorie facultative et une précision (lue par
 * l'admin, jamais par le recruteur — D3).
 *
 * Chaque écriture : transaction, verrou de l'offre (envoi, modification,
 * acceptation — jamais après un verrou de dossier) puis du dossier
 * (`lockDossier`), relecture de l'état sous verrou, `checkHiringAction()`
 * (src/lib/hiring.ts, juge unique), écriture CONDITIONNELLE (`updateMany`
 * sur le statut, la révision et l'échéance lus ; contrainte unique
 * `pendingSuggestionId` pour une seule proposition en attente), `AuditLog`
 * dans la transaction, puis notifications APRÈS la réponse avec les textes
 * neutres de src/lib/hiring.ts.
 *
 * Acceptation : dans la MÊME transaction, proposition `acceptee`, création
 * du `Placement` (`origin: proposition_acceptee`, `etape1_due`, relié au
 * dossier et à la proposition — uniques), puis offre pourvue si le nombre de
 * postes est atteint et clôture des autres dossiers (lib/opportunity-fill.ts).
 * Le retrait de l'accord de matching n'empêche pas d'accepter (§4.3) ; un
 * compte candidat ou recruteur suspendu ou banni, une offre pourvue ou une
 * échéance passée, si.
 *
 * Une proposition échue est expirée même si les tâches ne tournent pas :
 * vues (`effectiveProposalStatus`), contrôles (`isProposalExpired`) et
 * écritures (`expiresAt > maintenant` dans chaque `where`). Les tâches
 * (lib/hiring-jobs.ts) la marquent `expiree` et notifient une seule fois.
 */

const hiringUnavailable = () => fail(503, HIRING_UNAVAILABLE_ERROR)

/** Refus métier levé dans une transaction (rien n'est écrit). */
class HiringRefusal extends Error {
  constructor(
    readonly httpStatus: number,
    message: string,
  ) {
    super(message)
  }
}

const refuse = (check: Extract<HiringCheck, { ok: false }>) => new HiringRefusal(check.httpStatus, check.error)

function storeOrThrow(client: unknown) {
  const store = hireProposalStore(client)
  if (!store) throw new Error('Modèle HireProposal indisponible.')
  return store
}

/** Jour civil AAAA-MM-JJ → colonne `@db.Date` (minuit UTC). */
const civilDayToDb = (day: string) => new Date(`${day}T00:00:00.000Z`)

/** Tours, propositions, placement et offre d'un dossier, relus par `client` (transaction : sous verrou). */
async function loadContext(client: HiringClient, dossier: Dossier): Promise<HiringContext> {
  const rounds = interviewStore(client)
  const rows = rounds ? await rounds.findMany({ where: { suggestionId: dossier.id } }) : []
  const context = (await buildHiringContexts([dossier], rows, client)).get(dossier.id)
  if (!context) throw new Error('État du dossier introuvable.')
  return context
}

function mapError(err: unknown): ServiceResult<never> | null {
  if (err instanceof HiringRefusal) return fail(err.httpStatus, err.message)
  if (isInterviewStorageError(err)) return hiringUnavailable()
  return null
}

/* ------------------------------------------------------------------ */
/* Vues (D3)                                                           */
/* ------------------------------------------------------------------ */

/** Liste blanche d'une proposition pour un lecteur : jamais `createdById`,
 *  `pendingSuggestionId` ni `expiryReminderAt` ; précision d'un refus jamais
 *  au recruteur ; raison d'un retrait jamais au candidat. */
export function proposalView(row: HireProposalRow, audience: HiringAudience, userId: string, now: Date): HireProposalView {
  return toHireProposalView(row, { audience, userId }, now)
}

/** Toutes les propositions des dossiers donnés, par dossier, triées par version. Vide avec un ancien client. */
export async function loadProposalRows(suggestionIds: readonly string[]): Promise<Map<string, HireProposalRow[]>> {
  const result = new Map<string, HireProposalRow[]>()
  const store = hireProposalStore()
  if (!store || suggestionIds.length === 0) return result
  try {
    const rows = await store.findMany({
      where: { suggestionId: { in: [...suggestionIds] } },
      orderBy: [{ suggestionId: 'asc' }, { version: 'asc' }],
    })
    for (const row of rows) {
      const list = result.get(row.suggestionId)
      if (list) list.push(row)
      else result.set(row.suggestionId, [row])
    }
  } catch (err) {
    if (!isInterviewStorageError(err)) throw err
  }
  return result
}

/** Dernière proposition d'un dossier (vue du lecteur), ou `null`. */
export function latestProposalView(
  rows: readonly HireProposalRow[] | undefined,
  audience: HiringAudience,
  userId: string,
  now: Date,
): HireProposalView | null {
  const latest = rows ? latestProposalOf(rows) : undefined
  return latest ? proposalView(latest, audience, userId, now) : null
}

async function recruiterPhase(dossier: Dossier): Promise<HiringPhase | null> {
  return hiringPhase((await loadContext(prisma, dossier)).state, new Date())
}

async function candidatePhase(dossier: Dossier): Promise<CandidateHiringPhase | null> {
  return candidateHiringPhase((await loadContext(prisma, dossier)).state, new Date())
}

function noticeInput(dossier: Dossier, row: HireProposalRow) {
  return {
    companyName: dossier.opportunity.companyName,
    jobTitle: row.jobTitle,
    monthlySalaryAr: row.monthlySalaryAr,
    contractType: row.contractType,
    contractDurationMonths: row.contractDurationMonths,
    startDate: row.startDate,
    expiresAt: row.expiresAt,
  }
}

/** Message de l'entreprise, ajouté à l'email seulement (déjà filtré : sans coordonnées). */
const messageParagraph = (row: HireProposalRow) => (row.message ? [`Message de l’entreprise : « ${row.message} »`] : [])

/* ------------------------------------------------------------------ */
/* Expiration (aussi à la demande, avant un nouvel envoi)              */
/* ------------------------------------------------------------------ */

/**
 * Marque `expiree` les propositions encore `envoyee` dont l'échéance est
 * passée (filtre `where` en plus : un dossier). Écriture conditionnelle par
 * ligne : seules les lignes réellement expirées par CET appel sont
 * renvoyées (et journalisées), pour ne notifier qu'une fois.
 */
export async function expireDueProposals(
  client: HiringClient,
  now: Date,
  where: Record<string, unknown> = {},
  take = 500,
): Promise<HireProposalRow[]> {
  const store = hireProposalStore(client)
  if (!store) return []
  const due = await store.findMany({
    where: { ...where, status: 'envoyee', expiresAt: { lte: now } },
    orderBy: [{ expiresAt: 'asc' }, { id: 'asc' }],
    take,
  })
  const expired: HireProposalRow[] = []
  for (const row of due) {
    const { count } = await store.updateMany({
      where: { id: row.id, status: 'envoyee', expiresAt: { lte: now } },
      data: { status: 'expiree', pendingSuggestionId: null },
    })
    if (count === 0) continue
    expired.push({ ...row, status: 'expiree', pendingSuggestionId: null })
    await client.auditLog.create({
      data: {
        action: 'hire_proposal_expired',
        metadata: { suggestionId: row.suggestionId, proposalId: row.id, version: row.version },
      },
    })
  }
  return expired
}

/** Propositions expirées : candidat (in-app), recruteur (in-app), admins (in-app). Après la réponse. */
export function scheduleExpiredNotices(rows: readonly HireProposalRow[]): void {
  if (rows.length === 0) return
  scheduleNotification('Notifications d’expiration de propositions', async () => {
    for (const row of rows) {
      const dossier = await loadDossier(row.suggestionId)
      if (!dossier) continue
      await notifyCandidateNotice(dossier.candidateId, proposalExpiredNotice({ jobTitle: row.jobTitle }), '/candidat')
      await notifyRecruiter(
        dossier.opportunity.recruiterId,
        'Proposition expirée',
        `Votre proposition pour « ${clip(row.jobTitle)} » a expiré sans réponse. Vous pouvez en envoyer une nouvelle.`,
      )
      scheduleAdminNotification({
        event: 'hire_proposal_expired',
        category: 'systeme',
        title: 'Proposition d’embauche expirée',
        message:
          `La proposition de ${clip(dossier.opportunity.companyName, 60)} à ${candidateName(dossier)} pour ` +
          `« ${clip(row.jobTitle)} » a expiré sans réponse.`,
        link: '/admin/mise-en-relation',
      })
    }
  })
}

/**
 * Rappel J-2 (D2) au candidat, une seule fois par échéance : `expiryReminderAt`
 * posé par une écriture conditionnelle (même révision, même échéance) —
 * seul le passage qui le pose notifie ; une modification remet le rappel à
 * zéro avec la nouvelle échéance.
 */
export async function sendProposalReminders(now: Date, take = 500): Promise<number> {
  const store = hireProposalStore()
  if (!store) return 0
  const rows = await store.findMany({
    where: {
      status: 'envoyee',
      expiryReminderAt: null,
      expiresAt: { gt: now, lte: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000) },
    },
    orderBy: [{ expiresAt: 'asc' }, { id: 'asc' }],
    take,
  })
  let sent = 0
  for (const row of rows) {
    if (!isProposalReminderDue(row, now)) continue
    const { count } = await store.updateMany({
      where: { id: row.id, status: 'envoyee', expiryReminderAt: null, revision: row.revision, expiresAt: row.expiresAt },
      data: { expiryReminderAt: now },
    })
    if (count === 0) continue
    const dossier = await prisma.matchSuggestion.findUnique({ where: { id: row.suggestionId }, select: { candidateId: true } })
    if (!dossier) continue
    sent += 1
    await notifyCandidateNotice(
      dossier.candidateId,
      proposalReminderNotice({ jobTitle: row.jobTitle, expiresAt: row.expiresAt }),
      '/candidat',
    )
  }
  return sent
}

/* ------------------------------------------------------------------ */
/* Recruteur : envoyer, modifier, retirer                              */
/* ------------------------------------------------------------------ */

export interface ProposalBody {
  proposal: HireProposalView
  phase: HiringPhase | null
}

/** Dossier du recruteur propriétaire (403 hors de ses offres, 404 inexistant). */
async function loadRecruiterDossier(suggestionId: string, recruiterId: string): Promise<Dossier | ServiceResult<never>> {
  if (!HIRING_SUPPORTED || !hireProposalStore() || !interviewStore()) return hiringUnavailable()
  const dossier = await loadDossier(suggestionId)
  if (!dossier) return fail(404, 'Dossier introuvable.')
  if (dossier.opportunity.recruiterId !== recruiterId) return fail(403, 'Ce dossier ne concerne pas l’une de vos offres.')
  return dossier
}

const isServiceResult = (value: unknown): value is ServiceResult<never> =>
  Boolean(value && typeof value === 'object' && 'ok' in value && 'httpStatus' in value)

/**
 * Envoi d'une proposition depuis un dernier tour « retenu »
 * (`checkHiringAction('send_proposal')` : accord du candidat et compte
 * actif, offre non pourvue, aucune réponse définitive, 3 versions au plus).
 * Une proposition échue encore marquée `envoyee` est d'abord expirée (et
 * notifiée). 201 ; 409 « déjà en attente » (contrainte unique).
 */
export async function sendHireProposal(input: {
  suggestionId: string
  recruiterId: string
  fields: HireProposalFields
}): Promise<ServiceResult<ProposalBody>> {
  const loaded = await loadRecruiterDossier(input.suggestionId, input.recruiterId)
  if (isServiceResult(loaded)) return loaded
  const dossier = loaded
  const now = new Date()
  let result: { row: HireProposalRow; expired: HireProposalRow[] }
  try {
    result = await prisma.$transaction(async (tx) => {
      await lockOpportunity(tx, dossier.opportunityId)
      await lockDossier(tx, dossier.id)
      const fresh = await loadDossier(dossier.id, tx)
      if (!fresh) throw new HiringRefusal(404, 'Dossier introuvable.')
      const expired = await expireDueProposals(tx, now, { suggestionId: fresh.id })
      const context = await loadContext(tx, fresh)
      const check = checkHiringAction({
        actor: 'recruiter',
        action: 'send_proposal',
        state: context.state,
        now,
        connection: dossierConnection(fresh),
      })
      if (!check.ok) throw refuse(check)
      const row = await storeOrThrow(tx).create({
        data: {
          suggestionId: fresh.id,
          pendingSuggestionId: fresh.id,
          version: nextProposalVersion(context.state.proposals),
          jobTitle: input.fields.jobTitle,
          monthlySalaryAr: input.fields.monthlySalaryAr,
          startDate: civilDayToDb(input.fields.startDate),
          contractType: input.fields.contractType,
          contractDurationMonths: input.fields.contractDurationMonths,
          message: input.fields.message,
          expiresAt: hireProposalExpiresAt(now),
          createdById: input.recruiterId,
        },
      })
      await tx.auditLog.create({
        data: {
          userId: input.recruiterId,
          action: 'hire_proposal_sent',
          metadata: { suggestionId: fresh.id, proposalId: row.id, version: row.version, contractType: row.contractType },
        },
      })
      return { row, expired }
    })
  } catch (err) {
    if (isUniqueViolation(err)) return fail(409, PROPOSAL_PENDING_ERROR)
    const mapped = mapError(err)
    if (mapped) return mapped
    throw err
  }

  const { row, expired } = result
  scheduleExpiredNotices(expired)
  scheduleNotification('Notification de la proposition au candidat', () =>
    notifyCandidateNotice(dossier.candidateId, proposalSentNotice(noticeInput(dossier, row)), '/candidat', messageParagraph(row)),
  )
  scheduleAdminNotification({
    event: 'hire_proposal_sent',
    category: 'recruteur',
    title: 'Proposition d’embauche envoyée',
    message:
      `${clip(dossier.opportunity.companyName, 60)} a fait une proposition d’embauche à ${candidateName(dossier)} ` +
      `pour « ${clip(row.jobTitle)} » (réponse attendue sous 7 jours).`,
    link: '/admin/mise-en-relation',
  })
  return {
    ok: true,
    httpStatus: 201,
    body: { proposal: proposalView(row, 'recruiter', input.recruiterId, now), phase: await recruiterPhase(dossier) },
  }
}

/**
 * Modification de la proposition en attente (`revision` lue) : champs
 * fusionnés puis cohérence contrat / durée recontrôlée sur le résultat
 * (`mergeProposalRevision`), `revision + 1`, échéance relancée à 7 jours et
 * rappel J-2 réarmé. Accord du candidat et offre non pourvue exigés. 409 si
 * la proposition a changé entre-temps (réponse, expiration, autre modification).
 */
export async function reviseHireProposal(input: {
  suggestionId: string
  recruiterId: string
  revision: number
  changes: HireProposalChanges
}): Promise<ServiceResult<ProposalBody>> {
  const loaded = await loadRecruiterDossier(input.suggestionId, input.recruiterId)
  if (isServiceResult(loaded)) return loaded
  const dossier = loaded
  const now = new Date()
  let row: HireProposalRow
  try {
    row = await prisma.$transaction(async (tx) => {
      await lockOpportunity(tx, dossier.opportunityId)
      await lockDossier(tx, dossier.id)
      const fresh = await loadDossier(dossier.id, tx)
      if (!fresh) throw new HiringRefusal(404, 'Dossier introuvable.')
      const context = await loadContext(tx, fresh)
      const check = checkHiringAction({
        actor: 'recruiter',
        action: 'revise_proposal',
        state: context.state,
        now,
        revision: input.revision,
        connection: dossierConnection(fresh),
      })
      if (!check.ok) throw refuse(check)
      const pending = pendingProposalOf(context.state.proposals, now)
      const store = storeOrThrow(tx)
      const current = pending ? await store.findUnique({ where: { id: pending.id } }) : null
      if (!current) throw new HiringRefusal(409, PROPOSAL_CHANGED_ERROR)
      const merged = mergeProposalRevision(
        {
          jobTitle: current.jobTitle,
          monthlySalaryAr: current.monthlySalaryAr,
          startDate: civilDate(current.startDate),
          contractType: current.contractType,
          contractDurationMonths: current.contractDurationMonths,
          message: current.message,
        },
        input.changes,
      )
      if (merged.error) throw new HiringRefusal(400, merged.error)
      const { count } = await store.updateMany({
        where: { id: current.id, status: 'envoyee', revision: input.revision, expiresAt: { gt: now } },
        data: {
          jobTitle: merged.fields.jobTitle,
          monthlySalaryAr: merged.fields.monthlySalaryAr,
          startDate: civilDayToDb(merged.fields.startDate),
          contractType: merged.fields.contractType,
          contractDurationMonths: merged.fields.contractDurationMonths,
          message: merged.fields.message,
          revision: { increment: 1 },
          expiresAt: hireProposalExpiresAt(now),
          expiryReminderAt: null,
        },
      })
      if (count === 0) throw new HiringRefusal(409, PROPOSAL_CHANGED_ERROR)
      const updated = await store.findUnique({ where: { id: current.id } })
      if (!updated) throw new HiringRefusal(409, PROPOSAL_CHANGED_ERROR)
      await tx.auditLog.create({
        data: {
          userId: input.recruiterId,
          action: 'hire_proposal_revised',
          metadata: {
            suggestionId: fresh.id,
            proposalId: updated.id,
            version: updated.version,
            revision: updated.revision,
            fields: merged.changed,
          },
        },
      })
      return updated
    })
  } catch (err) {
    const mapped = mapError(err)
    if (mapped) return mapped
    throw err
  }

  scheduleNotification('Notification de la proposition modifiée au candidat', () =>
    notifyCandidateNotice(
      dossier.candidateId,
      proposalRevisedNotice({ companyName: dossier.opportunity.companyName, jobTitle: row.jobTitle, expiresAt: row.expiresAt }),
      '/candidat',
      messageParagraph(row),
    ),
  )
  return {
    ok: true,
    httpStatus: 200,
    body: { proposal: proposalView(row, 'recruiter', input.recruiterId, now), phase: await recruiterPhase(dossier) },
  }
}

/**
 * Retrait de la proposition en attente par le recruteur (`revision` lue) :
 * `retiree`, motif `recruteur` (liste fermée), jamais montré au candidat.
 * Le dossier revient « Retenu » : une nouvelle version reste possible.
 */
export async function withdrawHireProposal(input: {
  suggestionId: string
  recruiterId: string
  revision: number
}): Promise<ServiceResult<ProposalBody>> {
  const loaded = await loadRecruiterDossier(input.suggestionId, input.recruiterId)
  if (isServiceResult(loaded)) return loaded
  const dossier = loaded
  const now = new Date()
  let row: HireProposalRow
  try {
    row = await prisma.$transaction(async (tx) => {
      await lockDossier(tx, dossier.id)
      const context = await loadContext(tx, dossier)
      const check = checkHiringAction({
        actor: 'recruiter',
        action: 'withdraw_proposal',
        state: context.state,
        now,
        revision: input.revision,
      })
      if (!check.ok) throw refuse(check)
      const pending = pendingProposalOf(context.state.proposals, now)
      if (!pending) throw new HiringRefusal(409, PROPOSAL_CHANGED_ERROR)
      const store = storeOrThrow(tx)
      const { count } = await store.updateMany({
        where: { id: pending.id, status: 'envoyee', revision: input.revision, expiresAt: { gt: now } },
        data: { status: 'retiree', withdrawnAt: now, withdrawReason: 'recruteur', pendingSuggestionId: null },
      })
      if (count === 0) throw new HiringRefusal(409, PROPOSAL_CHANGED_ERROR)
      const updated = await store.findUnique({ where: { id: pending.id } })
      if (!updated) throw new HiringRefusal(409, PROPOSAL_CHANGED_ERROR)
      await tx.auditLog.create({
        data: {
          userId: input.recruiterId,
          action: 'hire_proposal_withdrawn',
          metadata: { suggestionId: dossier.id, proposalId: updated.id, version: updated.version, reason: 'recruteur' },
        },
      })
      return updated
    })
  } catch (err) {
    const mapped = mapError(err)
    if (mapped) return mapped
    throw err
  }

  scheduleNotification('Notification du retrait de la proposition au candidat', () =>
    notifyCandidateNotice(
      dossier.candidateId,
      proposalWithdrawnNotice({ companyName: dossier.opportunity.companyName, jobTitle: row.jobTitle }),
      '/candidat',
    ),
  )
  scheduleAdminNotification({
    event: 'hire_proposal_withdrawn',
    category: 'recruteur',
    title: 'Proposition d’embauche retirée',
    message:
      `${clip(dossier.opportunity.companyName, 60)} a retiré sa proposition à ${candidateName(dossier)} ` +
      `pour « ${clip(row.jobTitle)} ».`,
    link: '/admin/mise-en-relation',
  })
  return {
    ok: true,
    httpStatus: 200,
    body: { proposal: proposalView(row, 'recruiter', input.recruiterId, now), phase: await recruiterPhase(dossier) },
  }
}

/* ------------------------------------------------------------------ */
/* Candidat : accepter, décliner                                       */
/* ------------------------------------------------------------------ */

/** Dossier du candidat, mis en relation ; même 404 pour « pas à vous » et « inexistant ». */
async function loadCandidateDossier(suggestionId: string, candidateId: string): Promise<Dossier | ServiceResult<never>> {
  if (!HIRING_SUPPORTED || !hireProposalStore() || !interviewStore()) return hiringUnavailable()
  const dossier = await loadDossier(suggestionId)
  if (!dossier || dossier.candidateId !== candidateId || dossier.status !== 'mise_en_relation') {
    return fail(404, PROPOSAL_NOT_FOUND_ERROR)
  }
  return dossier
}

export interface AcceptBody {
  proposal: HireProposalView
  placementCreated: true
  candidatePhase: CandidateHiringPhase | null
}

/**
 * Acceptation d'une révision précise par le candidat, en UNE transaction :
 * 1. verrou de l'offre puis du dossier, état relu, `checkHiringAction`
 *    (révision lue, échéance, offre non pourvue, comptes candidat et
 *    recruteur actifs — pas l'accord de matching, §4.3) ;
 * 2. proposition `acceptee` (`where` : statut, révision, `expiresAt > now`) ;
 * 3. `Placement` créé (`proposition_acceptee`, `etape1_due`, salaire, poste,
 *    date de début, contrat ; `suggestionId` et `hireProposalId` uniques —
 *    un ancien placement ANNULÉ relié au dossier est d'abord détaché) ;
 * 4. offre pourvue si le nombre de postes est atteint, autres dossiers clos.
 * Deux acceptations concurrentes sur une offre à un poste : la seconde
 * attend le verrou de l'offre, la relit pourvue et reçoit 409.
 */
export async function acceptHireProposal(input: {
  suggestionId: string
  candidateId: string
  proposalId: string
  revision: number
}): Promise<ServiceResult<AcceptBody>> {
  const loaded = await loadCandidateDossier(input.suggestionId, input.candidateId)
  if (isServiceResult(loaded)) return loaded
  const dossier = loaded
  const now = new Date()
  let result: { row: HireProposalRow; placementId: string; closure: FilledClosure | null }
  try {
    result = await prisma.$transaction(async (tx) => {
      await lockOpportunity(tx, dossier.opportunityId)
      await lockDossier(tx, dossier.id)
      const fresh = await loadDossier(dossier.id, tx)
      if (!fresh || fresh.status !== 'mise_en_relation') throw new HiringRefusal(404, PROPOSAL_NOT_FOUND_ERROR)
      const recruiter = await tx.user.findUnique({ where: { id: fresh.opportunity.recruiterId }, select: { status: true } })
      const context = await loadContext(tx, fresh)
      const check = checkHiringAction({
        actor: 'candidate',
        action: 'accept_proposal',
        state: context.state,
        now,
        proposalId: input.proposalId,
        revision: input.revision,
        candidateBlocked: isBlocked(fresh.candidate.status),
        recruiterBlocked: !recruiter || isBlocked(recruiter.status),
      })
      if (!check.ok) throw refuse(check)
      const store = storeOrThrow(tx)
      const { count } = await store.updateMany({
        where: {
          id: input.proposalId,
          suggestionId: fresh.id,
          status: 'envoyee',
          revision: input.revision,
          expiresAt: { gt: now },
        },
        data: { status: 'acceptee', respondedAt: now, pendingSuggestionId: null },
      })
      if (count === 0) throw new HiringRefusal(409, PROPOSAL_CHANGED_ERROR)
      const row = await store.findUnique({ where: { id: input.proposalId } })
      if (!row) throw new HiringRefusal(409, PROPOSAL_CHANGED_ERROR)

      // Un placement annulé déjà relié au dossier (déclaration d'avant le
      // flux automatique) libère le lien unique ; il reste dans l'historique.
      await tx.$executeRaw`UPDATE "Placement" SET "suggestionId" = NULL WHERE "suggestionId" = ${fresh.id} AND "stage" = 'annule'`
      const placement = await tx.placement.create({
        data: {
          recruiterId: fresh.opportunity.recruiterId,
          opportunityId: fresh.opportunityId,
          candidateId: fresh.candidateId,
          monthlySalaryAr: row.monthlySalaryAr,
          stage: 'etape1_due',
          ...placementLinkData({
            suggestionId: fresh.id,
            hireProposalId: row.id,
            origin: 'proposition_acceptee',
            jobTitle: row.jobTitle,
            startDate: row.startDate,
            contractType: row.contractType,
          }),
        },
      })
      await tx.auditLog.create({
        data: {
          userId: input.candidateId,
          action: 'hire_proposal_accepted',
          metadata: { suggestionId: fresh.id, proposalId: row.id, version: row.version, revision: row.revision },
        },
      })
      await tx.auditLog.create({
        data: {
          userId: input.candidateId,
          action: 'placement_created_auto',
          metadata: { placementId: placement.id, suggestionId: fresh.id, proposalId: row.id, opportunityId: fresh.opportunityId },
        },
      })
      const closure = await applyAutoFillTx(tx, fresh.opportunityId, { now, actorId: null })
      return { row, placementId: placement.id, closure }
    })
  } catch (err) {
    if (isUniqueViolation(err)) return fail(409, ALREADY_HIRED_ERROR)
    const mapped = mapError(err)
    if (mapped) return mapped
    throw err
  }

  const { row, closure } = result
  const { companyName, recruiterId } = dossier.opportunity
  scheduleNotification('Notifications de l’acceptation d’une proposition', async () => {
    await notifyCandidateNotice(
      dossier.candidateId,
      proposalAcceptedNotice({ jobTitle: row.jobTitle, companyName, startDate: row.startDate }),
      '/candidat',
    )
    await notifyRecruiter(
      recruiterId,
      'Proposition acceptée',
      `${candidateName(dossier)} a accepté votre proposition pour « ${clip(row.jobTitle)} ». ` +
        'Le placement est créé : suivez le success fee dans « Placements ».',
      '/recruteur/placements',
    )
  })
  scheduleAdminNotification({
    event: 'hire_proposal_accepted',
    category: 'recruteur',
    title: 'Embauche confirmée',
    message:
      `${candidateName(dossier)} a accepté la proposition de ${clip(companyName, 60)} pour « ${clip(row.jobTitle)} » : ` +
      'placement créé, étape 1 du success fee due.',
    link: '/admin/placements',
  })
  scheduleFilledClosureEffects(closure)
  return {
    ok: true,
    httpStatus: 200,
    body: {
      proposal: proposalView(row, 'candidate', input.candidateId, now),
      placementCreated: true,
      candidatePhase: await candidatePhase(dossier),
    },
  }
}

export interface DeclineBody {
  proposal: HireProposalView
  candidatePhase: CandidateHiringPhase | null
}

/**
 * Refus d'une révision précise par le candidat : catégorie facultative
 * (vue par le recruteur, D3) et précision facultative (vue par l'admin
 * seulement, jamais dans le journal ni dans une notification). Le dossier
 * est clos (« Proposition déclinée »).
 */
export async function declineHireProposal(input: {
  suggestionId: string
  candidateId: string
  proposalId: string
  revision: number
  reason: HireDeclineReason | null
  note: string | null
}): Promise<ServiceResult<DeclineBody>> {
  const loaded = await loadCandidateDossier(input.suggestionId, input.candidateId)
  if (isServiceResult(loaded)) return loaded
  const dossier = loaded
  const now = new Date()
  let row: HireProposalRow
  try {
    row = await prisma.$transaction(async (tx) => {
      await lockDossier(tx, dossier.id)
      const context = await loadContext(tx, dossier)
      const check = checkHiringAction({
        actor: 'candidate',
        action: 'decline_proposal',
        state: context.state,
        now,
        proposalId: input.proposalId,
        revision: input.revision,
      })
      if (!check.ok) throw refuse(check)
      const store = storeOrThrow(tx)
      const { count } = await store.updateMany({
        where: {
          id: input.proposalId,
          suggestionId: dossier.id,
          status: 'envoyee',
          revision: input.revision,
          expiresAt: { gt: now },
        },
        data: {
          status: 'refusee',
          respondedAt: now,
          declineReason: input.reason,
          declineNote: input.note,
          pendingSuggestionId: null,
        },
      })
      if (count === 0) throw new HiringRefusal(409, PROPOSAL_CHANGED_ERROR)
      const updated = await store.findUnique({ where: { id: input.proposalId } })
      if (!updated) throw new HiringRefusal(409, PROPOSAL_CHANGED_ERROR)
      // Jamais la précision dans le journal d'audit (D3).
      await tx.auditLog.create({
        data: {
          userId: input.candidateId,
          action: 'hire_proposal_declined',
          metadata: { suggestionId: dossier.id, proposalId: updated.id, version: updated.version, reason: input.reason },
        },
      })
      return updated
    })
  } catch (err) {
    const mapped = mapError(err)
    if (mapped) return mapped
    throw err
  }

  const category = input.reason ? DECLINE_REASON_LABELS[input.reason] : null
  scheduleNotification('Notifications du refus d’une proposition', async () => {
    await notifyCandidateNotice(dossier.candidateId, proposalDeclinedNotice(), '/candidat')
    await notifyRecruiter(
      dossier.opportunity.recruiterId,
      'Proposition déclinée',
      `${candidateName(dossier)} a décliné votre proposition pour « ${clip(row.jobTitle)} »` +
        (category ? ` (motif : ${category.toLowerCase()}).` : ' (aucun motif indiqué).'),
    )
  })
  scheduleAdminNotification({
    event: 'hire_proposal_declined',
    category: 'candidat',
    title: 'Proposition d’embauche déclinée',
    message:
      `${candidateName(dossier)} a décliné la proposition de ${clip(dossier.opportunity.companyName, 60)} ` +
      `pour « ${clip(row.jobTitle)} »` +
      (category ? ` (motif : ${category.toLowerCase()}).` : '.'),
    link: '/admin/mise-en-relation',
  })
  return {
    ok: true,
    httpStatus: 200,
    body: { proposal: proposalView(row, 'candidate', input.candidateId, now), candidatePhase: await candidatePhase(dossier) },
  }
}

/* ------------------------------------------------------------------ */
/* Admin : liste des propositions                                      */
/* ------------------------------------------------------------------ */

export interface AdminProposalItem {
  proposal: HireProposalView
  suggestionId: string
  opportunity: { id: string; title: string; companyName: string }
  candidate: { id: string; fullName: string | null }
  phase: HiringPhase | null
}

/**
 * Propositions de la plateforme pour l'admin (`?status=`, statut EFFECTIF :
 * une proposition échue non encore marquée compte comme `expiree`). Vue
 * admin : catégorie et précision d'un refus, raison d'un retrait ; jamais
 * l'auteur. En attente d'abord par échéance, puis les plus récentes ; 200
 * au plus.
 */
export async function listAdminHireProposals(
  status: HireProposalStatus | undefined,
  now: Date = new Date(),
): Promise<ServiceResult<{ proposals: AdminProposalItem[]; statusLabels: Record<HireProposalStatus, string> }>> {
  const store = hireProposalStore()
  if (!HIRING_SUPPORTED || !store) return hiringUnavailable()
  const where: Record<string, unknown> =
    status === 'envoyee'
      ? { status: 'envoyee', expiresAt: { gt: now } }
      : status === 'expiree'
        ? { OR: [{ status: 'expiree' }, { status: 'envoyee', expiresAt: { lte: now } }] }
        : status
          ? { status }
          : {}
  let rows: HireProposalRow[]
  try {
    rows = await store.findMany({ where, orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }], take: 200 })
  } catch (err) {
    if (isInterviewStorageError(err)) return hiringUnavailable()
    throw err
  }
  const dossiers = await prisma.matchSuggestion.findMany({
    where: { id: { in: [...new Set(rows.map((row) => row.suggestionId))] } },
    select: {
      id: true,
      status: true,
      opportunityId: true,
      opportunity: { select: { id: true, title: true, companyName: true } },
      candidate: { select: { id: true, candidateProfile: { select: { fullName: true } } } },
    },
  })
  const byId = new Map(dossiers.map((dossier) => [dossier.id, dossier]))
  const rounds = interviewStore()
  const roundRows = rounds && dossiers.length > 0 ? await rounds.findMany({ where: { suggestionId: { in: dossiers.map((d) => d.id) } } }) : []
  const contexts = await buildHiringContexts(dossiers, roundRows)
  const items: AdminProposalItem[] = []
  for (const row of rows) {
    const dossier = byId.get(row.suggestionId)
    if (!dossier) continue
    const context = contexts.get(dossier.id)
    items.push({
      proposal: proposalView(row, 'admin', '', now),
      suggestionId: dossier.id,
      opportunity: dossier.opportunity,
      candidate: { id: dossier.candidate.id, fullName: dossier.candidate.candidateProfile?.fullName ?? null },
      phase: context ? hiringPhase(context.state, now) : null,
    })
  }
  const pendingFirst = (item: AdminProposalItem) => (item.proposal.status === 'envoyee' ? 0 : 1)
  items.sort(
    (a, b) =>
      pendingFirst(a) - pendingFirst(b) ||
      (pendingFirst(a) === 0
        ? Date.parse(a.proposal.expiresAt) - Date.parse(b.proposal.expiresAt)
        : Date.parse(b.proposal.updatedAt) - Date.parse(a.proposal.updatedAt)) ||
      a.proposal.id.localeCompare(b.proposal.id),
  )
  return { ok: true, httpStatus: 200, body: { proposals: items, statusLabels: HIRE_PROPOSAL_STATUS_LABELS } }
}

