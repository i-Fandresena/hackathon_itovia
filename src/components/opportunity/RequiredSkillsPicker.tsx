import { Plus, X } from 'lucide-react'
import { useId, useRef, useState, type KeyboardEvent } from 'react'
import { Button } from '../ui/Button'
import { COMMON_SKILLS } from '../../data/constants'
import {
  OPPORTUNITY_SKILL_MAX_LENGTH,
  OPPORTUNITY_SKILLS_MAX,
  canonicalSkill,
  cleanText,
  skillError,
  skillKey,
} from '../../lib/opportunityFields'
import './RequiredSkillsPicker.css'

interface RequiredSkillsPickerProps {
  /** Compétences retenues, dans l'ordre de sélection. */
  value: string[]
  onChange: (skills: string[]) => void
}

const SUGGESTIONS: readonly string[] = COMMON_SKILLS

/**
 * Compétences requises d'une offre : suggestions à cocher, plus une saisie
 * libre pour une compétence absente des suggestions. Une saisie équivalente à
 * une suggestion (casse, accents) sélectionne la suggestion au lieu de créer
 * un doublon. Règles partagées avec le serveur (`src/lib/opportunityFields.ts`).
 */
export function RequiredSkillsPicker({ value, onChange }: RequiredSkillsPickerProps) {
  const baseId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')

  const custom = value.filter((skill) => !SUGGESTIONS.includes(skill))
  const full = value.length >= OPPORTUNITY_SKILLS_MAX
  const fullMessage = `${OPPORTUNITY_SKILLS_MAX} compétences au maximum : retirez-en une pour en ajouter une autre.`

  const toggle = (skill: string) => {
    setError('')
    setStatus('')
    if (value.includes(skill)) {
      onChange(value.filter((s) => s !== skill))
      return
    }
    if (full) {
      setError(fullMessage)
      return
    }
    onChange([...value, skill])
  }

  const removeCustom = (skill: string, refocus = true) => {
    onChange(value.filter((s) => s !== skill))
    setError('')
    setStatus(`« ${skill} » retirée.`)
    if (refocus) inputRef.current?.focus()
  }

  const add = () => {
    setStatus('')
    const cleaned = cleanText(draft)
    if (cleaned === '') {
      setError('Saisissez une compétence avant de l’ajouter.')
      return
    }
    const invalid = skillError(cleaned)
    if (invalid) {
      setError(invalid)
      return
    }
    const label = canonicalSkill(cleaned, SUGGESTIONS)
    const existing = value.find((s) => skillKey(s) === skillKey(label))
    if (existing) {
      setError(`« ${existing} » figure déjà dans les compétences requises.`)
      return
    }
    if (full) {
      setError(fullMessage)
      return
    }
    onChange([...value, label])
    setDraft('')
    setError('')
    setStatus(
      SUGGESTIONS.includes(label) ? `« ${label} » sélectionnée dans les suggestions.` : `« ${label} » ajoutée.`,
    )
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      // Ajoute la compétence au lieu d'envoyer le formulaire.
      event.preventDefault()
      add()
    } else if (event.key === 'Backspace' && draft === '' && custom.length > 0) {
      event.preventDefault()
      removeCustom(custom[custom.length - 1], false)
    }
  }

  return (
    <fieldset className="skill-picker" aria-describedby={`${baseId}-hint`}>
      <legend className="field-label">Compétences requises</legend>
      <p className="field-hint" id={`${baseId}-hint`}>
        Sélectionnez les suggestions utiles ou ajoutez une compétence absente de la liste.
      </p>

      <div className="skill-chips" role="group" aria-label="Compétences suggérées">
        {SUGGESTIONS.map((skill) => {
          const active = value.includes(skill)
          return (
            <button
              key={skill}
              type="button"
              className={`chip ${active ? 'active' : ''}`}
              aria-pressed={active}
              onClick={() => toggle(skill)}
            >
              {skill}
            </button>
          )
        })}
      </div>

      {custom.length > 0 && (
        <ul className="skill-picker-custom" aria-label="Compétences ajoutées hors suggestions">
          {custom.map((skill) => (
            <li key={skill} className="chip active skill-picker-tag">
              <span>{skill}</span>
              <button
                type="button"
                className="skill-picker-remove"
                aria-label={`Retirer la compétence ${skill}`}
                title="Retirer"
                onClick={() => removeCustom(skill)}
              >
                <X size={14} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="skill-picker-add">
        <label className="skill-picker-add-label" htmlFor={`${baseId}-input`}>
          Autre compétence
        </label>
        <div className="skill-picker-add-row">
          <input
            ref={inputRef}
            id={`${baseId}-input`}
            className="input"
            value={draft}
            maxLength={OPPORTUNITY_SKILL_MAX_LENGTH}
            placeholder="Ex. Figma, Permis B, Soudure…"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${baseId}-error` : `${baseId}-help`}
            onChange={(e) => {
              setDraft(e.target.value)
              if (error) setError('')
            }}
            onKeyDown={handleKeyDown}
          />
          <Button variant="outline" size="sm" onClick={add}>
            <Plus size={14} aria-hidden />
            Ajouter
          </Button>
        </div>
        {error ? (
          <p className="field-error" id={`${baseId}-error`} role="alert">
            {error}
          </p>
        ) : (
          <p className="field-hint" id={`${baseId}-help`}>
            Entrée pour ajouter · {value.length} / {OPPORTUNITY_SKILLS_MAX} compétences
          </p>
        )}
        <p className="skill-picker-status" role="status" aria-live="polite">
          {status}
        </p>
      </div>
    </fieldset>
  )
}
