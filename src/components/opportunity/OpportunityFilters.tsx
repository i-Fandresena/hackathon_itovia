import { Search } from 'lucide-react'
import { CATEGORIES, PROVINCES, SECTOR_LABELS, SECTORS } from '../../data/constants'
import { Field, Input, Select } from '../ui/Form'
import type { Sector } from '../../types'
import './OpportunityFilters.css'

export interface FilterState {
  search: string
  province: string
  category: string
  sector: Sector | ''
}

interface OpportunityFiltersProps {
  filters: FilterState
  onChange: (filters: FilterState) => void
}

export function OpportunityFilters({ filters, onChange }: OpportunityFiltersProps) {
  return (
    <div className="opp-filters">
      <Field label="Rechercher">
        <div className="search-wrap">
          <Search size={18} className="search-icon" aria-hidden />
          <Input
            placeholder="Titre, entreprise, compétence…"
            value={filters.search}
            onChange={(e) => onChange({ ...filters, search: e.target.value })}
          />
        </div>
      </Field>
      <Field label="Province">
        <Select
          value={filters.province}
          onChange={(e) => onChange({ ...filters, province: e.target.value })}
        >
          <option value="">Toutes les provinces</option>
          {PROVINCES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Catégorie">
        <Select
          value={filters.category}
          onChange={(e) => onChange({ ...filters, category: e.target.value })}
        >
          <option value="">Toutes les catégories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Secteur">
        <Select
          value={filters.sector}
          onChange={(e) => onChange({ ...filters, sector: e.target.value as Sector | '' })}
        >
          <option value="">Tous les secteurs</option>
          {SECTORS.map((s) => (
            <option key={s} value={s}>
              {SECTOR_LABELS[s]}
            </option>
          ))}
        </Select>
      </Field>
    </div>
  )
}

export function filterOpportunities<
  T extends {
    title: string
    companyName: string
    province: string
    category: string
    sector: Sector
    requiredSkills: string[]
  },
>(items: T[], filters: FilterState): T[] {
  const q = filters.search.trim().toLowerCase()
  return items.filter((o) => {
    if (filters.province && o.province !== filters.province) return false
    if (filters.category && o.category !== filters.category) return false
    if (filters.sector && o.sector !== filters.sector) return false
    if (!q) return true
    const haystack = [
      o.title,
      o.companyName,
      o.category,
      o.province,
      ...o.requiredSkills,
    ]
      .join(' ')
      .toLowerCase()
    return haystack.includes(q)
  })
}
