import { useState } from 'react'

const RADIUS_OPTIONS_KM = [5, 10, 25, 50]

export default function LocationFilter({
  origin,
  radiusKm,
  onRadiusChange,
  onLocateMe,
  onLocateByCity,
  onClearOrigin,
  isLocating,
  locateError,
}) {
  const [city, setCity] = useState('')

  const handleCitySubmit = (event) => {
    event.preventDefault()
    onLocateByCity(city)
  }

  return (
    <div className="location-filter">
      <div className="location-controls">
        <div className="radius-field">
          <label htmlFor="radius-select">Radio</label>
          <select
            id="radius-select"
            value={radiusKm}
            onChange={(event) => onRadiusChange(Number(event.target.value))}
            disabled={!origin}
            title={
              origin
                ? 'Limita los resultados a esta distancia en línea recta'
                : 'Primero activa "Buscar cerca de mí" o usa una ciudad'
            }
          >
            {RADIUS_OPTIONS_KM.map((km) => (
              <option key={km} value={km}>
                {km} km
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          className="locate-button"
          onClick={onLocateMe}
          disabled={isLocating}
        >
          <span aria-hidden="true">⌖</span>{' '}
          {isLocating ? 'Obteniendo ubicación…' : 'Buscar cerca de mí'}
        </button>

        <form className="city-form" onSubmit={handleCitySubmit}>
          <label className="visually-hidden" htmlFor="city-input">
            Ciudad o municipio de referencia
          </label>
          <input
            id="city-input"
            type="text"
            value={city}
            onChange={(event) => setCity(event.target.value)}
            placeholder="o escribe una ciudad (ej. San Salvador)"
            autoComplete="off"
          />
          <button type="submit" disabled={isLocating || city.trim().length < 3}>
            Usar ciudad
          </button>
        </form>
      </div>

      <p className="location-hint">
        Tu ubicación se usa solo para esta búsqueda cuando la activas; no se guarda ni se
        comparte. Las distancias que verás son en línea recta, no por carretera.
      </p>

      {origin && (
        <p className="location-origin">
          <span aria-hidden="true">⌖</span> Referencia: <strong>{origin.label}</strong>{' '}
          <button type="button" className="link-button" onClick={onClearOrigin}>
            Quitar ubicación
          </button>
        </p>
      )}

      {locateError && (
        <p className="location-error" role="alert">
          {locateError}
        </p>
      )}
    </div>
  )
}
