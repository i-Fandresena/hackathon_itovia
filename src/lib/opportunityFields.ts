/**
 * Règles de saisie des missions et des compétences requises d'une offre.
 * Module PARTAGÉ avec le serveur (`server/tsconfig.json` l'inclut) : aucune
 * API navigateur, React ou Vite ici. Le client s'en sert pour prévenir la
 * saisie, le serveur (`opportunityInputSchema`) fait foi avec les mêmes
 * fonctions.
 *
 * OffRec reste l'intermédiaire : ni les missions ni les compétences ne
 * doivent porter d'adresse email, de numéro de téléphone ou d'adresse web.
 * Le nom de l'entreprise n'est pas détectable automatiquement : c'est au
 * recruteur de ne pas l'écrire (aide affichée sous le champ), puisque les
 * missions sont montrées au candidat avant la mise en relation.
 */

import { COMMON_SKILLS } from '../data/constants.js'
import { contactDetailsError } from './interview.js'

/** Missions : facultatives, 15 au plus, de 3 à 200 caractères chacune. */
export const OPPORTUNITY_MISSIONS_MAX = 15
export const OPPORTUNITY_MISSION_MIN_LENGTH = 3
export const OPPORTUNITY_MISSION_MAX_LENGTH = 200

/** Compétences requises : 20 au plus (suggestions comprises), de 2 à 50 caractères. */
export const OPPORTUNITY_SKILLS_MAX = 20
export const OPPORTUNITY_SKILL_MIN_LENGTH = 2
export const OPPORTUNITY_SKILL_MAX_LENGTH = 50

/** Adresse web explicite, ou nom de domaine courant (« entreprise.mg »).
 *  Les extensions retenues évitent les faux positifs sur des compétences
 *  comme « Node.js », « ASP.NET » ou « Socket.io ». */
const URL_PATTERN = /(?:https?:\/\/|www\.)\S+|\b[\w-]+\.(?:com|mg|fr|org)\b/i

/** Espaces normalisés : un seul espace entre les mots, aucun aux extrémités. */
export function cleanText(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

/** Clé de comparaison insensible à la casse, aux accents et aux espaces. */
export function skillKey(value: string): string {
  return cleanText(value)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

function webAddressError(text: string): string | null {
  return URL_PATTERN.test(text)
    ? 'Retirez toute adresse de site web : OffRec transmet lui-même les informations utiles.'
    : null
}

/** Erreur française pour une mission déjà nettoyée (`cleanText`), ou `null`. */
export function missionError(mission: string): string | null {
  if (mission.length < OPPORTUNITY_MISSION_MIN_LENGTH) {
    return `${OPPORTUNITY_MISSION_MIN_LENGTH} caractères minimum.`
  }
  if (mission.length > OPPORTUNITY_MISSION_MAX_LENGTH) {
    return `${OPPORTUNITY_MISSION_MAX_LENGTH} caractères maximum.`
  }
  return contactDetailsError(mission) ?? webAddressError(mission)
}

/**
 * Contrôle d'une liste de missions telle que saisie : lignes vides ignorées,
 * espaces nettoyés. Renvoie la liste nettoyée et les erreurs (index dans la
 * liste nettoyée, message déjà préfixé par « Mission n : »).
 */
export function checkMissions(raw: readonly string[]): {
  missions: string[]
  errors: { index: number; message: string }[]
} {
  const missions = raw.map(cleanText).filter((m) => m !== '')
  const errors: { index: number; message: string }[] = []
  const seen = new Set<string>()
  missions.forEach((mission, index) => {
    const key = skillKey(mission)
    const error = missionError(mission) ?? (seen.has(key) ? 'cette mission figure déjà dans la liste.' : null)
    seen.add(key)
    if (error) errors.push({ index, message: `Mission ${index + 1} : ${error}` })
  })
  if (missions.length > OPPORTUNITY_MISSIONS_MAX) {
    errors.push({ index: -1, message: `${OPPORTUNITY_MISSIONS_MAX} missions au maximum.` })
  }
  return { missions, errors }
}

/**
 * Erreur de chaque ligne du formulaire (même ordre que `rows`, `null` si la
 * ligne convient ou est vide) — mêmes règles que `checkMissions`.
 */
export function missionRowErrors(rows: readonly string[]): (string | null)[] {
  const seen = new Set<string>()
  return rows.map((row) => {
    const mission = cleanText(row)
    if (mission === '') return null
    const key = skillKey(mission)
    const error = missionError(mission) ?? (seen.has(key) ? 'Cette mission figure déjà dans la liste.' : null)
    seen.add(key)
    return error
  })
}

/** Erreur française pour une compétence déjà nettoyée (`cleanText`), ou `null`. */
export function skillError(skill: string): string | null {
  if (skill.length < OPPORTUNITY_SKILL_MIN_LENGTH) {
    return `${OPPORTUNITY_SKILL_MIN_LENGTH} caractères minimum.`
  }
  if (skill.length > OPPORTUNITY_SKILL_MAX_LENGTH) {
    return `${OPPORTUNITY_SKILL_MAX_LENGTH} caractères maximum.`
  }
  return contactDetailsError(skill) ?? webAddressError(skill)
}

/**
 * Libellé retenu pour une compétence : celui de la suggestion équivalente
 * (même clé `skillKey`, ex. « javascript » → « JavaScript »), sinon la
 * saisie nettoyée.
 */
export function canonicalSkill(skill: string, suggestions: readonly string[] = COMMON_SKILLS): string {
  const key = skillKey(skill)
  return suggestions.find((s) => skillKey(s) === key) ?? cleanText(skill)
}

/** Vrai si `skill` est déjà dans `list`, à la casse et aux accents près. */
export function hasSkill(list: readonly string[], skill: string): boolean {
  const key = skillKey(skill)
  return list.some((s) => skillKey(s) === key)
}

/**
 * Liste de compétences requises normalisée : espaces nettoyés, lignes vides
 * retirées, libellé des suggestions repris, doublons (casse, accents)
 * fusionnés en gardant le premier. Ne valide pas : voir `skillError`.
 */
export function normalizeRequiredSkills(
  raw: readonly string[],
  suggestions: readonly string[] = COMMON_SKILLS,
): string[] {
  const result: string[] = []
  for (const value of raw) {
    const cleaned = cleanText(value)
    if (cleaned === '' || hasSkill(result, cleaned)) continue
    result.push(canonicalSkill(cleaned, suggestions))
  }
  return result
}
