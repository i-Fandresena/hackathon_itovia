import type { CandidateHiringPhase } from './hiring'
import type { MatchSuggestionStatus } from '../types'

/**
 * Vocabulaire du suivi côté candidat (parcours 2026-10-08) : le candidat ne
 * postule plus, il suit les dossiers qu'OffRec a transmis à une entreprise.
 * `proposee_candidat` / `interet_candidat` ne sont plus produits : ce sont
 * des lignes héritées de l'ancien parcours, encore en cours.
 */
interface DossierStatusInfo {
  label: string
  description: string
  variant: 'default' | 'primary' | 'success' | 'muted'
}

const DOSSIER_STATUS: Partial<Record<MatchSuggestionStatus, DossierStatusInfo>> = {
  proposee_recruteur: {
    label: 'Profil transmis à l’entreprise',
    description:
      'OffRec a transmis votre profil à l’entreprise. Vous serez notifié·e ici et par email si la mise en relation est confirmée.',
    variant: 'default',
  },
  interet_recruteur: {
    label: 'L’entreprise est intéressée',
    description:
      'L’entreprise s’intéresse à votre profil. OffRec prépare la mise en relation et vous préviendra dès qu’elle sera confirmée.',
    variant: 'primary',
  },
  mise_en_relation: {
    label: 'Mis en relation',
    description:
      'La mise en relation est confirmée. OffRec vous recontacte pour les prochaines étapes.',
    variant: 'success',
  },
  proposee_candidat: {
    label: 'Proposition en attente (ancien parcours)',
    description:
      'Cette offre vous a été proposée avant le nouveau parcours. Indiquez si elle vous intéresse, ou retirez-vous du dossier.',
    variant: 'muted',
  },
  interet_candidat: {
    label: 'Intérêt signalé (ancien parcours)',
    description:
      'Vous avez signalé votre intérêt pour cette offre avant le nouveau parcours. OffRec étudie la transmission de votre profil à l’entreprise.',
    variant: 'muted',
  },
}

const UNKNOWN_STATUS: DossierStatusInfo = {
  label: 'Dossier en cours',
  description: 'Ce dossier est suivi par OffRec.',
  variant: 'muted',
}

export function dossierStatusInfo(status: MatchSuggestionStatus): DossierStatusInfo {
  return DOSSIER_STATUS[status] ?? UNKNOWN_STATUS
}

/** Le profil est réellement chez une entreprise (hors lignes héritées). */
export function isTransmitted(status: MatchSuggestionStatus): boolean {
  return status === 'proposee_recruteur' || status === 'interet_recruteur' || status === 'mise_en_relation'
}

/** Le retrait reste possible tant que la mise en relation n'est pas
 *  confirmée — le serveur refuse ensuite (400). */
export function canWithdrawFromDossier(status: MatchSuggestionStatus): boolean {
  return status !== 'mise_en_relation' && status !== 'ecartee'
}

/**
 * Après l'entretien (sous-lot 4) : texte NEUTRE de chaque phase vue par le
 * candidat (`candidatePhase`, calculée par le serveur avec
 * `candidateHiringPhase`). Jamais l'issue brute, le motif, la note, le score
 * ni le rang : seulement ce qu'OffRec lui a déjà écrit (plan §6.4).
 */
export const CANDIDATE_PHASE_TEXT: Record<CandidateHiringPhase, string> = {
  entretien_a_planifier:
    'La mise en relation est confirmée. L’entreprise va vous proposer une date d’entretien : OffRec vous prévient ici et par email.',
  entretien_prevu: 'Un entretien est prévu. Confirmez votre présence ou signalez un empêchement.',
  entretien_annule:
    'L’entreprise a annulé l’entretien. Votre mise en relation reste active : OffRec revient vers vous pour la suite.',
  suite_en_attente:
    'L’entretien a eu lieu. OffRec vous informe ici et par email dès que l’entreprise a fait connaître la suite.',
  suite_favorable:
    'L’entreprise souhaite poursuivre avec vous. OffRec vous tient informé·e de la prochaine étape ici et par email.',
  entretien_manque:
    'L’entreprise nous indique que l’entretien n’a pas pu avoir lieu en votre présence. Si vous avez rencontré un empêchement, expliquez-le à OffRec : nous reviendrons vers vous.',
  proposition_recue: 'Une proposition d’embauche vous attend. OffRec vous la présente dans votre espace.',
  embauche: 'Embauche confirmée. OffRec vous accompagne pour la suite.',
  clos: 'Ce dossier est clos. Votre profil reste proposé par OffRec pour d’autres offres qui correspondent à vos compétences.',
}

/** Dossier clos (« Dossier clos ») : rangé à part dans le tableau de bord. */
export function isClosedDossier(dossier: { status: MatchSuggestionStatus; candidatePhase?: CandidateHiringPhase | null }): boolean {
  return dossier.status === 'mise_en_relation' && dossier.candidatePhase === 'clos'
}
