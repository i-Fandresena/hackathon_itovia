import { prisma } from './prisma.js'

/** Retrouve l'utilisateur responsable d'un contenu signalé. */
export async function resolveTargetUserId(
  targetType: 'opportunity' | 'provider' | 'recommendation' | 'user' | 'endorsement' | 'talent' | 'company',
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
    case 'endorsement': {
      const e = await prisma.endorsement.findUnique({
        where: { id: targetId },
        select: { authorMember: { select: { userId: true } } },
      })
      return e?.authorMember.userId ?? null
    }
    case 'talent': {
      // Fiche publique d'un talent : l'agent qui la suit en est responsable
      // (il a recueilli l'accord et seul il crée et modifie le profil,
      // §7.3.14). `targetId` est l'id du profil (le `publicRef` reçu du
      // client est résolu par reports.routes.ts).
      const t = await prisma.talentProfile.findUnique({ where: { id: targetId }, select: { agentId: true } })
      return t?.agentId ?? null
    }
    case 'company':
      // Une entreprise n'est pas un compte : aucun responsable sanctionnable
      // par le pipeline avertissement -> bannissement. L'admin agit sur la
      // fiche (masquer, délier) depuis « Entreprises ». Même un recruteur
      // lié n'est pas visé automatiquement.
      return null
    case 'user':
      return targetId
    default:
      return null
  }
}
