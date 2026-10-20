import { buildOsmLink, formatDistance } from '../../utils/placeFormatters'

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

/**
 * Tarjeta compacta de un lugar recomendado dentro del chat. Solo muestra
 * datos reales de OpenStreetMap: sin calificaciones, reseñas ni fotos.
 */
export default function ChatPlaceCard({ place, detailHref, onOpen }) {
  const handleOpen = (event) => {
    if (!isPlainClick(event)) return
    event.preventDefault()
    onOpen(place)
  }

  const osmLink = buildOsmLink(place)
  const distance = formatDistance(place.distanceMeters)

  return (
    <article className="chat-place-card">
      <div className="chat-place-head">
        <span className="chat-place-icon" aria-hidden="true">
          {place.icon ?? '📍'}
        </span>
        <div className="chat-place-title">
          <h4>{place.name}</h4>
          {place.category && <span className="chat-place-category">{place.category}</span>}
        </div>
      </div>

      {place.address && <p className="chat-place-address">⌖ {place.address}</p>}

      <div className="chat-place-actions">
        <a className="chat-place-detail" href={detailHref} onClick={handleOpen}>
          Ver detalle
        </a>
        {osmLink && (
          <a
            className="chat-place-osm"
            href={osmLink}
            target="_blank"
            rel="noreferrer"
          >
            OpenStreetMap
          </a>
        )}
        {distance && <span className="chat-place-distance">{distance}</span>}
      </div>
    </article>
  )
}
