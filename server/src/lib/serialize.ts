import type { CandidateProfile, Prisma } from '@prisma/client'
import { parseCvFlags } from './cv-flags.js'

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

/**
 * Profil candidat renvoyé AU CANDIDAT LUI-MÊME (`/auth/*`). Il voit le statut,
 * la note et les points relevés sur son CV, mais jamais l'identité du
 * vérificateur (`cvVerifiedById`) ni l'empreinte du fichier (`cvFileHash`).
 * Ne jamais utiliser pour une réponse destinée à un recruteur.
 */
export function serializeOwnCandidateProfile(profile: CandidateProfile) {
  const { cvFileHash: _cvFileHash, cvVerifiedById: _cvVerifiedById, cvFlags, ...rest } = profile
  return { ...rest, cvFlags: parseCvFlags(cvFlags) }
}

/**
 * Ne jamais renvoyer `passwordHash` au client.
 *
 * `access.canVerifyCv` est calculé par l'appelant (`canVerifyCv(user.role)`,
 * lecture en base) : il est obligatoire pour qu'aucune route ne renvoie un
 * utilisateur sans ce droit explicite.
 */
export function serializeUser(user: UserWithProfiles, access: { canVerifyCv: boolean }) {
  return {
    canVerifyCv: access.canVerifyCv,
    id: user.id,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt.toISOString(),
    candidateProfile: user.candidateProfile ? serializeOwnCandidateProfile(user.candidateProfile) : undefined,
    recruiterProfile: user.recruiterProfile ?? undefined,
    individualProfile: user.individualProfile ?? undefined,
    agentProfile: user.agentProfile ?? undefined,
    talentAccountProfile: user.talentAccountProfile ?? undefined,
    /** Identité communautaire (annuaire) : absente tant que l'utilisateur n'a rien publié. */
    memberId: user.member?.id ?? null,
  }
}
