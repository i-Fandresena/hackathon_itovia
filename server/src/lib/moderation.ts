import { prisma } from './prisma.js'

/** Retrouve l'utilisateur responsable d'un contenu signalé. */
export async function resolveTargetUserId(
  targetType: 'opportunity' | 'provider' | 'recommendation' | 'user',
  targetId: string,
): Promise<string | null> {
  switch (targetType) {
    case 'opportunity': {
      const o = await prisma.opportunity.findUnique({ where: { id: targetId }, select: { recruiterId: true } })
      return o?.recruiterId ?? null
    }
    case 'provider': {
      const p = await prisma.provider.findUnique({
        where: { id: targetId },
        select: { addedByMember: { select: { userId: true } } },
      })
      return p?.addedByMember.userId ?? null
    }
    case 'recommendation': {
      const r = await prisma.recommendation.findUnique({
        where: { id: targetId },
        select: { authorMember: { select: { userId: true } } },
      })
      return r?.authorMember.userId ?? null
    }
    case 'user':
      return targetId
    default:
      return null
  }
}
