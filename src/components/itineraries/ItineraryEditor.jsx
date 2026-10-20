import { useEffect, useRef, useState } from 'react'
import { fetchPlace, searchPlaces } from '../../services/placesService.js'
import { updateItinerary } from '../../services/itinerariesService.js'
import {
  MAX_BUDGET_AMOUNT,
  MAX_DESCRIPTION_LENGTH,
  MAX_DURATION_DAYS,
  MAX_NOTES_LENGTH,
  MAX_PARTY_SIZE,
  MAX_SAVED_STOPS,
  MAX_TITLE_LENGTH,
  buildItineraryUpdate,
  formValuesFromRecord,
  moveStop,
  normalizeOrigin,
  normalizeStoredStop,
  recalculateStopDistances,
  removeStopAt,
  replaceStopPlace,
  stopFromPlace,
} from '../../services/itineraryPayload.js'
import AuthMessage from '../auth/AuthMessage.jsx'

function initialStops(record) {
  const origin = normalizeOrigin(record?.preferences?.origin)
  const stops = []
  if (Array.isArray(record?.stops)) {
    record.stops.forEach((stop, index) => {
      try {
        stops.push(normalizeStoredStop(stop, index))
      } catch {
        // Se descarta una parada corrupta; el resto del itinerario sigue editable.
      }
    })
  }
  return recalculateStopDistances(stops, origin)
}

export default function ItineraryEditor({ record, userId, onSaved, onCancel }) {
  const [values, setValues] = useState(() => formValuesFromRecord(record))
  const [stops, setStops] = useState(() => initialStops(record))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [stopMessage, setStopMessage] = useState(null)
  const [updatingStopId, setUpdatingStopId] = useState(null)

  const [searchQuery, setSearchQuery] = useState('')
  const [searchStatus, setSearchStatus] = useState('idle')
  const [searchError, setSearchError] = useState(null)
  const [searchResults, setSearchResults] = useState([])

  const searchControllerRef = useRef(null)
  const searchSequenceRef = useRef(0)

  const origin = normalizeOrigin(record?.preferences?.origin)

  useEffect(
    () => () => {
      searchControllerRef.current?.abort()
    },
    [],
  )

  const updateValue = (field, value) => {
    setValues((current) => ({ ...current, [field]: value }))
  }

  const runSearch = async () => {
    setSearchError(null)
    setStopMessage(null)

    const query = searchQuery.trim()
    if (query.length < 2) {
      setSearchError('Escribe al menos 2 caracteres para buscar en OpenStreetMap.')
      return
    }

    searchControllerRef.current?.abort()
    const controller = new AbortController()
    searchControllerRef.current = controller
    const sequence = searchSequenceRef.current + 1
    searchSequenceRef.current = sequence

    setSearchStatus('loading')
    setSearchResults([])

    try {
      const payload = await searchPlaces({ query }, { signal: controller.signal })
      if (sequence !== searchSequenceRef.current) return
      setSearchResults(Array.isArray(payload.places) ? payload.places.slice(0, 6) : [])
      setSearchStatus('success')
    } catch (requestError) {
      if (requestError?.name === 'AbortError') return
      if (sequence !== searchSequenceRef.current) return
      setSearchError(
        requestError?.message ??
          'No se pudo buscar en OpenStreetMap. Revisa tu conexión e intenta de nuevo.',
      )
      setSearchStatus('error')
    }
  }

  const handleAddStop = (place) => {
    setStopMessage(null)
    setError(null)

    if (stops.length >= MAX_SAVED_STOPS) {
      setStopMessage({
        tone: 'error',
        text: `El itinerario no puede superar ${MAX_SAVED_STOPS} paradas.`,
      })
      return
    }
    if (stops.some((stop) => stop.placeId === place.id)) {
      setStopMessage({ tone: 'error', text: 'Ese lugar ya está en el itinerario.' })
      return
    }

    try {
      const nextStop = stopFromPlace(place, { order: stops.length + 1 })
      const nextStops = recalculateStopDistances([...stops, nextStop], origin)
      setStops(nextStops)
      setSearchQuery('')
      setSearchResults([])
      setSearchStatus('idle')
      setStopMessage({
        tone: 'success',
        text: `Se añadió “${place.name}” como última parada. Guarda los cambios para conservarlo.`,
      })
    } catch (addError) {
      setStopMessage({
        tone: 'error',
        text: addError?.message ?? 'No se pudo añadir esa parada.',
      })
    }
  }

  const handleRemoveStop = (index) => {
    setStopMessage(null)
    try {
      setStops(removeStopAt(stops, index, origin))
    } catch (removeError) {
      setStopMessage({
        tone: 'error',
        text: removeError?.message ?? 'No se pudo quitar la parada.',
      })
    }
  }

  const handleMoveStop = (index, direction) => {
    setStopMessage(null)
    const reordered = moveStop(stops, index, direction)
    setStops(recalculateStopDistances(reordered, origin))
  }

  const handleRefreshStop = async (stop) => {
    setStopMessage(null)
    setUpdatingStopId(stop.placeId)

    try {
      const payload = await fetchPlace(stop.placeId)
      if (!payload?.place) {
        throw new Error('OpenStreetMap no devolvió datos para esta parada.')
      }
      const replacement = replaceStopPlace(stop, payload.place)
      setStops((current) =>
        recalculateStopDistances(
          current.map((item) => (item.placeId === stop.placeId ? replacement : item)),
          origin,
        ),
      )
      setStopMessage({
        tone: 'success',
        text: `Se actualizaron los datos disponibles de “${payload.place.name}”.`,
      })
    } catch (refreshError) {
      setStopMessage({
        tone: 'error',
        text: `${refreshError?.message ?? 'No se pudieron consultar los datos actuales.'} Se conserva la información guardada de la parada.`,
      })
    } finally {
      setUpdatingStopId(null)
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError(null)
    setStopMessage(null)
    setSaving(true)

    try {
      const patch = buildItineraryUpdate({ values, stops, currentRecord: record })
      const updated = await updateItinerary(userId, record.id, patch)
      onSaved(updated)
    } catch (saveError) {
      setError(saveError?.message ?? 'No se pudieron guardar los cambios. Intenta de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="itinerary-editor" onSubmit={handleSubmit} noValidate>
      <div className="editor-heading">
        <h2>Editar itinerario</h2>
        <p>
          Cambia los datos del plan, reordena sus paradas o añade lugares reales
          de OpenStreetMap. Los campos vacíos se guardan como no indicados.
        </p>
      </div>

      <div className="editor-grid">
        <div className="form-field editor-span">
          <label htmlFor="itinerary-title">Título</label>
          <input
            id="itinerary-title"
            name="title"
            type="text"
            value={values.title}
            maxLength={MAX_TITLE_LENGTH}
            onChange={(event) => updateValue('title', event.target.value)}
            required
          />
        </div>

        <div className="form-field editor-span">
          <label htmlFor="itinerary-description">Descripción</label>
          <textarea
            id="itinerary-description"
            name="description"
            rows={4}
            value={values.description}
            maxLength={MAX_DESCRIPTION_LENGTH}
            onChange={(event) => updateValue('description', event.target.value)}
          />
          <p className="form-hint">
            Es el resumen del plan. No se añaden precios, horarios ni datos que no
            existan.
          </p>
        </div>

        <div className="form-field">
          <label htmlFor="itinerary-start-date">Fecha de inicio</label>
          <input
            id="itinerary-start-date"
            name="startDate"
            type="date"
            min="1900-01-01"
            max="2100-12-31"
            value={values.startDate}
            onChange={(event) => updateValue('startDate', event.target.value)}
          />
        </div>

        <div className="form-field">
          <label htmlFor="itinerary-duration">Duración (días)</label>
          <input
            id="itinerary-duration"
            name="durationDays"
            type="number"
            min="1"
            max={MAX_DURATION_DAYS}
            step="1"
            value={values.durationDays}
            onChange={(event) => updateValue('durationDays', event.target.value)}
          />
        </div>

        <div className="form-field">
          <label htmlFor="itinerary-party-size">Número de personas</label>
          <input
            id="itinerary-party-size"
            name="partySize"
            type="number"
            min="1"
            max={MAX_PARTY_SIZE}
            step="1"
            value={values.partySize}
            onChange={(event) => updateValue('partySize', event.target.value)}
          />
        </div>

        <div className="form-field">
          <label htmlFor="itinerary-budget-amount">Presupuesto</label>
          <input
            id="itinerary-budget-amount"
            name="budgetAmount"
            type="number"
            min="0"
            max={MAX_BUDGET_AMOUNT}
            step="0.01"
            inputMode="decimal"
            value={values.budgetAmount}
            onChange={(event) => updateValue('budgetAmount', event.target.value)}
            aria-describedby="itinerary-budget-hint"
          />
          <p className="form-hint" id="itinerary-budget-hint">
            Importe declarado, no un precio verificado.
          </p>
        </div>

        <div className="form-field">
          <label htmlFor="itinerary-currency">Moneda</label>
          <input
            id="itinerary-currency"
            name="budgetCurrency"
            type="text"
            maxLength={3}
            value={values.budgetCurrency}
            onChange={(event) =>
              updateValue('budgetCurrency', event.target.value.toUpperCase())
            }
            aria-describedby="itinerary-currency-hint"
          />
          <p className="form-hint" id="itinerary-currency-hint">
            Código ISO 4217 de tres letras; por ejemplo USD.
          </p>
        </div>

        <div className="form-field">
          <label htmlFor="itinerary-budget-scope">Alcance del presupuesto</label>
          <select
            id="itinerary-budget-scope"
            name="budgetScope"
            value={values.budgetScope}
            onChange={(event) => updateValue('budgetScope', event.target.value)}
          >
            <option value="total">Total del viaje</option>
            <option value="persona">Por persona</option>
          </select>
        </div>

        <div className="form-field editor-span">
          <label htmlFor="itinerary-notes">Notas y preferencias</label>
          <textarea
            id="itinerary-notes"
            name="notes"
            rows={3}
            value={values.notes}
            maxLength={MAX_NOTES_LENGTH}
            onChange={(event) => updateValue('notes', event.target.value)}
            aria-describedby="itinerary-notes-hint"
          />
          <p className="form-hint" id="itinerary-notes-hint">
            Intereses, ritmo, accesibilidad u otras preferencias que quieras
            recordar. Solo las ve tu cuenta.
          </p>
        </div>
      </div>

      <section className="editor-stops" aria-labelledby="editor-stops-title">
        <div className="editor-section-heading">
          <div>
            <h2 id="editor-stops-title">Paradas</h2>
            <p>
              {stops.length} de {MAX_SAVED_STOPS}. El orden se guarda tal como lo
              dejes; las distancias se recalculan en línea recta.
            </p>
          </div>
        </div>

        {stops.length === 0 && (
          <AuthMessage>
            No quedan paradas válidas. Añade al menos una antes de guardar.
          </AuthMessage>
        )}

        <ol className="editor-stops-list">
          {stops.map((stop, index) => (
            <li className="editor-stop" key={stop.placeId}>
              <span className="chat-stop-number" aria-hidden="true">
                {index + 1}
              </span>
              <div className="editor-stop-content">
                <h3>{stop.name}</h3>
                {stop.address && <p className="chat-stop-address">{stop.address}</p>}
                {stop.reason && <p className="chat-stop-reason">{stop.reason}</p>}
                {stop.location ? (
                  <p className="editor-stop-coords">
                    {stop.location.latitude.toFixed(5)}, {stop.location.longitude.toFixed(5)}
                  </p>
                ) : (
                  <p className="editor-stop-coords">
                    OpenStreetMap no devolvió coordenadas para esta parada.
                  </p>
                )}

                <div className="editor-stop-actions">
                  <button
                    type="button"
                    onClick={() => handleMoveStop(index, -1)}
                    disabled={index === 0}
                    aria-label={`Subir ${stop.name}`}
                  >
                    ↑ Subir
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMoveStop(index, 1)}
                    disabled={index === stops.length - 1}
                    aria-label={`Bajar ${stop.name}`}
                  >
                    ↓ Bajar
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRefreshStop(stop)}
                    disabled={updatingStopId === stop.placeId}
                    aria-label={`Actualizar datos de ${stop.name} desde OpenStreetMap`}
                  >
                    {updatingStopId === stop.placeId ? 'Consultando…' : 'Actualizar datos'}
                  </button>
                  <button
                    type="button"
                    className="editor-remove-stop"
                    onClick={() => handleRemoveStop(index)}
                    disabled={stops.length === 1}
                    aria-label={`Quitar ${stop.name}`}
                  >
                    Quitar
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ol>

        <div className="editor-add-stop">
          <h3>Añadir una parada</h3>
          <p>
            Busca un lugar por nombre en OpenStreetMap. Solo se pueden añadir
            resultados reales.
          </p>
          <div className="editor-search">
            <label className="visually-hidden" htmlFor="editor-place-search">
              Buscar lugar para añadir
            </label>
            <input
              id="editor-place-search"
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  void runSearch()
                }
              }}
              placeholder="Por ejemplo: Playa El Tunco"
              disabled={stops.length >= MAX_SAVED_STOPS}
            />
            <button
              type="button"
              className="button-secondary"
              onClick={() => void runSearch()}
              disabled={searchStatus === 'loading' || stops.length >= MAX_SAVED_STOPS}
            >
              {searchStatus === 'loading' ? 'Buscando…' : 'Buscar'}
            </button>
          </div>

          {searchStatus === 'loading' && (
            <p className="editor-search-status" role="status">
              Consultando OpenStreetMap…
            </p>
          )}
          {searchError && <AuthMessage>{searchError}</AuthMessage>}
          {searchStatus === 'success' && searchResults.length === 0 && (
            <p className="editor-search-status" role="status">
              OpenStreetMap no devolvió resultados para esa búsqueda.
            </p>
          )}

          {searchResults.length > 0 && (
            <ul className="editor-search-results">
              {searchResults.map((place) => {
                const duplicate = stops.some((stop) => stop.placeId === place.id)
                return (
                  <li key={place.id}>
                    <div>
                      <strong>{place.name}</strong>
                      {place.address && <span>{place.address}</span>}
                    </div>
                    <button
                      type="button"
                      className="button-secondary"
                      onClick={() => handleAddStop(place)}
                      disabled={duplicate || stops.length >= MAX_SAVED_STOPS}
                    >
                      {duplicate ? 'Ya añadido' : 'Añadir'}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <AuthMessage tone={stopMessage?.tone === 'error' ? 'error' : 'success'}>
          {stopMessage?.text}
        </AuthMessage>
      </section>

      <AuthMessage>{error}</AuthMessage>
      <AuthMessage tone="info">
        La edición no consulta ni inventa precios, horarios o disponibilidad. Si
        actualizas una parada y OpenStreetMap falla, se conserva lo que ya estaba
        guardado.
      </AuthMessage>

      <div className="editor-actions">
        <button type="submit" className="button-primary" disabled={saving}>
          {saving ? 'Guardando…' : 'Guardar cambios'}
        </button>
        <button
          type="button"
          className="button-secondary"
          onClick={onCancel}
          disabled={saving}
        >
          Cancelar edición
        </button>
      </div>
    </form>
  )
}
