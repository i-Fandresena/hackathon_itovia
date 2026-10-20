import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays, FileSignature, RotateCcw, X } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { Field, Input, Select } from '../../components/ui/Form'
import { Loading } from '../../components/ui/Loading'
import { HiringPhaseBadge } from '../../components/hiring/HiringPhaseBadge'
import { HireProposalSummary } from '../../components/hiring/HireProposalSummary'
import { ApiError, apiAdminHireProposals, type AdminHireProposalItem } from '../../lib/api'
import { DECLINE_REASON_LABELS, HIRE_DECLINE_REASONS, HIRE_PROPOSAL_STATUSES, HIRE_PROPOSAL_STATUS_LABELS } from '../../lib/hiring'
import type { HireDeclineReason, HireProposalStatus } from '../../types'
import './AdminHireProposals.css'

const HOUR_MS = 60 * 60 * 1000

type DeadlineFilter = '' | 'sous_48h' | 'plus_48h'
type ReasonFilter = '' | 'sans_motif' | HireDeclineReason

/** Recherche sans tenir compte de la casse ni des accents. */
function normalize(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

interface AdminHireProposalsProps {
  /** Dossier demandé par un lien (`?dossier=`, depuis « Placements ») : filtre la liste. */
  dossierId?: string | null
  onClearDossier?: () => void
}

/**
 * Onglet « Propositions » de « Mise en relation » (sous-lot 6) : les
 * propositions d'embauche de la plateforme (`GET /admin/matching/hire-proposals`,
 * statut EFFECTIF : une proposition échue compte comme expirée), en attente
 * d'abord par échéance. Filtres : statut (serveur), offre, entreprise
 * (recruteur), candidat, montant, échéance et motif du refus (catégorie ;
 * la précision du candidat est lisible ici, jamais par le recruteur — D3).
 */
export function AdminHireProposals({ dossierId, onClearDossier }: AdminHireProposalsProps) {
  const [status, setStatus] = useState<HireProposalStatus | ''>('')
  const [items, setItems] = useState<AdminHireProposalItem[] | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [offerId, setOfferId] = useState('')
  const [company, setCompany] = useState('')
  const [candidate, setCandidate] = useState('')
  const [minAmount, setMinAmount] = useState('')
  const [maxAmount, setMaxAmount] = useState('')
  const [deadline, setDeadline] = useState<DeadlineFilter>('')
  const [reason, setReason] = useState<ReasonFilter>('')
  const requestRef = useRef(0)

  const load = useCallback(async () => {
    const requestId = ++requestRef.current
    setLoading(true)
    setError('')
    try {
      const list = await apiAdminHireProposals(status || undefined)
      if (requestId === requestRef.current) setItems(list)
    } catch (err) {
      if (requestId === requestRef.current) {
        setError(err instanceof ApiError ? err.message : 'Impossible de charger les propositions.')
      }
    } finally {
      if (requestId === requestRef.current) setLoading(false)
    }
  }, [status])

  useEffect(() => {
    void load()
  }, [load])

  const all = items ?? []
  const offers = useMemo(() => {
    const map = new Map<string, string>()
    for (const item of all) map.set(item.opportunity.id, `${item.opportunity.title} — ${item.opportunity.companyName}`)
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1], 'fr'))
  }, [all])
  const companies = useMemo(
    () => [...new Set(all.map((item) => item.opportunity.companyName))].sort((a, b) => a.localeCompare(b, 'fr')),
    [all],
  )

  const now = Date.now()
  const min = minAmount ? Number(minAmount) : null
  const max = maxAmount ? Number(maxAmount) : null
  const query = normalize(candidate)
  const shown = all.filter((item) => {
    const p = item.proposal
    if (dossierId && item.suggestionId !== dossierId) return false
    if (offerId && item.opportunity.id !== offerId) return false
    if (company && item.opportunity.companyName !== company) return false
    if (query && !normalize(item.candidate.fullName ?? '').includes(query)) return false
    if (min !== null && p.monthlySalaryAr < min) return false
    if (max !== null && p.monthlySalaryAr > max) return false
    if (deadline) {
      if (p.status !== 'envoyee') return false
      const left = Date.parse(p.expiresAt) - now
      if (deadline === 'sous_48h' ? left > 48 * HOUR_MS : left <= 48 * HOUR_MS) return false
    }
    if (reason) {
      if (p.status !== 'refusee') return false
      if (reason === 'sans_motif' ? Boolean(p.declineReason) : p.declineReason !== reason) return false
    }
    return true
  })
  const filtered = Boolean(offerId || company || candidate || minAmount || maxAmount || deadline || reason || dossierId)

  const reset = () => {
    setOfferId('')
    setCompany('')
    setCandidate('')
    setMinAmount('')
    setMaxAmount('')
    setDeadline('')
    setReason('')
    onClearDossier?.()
  }

  return (
    <section className="ahp" aria-labelledby="ahp-title">
      <h2 className="ahp-title" id="ahp-title">
        <FileSignature size={18} aria-hidden />
        Propositions d’embauche
      </h2>
      <p className="ahp-intro">
        Propositions envoyées par les recruteurs après un entretien « Retenu ». Une proposition sans réponse expire 7
        jours après son envoi ou sa dernière modification. Vous lisez la précision d’un refus ; le recruteur n’en voit
        que la catégorie.
      </p>

      <div className="ahp-status" role="group" aria-label="Filtrer par statut">
        {(['', ...HIRE_PROPOSAL_STATUSES] as const).map((value) => (
          <button
            key={value || 'tous'}
            type="button"
            className={`chip ${status === value ? 'active' : ''}`}
            aria-pressed={status === value}
            onClick={() => setStatus(value)}
          >
            {value ? HIRE_PROPOSAL_STATUS_LABELS[value] : 'Toutes'}
          </button>
        ))}
      </div>

      <div className="ahp-filters">
        <Field label="Offre">
          <Select value={offerId} onChange={(e) => setOfferId(e.target.value)}>
            <option value="">Toutes les offres</option>
            {offers.map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Recruteur (entreprise)">
          <Select value={company} onChange={(e) => setCompany(e.target.value)}>
            <option value="">Toutes les entreprises</option>
            {companies.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Candidat">
          <Input
            type="search"
            value={candidate}
            maxLength={80}
            placeholder="Nom du candidat"
            onChange={(e) => setCandidate(e.target.value)}
          />
        </Field>
        <Field label="Salaire minimum (Ar)">
          <Input
            type="text"
            inputMode="numeric"
            value={minAmount}
            placeholder="0"
            onChange={(e) => setMinAmount(e.target.value.replace(/\D/g, '').slice(0, 9))}
          />
        </Field>
        <Field label="Salaire maximum (Ar)">
          <Input
            type="text"
            inputMode="numeric"
            value={maxAmount}
            placeholder="Sans limite"
            onChange={(e) => setMaxAmount(e.target.value.replace(/\D/g, '').slice(0, 9))}
          />
        </Field>
        <Field label="Échéance">
          <Select value={deadline} onChange={(e) => setDeadline(e.target.value as DeadlineFilter)}>
            <option value="">Toutes</option>
            <option value="sous_48h">En attente, expire sous 48 h</option>
            <option value="plus_48h">En attente, plus de 48 h</option>
          </Select>
        </Field>
        <Field label="Motif du refus">
          <Select value={reason} onChange={(e) => setReason(e.target.value as ReasonFilter)}>
            <option value="">Tous</option>
            <option value="sans_motif">Déclinée sans motif</option>
            {HIRE_DECLINE_REASONS.map((value) => (
              <option key={value} value={value}>
                {DECLINE_REASON_LABELS[value]}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {dossierId && (
        <p className="ahp-dossier" role="status">
          Propositions d’un seul dossier.
          <Button variant="ghost" size="sm" onClick={() => onClearDossier?.()}>
            <X size={14} aria-hidden />
            Voir toutes les propositions
          </Button>
        </p>
      )}

      {error ? (
        <div className="ahp-error" role="alert">
          <span>{error}</span>
          <Button variant="outline" size="sm" onClick={() => void load()}>
            <RotateCcw size={14} aria-hidden />
            Réessayer
          </Button>
        </div>
      ) : loading && !items ? (
        <Loading label="Chargement des propositions…" />
      ) : shown.length === 0 ? (
        <EmptyState
          icon={FileSignature}
          title={all.length === 0 ? 'Aucune proposition' : 'Aucune proposition pour ces filtres'}
          description={
            all.length === 0
              ? 'Les propositions d’embauche apparaissent ici dès qu’un recruteur en envoie une après un entretien « Retenu ».'
              : 'Modifiez ou réinitialisez les filtres pour voir d’autres propositions.'
          }
          actionLabel={filtered ? 'Réinitialiser les filtres' : undefined}
          onAction={filtered ? reset : undefined}
        />
      ) : (
        <>
          <p className="ahp-count" aria-live="polite">
            {shown.length} proposition{shown.length > 1 ? 's' : ''}
            {shown.length !== all.length ? ` sur ${all.length}` : ''}
            {all.length >= 200 ? ' (les 200 plus récentes)' : ''}
          </p>
          <ul className="ahp-list" aria-busy={loading}>
            {shown.map((item) => (
              <li key={item.proposal.id}>
                <Card className="ahp-card">
                  <div className="ahp-card-head">
                    <div className="ahp-card-id">
                      <strong>{item.candidate.fullName ?? 'Candidat'}</strong>
                      <span className="ahp-card-offer">
                        {item.opportunity.title} — {item.opportunity.companyName}
                      </span>
                    </div>
                    {item.phase && <HiringPhaseBadge audience="admin" phase={item.phase} />}
                  </div>
                  <HireProposalSummary proposal={item.proposal} audience="admin" headingLevel={3}>
                    <Link
                      to={`/admin/entretiens?offre=${encodeURIComponent(item.opportunity.id)}&periode=tous`}
                      className="btn btn-ghost btn-sm"
                    >
                      <CalendarDays size={14} aria-hidden />
                      Entretiens de l’offre
                    </Link>
                  </HireProposalSummary>
                </Card>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
