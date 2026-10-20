import { useCallback, useEffect, useState } from 'react'
import { fetchPlace } from '../services/placesService'

/**
 * Carga el detalle real de un lugar desde OpenStreetMap vía /api/place.
 * No muestra datos hasta que el servidor responde; los errores quedan visibles.
 */
export function usePlaceDetails(placeId) {
  const [place, setPlace] = useState(null)
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState(null)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()

    fetchPlace(placeId, { signal: controller.signal })
      .then((payload) => {
        if (cancelled) return
        setPlace(payload.place ?? null)
        setStatus('success')
      })
      .catch((requestError) => {
        if (cancelled || requestError?.name === 'AbortError') return
        setError(requestError)
        setStatus('error')
      })

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [placeId, reloadToken])

  const retry = useCallback(() => {
    setStatus('loading')
    setError(null)
    setReloadToken((token) => token + 1)
  }, [])

  return { place, status, error, retry }
}
