import { Send } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Button } from '../ui/Button'
import { Field, Input, Select, Textarea } from '../ui/Form'
import { Modal } from '../ui/Modal'
import { useApp } from '../../context/AppContext'
import { ApiError, apiReviseHireProposal, apiSendHireProposal, type HireProposalChangesInput } from '../../lib/api'
import {
  CONTRACTS_WITH_DURATION,
  CONTRACT_DURATION_MAX_MONTHS,
  CONTRACT_DURATION_MIN_MONTHS,
  CONTRACT_TYPES,
  CONTRACT_TYPE_LABELS,
  HIRE_JOB_TITLE_MAX,
  HIRE_JOB_TITLE_MIN,
  HIRE_MESSAGE_MAX,
  HIRE_PROPOSAL_TTL_DAYS,
  HIRE_START_MAX_DAYS,
  MAX_PROPOSAL_VERSIONS,
  contractDurationError,
  formatAriaryAmount,
  hireProposalExpiresAt,
  hireSalaryError,
  hireStartDateError,
  madagascarToday,
  mergeProposalRevision,
  proposalSummaryText,
  type HireProposalFields,
  type HireProposalView,
} from '../../lib/hiring'
import { contactDetailsError, formatMadagascarDateTime } from '../../lib/interview'
import type { ContractType } from '../../types'
import { stateText } from './HireProposalSummary'
import './HireProposalModal.css'

const DAY_MS = 24 * 60 * 60 * 1000

interface HireProposalModalProps {
  /** `send` : nouvelle proposition (version `version`) ; `revise` : modifier la proposition en attente. */
  mode: 'send' | 'revise'
  suggestionId: string
  candidateName: string
  opportunityTitle: string
  /**
   * `revise` : la proposition en attente, RELUE par le parent à chaque rendu
   * (après un 409, la modale ré-affiche la version à jour) ; `send` : la
   * version précédente éventuelle, pour préremplir.
   */
  current?: HireProposalView | null
  /** Numéro de la version envoyée (`send`) ou modifiée (`revise`). */
  version: number
  onClose: () => void
  /** Appelé après l'enregistrement par le serveur, avec le message de retour. */
  onDone: (feedback: string) => void
  /** Recharge les données du parent (409 : proposition changée entre-temps). */
  onStale: () => Promise<void> | void
}

interface FormState {
  jobTitle: string
  /** Chiffres seulement (affichés groupés dans l'aide). */
  salary: string
  startDate: string
  contractType: ContractType
  duration: string
  message: string
}

function formFrom(proposal: HireProposalView | null | undefined, opportunityTitle: string): FormState {
  if (!proposal) {
    return {
      jobTitle: opportunityTitle.slice(0, HIRE_JOB_TITLE_MAX),
      salary: '',
      startDate: '',
      contractType: 'cdi',
      duration: '',
      message: '',
    }
  }
  return {
    jobTitle: proposal.jobTitle,
    salary: String(proposal.monthlySalaryAr),
    startDate: proposal.startDate,
    contractType: proposal.contractType,
    duration: proposal.contractDurationMonths ? String(proposal.contractDurationMonths) : '',
    message: proposal.message ?? '',
  }
}

/** Jour civil AAAA-MM-JJ décalé de `days` jours. */
function addCivilDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d) + days * DAY_MS).toISOString().slice(0, 10)
}

/** Champs saisis → champs d'une proposition, ou la première erreur à afficher. */
function readForm(form: FormState, now: Date): { ok: true; fields: HireProposalFields } | { ok: false; error: string } {
  const jobTitle = form.jobTitle.trim()
  if (jobTitle.length < HIRE_JOB_TITLE_MIN) {
    return { ok: false, error: `Intitulé du poste trop court (${HIRE_JOB_TITLE_MIN} caractères au moins).` }
  }
  const titleContact = contactDetailsError(jobTitle)
  if (titleContact) return { ok: false, error: `Intitulé du poste : ${titleContact}` }
  if (!form.salary) return { ok: false, error: 'Indiquez le salaire mensuel brut en Ariary.' }
  const monthlySalaryAr = Number(form.salary)
  const salaryError = hireSalaryError(monthlySalaryAr)
  if (salaryError) return { ok: false, error: salaryError }
  if (!form.startDate) return { ok: false, error: 'Indiquez la date de début.' }
  const startError = hireStartDateError(form.startDate, now)
  if (startError) return { ok: false, error: startError }
  const contractDurationMonths = form.contractType === 'cdi' || !form.duration ? null : Number(form.duration)
  const durationError = contractDurationError(form.contractType, contractDurationMonths)
  if (durationError) return { ok: false, error: durationError }
  const message = form.message.trim()
  const messageContact = contactDetailsError(message)
  if (messageContact) return { ok: false, error: `Message au candidat : ${messageContact}` }
  return {
    ok: true,
    fields: {
      jobTitle,
      monthlySalaryAr,
      startDate: form.startDate,
      contractType: form.contractType,
      contractDurationMonths,
      message: message || null,
    },
  }
}

const fieldsOf = (proposal: HireProposalView): HireProposalFields => ({
  jobTitle: proposal.jobTitle,
  monthlySalaryAr: proposal.monthlySalaryAr,
  startDate: proposal.startDate,
  contractType: proposal.contractType,
  contractDurationMonths: proposal.contractDurationMonths,
  message: proposal.message,
})

/**
 * « Faire une proposition » / « Modifier la proposition » (recruteur, dossier
 * « Retenu ») : poste (prérempli avec le titre de l'offre), salaire mensuel
 * brut en Ariary, date de début (jour civil, heure de Madagascar), type de
 * contrat, durée quand le contrat la demande, message sans coordonnées ;
 * aperçu « Ce que verra le candidat » (texte neutre de src/lib/hiring.ts) et
 * échéance à 7 jours. Le serveur refait tous les contrôles ; un 409 sur une
 * révision périmée recharge le dossier et ré-affiche la version à jour.
 */
export function HireProposalModal({
  mode,
  suggestionId,
  candidateName,
  opportunityTitle,
  current,
  version,
  onClose,
  onDone,
  onStale,
}: HireProposalModalProps) {
  const { currentUser } = useApp()
  const formId = useId()
  const [now] = useState(() => new Date())
  const [form, setForm] = useState<FormState>(() => formFrom(current, opportunityTitle))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [staleNotice, setStaleNotice] = useState('')
  const companyName = currentUser?.recruiterProfile?.companyName || 'Votre entreprise'
  const revise = mode === 'revise'

  // Modification : quand le parent relit une AUTRE révision (409 puis
  // rechargement), le formulaire repart de la version à jour.
  const shownKey = current ? `${current.id}:${current.revision}` : ''
  const shownKeyRef = useRef(shownKey)
  useEffect(() => {
    if (!revise || shownKeyRef.current === shownKey) return
    shownKeyRef.current = shownKey
    setForm(formFrom(current, opportunityTitle))
  }, [revise, shownKey, current, opportunityTitle])

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }))

  const close = () => {
    if (!busy) onClose()
  }

  const today = madagascarToday(now)
  const maxStart = addCivilDays(today, HIRE_START_MAX_DAYS)
  const expiresAt = hireProposalExpiresAt(now)
  const durationRequired = CONTRACTS_WITH_DURATION.includes(form.contractType)
  const read = readForm(form, now)
  const salaryNumber = form.salary ? Number(form.salary) : null

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (busy) return
    if (!read.ok) {
      setError(read.error)
      return
    }
    let changes: HireProposalChangesInput | null = null
    if (revise) {
      if (!current) return
      const merged = mergeProposalRevision(fieldsOf(current), read.fields)
      if (merged.error) {
        setError(merged.error)
        return
      }
      changes = Object.fromEntries(merged.changed.map((key) => [key, merged.fields[key]])) as HireProposalChangesInput
    }
    setBusy(true)
    setError('')
    setStaleNotice('')
    try {
      const response = revise && current && changes
        ? await apiReviseHireProposal(suggestionId, current.revision, changes)
        : await apiSendHireProposal(suggestionId, read.fields)
      const deadline = formatMadagascarDateTime(response.proposal.expiresAt)
      onDone(
        revise
          ? `Proposition modifiée : OffRec prévient ${candidateName} (plateforme et email). Nouvelle échéance : ${deadline}.`
          : `Proposition envoyée à ${candidateName} par OffRec (plateforme et email). Elle expire le ${deadline} sans réponse.`,
      )
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Envoi impossible. Réessayez.'
      if (err instanceof ApiError && err.status === 409) {
        // Révision périmée, réponse du candidat, expiration… : on relit le
        // dossier et on ré-affiche la version à jour.
        await onStale()
        setStaleNotice(`${message} Voici l’état à jour du dossier : vérifiez-le avant de réessayer.`)
      } else {
        setError(message)
      }
      setBusy(false)
    }
  }

  const title = revise
    ? `Modifier la proposition — ${candidateName}`
    : `Proposition d’embauche — ${candidateName}`

  // Après un 409, la proposition n'est plus en attente (acceptée, déclinée,
  // expirée, retirée) : plus rien à modifier.
  if (revise && current && current.status !== 'envoyee') {
    return (
      <Modal key="hpm-closed" title={title} onClose={close}>
        <p className="hpm-context">{opportunityTitle}</p>
        {staleNotice && (
          <p className="hpm-error" role="alert">
            {staleNotice}
          </p>
        )}
        <p className="hpm-text">{stateText(current, 'recruiter')}</p>
        <div className="hpm-actions">
          <Button variant="outline" size="sm" onClick={close}>
            Fermer
          </Button>
        </div>
      </Modal>
    )
  }

  const previewText = read.ok
    ? proposalSummaryText({
        companyName,
        jobTitle: read.fields.jobTitle,
        monthlySalaryAr: read.fields.monthlySalaryAr,
        contractType: read.fields.contractType,
        contractDurationMonths: read.fields.contractDurationMonths,
        startDate: read.fields.startDate,
        expiresAt,
      })
    : null

  return (
    <Modal key="hpm-form" title={title} onClose={close}>
      <form className="hpm-form" onSubmit={submit} noValidate aria-describedby={`${formId}-context`}>
        <p className="hpm-context" id={`${formId}-context`}>
          {opportunityTitle} · proposition {version} sur {MAX_PROPOSAL_VERSIONS} au plus pour ce dossier
        </p>

        {staleNotice && (
          <p className="hpm-error" role="alert">
            {staleNotice}
          </p>
        )}

        <fieldset className="hpm-fields" disabled={busy}>
          <Field label="Intitulé du poste" hint={`Sans email ni téléphone. ${form.jobTitle.length}/${HIRE_JOB_TITLE_MAX}`}>
            <Input
              value={form.jobTitle}
              maxLength={HIRE_JOB_TITLE_MAX}
              required
              onChange={(e) => set('jobTitle', e.target.value)}
            />
          </Field>

          <Field
            label="Salaire mensuel brut (Ariary)"
            hint={
              salaryNumber !== null && Number.isFinite(salaryNumber)
                ? `Soit ${formatAriaryAmount(salaryNumber)} Ar brut par mois.`
                : 'En chiffres, sans décimales : par exemple 1200000.'
            }
          >
            <Input
              type="text"
              inputMode="numeric"
              autoComplete="off"
              value={form.salary}
              required
              placeholder="1200000"
              onChange={(e) => set('salary', e.target.value.replace(/\D/g, '').slice(0, 9))}
            />
          </Field>

          <div className="hpm-pair">
            <Field label="Date de début" hint="Jour de prise de poste (heure de Madagascar).">
              <Input
                type="date"
                value={form.startDate}
                min={today}
                max={maxStart}
                required
                onChange={(e) => set('startDate', e.target.value)}
              />
            </Field>
            <Field label="Type de contrat">
              <Select
                value={form.contractType}
                onChange={(e) => {
                  const contractType = e.target.value as ContractType
                  setForm((f) => ({ ...f, contractType, duration: contractType === 'cdi' ? '' : f.duration }))
                }}
              >
                {CONTRACT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {CONTRACT_TYPE_LABELS[type]}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          {form.contractType !== 'cdi' && (
            <Field
              label={durationRequired ? 'Durée du contrat en mois (obligatoire)' : 'Durée du contrat en mois (facultative)'}
              hint={`De ${CONTRACT_DURATION_MIN_MONTHS} à ${CONTRACT_DURATION_MAX_MONTHS} mois.`}
            >
              <Input
                type="number"
                inputMode="numeric"
                min={CONTRACT_DURATION_MIN_MONTHS}
                max={CONTRACT_DURATION_MAX_MONTHS}
                step={1}
                value={form.duration}
                required={durationRequired}
                onChange={(e) => set('duration', e.target.value.replace(/\D/g, '').slice(0, 2))}
              />
            </Field>
          )}

          <Field
            label="Message au candidat (facultatif)"
            hint={`Sans email ni téléphone : OffRec transmet lui-même les modalités. ${form.message.length}/${HIRE_MESSAGE_MAX}`}
          >
            <Textarea
              rows={3}
              maxLength={HIRE_MESSAGE_MAX}
              value={form.message}
              placeholder="Ex. : nous serions ravis de vous accueillir dans l’équipe."
              onChange={(e) => set('message', e.target.value)}
            />
          </Field>
        </fieldset>

        <div className="hpm-preview" aria-live="polite">
          <p className="hpm-preview-title">Ce que verra le candidat (plateforme et email, envoyé par OffRec)</p>
          {previewText ? (
            <p className="hpm-quote">« {previewText} »</p>
          ) : (
            <p className="hpm-muted">Complétez le poste, le salaire, la date de début et le contrat pour voir l’aperçu.</p>
          )}
          {read.ok && read.fields.message && <p className="hpm-quote">Votre message : « {read.fields.message} »</p>}
          <p className="hpm-deadline">
            {revise ? 'Le délai repart : la' : 'La'} proposition expire le{' '}
            <strong>{formatMadagascarDateTime(expiresAt)}</strong> (heure de Madagascar) sans réponse, soit{' '}
            {HIRE_PROPOSAL_TTL_DAYS} jours. Le candidat reçoit un rappel 2 jours avant.
          </p>
        </div>

        {error && (
          <p className="hpm-error" role="alert">
            {error}
          </p>
        )}

        <div className="hpm-actions">
          <Button variant="ghost" size="sm" disabled={busy} onClick={close}>
            Annuler
          </Button>
          <Button type="submit" size="sm" disabled={busy} aria-busy={busy}>
            <Send size={14} aria-hidden />
            {busy ? 'Envoi…' : revise ? 'Enregistrer la modification' : 'Envoyer la proposition'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
