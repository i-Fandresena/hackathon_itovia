import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { requireRole } from '../middleware/rbac.js'
import { companyListQuerySchema } from '../lib/validation.js'
import { VISIBLE_COMPANY_WHERE, getLinkedCompany, getPublicCompany, listPublicCompanies } from '../lib/companies.js'

/**
 * Entreprises recommandées (`/api/companies`). Lecture SANS authentification
 * pour la vitrine, la fiche et la recherche du formulaire ; chaque réponse
 * publique passe par la liste blanche `toPublicCompany()`. Une entreprise
 * masquée par un admin n'apparaît nulle part. `Cache-Control: no-store` :
 * un masquage prend effet immédiatement.
 */
const router = Router()

const readLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de requêtes. Réessayez dans quelques minutes.' },
})

const NOT_FOUND = { error: 'Cette entreprise n’est pas (ou plus) présentée.' }
const uuid = z.string().uuid()

/** Vitrine et recherche (`?q=` sur le nom normalisé, `city`, `sector`). */
router.get('/', readLimiter, async (req, res, next) => {
  try {
    const query = companyListQuerySchema.parse(req.query)
    const result = await listPublicCompanies(query)
    res.set('Cache-Control', 'no-store')
    res.json(result)
  } catch (err) {
    next(err)
  }
})

/** Recruteur : sa fiche entreprise liée par un admin (niveau, nombre, points forts), `null` sinon. */
router.get('/mine', requireRole('recruiter'), async (req, res, next) => {
  try {
    res.set('Cache-Control', 'no-store')
    res.json({ company: await getLinkedCompany(req.session!.sub) })
  } catch (err) {
    next(err)
  }
})

/**
 * Fiche de l'entreprise qui publie une offre (page publique `/offres/:id`,
 * où le nom est déjà public ; côté candidat, appelée seulement après la mise
 * en relation). `{ company: null }` si le recruteur n'est lié à aucune fiche
 * visible.
 */
router.get('/by-opportunity/:opportunityId', readLimiter, async (req, res, next) => {
  try {
    res.set('Cache-Control', 'no-store')
    if (!uuid.safeParse(req.params.opportunityId).success) {
      res.json({ company: null })
      return
    }
    const opportunity = await prisma.opportunity.findUnique({
      where: { id: req.params.opportunityId },
      select: { recruiterId: true },
    })
    const company = opportunity
      ? await prisma.company.findFirst({
          where: { ...VISIBLE_COMPANY_WHERE, recruiterUserId: opportunity.recruiterId },
          select: { id: true },
        })
      : null
    res.json({ company: company ? await getPublicCompany(company.id) : null })
  } catch (err) {
    next(err)
  }
})

router.get('/:id', readLimiter, async (req, res, next) => {
  try {
    res.set('Cache-Control', 'no-store')
    const company = uuid.safeParse(req.params.id).success ? await getPublicCompany(req.params.id) : null
    if (!company) {
      res.status(404).json(NOT_FOUND)
      return
    }
    res.json({ company })
  } catch (err) {
    next(err)
  }
})

export default router
