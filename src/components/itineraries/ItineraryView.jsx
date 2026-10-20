import { buildOsmLink, formatDistance } from '../../utils/placeFormatters.js'
import OpenStreetMapAttribution from '../places/OpenStreetMapAttribution.jsx'
import ResultsMap from '../places/ResultsMap.jsx'

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
    return `${formatter.format(budget.amount)} ${scope} (declarado)`
  } catch {
    return `${budget.amount} ${budget.currency || ''} ${scope}`.trim()
  }
}

export default function ItineraryView({ itinerary, navigate }) {
  if (!itinerary || !Array.isArray(itinerary.stops) || itinerary.stops.length === 0) {
    return (
      <section className="saved-itinerary" aria-labelledby="saved-itinerary-title">
        <h2 id="saved-itinerary-title">{itinerary?.title ?? 'Itinerario guardado'}</h2>
        <p>
          Este itinerario no conserva paradas válidas. Puedes editar el título o
          eliminarlo, pero no se inventarán lugares para completarlo.
        </p>
      </section>
    )
  }

  const getDetailHref = (place) => `/lugares/${encodeURIComponent(place.id)}`
  const date = formatDate(itinerary.date)
  const budget = formatBudget(itinerary.budget)
  const warnings = Array.isArray(itinerary.warnings) ? itinerary.warnings : []
  const places = itinerary.stops.map((stop) => stop.place)

  return (
    <section className="saved-itinerary" aria-labelledby="saved-itinerary-title">
      <header className="saved-itinerary-header">
        <span className="eyebrow">ITINERARIO GUARDADO</span>
        <h2 id="saved-itinerary-title">{itinerary.title}</h2>
        {itinerary.summary && <p>{itinerary.summary}</p>}
      </header>

      <div className="saved-itinerary-meta">
        {date && <span>📅 {date}</span>}
        {itinerary.durationDays && <span>⏱ {itinerary.durationDays} días</span>}
        {itinerary.travelers && <span>👥 {itinerary.travelers} personas</span>}
        {budget && <span>💵 {budget}</span>}
        {itinerary.origin && <span>⌖ Salida: {itinerary.origin.label}</span>}
      </div>

      <ResultsMap
        compact
        title="Mapa del itinerario guardado"
        hint="Toca un marcador para abrir la parada."
        places={places}
        origin={itinerary.origin}
        getDetailHref={getDetailHref}
        onOpenPlace={(place) => navigate(getDetailHref(place))}
      />

      <ol className="saved-itinerary-stops">
        {itinerary.stops.map((stop) => {
          const osmLink = buildOsmLink(stop.place)
          const distancePrevious = formatDistance(stop.distanceFromPreviousMeters)
          const distanceOrigin = formatDistance(stop.distanceFromOriginMeters)
          const href = getDetailHref(stop.place)

          return (
            <li className="saved-itinerary-stop" key={`${stop.order}-${stop.place.id}`}>
              <span className="chat-stop-number" aria-hidden="true">
                {stop.order}
              </span>
              <div className="chat-stop-content">
                <h3>
                  <a href={href}>{stop.place.name}</a>
                </h3>

                {stop.place.address && (
                  <p className="chat-stop-address">{stop.place.address}</p>
                )}

                {stop.reason && <p className="chat-stop-reason">{stop.reason}</p>}

                <p className="chat-stop-meta">
                  {stop.visitMinutes !== null && stop.visitEstimate && (
                    <span>Visita estimada: {stop.visitMinutes} min (estimación). </span>
                  )}
                  {distancePrevious && (
                    <span>
                      ≈ {distancePrevious} desde la parada anterior, en línea recta.{' '}
                    </span>
                  )}
                  {distanceOrigin && itinerary.origin && (
                    <span>
                      ≈ {distanceOrigin} desde {itinerary.origin.label}, en línea recta.
                    </span>
                  )}
                </p>

                <div className="chat-stop-actions">
                  <a href={href}>Ver detalle actual</a>
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
        Las distancias son en línea recta y el orden es una sugerencia. Los datos
        del lugar se guardaron desde OpenStreetMap; si el lugar cambió o ya no
        existe, «Ver detalle actual» consulta la información disponible ahora.
      </p>

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

      <OpenStreetMapAttribution prefix="Información de lugares:" />
    </section>
  )
}
