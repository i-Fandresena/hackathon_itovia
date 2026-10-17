import { Router } from 'express'
import type { TalentSignal, TalentSignalStatus } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import {
  endorsementReviewSchema,
  signalMergeSchema,
  talentSignalListQuerySchema,
  talentSignalStatusSchema,
} from '../lib/validation.js'
import { loadSignalTrust as trustByRoot } from '../lib/talent-trust.js'
import {
  OPEN_SIGNAL_STATUSES,
  canTransitionSignal,
  isPossibleDuplicate,
  purgeExpiredSignalsLazily,
  purgeSignals,
  signalExpiry,
} from '../lib/talent-signals.js'
import { roleLabel } from '../lib/notify.js'

/**
 * File des agents « Talents recommandés » (monté sous `/api/agent`, rôle
 * agent). Visibilité : un signal `nouveau` est visible de tous les agents,
 * contact compris (il faut pouvoir l'évaluer avant de le prendre) ; dès sa
 * prise en charge, seul l'agent qui l'a pris le voit. La confiance est
 * calculée ici, côté serveur : l'empreinte d'auteur ne quitte jamais le
 * serveur.
 */
const router = Router()

function canSee(signal: Pick<TalentSignal, 'status' | 'agentId'>, me: string): boolean {
  return signal.status === 'nouveau' || signal.agentId === me
}

/** Racine d'une chaîne de fusions (le signal lui-même s'il n'est pas fusionné). */
async function rootOf(signal: TalentSignal): Promise<TalentSignal> {
  let current = signal
  for (let i = 0; i < 10 && current.mergedIntoId; i++) {
    const next = await prisma.talentSignal.findUnique({ where: { id: current.mergedIntoId } })
    if (!next) break
    current = next
  }
  return current
}

function publicSignalFields(s: TalentSignal, me: string) {
  return {
    id: s.id,
    trade: s.trade,
    sector: s.sector,
    province: s.province,
    city: s.city,
    district: s.district,
    status: s.status,
    mine: s.agentId === me,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
    expiresAt: s.expiresAt.toISOString(),
    contactPurged: s.contactPurgedAt !== null,
    mergedIntoId: s.mergedIntoId,
    talentId: s.talentId,
  }
}

function contactFields(s: TalentSignal) {
  return { subjectName: s.subjectName, contactPhone: s.contactPhone, contactHint: s.contactHint }
}

router.get('/talent-signals', async (req, res, next) => {
  try {
    await purgeExpiredSignalsLazily()
    const me = req.session!.sub
    const { status } = talentSignalListQuerySchema.parse(req.query)
    const where = !status
      ? { OR: [{ status: 'nouveau' as const }, { agentId: me, status: { in: ['pris_en_charge', 'injoignable'] as TalentSignalStatus[] } }] }
      : status === 'nouveau'
        ? { status }
        : { status, agentId: me }
    const [signals, nouveau, mineGrouped] = await Promise.all([
      prisma.talentSignal.findMany({ where, orderBy: { createdAt: 'desc' }, take: 200 }),
      prisma.talentSignal.count({ where: { status: 'nouveau' } }),
      prisma.talentSignal.groupBy({ by: ['status'], where: { agentId: me }, _count: { _all: true } }),
    ])
    const counts: Record<string, number> = { nouveau }
    for (const g of mineGrouped) if (g.status !== 'nouveau') counts[g.status] = g._count._all

    // Doublons possibles : comparés à tous les signaux ouverts visibles.
    const openVisible = await prisma.talentSignal.findMany({
      where: { OR: [{ status: 'nouveau' }, { agentId: me, status: { in: OPEN_SIGNAL_STATUSES } }] },
      select: { id: true, trade: true, district: true, subjectName: true },
    })
    const trust = await trustByRoot(signals.map((s) => s.id))
    res.json({
      counts,
      signals: signals.map((s) => {
        const t = trust.get(s.id)!
        const isOpen = OPEN_SIGNAL_STATUSES.includes(s.status)
        return {
          ...publicSignalFields(s, me),
          subjectName: canSee(s, me) ? s.subjectName : null,
          hasPhone: Boolean(s.contactPhone),
          endorsementCount: t.trust.recommendationCount,
          proofCount: t.rows.filter((r) => r.proof !== 'aucune' && r.proofFileUrl).length,
          mergedCount: t.familyIds.length - 1,
          trust: t.trust,
          possibleDuplicateIds: isOpen ? openVisible.filter((o) => isPossibleDuplicate(s, o)).map((o) => o.id) : [],
        }
      }),
    })
  } catch (err) {
    next(err)
  }
})

router.get('/talent-signals/:id', async (req, res, next) => {
  try {
    await purgeExpiredSignalsLazily()
    const me = req.session!.sub
    const signal = await prisma.talentSignal.findUnique({ where: { id: req.params.id } })
    if (!signal || !canSee(signal, me)) {
      res.status(404).json({ error: 'Signal introuvable.' })
      return
    }
    const t = (await trustByRoot([signal.id])).get(signal.id)!
    const family = await prisma.talentSignal.findMany({
      where: { id: { in: t.familyIds.filter((id) => id !== signal.id) } },
      orderBy: { createdAt: 'asc' },
    })
    const duplicates = OPEN_SIGNAL_STATUSES.includes(signal.status)
      ? (
          await prisma.talentSignal.findMany({
            where: {
              id: { not: signal.id },
              OR: [{ status: 'nouveau' }, { agentId: me, status: { in: OPEN_SIGNAL_STATUSES } }],
            },
            orderBy: { createdAt: 'asc' },
          })
        ).filter((o) => isPossibleDuplicate(signal, o))
      : []
    res.json({
      signal: {
        ...publicSignalFields(signal, me),
        ...contactFields(signal),
        trust: t.trust,
        endorsements: t.rows.map((r) => ({
          id: r.id,
          signalId: r.talentSignalId,
          relation: r.relation,
          jobLabel: r.jobLabel,
          jobDate: r.jobDate.toISOString(),
          highlights: r.highlights,
          comment: r.comment,
          proof: r.proof,
          proofFileUrl: r.proofFileUrl,
          proofAccepted: r.proofAccepted,
          reviewedAt: r.reviewedAt?.toISOString() ?? null,
          hiddenJobLabel: r.hiddenJobLabel,
          excludedAt: r.excludedAt?.toISOString() ?? null,
          excludedReason: r.excludedReason,
          createdAt: r.createdAt.toISOString(),
          authorDistrict: r.authorDistrict,
          authorName: r.authorMember.displayName,
          authorRoleLabel: roleLabel(r.authorMember.user.role),
        })),
        merged: family.map((f) => ({
          id: f.id,
          createdAt: f.createdAt.toISOString(),
          district: f.district,
          ...contactFields(f),
        })),
        possibleDuplicates: duplicates.map((d) => ({
          id: d.id,
          trade: d.trade,
          district: d.district,
          city: d.city,
          status: d.status,
          createdAt: d.createdAt.toISOString(),
          subjectName: d.subjectName,
        })),
      },
    })
  } catch (err) {
    next(err)
  }
})

/** Prise en charge atomique : un seul agent gagne, les autres reçoivent 409. */
router.post('/talent-signals/:id/take', async (req, res, next) => {
  try {
    const me = req.session!.sub
    const result = await prisma.talentSignal.updateMany({
      where: { id: req.params.id, status: 'nouveau', agentId: null },
      data: { status: 'pris_en_charge', agentId: me, expiresAt: signalExpiry() },
    })
    if (result.count === 0) {
      const exists = await prisma.talentSignal.findUnique({ where: { id: req.params.id }, select: { id: true } })
      res
        .status(exists ? 409 : 404)
        .json({ error: exists ? 'Ce signal a déjà été pris en charge par un autre agent.' : 'Signal introuvable.' })
      return
    }
    await prisma.auditLog.create({
      data: { userId: me, action: 'talent_signal_taken', metadata: { signalId: req.params.id } },
    })
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

router.patch('/talent-signals/:id', async (req, res, next) => {
  try {
    const me = req.session!.sub
    const body = talentSignalStatusSchema.parse(req.body)
    const signal = await prisma.talentSignal.findUnique({ where: { id: req.params.id } })
    if (!signal || signal.agentId !== me) {
      res.status(404).json({ error: 'Signal introuvable.' })
      return
    }
    if (!canTransitionSignal(signal.status, body.status)) {
      res.status(409).json({ error: 'Ce changement de statut n’est pas possible.' })
      return
    }
    if (body.status === 'refuse') {
      await purgeSignals([signal.id], 'refuse')
    } else {
      await prisma.talentSignal.update({
        where: { id: signal.id },
        data: {
          status: body.status,
          // Rendre le signal à la file : il redevient visible de tous.
          agentId: body.status === 'nouveau' ? null : signal.agentId,
          expiresAt: signalExpiry(),
        },
      })
    }
    await prisma.auditLog.create({
      data: { userId: me, action: 'talent_signal_status', metadata: { signalId: signal.id, from: signal.status, to: body.status } },
    })
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

/**
 * Fusion manuelle d'un doublon dans un autre signal : le signal fusionné
 * garde ses recommandations et son contact (visibles depuis la cible), ne
 * figure plus dans la file, et suit la cible lors d'une purge.
 */
router.post('/talent-signals/:id/merge', async (req, res, next) => {
  try {
    const me = req.session!.sub
    const { intoId } = signalMergeSchema.parse(req.body)
    if (intoId === req.params.id) {
      res.status(400).json({ error: 'Un signal ne peut pas être fusionné avec lui-même.' })
      return
    }
    const [source, into] = await Promise.all([
      prisma.talentSignal.findUnique({ where: { id: req.params.id } }),
      prisma.talentSignal.findUnique({ where: { id: intoId } }),
    ])
    const usable = (s: TalentSignal | null): s is TalentSignal =>
      Boolean(s && OPEN_SIGNAL_STATUSES.includes(s.status) && canSee(s, me))
    if (!usable(source) || !usable(into)) {
      res.status(404).json({ error: 'Signal introuvable ou déjà traité.' })
      return
    }
    // Les mêmes auteurs ne doivent pas apparaître deux fois : le moteur
    // dédoublonne de toute façon par auteur (la plus récente compte).
    await prisma.$transaction([
      prisma.talentSignal.update({
        where: { id: source.id },
        data: { status: 'fusionne', mergedIntoId: into.id, agentId: source.agentId ?? me },
      }),
      prisma.talentSignal.update({ where: { id: into.id }, data: { expiresAt: signalExpiry() } }),
    ])
    await prisma.auditLog.create({
      data: { userId: me, action: 'talent_signal_merged', metadata: { signalId: source.id, intoId: into.id } },
    })
    res.json({ ok: true, intoId: into.id })
  } catch (err) {
    next(err)
  }
})

/**
 * Revue d'une recommandation par l'agent qui suit le signal (ou le talent
 * rattaché) : accepter/refuser la preuve, marquer comme revue, masquer le
 * libellé du travail, écarter un auteur lié (famille…). Jamais de
 * suppression : une recommandation écartée reste en base et ne compte plus.
 */
router.patch('/endorsements/:id', async (req, res, next) => {
  try {
    const me = req.session!.sub
    const body = endorsementReviewSchema.parse(req.body)
    const endorsement = await prisma.endorsement.findUnique({
      where: { id: req.params.id },
      include: { talentSignal: true },
    })
    if (!endorsement?.talentSignal) {
      res.status(404).json({ error: 'Recommandation introuvable.' })
      return
    }
    const root = await rootOf(endorsement.talentSignal)
    let allowed = root.agentId === me
    if (!allowed && root.talentId) {
      const talent = await prisma.talentProfile.findUnique({ where: { id: root.talentId }, select: { agentId: true } })
      allowed = talent?.agentId === me
    }
    if (!allowed) {
      res.status(403).json({ error: 'Prenez d’abord ce signal en charge.' })
      return
    }
    if (body.proofAccepted !== undefined && endorsement.proof === 'aucune') {
      res.status(400).json({ error: 'Cette recommandation n’a pas de preuve à revoir.' })
      return
    }
    const now = new Date()
    const updated = await prisma.endorsement.update({
      where: { id: endorsement.id },
      data: {
        ...(body.proofAccepted !== undefined ? { proofAccepted: body.proofAccepted } : {}),
        ...(body.hiddenJobLabel !== undefined ? { hiddenJobLabel: body.hiddenJobLabel } : {}),
        ...(body.reviewed || body.proofAccepted !== undefined ? { reviewedAt: now } : {}),
        ...(body.exclude && !endorsement.excludedAt
          ? { excludedAt: now, excludedReason: body.exclude.reason, excludedById: me }
          : {}),
      },
    })
    await prisma.auditLog.create({
      data: {
        userId: me,
        action: body.exclude ? 'endorsement_excluded' : 'endorsement_reviewed',
        metadata: {
          endorsementId: endorsement.id,
          proofAccepted: body.proofAccepted ?? null,
          hiddenJobLabel: body.hiddenJobLabel ?? null,
          excluded: Boolean(body.exclude),
        },
      },
    })
    res.json({
      endorsement: {
        id: updated.id,
        proofAccepted: updated.proofAccepted,
        reviewedAt: updated.reviewedAt?.toISOString() ?? null,
        hiddenJobLabel: updated.hiddenJobLabel,
        excludedAt: updated.excludedAt?.toISOString() ?? null,
        excludedReason: updated.excludedReason,
      },
    })
  } catch (err) {
    next(err)
  }
})

export default router
