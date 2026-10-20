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

export default function NotFoundPage({ variant = 'page', navigate }) {
  const isPlace = variant === 'place'

  const handleInternalLink = (event, href) => {
    if (!shouldHandleClick(event)) return
    event.preventDefault()
    navigate(href)
  }

  return (
    <section className="status-page">
      <span className="status-icon" aria-hidden="true">
        ⌖
      </span>
      <p className="eyebrow">{isPlace ? 'LUGAR NO ENCONTRADO' : 'PÁGINA NO ENCONTRADA'}</p>
      <h1>{isPlace ? 'No encontramos este lugar' : 'Esta página no existe'}</h1>
      <p>
        {isPlace
          ? 'Puede que el enlace esté mal escrito o que OpenStreetMap ya no reconozca este identificador.'
          : 'Revisa la dirección o vuelve a explorar los lugares disponibles.'}
      </p>
      <div className="status-actions">
        <a
          className="button-primary"
          href="/#destinos"
          onClick={(event) => handleInternalLink(event, '/#destinos')}
        >
          Volver a explorar
        </a>
        <a
          className="button-secondary"
          href="/"
          onClick={(event) => handleInternalLink(event, '/')}
        >
          Ir al inicio
        </a>
      </div>
    </section>
  )
}
