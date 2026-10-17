import { Prisma } from '@prisma/client'

/**
 * Colonne `Opportunity.missions` (migration 20261015090000_opportunity_missions).
 *
 * Le client Prisma déjà généré peut être antérieur à la colonne (serveur en
 * `tsx watch` qui recharge le code sans régénérer le client) : il refuserait
 * alors tout `missions` dans un `data` ou un `select` (« Unknown argument »).
 * Tant que c'est le cas, les lectures renvoient `[]`, les écritures
 * ignorent une liste vide et refusent une liste non vide avec un message
 * clair (`MISSIONS_UNAVAILABLE_MESSAGE`) ; tout le reste (liste, détail,
 * création et modification d'offre, matching) fonctionne comme avant.
 * Après `prisma generate` et redémarrage, tout passe par la colonne.
 *
 * Les helpers sont typés `{}` pour compiler avec l'ancien comme avec le
 * nouveau client.
 */
export const OPPORTUNITY_MISSIONS_SUPPORTED = Object.prototype.hasOwnProperty.call(
  Prisma.OpportunityScalarFieldEnum ?? {},
  'missions',
)

export const MISSIONS_UNAVAILABLE_MESSAGE =
  'Les missions ne peuvent pas encore être enregistrées : le serveur OffRec doit être mis à jour ' +
  '(régénération du client Prisma puis redémarrage). Retirez les missions pour publier maintenant, ' +
  'ou réessayez plus tard.'

/** `{ missions: true }` à ajouter à un `select` d'offre, ou `{}`. */
export const MISSIONS_SELECT: {} = OPPORTUNITY_MISSIONS_SUPPORTED ? { missions: true } : {}

/**
 * Champ `missions` à ajouter au `data` d'une création ou d'une mise à jour.
 * `undefined` (non fourni) : rien n'est écrit. `null` : client trop ancien
 * pour une liste non vide — l'appelant répond 503.
 */
export function missionsData(missions: string[] | undefined): {} | null {
  if (missions === undefined) return {}
  if (OPPORTUNITY_MISSIONS_SUPPORTED) return { missions }
  return missions.length === 0 ? {} : null
}

/** Missions d'une ligne `Opportunity` quel que soit le client (`[]` si absentes). */
export function missionsOf(row: object): string[] {
  const value = (row as { missions?: unknown }).missions
  return Array.isArray(value) ? value.filter((m): m is string => typeof m === 'string') : []
}
