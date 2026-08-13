import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { SearchX } from 'lucide-react'
import { ProviderCard } from '../../components/provider/ProviderCard'
import {
  ProviderFilters,
  filterProviders,
  type DirectoryFilterState,
} from '../../components/provider/ProviderFilters'
import { EmptyState } from '../../components/ui/EmptyState'
import { Loading } from '../../components/ui/Loading'
import { useApp } from '../../context/AppContext'
import { rankProviders } from '../../lib/trust'
import './Directory.css'

/**
 * L'annuaire est public : chercher ne demande pas de compte, seul le fait de
 * contribuer en demande un. C'est la porte d'entrée du produit.
 */
export function Directory() {
  const { providers, recommendations, membersById, hydrated } = useApp()
  const [searchParams] = useSearchParams()
  const [filters, setFilters] = useState<DirectoryFilterState>(() => ({
    search: searchParams.get('q') ?? '',
    trade: searchParams.get('trade') ?? '',
    district: '',
  }))

  // La recherche de la barre haute et les raccourcis métiers du rail gauche
  // arrivent par l'URL ; les filtres de la page restent la source d'affichage.
  useEffect(() => {
    setFilters((f) => ({
      ...f,
      search: searchParams.get('q') ?? '',
      trade: searchParams.get('trade') ?? '',
    }))
  }, [searchParams])

  const list = useMemo(
    () =>
      rankProviders(filterProviders(providers, filters), recommendations, membersById, {
        viewerDistrict: filters.district || undefined,
      }),
    [providers, recommendations, membersById, filters],
  )

  if (!hydrated) {
    return (
      <div className="page">
        <div className="container">
          <Loading />
        </div>
      </div>
    )
  }

  const sourced = list.filter((p) => p.trust.recommendationCount > 0).length

  return (
    <div className="page">
      <div className="container">
        <header className="page-header">
          <h1>Annuaire de confiance — construction, Antananarivo</h1>
          <p>
            Des prestataires recommandés par des membres qui ont réellement
            travaillé avec eux, avec le prix qu’ils ont payé et la date du
            chantier. Classés par qualité <strong>et</strong> par solidité de
            l’information.
          </p>
        </header>

        <ProviderFilters filters={filters} onChange={setFilters} />

        {list.length === 0 ? (
          <EmptyState
            icon={SearchX}
            title="Aucun prestataire trouvé"
            description="Élargissez votre recherche, ou ajoutez la fiche d’un prestataire que vous connaissez."
          />
        ) : (
          <>
            <p className="dir-count">
              {list.length} prestataire{list.length > 1 ? 's' : ''} · {sourced}{' '}
              avec au moins une recommandation
            </p>
            <div className="prov-list">
              {list.map((scored) => (
                <ProviderCard key={scored.provider.id} {...scored} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
