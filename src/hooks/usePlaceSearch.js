import { useCallback, useEffect, useRef, useState } from 'react'
import { ALL_CATEGORIES_KEY } from '../data/categories'
import { searchPlaces, locateReference } from '../services/placesService'
import { describeGeolocationError } from '../utils/geolocation'

const MIN_QUERY_LENGTH = 2
export const DEFAULT_RADIUS_KM = 10

/**
 * Búsqueda real contra OpenStreetMap a través del API propio.
 *
 * - No hay autocompletado: las políticas de Nominatim lo prohíben. La búsqueda
 *   se lanza al enviar el formulario, al elegir categoría o al fijar una
 *   referencia; no en cada tecla.
 * - Cancela la solicitud anterior cuando llega una nueva.
 * - La ubicación del usuario solo se pide tras pulsar "Buscar cerca de mí".
 * - Las coordenadas personales no se guardan ni viajan en la URL.
 */
export function usePlaceSearch({
  initialQuery = '',
  initialCategory = ALL_CATEGORIES_KEY,
  initialRadiusKm = DEFAULT_RADIUS_KM,
} = {}) {
  const [query, setQuery] = useState(initialQuery)
  const [categoryKey, setCategoryKey] = useState(initialCategory)
  const [radiusKm, setRadiusKm] = useState(initialRadiusKm)
  const [origin, setOrigin] = useState(null)

  const [results, setResults] = useState([])
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState(null)
  const [hasSearched, setHasSearched] = useState(false)
  const [rankingNotice, setRankingNotice] = useState(null)

  const [isLocating, setIsLocating] = useState(false)
  const [locateError, setLocateError] = useState(null)

  const controllerRef = useRef(null)
  const requestIdRef = useRef(0)

  const trimmedQuery = query.trim()
  const canSearch =
    trimmedQuery.length >= MIN_QUERY_LENGTH || categoryKey !== ALL_CATEGORIES_KEY

  useEffect(() => () => controllerRef.current?.abort(), [])

  const performSearch = useCallback(
    async ({ query: searchQuery, category, radius, center }) => {
      controllerRef.current?.abort()
      const controller = new AbortController()
      controllerRef.current = controller
      requestIdRef.current += 1
      const requestId = requestIdRef.current

      setStatus('loading')
      setError(null)

      try {
        const payload = await searchPlaces(
          {
            query: searchQuery,
            category: category === ALL_CATEGORIES_KEY ? undefined : category,
            center: center ?? undefined,
            radiusKm: center ? radius : undefined,
          },
          { signal: controller.signal },
        )

        if (requestId !== requestIdRef.current) return

        setResults(payload.places ?? [])
        setRankingNotice(payload.rankingNotice ?? null)
        setHasSearched(true)
        setStatus('success')
      } catch (searchError) {
        if (searchError?.name === 'AbortError' || requestId !== requestIdRef.current) return

        setResults([])
        setHasSearched(true)
        setError(searchError)
        setStatus('error')
      }
    },
    [],
  )

  // Si la URL trae una búsqueda o categoría, se ejecuta una vez al cargar.
  // Se difiere con un temporizador para no encadenar renders dentro del efecto.
  useEffect(() => {
    const searchQuery = initialQuery.trim()
    if (searchQuery.length < MIN_QUERY_LENGTH && initialCategory === ALL_CATEGORIES_KEY) {
      return undefined
    }

    const timer = setTimeout(() => {
      void performSearch({
        query: searchQuery,
        category: initialCategory,
        radius: initialRadiusKm,
        center: null,
      })
    }, 0)

    return () => clearTimeout(timer)
  }, [initialQuery, initialCategory, initialRadiusKm, performSearch])

  const searchFor = useCallback(
    (text, { center = null } = {}) => {
      setQuery(text)
      const searchQuery = text.trim()
      if (searchQuery.length < MIN_QUERY_LENGTH && categoryKey === ALL_CATEGORIES_KEY) return
      void performSearch({
        query: searchQuery,
        category: categoryKey,
        radius: radiusKm,
        center: center ?? origin,
      })
    },
    [performSearch, categoryKey, radiusKm, origin],
  )

  const submitSearch = useCallback(
    (overrideQuery) => {
      const searchQuery = (typeof overrideQuery === 'string' ? overrideQuery : query).trim()
      if (searchQuery.length < MIN_QUERY_LENGTH && categoryKey === ALL_CATEGORIES_KEY) return
      void performSearch({
        query: searchQuery,
        category: categoryKey,
        radius: radiusKm,
        center: origin,
      })
    },
    [performSearch, query, categoryKey, radiusKm, origin],
  )

  const selectCategory = useCallback(
    (key) => {
      setCategoryKey(key)

      const searchQuery = query.trim()
      if (searchQuery.length < MIN_QUERY_LENGTH && key === ALL_CATEGORIES_KEY) return
      void performSearch({
        query: searchQuery,
        category: key,
        radius: radiusKm,
        center: origin,
      })
    },
    [performSearch, query, radiusKm, origin],
  )

  const selectRadius = useCallback(
    (km) => {
      setRadiusKm(km)
      if (!origin) return

      const searchQuery = query.trim()
      if (searchQuery.length < MIN_QUERY_LENGTH && categoryKey === ALL_CATEGORIES_KEY) return
      void performSearch({
        query: searchQuery,
        category: categoryKey,
        radius: km,
        center: origin,
      })
    },
    [performSearch, query, categoryKey, origin],
  )

  const requestSearchWithOrigin = useCallback(
    (nextOrigin) => {
      const searchQuery = query.trim()
      if (searchQuery.length < MIN_QUERY_LENGTH && categoryKey === ALL_CATEGORIES_KEY) return

      void performSearch({
        query: searchQuery,
        category: categoryKey,
        radius: radiusKm,
        center: nextOrigin,
      })
    },
    [performSearch, query, categoryKey, radiusKm],
  )

  const locateMe = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setLocateError(
        'Tu navegador no permite obtener la ubicación. Puedes escribir una ciudad como referencia.',
      )
      return
    }

    setIsLocating(true)
    setLocateError(null)

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setIsLocating(false)
        const nextOrigin = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          label: 'Tu ubicación actual',
        }
        setOrigin(nextOrigin)
        requestSearchWithOrigin(nextOrigin)
      },
      (geoError) => {
        setIsLocating(false)
        setLocateError(describeGeolocationError(geoError))
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    )
  }, [requestSearchWithOrigin])

  const locateByCity = useCallback(
    async (cityQuery) => {
      const trimmedCity = cityQuery.trim()
      if (trimmedCity.length < 3) {
        setLocateError('Escribe al menos 3 caracteres para ubicar la referencia.')
        return
      }

      setIsLocating(true)
      setLocateError(null)

      try {
        const payload = await locateReference(trimmedCity)
        const nextOrigin = {
          latitude: payload.location.latitude,
          longitude: payload.location.longitude,
          label: payload.label ?? trimmedCity,
        }
        setOrigin(nextOrigin)
        requestSearchWithOrigin(nextOrigin)
      } catch (locateRequestError) {
        if (locateRequestError?.name === 'AbortError') return
        setLocateError(
          locateRequestError?.message ?? 'No pudimos ubicar esa referencia. Intenta con otra ciudad.',
        )
      } finally {
        setIsLocating(false)
      }
    },
    [requestSearchWithOrigin],
  )

  const clearOrigin = useCallback(() => {
    setOrigin(null)
    setLocateError(null)

    const searchQuery = query.trim()
    if (searchQuery.length < MIN_QUERY_LENGTH && categoryKey === ALL_CATEGORIES_KEY) {
      controllerRef.current?.abort()
      requestIdRef.current += 1
      setResults([])
      setStatus('idle')
      setHasSearched(false)
      return
    }

    void performSearch({
      query: searchQuery,
      category: categoryKey,
      radius: radiusKm,
      center: null,
    })
  }, [performSearch, query, categoryKey, radiusKm])

  const clearSearch = useCallback(() => {
    controllerRef.current?.abort()
    requestIdRef.current += 1

    setQuery('')
    setCategoryKey(ALL_CATEGORIES_KEY)
    setOrigin(null)
    setLocateError(null)
    setResults([])
    setError(null)
    setStatus('idle')
    setHasSearched(false)
  }, [])

  const retry = useCallback(() => {
    void performSearch({
      query: trimmedQuery,
      category: categoryKey,
      radius: radiusKm,
      center: origin,
    })
  }, [performSearch, trimmedQuery, categoryKey, radiusKm, origin])

  return {
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
  }
}
