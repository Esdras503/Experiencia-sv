import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../context/authContext.js'
import { listItineraries } from '../services/itinerariesService.js'
import ItineraryCard from '../components/itineraries/ItineraryCard.jsx'
import ErrorState from '../components/ui/ErrorState.jsx'
import LoadingState from '../components/ui/LoadingState.jsx'

export default function ItinerariesPage({ navigate, onOpenChat }) {
  const { user } = useAuth()
  const [itineraries, setItineraries] = useState([])
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState(null)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    if (!user?.id) return undefined
    let cancelled = false

    listItineraries(user.id)
      .then((items) => {
        if (cancelled) return
        setItineraries(items)
        setStatus('success')
      })
      .catch((loadError) => {
        if (cancelled) return
        setError(loadError)
        setStatus('error')
      })

    return () => {
      cancelled = true
    }
  }, [user, reloadToken])

  const retry = useCallback(() => {
    setStatus('loading')
    setError(null)
    setReloadToken((value) => value + 1)
  }, [])

  if (!user) return null

  return (
    <section className="saved-page" aria-labelledby="saved-title">
      <nav className="account-breadcrumbs" aria-label="Ruta de navegación">
        <a href="/">Inicio</a>
        <span aria-hidden="true">/</span>
        <span aria-current="page">Mis itinerarios</span>
      </nav>

      <header className="saved-heading">
        <div>
          <span className="eyebrow">MIS ITINERARIOS</span>
          <h1 id="saved-title">Planes guardados</h1>
          <p>
            Aquí viven los itinerarios que guardaste. Puedes abrirlos, editar sus
            paradas o eliminarlos.
          </p>
        </div>

        <div className="saved-heading-actions">
          <button type="button" className="button-secondary" onClick={onOpenChat}>
            Crear con el asistente
          </button>
          <a className="button-primary" href="/cuenta">
            Mi cuenta
          </a>
        </div>
      </header>

      {status === 'loading' && (
        <LoadingState count={2} message="Cargando tus itinerarios guardados…" />
      )}

      {status === 'error' && (
        <ErrorState
          title="No pudimos cargar tus itinerarios"
          description={error?.message ?? 'Revisa tu conexión e intenta de nuevo.'}
          actionLabel="Reintentar"
          onAction={retry}
        />
      )}

      {status === 'success' && itineraries.length === 0 && (
        <div className="saved-empty">
          <span className="saved-empty-icon" aria-hidden="true">
            ✳
          </span>
          <h2>Todavía no has guardado ningún itinerario</h2>
          <p>
            Pide un plan al asistente y pulsa «Guardar itinerario» cuando lo tengas
            listo. También puedes seguir explorando lugares sin guardar nada.
          </p>
          <div className="saved-empty-actions">
            <button type="button" className="button-primary" onClick={onOpenChat}>
              Hablar con el asistente
            </button>
            <button
              type="button"
              className="button-secondary"
              onClick={() => navigate('/#destinos')}
            >
              Explorar lugares
            </button>
          </div>
        </div>
      )}

      {status === 'success' && itineraries.length > 0 && (
        <>
          <p className="saved-count" role="status">
            {itineraries.length}{' '}
            {itineraries.length === 1 ? 'itinerario guardado' : 'itinerarios guardados'}
          </p>
          <div className="itinerary-grid">
            {itineraries.map((record) => (
              <ItineraryCard key={record.id} record={record} />
            ))}
          </div>
        </>
      )}
    </section>
  )
}
