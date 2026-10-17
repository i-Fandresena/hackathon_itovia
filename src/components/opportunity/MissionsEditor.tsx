import { ArrowDown, ArrowUp, Plus, X } from 'lucide-react'
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { Button } from '../ui/Button'
import {
  OPPORTUNITY_MISSION_MAX_LENGTH,
  OPPORTUNITY_MISSIONS_MAX,
  cleanText,
  missionRowErrors,
} from '../../lib/opportunityFields'
import './MissionsEditor.css'

interface MissionsEditorProps {
  /** Lignes telles que saisies (une ligne vide est permise, ignorée à l'envoi). */
  rows: string[]
  onChange: (rows: string[]) => void
  /** Affiche les erreurs de chaque ligne (après une tentative d'envoi). */
  showErrors?: boolean
}

type FocusPart = 'input' | 'up' | 'down'

/**
 * Liste ordonnée des missions d'une offre : ajout, suppression,
 * réordonnancement, entièrement utilisable au clavier (Entrée ajoute une
 * ligne, Retour arrière sur une ligne vide la supprime). Règles partagées
 * avec le serveur dans `src/lib/opportunityFields.ts`.
 */
export function MissionsEditor({ rows, onChange, showErrors }: MissionsEditorProps) {
  const baseId = useId()
  const listRef = useRef<HTMLOListElement>(null)
  const [focus, setFocus] = useState<{ index: number; part: FocusPart } | null>(null)

  const errors = missionRowErrors(rows)
  const filled = rows.filter((row) => cleanText(row) !== '').length
  const canAdd = rows.length < OPPORTUNITY_MISSIONS_MAX

  useEffect(() => {
    if (!focus) return
    const row = listRef.current?.querySelectorAll<HTMLElement>('[data-mission-row]')[focus.index]
    const target = row?.querySelector<HTMLElement>(`[data-part="${focus.part}"]:not(:disabled)`)
    ;(target ?? row?.querySelector<HTMLElement>('[data-part="input"]'))?.focus()
    setFocus(null)
  }, [focus])

  const update = (index: number, value: string) => {
    onChange(rows.map((row, i) => (i === index ? value : row)))
  }

  const insertAfter = (index: number) => {
    if (!canAdd) return
    onChange([...rows.slice(0, index + 1), '', ...rows.slice(index + 1)])
    setFocus({ index: index + 1, part: 'input' })
  }

  const remove = (index: number, focusPrevious = false) => {
    if (rows.length === 1) {
      onChange([''])
      setFocus({ index: 0, part: 'input' })
      return
    }
    onChange(rows.filter((_, i) => i !== index))
    setFocus(
      focusPrevious || index === rows.length - 1
        ? { index: Math.max(0, index - 1), part: 'input' }
        : { index, part: 'input' },
    )
  }

  const move = (index: number, delta: -1 | 1) => {
    const target = index + delta
    if (target < 0 || target >= rows.length) return
    const next = [...rows]
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange(next)
    setFocus({ index: target, part: delta < 0 ? 'up' : 'down' })
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>, index: number) => {
    if (event.key === 'Enter') {
      // Jamais d'envoi du formulaire depuis une ligne de mission.
      event.preventDefault()
      if (cleanText(rows[index]) !== '') insertAfter(index)
    } else if (event.key === 'Backspace' && rows[index] === '' && rows.length > 1) {
      event.preventDefault()
      remove(index, true)
    }
  }

  return (
    <fieldset className="mission-editor" aria-describedby={`${baseId}-hint`}>
      <legend className="field-label">
        Missions du poste <span className="mission-editor-optional">(facultatif)</span>
      </legend>
      <p className="field-hint" id={`${baseId}-hint`}>
        Une action concrète par ligne, dans l’ordre d’importance. Ne mentionnez ni le nom de
        l’entreprise ni de coordonnées (email, téléphone, site web) : les candidats voient ces
        missions avant la mise en relation.
      </p>

      <ol className="mission-editor-list" ref={listRef}>
        {rows.map((row, index) => {
          const error = showErrors ? errors[index] : null
          const errorId = `${baseId}-error-${index}`
          const n = index + 1
          return (
            <li key={index} className="mission-row" data-mission-row>
              <span className="mission-row-num" aria-hidden>
                {n}.
              </span>
              <input
                className="input mission-row-input"
                data-part="input"
                value={row}
                maxLength={OPPORTUNITY_MISSION_MAX_LENGTH}
                placeholder={index === 0 ? 'Ex. Gérer le planning des livraisons' : 'Mission suivante'}
                aria-label={`Mission ${n}`}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? errorId : undefined}
                onChange={(e) => update(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, index)}
              />
              <div className="mission-row-actions">
                <button
                  type="button"
                  className="mission-icon-btn"
                  data-part="up"
                  aria-label={`Monter la mission ${n}`}
                  title="Monter"
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                >
                  <ArrowUp size={16} aria-hidden />
                </button>
                <button
                  type="button"
                  className="mission-icon-btn"
                  data-part="down"
                  aria-label={`Descendre la mission ${n}`}
                  title="Descendre"
                  disabled={index === rows.length - 1}
                  onClick={() => move(index, 1)}
                >
                  <ArrowDown size={16} aria-hidden />
                </button>
                <button
                  type="button"
                  className="mission-icon-btn mission-icon-btn-danger"
                  aria-label={`Supprimer la mission ${n}`}
                  title="Supprimer"
                  disabled={rows.length === 1 && row === ''}
                  onClick={() => remove(index)}
                >
                  <X size={16} aria-hidden />
                </button>
              </div>
              {error && (
                <p className="field-error mission-row-error" id={errorId}>
                  {error}
                </p>
              )}
            </li>
          )
        })}
      </ol>

      <div className="mission-editor-foot">
        <Button
          variant="outline"
          size="sm"
          disabled={!canAdd}
          onClick={() => insertAfter(rows.length - 1)}
        >
          <Plus size={14} aria-hidden />
          Ajouter une mission
        </Button>
        <span className="mission-editor-count" aria-live="polite">
          {filled} / {OPPORTUNITY_MISSIONS_MAX} missions
        </span>
      </div>
    </fieldset>
  )
}
