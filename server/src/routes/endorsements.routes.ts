import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { Prisma } from '@prisma/client'
import { ZodError } from 'zod'
import { prisma } from '../lib/prisma.js'
import { requireRole } from '../middleware/rbac.js'
import { getOrCreateMember } from '../lib/member.js'
import { companyEndorsementInputSchema, phoneKeyOf, talentEndorsementInputSchema } from '../lib/validation.js'
import {
  deleteProofFile,
  parseCompanyProofUpload,
  parseProofUpload,
  ProofFileError,
  saveProofFile,
} from '../lib/proof-upload.js'
import { userPhoneKeys } from '../lib/endorsement-evidence.js'
import { OPEN_SIGNAL_STATUSES, resolveSignalTarget, signalExpiry } from '../lib/talent-signals.js'
import { clip, notifyAgents, notifyUser, roleLabel, scheduleAdminNotification } from '../lib/notify.js'
import { canonicalCity, cleanCompanyName, companyNameKey } from '../lib/companies.js'
import { COMPANY_HIGHLIGHTS, TALENT_HIGHLIGHTS } from '../../../src/data/endorsements.js'

/**
 * Recommander un talent : un membre connecté signale une personne qu'il a
 * vue travailler. La recommandation alimente un signal privé, traité par un
 * agent de terrain — jamais un profil, jamais une page publique.
 *
 * La réponse est toujours la même (« Merci… ») : elle ne révèle jamais si la
 * personne est déjà connue d'OffRec.
 */
const router = Router()

const RECOMMENDER_ROLES = ['candidate', 'particulier', 'recruiter', 'talent'] as const

const endorsementLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de recommandations envoyées. Réessayez dans quelques minutes.' },
})

/**
 * Plafonds par membre, en base (en plus du limiteur par adresse IP). COMMUNS
 * aux recommandations de talents et d'entreprises : le compte est fait sur
 * toutes les lignes `Endorsement` du membre, quel que soit le sujet. Le
 * limiteur IP (`endorsementLimiter`) est lui aussi partagé par les deux routes.
 */
const MAX_PER_DAY = 3
const MAX_PER_30_DAYS = 10

/** `true` si le membre a atteint l'un des deux plafonds. */
async function memberCapReached(memberId: string, now: Date): Promise<boolean> {
  const [lastDay, last30] = await Promise.all([
    prisma.endorsement.count({
      where: { authorMemberId: memberId, createdAt: { gte: new Date(now.getTime() - 24 * 3600 * 1000) } },
    }),
    prisma.endorsement.count({
      where: { authorMemberId: memberId, createdAt: { gte: new Date(now.getTime() - 30 * 24 * 3600 * 1000) } },
    }),
  ])
  return lastDay >= MAX_PER_DAY || last30 >= MAX_PER_30_DAYS
}

const CAP_MESSAGE = `Vous avez atteint la limite de recommandations (${MAX_PER_DAY} par jour, ${MAX_PER_30_DAYS} par mois). Merci de réessayer plus tard.`

const NEUTRAL_MESSAGE = 'Merci, un agent OffRec va traiter votre recommandation.'

/** « Prénom I. » à partir d'un nom complet ; jamais le nom de famille entier. */
function shortName(fullName: string | null | undefined): string {
  const words = (fullName ?? '').trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return 'Membre OffRec'
  const first = words[0].slice(0, 30)
  return words[1] ? `${first} ${words[1].charAt(0).toUpperCase()}.` : first
}

router.post(
  '/talents',
  requireRole(...RECOMMENDER_ROLES),
  endorsementLimiter,
  parseProofUpload,
  async (req, res, next) => {
    let savedProof: { url: string; filePath: string } | null = null
    try {
      const userId = req.session!.sub
      const role = req.session!.role

      let raw: unknown
      try {
        raw = JSON.parse(typeof req.body?.payload === 'string' ? req.body.payload : '')
      } catch {
        res.status(400).json({ error: 'Formulaire invalide (champ « payload » manquant ou mal formé).' })
        return
      }
      const body = talentEndorsementInputSchema.parse(raw)
      const allowed = new Set<string>(TALENT_HIGHLIGHTS)
      if (!body.highlights.every((h) => allowed.has(h))) {
        res.status(400).json({ error: 'Point fort inconnu : choisissez dans la liste proposée.' })
        return
      }
      const highlights = [...new Set(body.highlights)]
      const phoneKey = phoneKeyOf(body.contactPhone)

      // Pas d'auto-recommandation : téléphone de l'auteur = téléphone donné.
      const authorPhoneKey = (await userPhoneKeys([userId])).get(userId) ?? null
      if (phoneKey && authorPhoneKey && phoneKey === authorPhoneKey) {
        res.status(400).json({ error: 'Vous ne pouvez pas vous recommander vous-même.' })
        return
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          member: { select: { id: true, district: true } },
          candidateProfile: { select: { fullName: true } },
          individualProfile: { select: { fullName: true } },
          talentAccountProfile: { select: { fullName: true, talentId: true } },
          recruiterProfile: { select: { companyName: true } },
        },
      })
      if (!user) {
        res.status(401).json({ error: 'Authentification requise.' })
        return
      }

      const target = await resolveSignalTarget(phoneKey)
      if (target.kind === 'talent' && user.talentAccountProfile?.talentId === target.talentId) {
        res.status(400).json({ error: 'Vous ne pouvez pas vous recommander vous-même.' })
        return
      }

      const member = await getOrCreateMember(userId, {
        displayName: shortName(
          user.candidateProfile?.fullName ??
            user.individualProfile?.fullName ??
            user.talentAccountProfile?.fullName ??
            user.recruiterProfile?.companyName,
        ),
        district: body.authorDistrict ?? user.member?.district ?? body.district,
        city: body.city,
      })
      const authorDistrict = body.authorDistrict ?? member.district

      const now = new Date()
      if (await memberCapReached(member.id, now)) {
        res.status(429).json({ error: CAP_MESSAGE })
        return
      }

      if (target.kind === 'talent') {
        const already = await prisma.endorsement.findFirst({
          where: { authorMemberId: member.id, talentSignal: { talentId: target.talentId } },
          select: { id: true },
        })
        if (already) {
          res.status(409).json({ error: 'Vous avez déjà recommandé cette personne.' })
          return
        }
      } else if (target.kind === 'open_signal') {
        const already = await prisma.endorsement.findFirst({
          where: { authorMemberId: member.id, talentSignalId: target.signalId },
          select: { id: true },
        })
        if (already) {
          res.status(409).json({ error: 'Vous avez déjà recommandé cette personne.' })
          return
        }
      }

      if (req.file) {
        savedProof = await saveProofFile(req.file)
      }

      const endorsementData = {
        subjectType: 'talent' as const,
        authorMemberId: member.id,
        authorDistrict,
        relation: body.relation,
        jobLabel: body.jobLabel,
        jobDate: new Date(body.jobDate),
        highlights,
        comment: body.comment ?? null,
        proof: savedProof ? ('photo' as const) : ('aucune' as const),
        proofFileUrl: savedProof?.url ?? null,
      }

      const { signalId, endorsementId, createdSignal } = await prisma.$transaction(async (tx) => {
        if (target.kind === 'talent') {
          // Talent déjà suivi : on rattache sans conserver le contact donné.
          let sid = target.signalId
          if (!sid) {
            const s = await tx.talentSignal.create({
              data: {
                trade: body.trade,
                sector: body.sector,
                province: body.province,
                city: body.city,
                district: body.district,
                status: 'converti',
                talentId: target.talentId,
                agentId: target.agentId,
                expiresAt: signalExpiry(now),
              },
            })
            sid = s.id
          }
          const e = await tx.endorsement.create({ data: { ...endorsementData, talentSignalId: sid } })
          return { signalId: sid, endorsementId: e.id, createdSignal: false }
        }
        if (target.kind === 'open_signal') {
          await tx.talentSignal.update({ where: { id: target.signalId }, data: { expiresAt: signalExpiry(now) } })
          const e = await tx.endorsement.create({ data: { ...endorsementData, talentSignalId: target.signalId } })
          return { signalId: target.signalId, endorsementId: e.id, createdSignal: false }
        }
        const s = await tx.talentSignal.create({
          data: {
            trade: body.trade,
            sector: body.sector,
            province: body.province,
            city: body.city,
            district: body.district,
            subjectName: body.subjectName ?? null,
            contactPhone: body.contactPhone ?? null,
            phoneKey,
            contactHint: body.contactHint ?? null,
            expiresAt: signalExpiry(now),
          },
        })
        const e = await tx.endorsement.create({ data: { ...endorsementData, talentSignalId: s.id } })
        return { signalId: s.id, endorsementId: e.id, createdSignal: true }
      })

      res.status(201).json({ ok: true, message: NEUTRAL_MESSAGE })

      // Après la réponse : journal et notifications, sans nom ni téléphone.
      setImmediate(() => {
        void (async () => {
          await prisma.auditLog.create({
            data: { userId, action: 'talent_endorsement_created', metadata: { signalId, endorsementId } },
          })
          const place = `${clip(body.trade, 40)}, ${clip(body.district, 40)}`
          if (createdSignal) {
            await notifyAgents({
              event: 'talent_signal_created',
              province: body.province,
              title: 'Nouveau talent recommandé',
              message: `Un talent a été recommandé (${place}). Il attend qu’un agent le prenne en charge.`,
              link: `/agent/recommandations/${signalId}`,
            })
          } else if (target.kind === 'talent') {
            await notifyUser({
              userId: target.agentId,
              event: 'talent_endorsed',
              title: 'Nouvelle recommandation',
              message: 'Un de vos talents a reçu une nouvelle recommandation.',
              link: `/agent/talents/${target.talentId}`,
            })
          } else if (target.kind === 'open_signal' && target.agentId) {
            await notifyUser({
              userId: target.agentId,
              event: 'talent_signal_endorsed',
              title: 'Nouvelle recommandation',
              message: `Un talent que vous suivez a reçu une nouvelle recommandation (${place}).`,
              link: `/agent/recommandations/${target.signalId}`,
            })
          }
          scheduleAdminNotification({
            event: 'talent_endorsement_created',
            category: 'agent',
            title: 'Talent recommandé',
            message: `${roleLabel(role)} a recommandé un talent (${place}).`,
            link: '/admin/talents',
          })
        })().catch((err) => console.error('[endorsements] Suites de la recommandation impossibles', err))
      })
    } catch (err) {
      if (savedProof) await deleteProofFile(savedProof.url)
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        res.status(409).json({ error: 'Vous avez déjà recommandé cette personne.' })
        return
      }
      if (err instanceof ProofFileError) {
        res.status(400).json({ error: err.message })
        return
      }
      if (err instanceof ZodError) return next(err)
      next(err)
    }
  },
)

/* ------------------------------------------------------------------ */
/* Recommander une entreprise                                           */
/* ------------------------------------------------------------------ */

/** Décision F3 : seuls candidats, particuliers et talents recommandent un employeur. */
const COMPANY_RECOMMENDER_ROLES = ['candidate', 'particulier', 'talent'] as const

const COMPANY_NEUTRAL_MESSAGE =
  'Merci, votre recommandation est enregistrée. Votre nom n’est jamais montré, ni au public ni à l’entreprise.'

const SELF_COMPANY_MESSAGE = 'Vous ne pouvez pas recommander votre propre entreprise.'

type CompanyTarget = { id: string; nameKey: string; city: string; recruiterUserId: string | null }

/**
 * Un ancien salarié, stagiaire ou prestataire recommande un employeur
 * (positif seulement). La fiche entreprise est créée si elle n'existe pas
 * (dédoublonnage `nameKey` + ville). Preuve facultative (photo ou PDF :
 * contrat, bulletin…), enregistrée comme document (`facture`), vue par un
 * admin puis supprimée du disque — seul `proofAccepted` reste.
 */
router.post(
  '/companies',
  requireRole(...COMPANY_RECOMMENDER_ROLES),
  endorsementLimiter,
  parseCompanyProofUpload,
  async (req, res, next) => {
    let savedProof: { url: string } | null = null
    try {
      const userId = req.session!.sub
      const role = req.session!.role

      let raw: unknown
      try {
        raw = JSON.parse(typeof req.body?.payload === 'string' ? req.body.payload : '')
      } catch {
        res.status(400).json({ error: 'Formulaire invalide (champ « payload » manquant ou mal formé).' })
        return
      }
      const body = companyEndorsementInputSchema.parse(raw)
      const allowed = new Set<string>(COMPANY_HIGHLIGHTS)
      if (!body.highlights.every((h) => allowed.has(h))) {
        res.status(400).json({ error: 'Point fort inconnu : choisissez dans la liste proposée.' })
        return
      }
      const highlights = [...new Set(body.highlights)]

      // Entreprise visée : existante (choisie dans la recherche, visible) ou
      // décrite. Une fiche masquée retrouvée par son nom reçoit la
      // recommandation sans que la réponse le révèle.
      let existing: CompanyTarget | null = null
      let newCompany: { name: string; nameKey: string; sector: NonNullable<typeof body.company>['sector']; province: string; city: string } | null = null
      if (body.companyId) {
        existing = await prisma.company.findFirst({
          where: { id: body.companyId, hiddenAt: null },
          select: { id: true, nameKey: true, city: true, recruiterUserId: true },
        })
        if (!existing) {
          res.status(404).json({ error: 'Entreprise introuvable.' })
          return
        }
      } else {
        const c = body.company!
        const name = cleanCompanyName(c.name)
        const nameKey = companyNameKey(name)
        if (nameKey.length < 2) {
          res.status(400).json({ error: 'Nom d’entreprise trop court.' })
          return
        }
        const city = canonicalCity(c.city)
        existing = await prisma.company.findUnique({
          where: { nameKey_city: { nameKey, city } },
          select: { id: true, nameKey: true, city: true, recruiterUserId: true },
        })
        if (!existing) newCompany = { name, nameKey, sector: c.sector, province: c.province, city }
      }
      const targetKey = existing ? existing.nameKey : newCompany!.nameKey
      const targetCity = existing ? existing.city : newCompany!.city

      // « L'auteur est l'entreprise » : recruteur lié, nom d'entreprise de son
      // propre profil recruteur, ou même téléphone qu'un recruteur de cette
      // entreprise (deuxième compte de la même personne).
      if (existing?.recruiterUserId === userId) {
        res.status(400).json({ error: SELF_COMPANY_MESSAGE })
        return
      }
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          member: { select: { id: true, district: true } },
          candidateProfile: { select: { fullName: true } },
          individualProfile: { select: { fullName: true } },
          talentAccountProfile: { select: { fullName: true } },
          recruiterProfile: { select: { companyName: true } },
        },
      })
      if (!user) {
        res.status(401).json({ error: 'Authentification requise.' })
        return
      }
      if (user.recruiterProfile && companyNameKey(user.recruiterProfile.companyName) === targetKey) {
        res.status(400).json({ error: SELF_COMPANY_MESSAGE })
        return
      }
      const authorPhoneKey = (await userPhoneKeys([userId])).get(userId) ?? null
      if (authorPhoneKey) {
        const recruiters = await prisma.recruiterProfile.findMany({
          select: { userId: true, companyName: true, phone: true },
        })
        const sameCompany = recruiters.filter(
          (r) => r.userId === existing?.recruiterUserId || companyNameKey(r.companyName) === targetKey,
        )
        if (sameCompany.some((r) => phoneKeyOf(r.phone) === authorPhoneKey)) {
          res.status(400).json({ error: SELF_COMPANY_MESSAGE })
          return
        }
      }

      const member = await getOrCreateMember(userId, {
        displayName: shortName(
          user.candidateProfile?.fullName ?? user.individualProfile?.fullName ?? user.talentAccountProfile?.fullName,
        ),
        district: body.authorDistrict ?? user.member?.district ?? targetCity,
        city: targetCity,
      })
      const authorDistrict = body.authorDistrict ?? member.district

      const now = new Date()
      if (await memberCapReached(member.id, now)) {
        res.status(429).json({ error: CAP_MESSAGE })
        return
      }
      if (existing) {
        const already = await prisma.endorsement.findFirst({
          where: { authorMemberId: member.id, companyId: existing.id },
          select: { id: true },
        })
        if (already) {
          res.status(409).json({ error: 'Vous avez déjà recommandé cette entreprise.' })
          return
        }
      }

      if (req.file) savedProof = await saveProofFile(req.file, { allowPdf: true })
      const proofUrl = savedProof?.url ?? null

      const { companyId, endorsementId } = await prisma.$transaction(async (tx) => {
        const company = existing
          ? { id: existing.id }
          : await tx.company.upsert({
              where: { nameKey_city: { nameKey: newCompany!.nameKey, city: newCompany!.city } },
              create: { ...newCompany!, createdByMemberId: member.id },
              update: {},
              select: { id: true },
            })
        const e = await tx.endorsement.create({
          data: {
            subjectType: 'entreprise',
            companyId: company.id,
            authorMemberId: member.id,
            authorDistrict,
            relation: body.relation,
            jobLabel: body.jobLabel,
            jobDate: new Date(body.jobDate),
            highlights,
            comment: body.comment ?? null,
            // Contrat, bulletin… : une preuve documentaire, quelle que soit sa
            // forme (photo ou PDF) — elle pèse comme une facture une fois acceptée.
            proof: proofUrl ? 'facture' : 'aucune',
            proofFileUrl: proofUrl,
          },
          select: { id: true },
        })
        return { companyId: company.id, endorsementId: e.id }
      })

      res.status(201).json({ ok: true, message: COMPANY_NEUTRAL_MESSAGE })

      // Après la réponse : journal et notification admin — sans auteur, sans
      // rôle d'auteur, sans commentaire. Le recruteur lié n'est PAS notifié
      // (le moment d'une notification aiderait à deviner l'auteur).
      const hasProof = Boolean(proofUrl)
      setImmediate(() => {
        void (async () => {
          await prisma.auditLog.create({
            data: { userId, action: 'company_endorsement_created', metadata: { companyId, endorsementId, role } },
          })
          const company = await prisma.company.findUnique({ where: { id: companyId }, select: { name: true, city: true } })
          scheduleAdminNotification({
            event: 'company_endorsement_created',
            category: 'annuaire',
            title: hasProof ? 'Preuve d’entreprise à examiner' : 'Entreprise recommandée',
            message: hasProof
              ? `Une recommandation de « ${clip(company?.name, 60)} » (${clip(company?.city, 40)}) est accompagnée d’une preuve à examiner.`
              : `« ${clip(company?.name, 60)} » (${clip(company?.city, 40)}) a reçu une nouvelle recommandation.`,
            link: '/admin/entreprises',
          })
        })().catch((err) => console.error('[endorsements] Suites de la recommandation d’entreprise impossibles', err))
      })
    } catch (err) {
      if (savedProof) await deleteProofFile(savedProof.url)
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        res.status(409).json({ error: 'Vous avez déjà recommandé cette entreprise.' })
        return
      }
      if (err instanceof ProofFileError) {
        res.status(400).json({ error: err.message })
        return
      }
      if (err instanceof ZodError) return next(err)
      next(err)
    }
  },
)

/**
 * Recommandations envoyées par le compte connecté (talents ET entreprises),
 * avec un statut neutre. Talent : `en_cours` tant qu'un agent peut encore
 * agir, `traitee` sinon (sans dire si la personne a été retrouvée, refusée ou
 * était déjà connue). Entreprise : `en_cours` tant que la preuve attend la
 * revue de l'admin, `traitee` ensuite. Ni contact ni commentaire.
 */
router.get('/mine', requireRole(...RECOMMENDER_ROLES), async (req, res, next) => {
  try {
    const member = await prisma.member.findUnique({ where: { userId: req.session!.sub }, select: { id: true } })
    if (!member) {
      res.json({ endorsements: [] })
      return
    }
    const rows = await prisma.endorsement.findMany({
      where: { authorMemberId: member.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        subjectType: true,
        relation: true,
        jobLabel: true,
        jobDate: true,
        highlights: true,
        proof: true,
        proofFileUrl: true,
        proofAccepted: true,
        createdAt: true,
        talentSignal: {
          select: {
            trade: true,
            city: true,
            district: true,
            status: true,
            mergedInto: { select: { status: true, mergedInto: { select: { status: true } } } },
          },
        },
        company: { select: { id: true, name: true, city: true, hiddenAt: true } },
      },
    })
    const endorsements = rows.map((r) => {
      const common = {
        id: r.id,
        relation: r.relation,
        jobLabel: r.jobLabel,
        jobDate: r.jobDate.toISOString(),
        highlights: r.highlights,
        hasProof: r.proof !== 'aucune',
        proofFileUrl: r.proofFileUrl,
        createdAt: r.createdAt.toISOString(),
      }
      if (r.subjectType === 'entreprise') {
        // Statut neutre : `en_cours` tant qu'une preuve attend la revue de
        // l'admin, `traitee` ensuite (sans dire si elle a été acceptée, ni si
        // la recommandation a été écartée).
        const pending = r.proofFileUrl !== null && r.proofAccepted === null
        return {
          ...common,
          subjectType: 'entreprise' as const,
          trade: '',
          city: r.company?.city ?? '',
          district: '',
          companyName: r.company?.name ?? '',
          // Lien vers la fiche seulement si elle est visible.
          companyId: r.company && !r.company.hiddenAt ? r.company.id : null,
          status: pending ? ('en_cours' as const) : ('traitee' as const),
        }
      }
      const s = r.talentSignal
      const effective =
        s?.status === 'fusionne' ? (s.mergedInto?.status === 'fusionne' ? s.mergedInto.mergedInto?.status : s.mergedInto?.status) : s?.status
      return {
        ...common,
        subjectType: 'talent' as const,
        trade: s?.trade ?? '',
        city: s?.city ?? '',
        district: s?.district ?? '',
        companyName: null,
        companyId: null,
        status: effective && OPEN_SIGNAL_STATUSES.includes(effective) ? ('en_cours' as const) : ('traitee' as const),
      }
    })
    res.json({ endorsements })
  } catch (err) {
    next(err)
  }
})

export default router
