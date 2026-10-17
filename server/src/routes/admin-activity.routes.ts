import { Router } from 'express'
import type { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { requireRole } from '../middleware/rbac.js'
import { ACTIVITY_FAMILY_KEYS, adminActivityQuerySchema } from '../lib/validation.js'
import {
  ACTIVITY_FAMILY_LABELS,
  MASKED_ACTIONS,
  SYSTEM_ACTIONS,
  activityCursorWhere,
  actorSearchWhere,
  buildActivityItems,
  encodeActivityCursor,
  familyOf,
  familyWhere,
  type ActivityFamily,
} from '../lib/activity.js'

/**
 * Journal d'activité de la plateforme, côté admin (`/api/admin/activity`) —
 * CONSULTATION seulement, tiré d'`AuditLog`. Distinct des notifications
 * admin (sélection d'événements rédigés pour un humain) : ici, toutes les
 * actions journalisées, filtrables.
 *
 * Pagination par curseur (createdAt desc, id desc) plutôt que par décalage :
 * le journal grossit en continu, un décalage ferait réapparaître ou sauter
 * des lignes quand de nouveaux événements arrivent entre deux pages.
 *
 * Lignes construites par liste blanche (`lib/activity.ts`) : jamais la
 * `metadata` brute.
 */
const router = Router()

router.use(requireRole('admin'))

router.get('/', async (req, res, next) => {
  try {
    const query = adminActivityQuerySchema.parse(req.query)

    // Filtres communs à la liste et aux compteurs par famille (tout sauf la famille et le curseur).
    const base: Prisma.AuditLogWhereInput[] = []
    if (!query.system) base.push({ action: { notIn: SYSTEM_ACTIONS } })
    if (query.role || query.q) {
      // Filtrer sur l'acteur révélerait l'auteur d'une recommandation : ces lignes sortent du résultat.
      base.push({ action: { notIn: MASKED_ACTIONS } })
      base.push({
        user: { is: { ...(query.role ? { role: query.role } : {}), ...(query.q ? actorSearchWhere(query.q) : {}) } },
      })
    }
    if (query.from) base.push({ createdAt: { gte: new Date(query.from) } })
    if (query.to) base.push({ createdAt: { lt: new Date(query.to) } })

    const listWhere: Prisma.AuditLogWhereInput = {
      AND: [
        ...base,
        ...(query.family ? [familyWhere(query.family)] : []),
        ...(query.cursor ? [activityCursorWhere(query.cursor)] : []),
      ],
    }

    const [logs, groups] = await Promise.all([
      prisma.auditLog.findMany({
        where: listWhere,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: query.limit + 1,
        select: { id: true, userId: true, action: true, metadata: true, createdAt: true },
      }),
      prisma.auditLog.groupBy({ by: ['action'], where: { AND: base }, _count: { _all: true } }),
    ])

    const hasMore = logs.length > query.limit
    const page = hasMore ? logs.slice(0, query.limit) : logs
    const items = await buildActivityItems(page)

    const counts = Object.fromEntries(ACTIVITY_FAMILY_KEYS.map((k) => [k, 0])) as Record<ActivityFamily, number>
    for (const g of groups) counts[familyOf(g.action)] += g._count._all
    const all = Object.values(counts).reduce((a, b) => a + b, 0)

    res.json({
      items,
      nextCursor: hasMore ? encodeActivityCursor(page[page.length - 1]) : null,
      /** Nombre de lignes correspondant aux filtres (famille comprise), toutes pages confondues. */
      total: query.family ? counts[query.family] : all,
      /** Compteurs par famille sous les autres filtres ; `autre` n'apparaît que s'il est non nul. */
      families: ACTIVITY_FAMILY_KEYS.filter((k) => k !== 'autre' || counts.autre > 0).map((key) => ({
        key,
        label: ACTIVITY_FAMILY_LABELS[key],
        count: counts[key],
      })),
      allCount: all,
      includeSystem: query.system,
    })
  } catch (err) {
    next(err)
  }
})

export default router
