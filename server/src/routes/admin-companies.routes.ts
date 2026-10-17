import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { requireRole } from '../middleware/rbac.js'
import {
  companyEndorsementReviewSchema,
  companyRecruiterLinkSchema,
  companyVisibilitySchema,
} from '../lib/validation.js'
import { loadCompanyTrust, retainedCompanyEndorsements, type CompanyEndorsementRow } from '../lib/companies.js'
import { deleteProofFile } from '../lib/proof-upload.js'
import { clip, notifyUser, roleLabel } from '../lib/notify.js'

/**
 * Administration des entreprises recommandées (`/api/admin/companies`) :
 * revue des preuves (le fichier est supprimé du disque après la décision,
 * acceptée OU refusée), exclusion d'un auteur lié, masquage d'une fiche,
 * liaison à un compte recruteur (jamais d'auto-revendication). L'admin est
 * le seul à voir les auteurs et les commentaires.
 */
const router = Router()

router.use(requireRole('admin'))

/** Vue admin d'une recommandation d'entreprise (auteur et commentaire compris). */
function adminEndorsementView(r: CompanyEndorsementRow) {
  return {
    id: r.id,
    relation: r.relation,
    jobLabel: r.jobLabel,
    jobDate: r.jobDate.toISOString(),
    highlights: r.highlights,
    comment: r.comment,
    proof: r.proof,
    proofFileUrl: r.proofFileUrl,
    proofAccepted: r.proofAccepted,
    reviewedAt: r.reviewedAt?.toISOString() ?? null,
    excludedAt: r.excludedAt?.toISOString() ?? null,
    excludedReason: r.excludedReason,
    createdAt: r.createdAt.toISOString(),
    authorDistrict: r.authorDistrict,
    authorName: r.authorMember.displayName,
    authorRoleLabel: roleLabel(r.authorMember.user.role),
  }
}

const companySelect = {
  id: true,
  name: true,
  nameKey: true,
  sector: true,
  city: true,
  province: true,
  hiddenAt: true,
  hiddenReason: true,
  createdAt: true,
  recruiterUser: {
    select: { id: true, email: true, status: true, recruiterProfile: { select: { companyName: true } } },
  },
} as const

router.get('/', async (_req, res, next) => {
  try {
    const companies = await prisma.company.findMany({ select: companySelect, orderBy: { createdAt: 'desc' } })
    const trust = await loadCompanyTrust(companies.map((c) => c.id))
    res.json({
      companies: companies.map((c) => {
        const entry = trust.get(c.id)!
        return {
          id: c.id,
          name: c.name,
          nameKey: c.nameKey,
          sector: c.sector,
          city: c.city,
          province: c.province,
          hiddenAt: c.hiddenAt?.toISOString() ?? null,
          hiddenReason: c.hiddenReason,
          createdAt: c.createdAt.toISOString(),
          recruiter: c.recruiterUser
            ? {
                id: c.recruiterUser.id,
                email: c.recruiterUser.email,
                status: c.recruiterUser.status,
                companyName: c.recruiterUser.recruiterProfile?.companyName ?? null,
              }
            : null,
          trust: entry.trust,
          endorsementCount: entry.rows.length,
          retainedCount: retainedCompanyEndorsements(entry.rows).length,
          pendingProofs: entry.rows.filter((r) => r.proofFileUrl && r.proofAccepted === null).length,
        }
      }),
    })
  } catch (err) {
    next(err)
  }
})

/** Comptes recruteurs pour la liaison (avec l'entreprise déjà liée, le cas échéant). */
router.get('/recruiters', async (_req, res, next) => {
  try {
    const recruiters = await prisma.user.findMany({
      where: { role: 'recruiter' },
      orderBy: { email: 'asc' },
      select: {
        id: true,
        email: true,
        status: true,
        recruiterProfile: { select: { companyName: true, city: true } },
        linkedCompany: { select: { id: true, name: true } },
      },
    })
    res.json({
      recruiters: recruiters.map((r) => ({
        id: r.id,
        email: r.email,
        status: r.status,
        companyName: r.recruiterProfile?.companyName ?? null,
        city: r.recruiterProfile?.city ?? null,
        linkedCompany: r.linkedCompany,
      })),
    })
  } catch (err) {
    next(err)
  }
})

/**
 * Revue d'une recommandation d'entreprise : décision sur la preuve
 * (acceptée ou refusée -> le fichier est supprimé du disque, seul
 * `proofAccepted` reste) et/ou exclusion d'un auteur lié (motif obligatoire,
 * jamais de suppression).
 */
router.patch('/endorsements/:id', async (req, res, next) => {
  try {
    const body = companyEndorsementReviewSchema.parse(req.body)
    const e = await prisma.endorsement.findFirst({
      where: { id: req.params.id, subjectType: 'entreprise' },
      select: { id: true, companyId: true, proofFileUrl: true, proofAccepted: true, excludedAt: true },
    })
    if (!e) {
      res.status(404).json({ error: 'Recommandation introuvable.' })
      return
    }
    if (body.proofAccepted !== undefined && (!e.proofFileUrl || e.proofAccepted !== null)) {
      res.status(409).json({ error: 'Aucune preuve en attente pour cette recommandation.' })
      return
    }
    if (body.exclude && e.excludedAt) {
      res.status(409).json({ error: 'Cette recommandation est déjà écartée.' })
      return
    }
    const now = new Date()
    await prisma.endorsement.update({
      where: { id: e.id },
      data: {
        ...(body.proofAccepted !== undefined
          ? { proofAccepted: body.proofAccepted, reviewedAt: now, proofFileUrl: null }
          : {}),
        ...(body.exclude
          ? { excludedAt: now, excludedReason: body.exclude.reason, excludedById: req.session!.sub }
          : {}),
      },
    })
    // La base ne référence plus le fichier : on l'efface, dans les deux cas.
    if (body.proofAccepted !== undefined) await deleteProofFile(e.proofFileUrl)
    await prisma.auditLog.create({
      data: {
        userId: req.session!.sub,
        action: body.exclude ? 'company_endorsement_excluded' : 'company_endorsement_proof_reviewed',
        metadata: {
          endorsementId: e.id,
          companyId: e.companyId,
          ...(body.proofAccepted !== undefined ? { proofAccepted: body.proofAccepted, proofFileDeleted: true } : {}),
        },
      },
    })
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

router.get('/:id', async (req, res, next) => {
  try {
    const c = await prisma.company.findUnique({ where: { id: req.params.id }, select: companySelect })
    if (!c) {
      res.status(404).json({ error: 'Entreprise introuvable.' })
      return
    }
    const entry = (await loadCompanyTrust([c.id])).get(c.id)!
    res.json({
      company: {
        id: c.id,
        name: c.name,
        sector: c.sector,
        city: c.city,
        province: c.province,
        hiddenAt: c.hiddenAt?.toISOString() ?? null,
        hiddenReason: c.hiddenReason,
        recruiter: c.recruiterUser ? { id: c.recruiterUser.id, email: c.recruiterUser.email } : null,
        trust: entry.trust,
      },
      endorsements: [...entry.rows].reverse().map(adminEndorsementView),
    })
  } catch (err) {
    next(err)
  }
})

/** Masquer (motif) ou réafficher une fiche : masquée, elle n'apparaît plus nulle part. */
router.patch('/:id/visibility', async (req, res, next) => {
  try {
    const body = companyVisibilitySchema.parse(req.body)
    const c = await prisma.company.findUnique({ where: { id: req.params.id }, select: { id: true } })
    if (!c) {
      res.status(404).json({ error: 'Entreprise introuvable.' })
      return
    }
    await prisma.company.update({
      where: { id: c.id },
      data: body.hidden ? { hiddenAt: new Date(), hiddenReason: body.reason } : { hiddenAt: null, hiddenReason: null },
    })
    await prisma.auditLog.create({
      data: {
        userId: req.session!.sub,
        action: body.hidden ? 'company_hidden' : 'company_unhidden',
        metadata: { companyId: c.id },
      },
    })
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

/** Lier (ou délier avec `null`) la fiche à un compte recruteur. Un recruteur n'a qu'une fiche. */
router.put('/:id/recruiter', async (req, res, next) => {
  try {
    const body = companyRecruiterLinkSchema.parse(req.body)
    const c = await prisma.company.findUnique({ where: { id: req.params.id }, select: { id: true, name: true, recruiterUserId: true } })
    if (!c) {
      res.status(404).json({ error: 'Entreprise introuvable.' })
      return
    }
    if (body.recruiterUserId) {
      const recruiter = await prisma.user.findUnique({
        where: { id: body.recruiterUserId },
        select: { role: true, linkedCompany: { select: { id: true, name: true } } },
      })
      if (!recruiter || recruiter.role !== 'recruiter') {
        res.status(400).json({ error: 'Ce compte n’est pas un compte recruteur.' })
        return
      }
      if (recruiter.linkedCompany && recruiter.linkedCompany.id !== c.id) {
        res.status(409).json({ error: `Ce recruteur est déjà lié à « ${recruiter.linkedCompany.name} ».` })
        return
      }
    }
    await prisma.company.update({ where: { id: c.id }, data: { recruiterUserId: body.recruiterUserId } })
    await prisma.auditLog.create({
      data: {
        userId: req.session!.sub,
        action: body.recruiterUserId ? 'company_recruiter_linked' : 'company_recruiter_unlinked',
        metadata: { companyId: c.id, recruiterUserId: body.recruiterUserId, previousRecruiterUserId: c.recruiterUserId },
      },
    })
    res.json({ ok: true })
    if (body.recruiterUserId && body.recruiterUserId !== c.recruiterUserId) {
      void notifyUser({
        userId: body.recruiterUserId,
        event: 'company_recruiter_linked',
        title: 'Fiche entreprise liée',
        message: `Votre compte est lié à la fiche « ${clip(c.name, 60)} » : sa confiance s’affiche sur votre tableau de bord.`,
        link: '/recruteur',
      })
    }
  } catch (err) {
    next(err)
  }
})

export default router
