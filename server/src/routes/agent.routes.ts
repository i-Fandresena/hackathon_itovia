import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { requireRole } from '../middleware/rbac.js'
import {
  phoneKeyOf,
  publicVisibilitySchema,
  sourcingLeadInputSchema,
  sourcingLeadStatusSchema,
  talentCreateSchema,
  talentLeadStatusSchema,
  talentProfileInputSchema,
  talentProposeSchema,
  talentVerificationInputSchema,
} from '../lib/validation.js'
import { actorLabel, clip, scheduleAdminNotification } from '../lib/notify.js'
import { OPEN_SIGNAL_STATUSES, withMergedSignals } from '../lib/talent-signals.js'
import { agentEndorsementView, loadTalentTrust } from '../lib/talent-trust.js'
import { talentMatch } from '../lib/talent-match.js'
import agentSignalRoutes from './agent-signals.routes.js'
import agentContactRequestRoutes from './agent-contact-requests.routes.js'
import { newPublicRef, publicVisibilityState, toPublicTalent } from '../lib/public-talents.js'

/** Refus métier levé dans une transaction (annule tout, puis réponse HTTP). */
class SignalConversionError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
  }
}

const router = Router()

router.use(requireRole('agent'))

// File « Talents recommandés » et revue des recommandations.
router.use(agentSignalRoutes)

// Demandes de contact reçues via la vitrine « Talents recommandés ».
router.use(agentContactRequestRoutes)

/**
 * Demandes de contact "non-diplômé" déposées en self-service (voir
 * public.routes.ts) — partagées entre tous les agents tant qu'aucun
 * profil réel n'a été créé, puisqu'aucun agent n'en est encore responsable.
 */
router.get('/leads', async (req, res, next) => {
  try {
    const status = typeof req.query.status === 'string' ? req.query.status : undefined
    const leads = await prisma.talentLead.findMany({
      where: status ? { status: status as never } : undefined,
      orderBy: { createdAt: 'desc' },
    })
    res.json({ leads })
  } catch (err) {
    next(err)
  }
})

router.get('/leads/:id', async (req, res, next) => {
  try {
    const lead = await prisma.talentLead.findUnique({ where: { id: req.params.id } })
    if (!lead) {
      res.status(404).json({ error: 'Demande introuvable.' })
      return
    }
    res.json({ lead })
  } catch (err) {
    next(err)
  }
})

router.patch('/leads/:id', async (req, res, next) => {
  try {
    const body = talentLeadStatusSchema.parse(req.body)
    const lead = await prisma.talentLead
      .update({ where: { id: req.params.id }, data: { status: body.status } })
      .catch(() => null)
    if (!lead) {
      res.status(404).json({ error: 'Demande introuvable.' })
      return
    }
    res.json({ lead })
  } catch (err) {
    next(err)
  }
})

router.get('/talents', async (req, res, next) => {
  try {
    const talents = await prisma.talentProfile.findMany({
      where: { agentId: req.session!.sub },
      orderBy: { createdAt: 'desc' },
    })
    const trust = await loadTalentTrust(talents.map((t) => t.id))
    res.json({
      talents: talents.map(({ phoneKey: _phoneKey, ...t }) => {
        const tr = trust.get(t.id)!.trust
        return { ...t, trust: { level: tr.level, recommendationCount: tr.recommendationCount } }
      }),
    })
  } catch (err) {
    next(err)
  }
})

router.get('/talents/:id', async (req, res, next) => {
  try {
    const talent = await prisma.talentProfile.findUnique({
      where: { id: req.params.id },
      include: {
        verifications: { orderBy: { verifiedAt: 'desc' } },
        proposals: { include: { opportunity: true }, orderBy: { proposedAt: 'desc' } },
      },
    })
    if (!talent || talent.agentId !== req.session!.sub) {
      res.status(404).json({ error: 'Talent introuvable.' })
      return
    }
    const [trustMap, opportunities] = await Promise.all([
      loadTalentTrust([talent.id]),
      prisma.opportunity.findMany({ orderBy: { createdAt: 'desc' } }),
    ])
    const entry = trustMap.get(talent.id)!
    const { phoneKey: _phoneKey, ...rest } = talent
    const visibility = await publicVisibilityState(talent.id)
    res.json({
      talent: {
        ...rest,
        // Accord public : état, conditions manquantes et aperçu EXACT de la
        // fiche publique (même liste blanche que la vitrine).
        publicVisibility: visibility,
        publicPreview: toPublicTalent(
          { ...talent, publicRef: visibility?.publicRef ?? null, lastVerifiedAt: talent.verifications[0]?.verifiedAt ?? null },
          entry,
        ),
        // Calculée ici : l'empreinte des auteurs ne quitte jamais le serveur.
        trust: entry.trust,
        endorsements: [...entry.rows].reverse().map(agentEndorsementView),
        // « Adéquation à l'offre » (scoreOpportunity, poids inchangés) —
        // affichée à côté de la confiance, jamais additionnée.
        opportunityMatches: opportunities.map((o) => {
          const m = talentMatch(talent, o)
          return { opportunityId: o.id, score: m.score, reasons: m.reasons }
        }),
      },
    })
  } catch (err) {
    next(err)
  }
})

router.post('/talents', async (req, res, next) => {
  try {
    const { fromLeadId, fromSourcingLeadId, fromSignalId, consent: _consent, ...body } = talentCreateSchema.parse(req.body)
    const me = req.session!.sub
    const talent = await prisma.$transaction(async (tx) => {
      const now = new Date()
      const created = await tx.talentProfile.create({
        data: { ...body, agentId: me, consentAt: now, phoneKey: phoneKeyOf(body.phone) },
      })
      // Accord de la personne, recueilli par l'agent : historique en journal.
      await tx.auditLog.create({
        data: {
          userId: me,
          action: 'talent_consent_profile',
          metadata: {
            talentId: created.id,
            origin: fromSignalId ? 'signal' : fromLeadId ? 'lead' : fromSourcingLeadId ? 'sourcing' : 'direct',
          },
        },
      })
      if (fromLeadId) {
        await tx.talentLead.update({ where: { id: fromLeadId }, data: { status: 'converti' } })
        // Si la personne a créé un compte de suivi après sa demande de
        // contact, on le relie au profil désormais réel — c'est ce qui
        // fait apparaître le vrai statut dans "Mon espace" (§7.3.14 : le
        // compte n'a fait qu'observer, l'agent seul a créé ce profil).
        await tx.talentAccountProfile.updateMany({
          where: { leadId: fromLeadId },
          data: { talentId: created.id },
        })
      }
      if (fromSourcingLeadId) {
        await tx.sourcingLead.updateMany({
          where: { id: fromSourcingLeadId, agentId: me },
          data: { status: 'converti', talentId: created.id },
        })
      }
      if (fromSignalId) {
        // Signal libre (`nouveau`) ou suivi par cet agent ; prise atomique.
        const taken = await tx.talentSignal.updateMany({
          where: {
            id: fromSignalId,
            OR: [
              { status: 'nouveau', agentId: null },
              { agentId: me, status: { in: OPEN_SIGNAL_STATUSES.filter((st) => st !== 'nouveau') } },
            ],
          },
          data: { status: 'converti', agentId: me, talentId: created.id },
        })
        if (taken.count === 0) {
          const signal = await tx.talentSignal.findUnique({ where: { id: fromSignalId }, select: { status: true, agentId: true } })
          if (!signal) throw new SignalConversionError(404, 'Signal introuvable.')
          if (OPEN_SIGNAL_STATUSES.includes(signal.status) && signal.agentId && signal.agentId !== me) {
            throw new SignalConversionError(409, 'Ce signal est suivi par un autre agent.')
          }
          throw new SignalConversionError(409, 'Ce signal a déjà été traité (converti, refusé, expiré ou fusionné).')
        }
        // Signaux fusionnés dans celui-ci : rattachés au même talent (leurs
        // recommandations comptent pour lui) ; ils gardent le statut
        // `fusionne`. Le contact donné par les recommandeurs est effacé :
        // seul celui confirmé par l'agent sur le profil fait foi.
        const family = await withMergedSignals(tx, [fromSignalId])
        await tx.talentSignal.updateMany({
          where: { id: { in: family } },
          data: { talentId: created.id, subjectName: null, contactPhone: null, phoneKey: null, contactHint: null, contactPurgedAt: now },
        })
        await tx.auditLog.create({
          data: { userId: me, action: 'talent_signal_converted', metadata: { signalId: fromSignalId, talentId: created.id, signals: family.length } },
        })
      }
      return created
    })
    const { phoneKey: _phoneKey, ...publicTalent } = talent
    res.status(201).json({ talent: publicTalent })
    // Le talent n'est jamais nommé : métier et ville suffisent à l'admin.
    scheduleAdminNotification(async () => ({
      event: 'talent_created',
      category: 'agent',
      title: 'Nouveau profil de talent',
      message:
        `${await actorLabel(me)} a créé un profil de talent (${clip(talent.trade, 40)}, ${clip(talent.city, 40)})` +
        (fromLeadId
          ? ' à partir d’une demande de contact.'
          : fromSourcingLeadId
            ? ' à partir d’un signal de veille.'
            : fromSignalId
              ? ' à partir d’une recommandation.'
              : '.'),
      link: '/admin/talents',
    }))
  } catch (err) {
    if (err instanceof SignalConversionError) {
      res.status(err.status).json({ error: err.message })
      return
    }
    next(err)
  }
})

router.put('/talents/:id', async (req, res, next) => {
  try {
    const existing = await prisma.talentProfile.findUnique({ where: { id: req.params.id } })
    if (!existing || existing.agentId !== req.session!.sub) {
      res.status(404).json({ error: 'Talent introuvable.' })
      return
    }
    const body = talentProfileInputSchema.parse(req.body)
    const talent = await prisma.talentProfile.update({
      where: { id: req.params.id },
      // `phoneKey` suit toujours le téléphone (rattachement des recommandations).
      data: { ...body, phoneKey: phoneKeyOf(body.phone) },
    })
    const { phoneKey: _phoneKey, ...publicTalent } = talent
    res.json({ talent: publicTalent })
  } catch (err) {
    next(err)
  }
})

/**
 * Accord EXPLICITE de visibilité publique (vitrine « Talents recommandés »),
 * distinct de l'accord de création, recueilli par l'agent auprès de la
 * personne et révocable. Chaque nouvel accord génère un nouveau `publicRef`
 * (l'ancien lien reste mort) ; le retrait efface accord et `publicRef`.
 * Historique dans `AuditLog`. Il faut un accord de création tracé et au
 * moins une vérification pour donner l'accord public.
 */
router.put('/talents/:id/public-visibility', async (req, res, next) => {
  try {
    const me = req.session!.sub
    const talent = await prisma.talentProfile.findUnique({
      where: { id: req.params.id },
      select: { id: true, agentId: true, trade: true, city: true, consentAt: true, publicConsentAt: true, publicRef: true, _count: { select: { verifications: true } } },
    })
    if (!talent || talent.agentId !== me) {
      res.status(404).json({ error: 'Talent introuvable.' })
      return
    }
    const { granted } = publicVisibilitySchema.parse(req.body)
    const isGranted = talent.publicConsentAt !== null && talent.publicRef !== null
    if (granted && !isGranted) {
      if (!talent.consentAt) {
        res.status(409).json({ error: 'Accord de création du profil non tracé : recueillez d’abord l’accord de la personne pour son profil OffRec.' })
        return
      }
      if (talent._count.verifications === 0) {
        res.status(409).json({ error: 'Enregistrez d’abord une vérification : la fiche publique affiche « Vérifié par un agent OffRec ».' })
        return
      }
      const publicRef = await newPublicRef()
      await prisma.$transaction([
        prisma.talentProfile.update({ where: { id: talent.id }, data: { publicConsentAt: new Date(), publicRef } }),
        prisma.auditLog.create({ data: { userId: me, action: 'talent_consent_public_granted', metadata: { talentId: talent.id } } }),
      ])
    } else if (!granted && isGranted) {
      await prisma.$transaction([
        prisma.talentProfile.update({ where: { id: talent.id }, data: { publicConsentAt: null, publicRef: null } }),
        prisma.auditLog.create({ data: { userId: me, action: 'talent_consent_public_revoked', metadata: { talentId: talent.id } } }),
      ])
    }
    // Déjà dans l'état demandé : sans effet (pas de nouveau `publicRef`).
    res.json({ publicVisibility: await publicVisibilityState(talent.id) })
    if (granted !== isGranted) {
      scheduleAdminNotification(async () => ({
        event: granted ? 'talent_public_granted' : 'talent_public_revoked',
        category: 'agent',
        title: granted ? 'Talent présenté publiquement' : 'Fiche publique retirée',
        message: granted
          ? `${await actorLabel(me)} a recueilli l’accord d’un talent (${clip(talent.trade, 40)}, ${clip(talent.city, 40)}) pour sa fiche publique « Talents recommandés ».`
          : `${await actorLabel(me)} a retiré la fiche publique d’un talent (${clip(talent.trade, 40)}, ${clip(talent.city, 40)}).`,
        link: '/admin/talents',
      }))
    }
  } catch (err) {
    next(err)
  }
})

/**
 * Un profil ne passe jamais automatiquement d'un statut à l'autre : c'est
 * toujours une action explicite de l'agent (cahier des charges §7.3 règle
 * 14). Chaque vérification est conservée (pas d'écrasement, §7).
 */
router.post('/talents/:id/verify', async (req, res, next) => {
  try {
    const talent = await prisma.talentProfile.findUnique({ where: { id: req.params.id } })
    if (!talent || talent.agentId !== req.session!.sub) {
      res.status(404).json({ error: 'Talent introuvable.' })
      return
    }
    const body = talentVerificationInputSchema.parse(req.body)
    const verification = await prisma.talentVerification.create({
      data: { talentId: talent.id, trade: body.trade, checklist: body.checklist, note: body.note },
    })
    if (talent.status === 'en_attente') {
      await prisma.talentProfile.update({ where: { id: talent.id }, data: { status: 'verifie' } })
    }
    res.status(201).json({ verification })
    const agentId = req.session!.sub
    scheduleAdminNotification(async () => ({
      event: 'talent_verified',
      category: 'agent',
      title: 'Talent vérifié',
      message:
        `${await actorLabel(agentId)} a enregistré une vérification de talent (${clip(verification.trade, 40)}, ${clip(talent.city, 40)})` +
        (talent.status === 'en_attente' ? ' : le profil passe à « vérifié ».' : '.'),
      link: '/admin/agents',
    }))
  } catch (err) {
    next(err)
  }
})

router.post('/talents/:id/propose', async (req, res, next) => {
  try {
    const talent = await prisma.talentProfile.findUnique({ where: { id: req.params.id } })
    if (!talent || talent.agentId !== req.session!.sub) {
      res.status(404).json({ error: 'Talent introuvable.' })
      return
    }
    const body = talentProposeSchema.parse(req.body)
    const opportunity = await prisma.opportunity.findUnique({ where: { id: body.opportunityId } })
    if (!opportunity) {
      res.status(404).json({ error: 'Offre introuvable.' })
      return
    }
    const proposal = await prisma.talentOpportunityProposal
      .create({ data: { talentId: talent.id, opportunityId: opportunity.id } })
      .catch(() => null)
    if (!proposal) {
      res.status(409).json({ error: 'Ce talent a déjà été proposé pour cette offre.' })
      return
    }
    if (talent.status === 'verifie') {
      await prisma.talentProfile.update({ where: { id: talent.id }, data: { status: 'recommande' } })
    }
    await prisma.notification.create({
      data: {
        userId: opportunity.recruiterId,
        title: 'Nouveau profil proposé',
        message: `Un agent de terrain a proposé un profil vérifié pour « ${opportunity.title} ».`,
        link: `/recruteur/offres/${opportunity.id}/shortlist`,
      },
    })
    res.status(201).json({ proposal })
    const agentId = req.session!.sub
    scheduleAdminNotification(async () => ({
      event: 'talent_proposed',
      category: 'agent',
      title: 'Talent proposé à une offre',
      message:
        `${await actorLabel(agentId)} a proposé un talent vérifié (${clip(talent.trade, 40)}) ` +
        `pour « ${clip(opportunity.title)} » (${clip(opportunity.companyName, 60)}).`,
      link: '/admin/placements',
    }))
  } catch (err) {
    next(err)
  }
})

router.get('/stats', async (req, res, next) => {
  try {
    const agentId = req.session!.sub
    const [total, verified, placed, sourcingLeadsCount] = await Promise.all([
      prisma.talentProfile.count({ where: { agentId } }),
      prisma.talentProfile.count({ where: { agentId, status: { in: ['verifie', 'recommande', 'place'] } } }),
      prisma.talentProfile.count({ where: { agentId, status: 'place' } }),
      prisma.sourcingLead.count({ where: { agentId } }),
    ])
    res.json({
      profilesCreated: total,
      verificationRate: total > 0 ? verified / total : 0,
      placements: placed,
      sourcingLeadsCount,
    })
  } catch (err) {
    next(err)
  }
})

/**
 * Veille : signaux qu'un agent a repérés en ligne ou sur le terrain (profil
 * potentiel ou besoin d'une entreprise) — jamais publiés tels quels dans
 * l'annuaire. Un talent n'apparaît vérifié qu'après la même vérification
 * humaine que n'importe quel TalentProfile (§7.3.15) ; une piste d'offre ne
 * devient une vraie Opportunity que si l'entreprise crée elle-même un
 * compte recruteur.
 */
router.get('/sourcing', async (req, res, next) => {
  try {
    const status = typeof req.query.status === 'string' ? req.query.status : undefined
    const type = typeof req.query.type === 'string' ? req.query.type : undefined
    const leads = await prisma.sourcingLead.findMany({
      where: {
        agentId: req.session!.sub,
        status: status ? (status as never) : undefined,
        type: type ? (type as never) : undefined,
      },
      orderBy: { createdAt: 'desc' },
    })
    res.json({ leads })
  } catch (err) {
    next(err)
  }
})

router.get('/sourcing/:id', async (req, res, next) => {
  try {
    const lead = await prisma.sourcingLead.findUnique({ where: { id: req.params.id } })
    if (!lead || lead.agentId !== req.session!.sub) {
      res.status(404).json({ error: 'Piste introuvable.' })
      return
    }
    res.json({ lead })
  } catch (err) {
    next(err)
  }
})

router.post('/sourcing', async (req, res, next) => {
  try {
    const body = sourcingLeadInputSchema.parse(req.body)
    const lead = await prisma.sourcingLead.create({
      data: { ...body, sourceUrl: body.sourceUrl || null, agentId: req.session!.sub },
    })
    res.status(201).json({ lead })
    // Ni la source, ni l'URL, ni la description (texte libre) du signal.
    const agentId = req.session!.sub
    scheduleAdminNotification(async () => ({
      event: 'sourcing_lead_created',
      category: 'agent',
      title: 'Signal de veille enregistré',
      message:
        `${await actorLabel(agentId)} a repéré ${lead.type === 'talent' ? 'un profil potentiel' : 'un besoin d’entreprise'} ` +
        `(${clip(lead.trade, 40)}, ${clip(lead.city, 40)}).`,
      link: '/admin/agents',
    }))
  } catch (err) {
    next(err)
  }
})

router.patch('/sourcing/:id', async (req, res, next) => {
  try {
    const existing = await prisma.sourcingLead.findUnique({ where: { id: req.params.id } })
    if (!existing || existing.agentId !== req.session!.sub) {
      res.status(404).json({ error: 'Piste introuvable.' })
      return
    }
    const body = sourcingLeadStatusSchema.parse(req.body)
    const lead = await prisma.sourcingLead.update({
      where: { id: req.params.id },
      data: { status: body.status },
    })
    res.json({ lead })
  } catch (err) {
    next(err)
  }
})

export default router
