import { Briefcase, Check, FileSearch, GraduationCap, MapPin, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { EXPERIENCE_LABELS, OPPORTUNITY_TYPE_LABELS } from '../../data/constants'
import type { MatchFit } from '../../types'
import './MatchFitDetail.css'

type Tone = 'ok' | 'partial' | 'ko'

interface MatchFitDetailProps {
  fit: MatchFit
  /**
   * Vue admin uniquement : compétences requises absentes du profil mais
   * détectées par l'IA dans le CV. Simple indice — jamais dans le score, le
   * classement ou les filtres, et jamais transmis au recruteur (ne pas passer
   * cette prop côté recruteur).
   */
  cvHintSkills?: string[]
}

/** Niveau sans la fourchette d'années (« Junior (1–2 ans) » → « Junior »). */
function shortLevel(label: string): string {
  return label.replace(/\s*\(.*\)$/, '')
}

/**
 * Adéquation d'un profil avec une offre, critère par critère : compétences
 * requises couvertes / manquantes, lieu, niveau, type. Calculée par le
 * serveur (`computeMatchFit`), identique pour l'admin et le recruteur.
 */
export function MatchFitDetail({ fit, cvHintSkills = [] }: MatchFitDetailProps) {
  const { covered, missing } = fit.skills
  const total = covered.length + missing.length
  const hints = new Set(cvHintSkills)

  const place = `${fit.location.city}, ${fit.location.province}`
  const location: { tone: Tone; text: string } =
    fit.location.match === 'meme_ville'
      ? { tone: 'ok', text: `Même ville (${fit.location.city})` }
      : fit.location.match === 'meme_province'
        ? { tone: 'partial', text: `Même province (${fit.location.province})` }
        : { tone: 'ko', text: `Autre province (offre : ${place})` }

  const candidateLevel = shortLevel(EXPERIENCE_LABELS[fit.level.candidate] ?? fit.level.candidate)
  const requiredLevel = shortLevel(EXPERIENCE_LABELS[fit.level.required] ?? fit.level.required)
  const level: { tone: Tone; text: string } = fit.level.conforme
    ? { tone: 'ok', text: `Niveau conforme : ${candidateLevel} (requis : ${requiredLevel})` }
    : { tone: 'ko', text: `Niveau non conforme : ${candidateLevel} (requis : ${requiredLevel})` }

  const offeredType = OPPORTUNITY_TYPE_LABELS[fit.type.offered] ?? fit.type.offered
  const type: { tone: Tone; text: string } =
    fit.type.match === 'souhaite'
      ? { tone: 'ok', text: `${offeredType} : type souhaité` }
      : fit.type.match === 'sans_preference'
        ? { tone: 'partial', text: `${offeredType} : aucune préférence déclarée` }
        : { tone: 'ko', text: `${offeredType} : type non recherché` }

  return (
    <div className="fitd">
      <div className="fitd-skills">
        <p className="fitd-label">
          Compétences requises
          <span className="fitd-ratio">
            {covered.length}/{total}
          </span>
        </p>
        {total === 0 ? (
          <p className="fitd-none">L’offre ne liste aucune compétence requise.</p>
        ) : (
          <ul className="fitd-chips">
            {covered.map((skill) => (
              <li key={`c-${skill}`} className="fitd-chip fitd-chip-ok">
                <Check size={12} aria-hidden />
                <span className="fitd-sr">Couverte : </span>
                {skill}
              </li>
            ))}
            {missing.map((skill) =>
              hints.has(skill) ? (
                <li
                  key={`m-${skill}`}
                  className="fitd-chip fitd-chip-hint"
                  title="Présent dans le CV, non confirmé au profil — indice, non pris en compte dans le score"
                >
                  <FileSearch size={12} aria-hidden />
                  <span className="fitd-sr">Manquante, présente dans le CV : </span>
                  {skill}
                </li>
              ) : (
                <li key={`m-${skill}`} className="fitd-chip fitd-chip-ko">
                  <X size={12} aria-hidden />
                  <span className="fitd-sr">Manquante : </span>
                  {skill}
                </li>
              ),
            )}
          </ul>
        )}
        {cvHintSkills.length > 0 && (
          <p className="fitd-hint">
            <FileSearch size={13} aria-hidden />
            <span>
              Présent dans le CV, non confirmé au profil : <strong>{cvHintSkills.join(', ')}</strong>. Indice issu de la
              lecture automatique du CV — non pris en compte dans le score ni dans le classement.
            </span>
          </p>
        )}
      </div>

      <ul className="fitd-facts">
        <Fact icon={MapPin} tone={location.tone} text={location.text} />
        <Fact icon={GraduationCap} tone={level.tone} text={level.text} />
        <Fact icon={Briefcase} tone={type.tone} text={type.text} />
      </ul>
    </div>
  )
}

function Fact({ icon: Icon, tone, text }: { icon: LucideIcon; tone: Tone; text: string }) {
  return (
    <li className={`fitd-fact fitd-fact-${tone}`}>
      <Icon size={14} aria-hidden />
      <span>{text}</span>
    </li>
  )
}
