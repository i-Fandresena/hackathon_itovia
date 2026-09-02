import type { Prisma } from '@prisma/client'

type UserWithProfiles = Prisma.UserGetPayload<{
  include: {
    candidateProfile: true
    recruiterProfile: true
    individualProfile: true
    agentProfile: true
    talentAccountProfile: true
    member: true
  }
}>

/** Ne jamais renvoyer `passwordHash` au client. */
export function serializeUser(user: UserWithProfiles) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt.toISOString(),
    candidateProfile: user.candidateProfile ?? undefined,
    recruiterProfile: user.recruiterProfile ?? undefined,
    individualProfile: user.individualProfile ?? undefined,
    agentProfile: user.agentProfile ?? undefined,
    talentAccountProfile: user.talentAccountProfile ?? undefined,
    /** Identité communautaire (annuaire) : absente tant que l'utilisateur n'a rien publié. */
    memberId: user.member?.id ?? null,
  }
}
