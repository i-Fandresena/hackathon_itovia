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
