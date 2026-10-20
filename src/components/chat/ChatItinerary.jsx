import { buildOsmLink, formatDistance } from '../../utils/placeFormatters'
import ResultsMap from '../places/ResultsMap'

function isPlainClick(event) {
  return !(
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  )
}

function formatDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? '')
  return match ? `${match[3]}/${match[2]}/${match[1]}` : null
}

function formatBudget(budget) {
  if (!budget) return null
  const scope = budget.scope === 'persona' ? 'por persona' : 'total'
  try {
    const formatter = new Intl.NumberFormat('es-SV', {
      style: 'currency',
      currency: budget.currency || 'USD',
      maximumFractionDigits: 2,
    })
    return `${formatter.format(budget.amount)} ${scope}`
  } catch {
    return `${budget.amount} ${budget.currency || ''} ${scope}`.trim()
  }
}

/**
 * Itinerario estructurado del chat. Las paradas son lugares reales validados
 * por el servidor y las distancias son en línea recta (haversine).
 */
export default function ChatItinerary({
  itinerary,
  onOpenPlace,
  onSuggestion,
  onSave,
  onOpenSaved,
  saveStatus = 'idle',
  saveError = null,
  savedItineraryId = null,
  isAuthenticated = false,
  accountsConfigured = true,
  onRequireAuth,
}) {
  if (!itinerary || !Array.isArray(itinerary.stops) || itinerary.stops.length === 0) {
    return null
  }

  const getDetailHref = (place) => `/lugares/${encodeURIComponent(place.id)}`
  const handleOpen = (event, place) => {
    if (!isPlainClick(event)) return
    event.preventDefault()
    onOpenPlace(place)
  }

  const handleOpenSaved = (event) => {
    if (!isPlainClick(event)) return
    event.preventDefault()
    onOpenSaved(savedItineraryId)
  }

  const places = itinerary.stops.map((stop) => stop.place)
  const date = formatDate(itinerary.date)
  const budget = formatBudget(itinerary.budget)
  const warnings = Array.isArray(itinerary.warnings) ? itinerary.warnings : []

  return (
    <section className="chat-itinerary" aria-labelledby="chat-itinerary-title">
      <header className="chat-itinerary-header">
        <p className="chat-itinerary-eyebrow">Itinerario sugerido</p>
        <h3 id="chat-itinerary-title">{itinerary.title}</h3>
        {itinerary.summary && <p>{itinerary.summary}</p>}
      </header>

      <div className="chat-itinerary-meta">
        {date && <span>📅 {date}</span>}
        {itinerary.travelers && <span>👥 {itinerary.travelers} personas</span>}
        {budget && <span>💵 {budget} (referencia)</span>}
        {itinerary.origin && <span>⌖ Salida: {itinerary.origin.label}</span>}
      </div>

      <ResultsMap
        compact
        title="Mapa del itinerario"
        hint="Toca un marcador para abrir la parada."
        places={places}
        origin={itinerary.origin}
        getDetailHref={getDetailHref}
        onOpenPlace={onOpenPlace}
      />

      <ol className="chat-itinerary-stops">
        {itinerary.stops.map((stop) => {
          const osmLink = buildOsmLink(stop.place)
          const distancePrevious = formatDistance(stop.distanceFromPreviousMeters)
          const distanceOrigin = formatDistance(stop.distanceFromOriginMeters)

          return (
            <li className="chat-itinerary-stop" key={`${stop.order}-${stop.place.id}`}>
              <span className="chat-stop-number" aria-hidden="true">
                {stop.order}
              </span>
              <div className="chat-stop-content">
                <h4>
                  <a
                    href={getDetailHref(stop.place)}
                    onClick={(event) => handleOpen(event, stop.place)}
                  >
                    {stop.place.name}
                  </a>
                </h4>

                {stop.place.address && (
                  <p className="chat-stop-address">{stop.place.address}</p>
                )}

                <p className="chat-stop-reason">{stop.reason}</p>

                <p className="chat-stop-meta">
                  {stop.visitMinutes !== null && stop.visitEstimate && (
                    <span>Visita estimada: {stop.visitMinutes} min (estimación). </span>
                  )}
                  {distancePrevious && (
                    <span>≈ {distancePrevious} desde la parada anterior, en línea recta. </span>
                  )}
                  {distanceOrigin && itinerary.origin && (
                    <span>
                      ≈ {distanceOrigin} desde {itinerary.origin.label}, en línea recta.
                    </span>
                  )}
                </p>

                <div className="chat-stop-actions">
                  <a
                    href={getDetailHref(stop.place)}
                    onClick={(event) => handleOpen(event, stop.place)}
                  >
                    Ver detalle
                  </a>
                  {osmLink && (
                    <a href={osmLink} target="_blank" rel="noreferrer">
                      OpenStreetMap
                    </a>
                  )}
                </div>
              </div>
            </li>
          )
        })}
      </ol>

      <p className="chat-itinerary-note">
        Distancias en línea recta (no por carretera). El orden es una sugerencia y puede
        no ser la ruta más corta.
      </p>

      <div className="chat-itinerary-actions" aria-label="Acciones para modificar el itinerario">
        <button
          type="button"
          onClick={() => onSuggestion('Agrega otra parada al itinerario.')}
        >
          Agregar parada
        </button>
        <button
          type="button"
          onClick={() => onSuggestion('Quita la última parada del itinerario.')}
        >
          Quitar última
        </button>
        <button
          type="button"
          onClick={() =>
            onSuggestion('Ordena las paradas para evitar desplazamientos innecesarios.')
          }
        >
          Reordenar
        </button>
        <button
          type="button"
          onClick={() => onSuggestion('Hazlo más económico si es posible.')}
        >
          Más económico
        </button>
      </div>

      <div className="chat-itinerary-save" aria-live="polite">
        {savedItineraryId ? (
          <>
            <p className="chat-save-success" role="status">
              Itinerario guardado en tu cuenta.
            </p>
            <a
              className="button-primary"
              href={`/itinerarios/${encodeURIComponent(savedItineraryId)}`}
              onClick={handleOpenSaved}
            >
              Ver itinerario guardado <span aria-hidden="true">→</span>
            </a>
          </>
        ) : (
          <>
            <button
              type="button"
              className="button-primary"
              onClick={isAuthenticated ? onSave : onRequireAuth}
              disabled={
                saveStatus === 'saving' ||
                (!isAuthenticated && !accountsConfigured)
              }
            >
              {saveStatus === 'saving'
                ? 'Guardando…'
                : isAuthenticated
                  ? 'Guardar itinerario'
                  : 'Iniciar sesión para guardar'}
            </button>
            <p className="chat-save-note">
              {accountsConfigured
                ? isAuthenticated
                  ? 'Se guardará una copia editable en tu cuenta.'
                  : 'Tu plan seguirá aquí al volver del inicio de sesión.'
                : 'Las cuentas no están configuradas en este entorno. Puedes seguir usando el plan sin guardarlo.'}
            </p>
          </>
        )}

        {saveError && (
          <p className="chat-save-error" role="alert">
            {saveError}
          </p>
        )}
      </div>

      {warnings.length > 0 && (
        <details className="chat-itinerary-warnings">
          <summary>Datos a confirmar ({warnings.length})</summary>
          <ul>
            {warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </details>
      )}
    </section>
  )
}
