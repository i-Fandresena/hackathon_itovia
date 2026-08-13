import { Search } from 'lucide-react'
import { DISTRICTS, TRADES } from '../../data/constants'
import type { Provider } from '../../types'
import { Field, Input, Select } from '../ui/Form'
import '../opportunity/OpportunityFilters.css'

export interface DirectoryFilterState {
  search: string
  trade: string
  district: string
}

interface ProviderFiltersProps {
  filters: DirectoryFilterState
  onChange: (filters: DirectoryFilterState) => void
}

export function ProviderFilters({ filters, onChange }: ProviderFiltersProps) {
  return (
    <div className="opp-filters">
      <Field label="Rechercher" hint="Nom, métier ou quartier.">
        <div className="search-wrap">
          <Search size={18} className="search-icon" aria-hidden />
          <Input
            placeholder="Nom, métier, quartier…"
            value={filters.search}
            onChange={(e) => onChange({ ...filters, search: e.target.value })}
          />
        </div>
      </Field>
      <Field label="Métier">
        <Select
          value={filters.trade}
          onChange={(e) => onChange({ ...filters, trade: e.target.value })}
        >
          <option value="">Tous les métiers</option>
          {TRADES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </Select>
      </Field>
      <Field
        label="Mon quartier"
        hint="Ne filtre pas : met en avant les retours de vos voisins."
      >
        <Select
          value={filters.district}
          onChange={(e) => onChange({ ...filters, district: e.target.value })}
        >
          <option value="">Toute l’agglomération</option>
          {DISTRICTS.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </Select>
      </Field>
    </div>
  )
}

export function filterProviders(
  providers: Provider[],
  filters: DirectoryFilterState,
): Provider[] {
  const q = filters.search.trim().toLowerCase()
  return providers.filter((p) => {
    if (filters.trade && p.trade !== filters.trade) return false
    if (!q) return true
    return [p.name, p.trade, p.district, p.city, p.description]
      .join(' ')
      .toLowerCase()
      .includes(q)
  })
}
