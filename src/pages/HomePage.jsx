import { useEffect, useMemo, useRef } from 'react'
import { ALL_CATEGORIES_KEY, categories } from '../data/categories'
import { usePlaceSearch } from '../hooks/usePlaceSearch'
import SearchBar from '../components/places/SearchBar'
import CategoryFilter from '../components/places/CategoryFilter'
import LocationFilter from '../components/places/LocationFilter'
import PlaceGrid from '../components/places/PlaceGrid'
import ResultsMap from '../components/places/ResultsMap'
import OpenStreetMapAttribution from '../components/places/OpenStreetMapAttribution'
import RankingNotice from '../components/places/RankingNotice'
import EmptyState from '../components/ui/EmptyState'
import ErrorState from '../components/ui/ErrorState'
import LoadingState from '../components/ui/LoadingState'
import SafeImage from '../components/ui/SafeImage'

const SEARCH_SUGGESTIONS = [
  'Playa El Tunco',
  'Lago de Coatepeque',
  'Volcán de San Salvador',
  'Suchitoto',
  'Ruta de las Flores',
  'San Salvador',
]

function readFilters(search) {
  const params = new URLSearchParams(search)
  const requestedCategory = params.get('categoria')
  const matchedCategory = categories.find(
    (category) => category.key === requestedCategory || category.name === requestedCategory,
  )

  return {
    query: params.get('q') ?? '',
    categoryKey: matchedCategory?.key ?? ALL_CATEGORIES_KEY,
  }
}

function getScrollBehavior() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
}

export default function HomePage({ search, navigate, onOpenChat }) {
  const initialFilters = useMemo(() => readFilters(search), [search])
  const searchInputRef = useRef(null)
  const resultsHeadingRef = useRef(null)

  const {
    query,
    setQuery,
    categoryKey,
    selectCategory,
    radiusKm,
    selectRadius,
    origin,
    locateMe,
    locateByCity,
    clearOrigin,
    isLocating,
    locateError,
    results,
    status,
    error,
    hasSearched,
    canSearch,
    rankingNotice,
    searchFor,
    submitSearch,
    retry,
    clearSearch,
  } = usePlaceSearch({
    initialQuery: initialFilters.query,
    initialCategory: initialFilters.categoryKey,
  })

  const filtersQuery = useMemo(() => {
    const params = new URLSearchParams()
    const trimmedQuery = query.trim()

    if (trimmedQuery) params.set('q', trimmedQuery)
    if (categoryKey !== ALL_CATEGORIES_KEY) params.set('categoria', categoryKey)

    const queryString = params.toString()
    return queryString ? `?${queryString}` : ''
  }, [query, categoryKey])

  useEffect(() => {
    const nextUrl = `${window.location.pathname}${filtersQuery}${window.location.hash}`
    window.history.replaceState({}, '', nextUrl)
  }, [filtersQuery])

  useEffect(() => {
    const sectionId = window.location.hash.replace('#', '')
    if (!sectionId) return undefined

    const frame = requestAnimationFrame(() => {
      document
        .getElementById(sectionId)
        ?.scrollIntoView({ behavior: getScrollBehavior(), block: 'start' })
    })

    return () => cancelAnimationFrame(frame)
  }, [])

  const focusResults = () => {
    resultsHeadingRef.current?.focus({ preventScroll: true })
    resultsHeadingRef.current?.scrollIntoView({
      behavior: getScrollBehavior(),
      block: 'start',
    })
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    submitSearch()
    focusResults()
  }

  const handleSuggestion = (text) => {
    searchFor(text)
    focusResults()
  }

  const handleClearFilters = () => {
    clearSearch()
    searchInputRef.current?.focus()
  }

  const handleOpenPlace = (place) => {
    navigate(`/lugares/${place.id}${filtersQuery}`)
  }

  const getDetailHref = (place) => `/lugares/${place.id}${filtersQuery}`

  const showLoading = status === 'loading'
  const showEmptyResults = hasSearched && status === 'success' && results.length === 0
  const showResults = hasSearched && status === 'success' && results.length > 0

  const resultsLabel = `${results.length} ${results.length === 1 ? 'lugar' : 'lugares'}`

  return (
    <>
      <section className="hero" id="inicio">
        <div className="hero-content">
          <span className="eyebrow">
            <span className="status-dot" aria-hidden="true" />
            DESCUBRE EL SALVADOR
          </span>

          <h1>
            Tu próxima aventura
            <br />
            comienza <span>aquí.</span>
          </h1>

          <p className="hero-description">
            Encuentra lugares increíbles, descubre rincones únicos y planifica
            experiencias inolvidables en El Salvador.
          </p>

          <SearchBar
            query={query}
            onQueryChange={setQuery}
            onSubmit={handleSubmit}
            inputRef={searchInputRef}
          />

          <div className="hero-note">
            <span aria-hidden="true">✦</span> Explora a tu ritmo. Vive a tu manera.
          </div>
        </div>

        <div className="hero-visual">
          <SafeImage
            className="hero-image"
            src="https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=1200&q=85"
            alt=""
            loading="eager"
            fallbackLabel="Imagen ilustrativa no disponible"
          />
          <div className="image-label">
            <span className="image-label-icon" aria-hidden="true">
              ⌖
            </span>
            <div>
              <strong>Hay un lugar para ti</strong>
              <span>Tu próxima historia comienza hoy</span>
            </div>
          </div>
          <div className="floating-star" aria-hidden="true">
            ✳
          </div>
        </div>
      </section>

      <section className="discovery" id="categorias">
        <div className="section-heading">
          <span className="eyebrow">ENCUENTRA TU EXPERIENCIA</span>
          <h2>¿Qué te gustaría descubrir?</h2>
          <p>Cada categoría se traduce en etiquetas reales de OpenStreetMap.</p>
        </div>

        <CategoryFilter activeCategory={categoryKey} onSelect={selectCategory} />
      </section>

      <section className="destinations" id="destinos" aria-labelledby="destinations-title">
        <div className="destination-heading">
          <div>
            <span className="eyebrow">INSPÍRATE Y EXPLORA</span>
            <h2 id="destinations-title" ref={resultsHeadingRef} tabIndex={-1}>
              Lugares que te esperan
            </h2>
          </div>

          <div className="results-summary">
            {hasSearched && status === 'success' && (
              <span
                className="results-count"
                role="status"
                aria-live="polite"
                aria-atomic="true"
              >
                {resultsLabel}
              </span>
            )}
            {(hasSearched || canSearch) && (
              <button type="button" className="clear-filters" onClick={handleClearFilters}>
                Limpiar búsqueda y filtros
              </button>
            )}
          </div>
        </div>

        <LocationFilter
          origin={origin}
          radiusKm={radiusKm}
          onRadiusChange={selectRadius}
          onLocateMe={locateMe}
          onLocateByCity={locateByCity}
          onClearOrigin={clearOrigin}
          isLocating={isLocating}
          locateError={locateError}
        />

        {!hasSearched && status !== 'loading' && (
          <div className="search-prompt" role="status">
            <h3>Explora El Salvador con datos abiertos</h3>
            <p>
              Escribe un nombre, municipio o departamento y pulsa Buscar. También puedes
              elegir una categoría o usar una ciudad como referencia. Los resultados se
              consultan a OpenStreetMap en el momento de la búsqueda; no se inventan
              lugares, fotos ni calificaciones.
            </p>
            <div className="suggestion-chips">
              {SEARCH_SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  className="category-chip"
                  onClick={() => handleSuggestion(suggestion)}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {showLoading && <LoadingState />}

        {canSearch && status === 'error' && (
          <ErrorState
            title="No pudimos completar la búsqueda"
            description={error?.message ?? 'Ocurrió un error inesperado. Intenta de nuevo.'}
            actionLabel="Reintentar"
            onAction={retry}
          />
        )}

        {showEmptyResults && (
          <EmptyState
            title="Sin resultados"
            description="OpenStreetMap no devolvió lugares para esa búsqueda. Prueba con otro término, cambia de categoría, amplía el radio o elige otra referencia."
            actionLabel="Limpiar búsqueda y filtros"
            onAction={handleClearFilters}
          />
        )}

        {showResults && (
          <>
            <ResultsMap
              places={results}
              origin={origin}
              radiusKm={radiusKm}
              getDetailHref={getDetailHref}
              onOpenPlace={handleOpenPlace}
            />
            <PlaceGrid
              places={results}
              getDetailHref={getDetailHref}
              onOpenPlace={handleOpenPlace}
            />
            <div className="results-footer">
              <OpenStreetMapAttribution />
              <RankingNotice text={rankingNotice} />
            </div>
          </>
        )}
      </section>

      <section className="assistant-banner" aria-labelledby="assistant-title">
        <div className="assistant-icon" aria-hidden="true">
          ✳
        </div>
        <div>
          <span className="eyebrow">TU ASISTENTE DE VIAJES</span>
          <h2 id="assistant-title">¿No sabes por dónde empezar?</h2>
          <p>Cuéntanos qué te gusta y te ayudaremos a encontrar tu próxima aventura.</p>
        </div>
        <button type="button" onClick={onOpenChat}>
          Hablar con el asistente <span aria-hidden="true">→</span>
        </button>
      </section>
    </>
  )
}
