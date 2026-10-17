import type { Prisma, TalentSignalStatus } from '@prisma/client'
import { prisma } from './prisma.js'
import { phoneKeyOf } from './validation.js'
import { deleteProofFile } from './proof-upload.js'

/**
 * Signaux de talents recommandés : regroupement des recommandations, cycle
 * de vie, purge du contact. Aucune de ces fonctions ne crée de profil : seul
 * un agent crée un `TalentProfile` (§7.3.14).
 */

export { authorLinkKey } from './endorsement-evidence.js'

/** Chiffres seulement, `261` ou `0` initial retiré, 9 derniers ; `null` si invalide. */
export const normalizePhoneKey = phoneKeyOf

/** Délai de conservation du contact sans activité. */
export const SIGNAL_RETENTION_DAYS = 60
const DAY_MS = 24 * 60 * 60 * 1000

export function signalExpiry(from: Date = new Date()): Date {
  return new Date(from.getTime() + SIGNAL_RETENTION_DAYS * DAY_MS)
}

/** Statuts où le signal attend encore un agent ou une suite. */
export const OPEN_SIGNAL_STATUSES: TalentSignalStatus[] = ['nouveau', 'pris_en_charge', 'injoignable']

/**
 * Transitions demandées par l'agent via `PATCH /agent/talent-signals/:id`
 * (la prise en charge passe par `take`, atomique ; la fusion par `merge` ;
 * `converti` par la création du profil (`POST /agent/talents`, `fromSignalId`) ; `expire` par la purge).
 */
export const AGENT_SIGNAL_TRANSITIONS: Partial<Record<TalentSignalStatus, TalentSignalStatus[]>> = {
  pris_en_charge: ['nouveau', 'injoignable', 'refuse'],
  injoignable: ['pris_en_charge', 'refuse'],
}

export function canTransitionSignal(from: TalentSignalStatus, to: TalentSignalStatus): boolean {
  return AGENT_SIGNAL_TRANSITIONS[from]?.includes(to) ?? false
}

/* ------------------------------------------------------------------ */
/* Purge                                                               */
/* ------------------------------------------------------------------ */

type Tx = Prisma.TransactionClient

/** Signaux fusionnés (directement ou en chaîne) dans ceux donnés, eux compris. */
export async function withMergedSignals(db: Tx | typeof prisma, ids: string[]): Promise<string[]> {
  const all = new Set(ids)
  let frontier = ids
  while (frontier.length > 0) {
    const children = await db.talentSignal.findMany({
      where: { mergedIntoId: { in: frontier } },
      select: { id: true },
    })
    frontier = children.map((c) => c.id).filter((id) => !all.has(id))
    frontier.forEach((id) => all.add(id))
  }
  return [...all]
}

/**
 * Efface le contact des signaux donnés (et des signaux fusionnés dedans),
 * le commentaire de leurs recommandations et les photos de preuve. Les
 * lignes structurées restent pour les statistiques. `status` : statut final
 * des signaux donnés (les fusionnés gardent `fusionne`).
 */
export async function purgeSignals(ids: string[], status: 'refuse' | 'expire', now = new Date()): Promise<number> {
  if (ids.length === 0) return 0
  const files = await prisma.$transaction(async (tx) => {
    const all = await withMergedSignals(tx, ids)
    const proofs = await tx.endorsement.findMany({
      where: { talentSignalId: { in: all }, proofFileUrl: { not: null } },
      select: { proofFileUrl: true },
    })
    await tx.talentSignal.updateMany({ where: { id: { in: ids } }, data: { status } })
    await tx.talentSignal.updateMany({
      where: { id: { in: all } },
      data: { subjectName: null, contactPhone: null, phoneKey: null, contactHint: null, contactPurgedAt: now },
    })
    await tx.endorsement.updateMany({
      where: { talentSignalId: { in: all } },
      data: { comment: null, proofFileUrl: null },
    })
    return proofs.map((p) => p.proofFileUrl)
  })
  await Promise.all(files.map((f) => deleteProofFile(f)))
  return ids.length
}

/**
 * Passe en `expire` les signaux ouverts dont l'échéance est dépassée et purge
 * leur contact. Sans ordonnanceur : appelée au démarrage et paresseusement par
 * la file des agents (`purgeExpiredSignalsLazily`).
 */
export async function purgeExpiredSignals(now: Date = new Date()): Promise<number> {
  const expired = await prisma.talentSignal.findMany({
    where: { status: { in: OPEN_SIGNAL_STATUSES }, expiresAt: { lt: now } },
    select: { id: true },
  })
  if (expired.length === 0) return 0
  const count = await purgeSignals(
    expired.map((s) => s.id),
    'expire',
    now,
  )
  await prisma.auditLog.create({
    data: { action: 'talent_signals_purged', metadata: { count, reason: 'expire' } },
  })
  return count
}

let lastLazyPurge = 0
const LAZY_PURGE_INTERVAL_MS = 60 * 60 * 1000

/** Au plus une fois par heure par processus ; n'échoue jamais la requête appelante. */
export async function purgeExpiredSignalsLazily(): Promise<void> {
  const now = Date.now()
  if (now - lastLazyPurge < LAZY_PURGE_INTERVAL_MS) return
  lastLazyPurge = now
  try {
    await purgeExpiredSignals(new Date(now))
  } catch (err) {
    console.error('[talent-signals] Purge impossible', err)
  }
}

/* ------------------------------------------------------------------ */
/* Regroupement                                                        */
/* ------------------------------------------------------------------ */

/** Talent dont le téléphone normalisé correspond (colonne indexée `phoneKey`). */
export async function findTalentByPhoneKey(phoneKey: string): Promise<{ id: string; agentId: string } | null> {
  return prisma.talentProfile.findFirst({
    where: { phoneKey },
    orderBy: { createdAt: 'asc' },
    select: { id: true, agentId: true },
  })
}

export type SignalTarget =
  | { kind: 'talent'; talentId: string; agentId: string; signalId: string | null }
  | { kind: 'open_signal'; signalId: string; agentId: string | null }
  | { kind: 'new' }

/**
 * Règle déterministe : avec un téléphone, un talent existant l'emporte, puis
 * un signal ouvert de même `phoneKey` ; sinon (ou sans téléphone) un nouveau
 * signal. Les doublons sans téléphone sont fusionnés à la main par l'agent.
 */
export async function resolveSignalTarget(phoneKey: string | null): Promise<SignalTarget> {
  if (!phoneKey) return { kind: 'new' }
  const talent = await findTalentByPhoneKey(phoneKey)
  if (talent) {
    const signal = await prisma.talentSignal.findFirst({
      where: { talentId: talent.id, status: 'converti' },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    })
    return { kind: 'talent', talentId: talent.id, agentId: talent.agentId, signalId: signal?.id ?? null }
  }
  const open = await prisma.talentSignal.findFirst({
    where: { phoneKey, status: { in: OPEN_SIGNAL_STATUSES } },
    orderBy: { createdAt: 'asc' },
    select: { id: true, agentId: true },
  })
  if (open) return { kind: 'open_signal', signalId: open.id, agentId: open.agentId }
  return { kind: 'new' }
}

/* ------------------------------------------------------------------ */
/* Doublons possibles (signaux sans téléphone commun)                  */
/* ------------------------------------------------------------------ */

function norm(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function firstWord(value: string | null | undefined): string {
  return norm(value).split(' ')[0] ?? ''
}

export interface DuplicateCandidate {
  id: string
  trade: string
  district: string
  subjectName: string | null
}

/**
 * Même métier, même quartier, et — si les deux noms sont renseignés — même
 * premier mot. Indicatif : l'agent décide de fusionner ou non.
 */
export function isPossibleDuplicate(a: DuplicateCandidate, b: DuplicateCandidate): boolean {
  if (a.id === b.id) return false
  if (norm(a.trade) !== norm(b.trade) || norm(a.district) !== norm(b.district)) return false
  if (a.subjectName && b.subjectName) return firstWord(a.subjectName) === firstWord(b.subjectName)
  return true
}
