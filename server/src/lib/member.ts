import { prisma } from './prisma.js'

/**
 * Récupère l'identité communautaire du compte, la crée si besoin, et met à
 * jour son quartier si un nouveau est déclaré — « le quartier déclaré à la
 * dernière contribution fait foi », comme dans l'ancien AppContext.
 *
 * `info` est optionnel : une confirmation (« j'ai eu la même expérience »)
 * ne collecte ni nom ni quartier, donc un membre sans historique est créé
 * avec des valeurs génériques, corrigées dès sa première vraie contribution.
 */
export async function getOrCreateMember(
  userId: string,
  info?: { displayName: string; district: string; city?: string },
) {
  const existing = await prisma.member.findUnique({ where: { userId } })
  if (existing) {
    if (info && info.district && info.district !== existing.district) {
      return prisma.member.update({ where: { userId }, data: { district: info.district } })
    }
    return existing
  }
  return prisma.member.create({
    data: {
      userId,
      displayName: info?.displayName ?? 'Membre OffRec',
      district: info?.district ?? 'Antananarivo',
      city: info?.city ?? 'Antananarivo',
      phoneVerified: false,
    },
  })
}
