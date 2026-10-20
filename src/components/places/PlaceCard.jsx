import { buildOsmLink, formatDistance } from '../../utils/placeFormatters'

export default function PlaceCard({ place, detailHref, onOpen }) {
  const handleOpen = (event) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return
    }

    event.preventDefault()
    onOpen(place)
  }

  const osmLink = buildOsmLink(place)
  const distance = formatDistance(place.distanceMeters)

  return (
    <article className="place-card">
      <div className="place-cover">
        <span className="place-cover-icon" aria-hidden="true">
          {place.icon ?? '📍'}
        </span>
        {place.category && <span className="place-category">{place.category}</span>}
      </div>

      <div className="place-info">
        {place.address && (
          <span className="place-location">
            <span aria-hidden="true">⌖</span> {place.address}
          </span>
        )}
        <h3>{place.name}</h3>

        <div className="place-meta">
          {distance && (
            <span
              className="place-distance"
              title="Distancia en línea recta desde la referencia elegida; no es distancia por carretera."
            >
              ≈ {distance} <span className="place-distance-note">en línea recta</span>
            </span>
          )}
        </div>
      </div>

      <div className="place-actions">
        <a className="place-link" href={detailHref} onClick={handleOpen}>
          Ver detalle <span aria-hidden="true">→</span>
        </a>
        {osmLink && (
          <a
            className="place-maps-link"
            href={osmLink}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Abrir ${place.name ?? 'el lugar'} en OpenStreetMap`}
          >
            OpenStreetMap <span aria-hidden="true">↗</span>
          </a>
        )}
      </div>
    </article>
  )
}
