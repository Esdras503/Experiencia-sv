import { usePlaceDetails } from '../hooks/usePlaceDetails'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { buildOsmLink } from '../utils/placeFormatters'
import ErrorState from '../components/ui/ErrorState'
import LoadingState from '../components/ui/LoadingState'
import OpenStreetMapAttribution from '../components/places/OpenStreetMapAttribution'
import PlaceMap from '../components/places/PlaceMap'
import NotFoundPage from './NotFoundPage'

function shouldHandleClick(event) {
  return !(
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  )
}

function sanitizePhone(phone) {
  return phone.replace(/[^\d+]/g, '')
}

export default function PlaceDetailPage({ placeId, search, navigate }) {
  const { place, status, error, retry } = usePlaceDetails(placeId)
  const backToResultsHref = `/${search}#destinos`

  useDocumentTitle(place?.name ? `${place.name} — Experiencia SV` : null)

  const handleInternalLink = (event, href) => {
    if (!shouldHandleClick(event)) return
    event.preventDefault()
    navigate(href)
  }

  if (status === 'loading') {
    return (
      <section className="detail-page" aria-busy="true">
        <LoadingState count={1} message="Cargando información del lugar…" />
      </section>
    )
  }

  if (status === 'error' && error?.code === 'PLACE_NOT_FOUND') {
    return <NotFoundPage variant="place" navigate={navigate} />
  }

  if (status === 'error' || !place) {
    return (
      <section className="detail-page">
        <ErrorState
          title="No pudimos cargar este lugar"
          description={error?.message ?? 'Ocurrió un error inesperado. Intenta de nuevo.'}
          actionLabel="Reintentar"
          onAction={retry}
        />
        <p className="detail-back-links">
          <a href={backToResultsHref} onClick={(event) => handleInternalLink(event, backToResultsHref)}>
            Volver a resultados
          </a>
          {' · '}
          <a href="/" onClick={(event) => handleInternalLink(event, '/')}>
            Ir al inicio
          </a>
        </p>
      </section>
    )
  }

  const osmLink = buildOsmLink(place)
  const hasExtraInfo = Boolean(place.website || place.phone || place.openingHours)

  return (
    <article className="detail-page">
      <nav className="breadcrumbs" aria-label="Ruta de navegación">
        <ol>
          <li>
            <a href="/" onClick={(event) => handleInternalLink(event, '/')}>
              Inicio
            </a>
          </li>
          <li>
            <a
              href={backToResultsHref}
              onClick={(event) => handleInternalLink(event, backToResultsHref)}
            >
              Resultados
            </a>
          </li>
          <li aria-current="page">{place.name}</li>
        </ol>
      </nav>

      <div className="detail-grid">
        <figure className="detail-media">
          <div className="detail-cover">
            <span className="detail-cover-icon" aria-hidden="true">
              {place.icon ?? '📍'}
            </span>
          </div>
          <figcaption className="detail-cover-caption">
            {place.category ? `${place.category} · ` : ''}Datos de OpenStreetMap
          </figcaption>
        </figure>

        <div className="detail-content">
          {place.category && <span className="eyebrow">{place.category}</span>}
          <h1>{place.name}</h1>

          {place.address && (
            <p className="detail-location">
              <span aria-hidden="true">⌖</span> {place.address}
            </p>
          )}

          <div className="detail-actions">
            {osmLink && (
              <a
                className="button-primary"
                href={osmLink}
                target="_blank"
                rel="noopener noreferrer"
              >
                Abrir en OpenStreetMap <span aria-hidden="true">↗</span>
              </a>
            )}
            <a
              className="button-secondary"
              href={backToResultsHref}
              onClick={(event) => handleInternalLink(event, backToResultsHref)}
            >
              Volver a resultados
            </a>
            <a
              className="button-secondary"
              href="/"
              onClick={(event) => handleInternalLink(event, '/')}
            >
              Ir al inicio
            </a>
          </div>

          <section className="detail-section" aria-labelledby="detail-info-title">
            <h2 id="detail-info-title">Información adicional</h2>

            {place.description && (
              <p className="detail-description">
                {place.description}{' '}
                <span className="detail-source-note">(descripción publicada en OpenStreetMap)</span>
              </p>
            )}

            {hasExtraInfo ? (
              <ul className="detail-list">
                {place.website && (
                  <li>
                    <span className="detail-list-label">Sitio web</span>{' '}
                    <a href={place.website} target="_blank" rel="noopener noreferrer">
                      {place.website}
                    </a>
                  </li>
                )}
                {place.phone && (
                  <li>
                    <span className="detail-list-label">Teléfono</span>{' '}
                    <a href={`tel:${sanitizePhone(place.phone)}`}>{place.phone}</a>
                  </li>
                )}
                {place.openingHours && (
                  <li>
                    <span className="detail-list-label">Horario</span>{' '}
                    <span>{place.openingHours}</span>{' '}
                    <span className="detail-source-note">
                      (publicado en OpenStreetMap; puede no estar actualizado)
                    </span>
                  </li>
                )}
              </ul>
            ) : (
              <p>OpenStreetMap no tiene sitio web, teléfono ni horario publicados para este lugar.</p>
            )}
          </section>

          <section className="detail-section" aria-labelledby="detail-map-title">
            <h2 id="detail-map-title">Ubicación</h2>
            {place.location ? (
              <PlaceMap place={place} />
            ) : (
              <p>OpenStreetMap no devolvió coordenadas para este lugar.</p>
            )}
          </section>

          <OpenStreetMapAttribution prefix="Información de lugares:" />
        </div>
      </div>
    </article>
  )
}
