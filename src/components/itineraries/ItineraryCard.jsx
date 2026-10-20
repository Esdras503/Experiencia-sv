function formatDate(value) {
  if (!value) return null
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (!match) return null
  return `${match[3]}/${match[2]}/${match[1]}`
}

function formatUpdated(value) {
  if (!value) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return new Intl.DateTimeFormat('es-SV', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(parsed)
}

export default function ItineraryCard({ record }) {
  const stopCount = Array.isArray(record.stops) ? record.stops.length : 0
  const origin = record.preferences?.origin?.label
  const budget =
    record.budget_amount === null || record.budget_amount === undefined
      ? null
      : new Intl.NumberFormat('es-SV', {
          style: 'currency',
          currency: record.budget_currency || 'USD',
          maximumFractionDigits: 2,
        }).format(Number(record.budget_amount))

  return (
    <article className="itinerary-card">
      <div className="itinerary-card-heading">
        <span className="itinerary-card-icon" aria-hidden="true">
          ✳
        </span>
        <div>
          <h2>
            <a href={`/itinerarios/${record.id}`}>{record.title}</a>
          </h2>
          <p className="itinerary-card-updated">
            Actualizado: {formatUpdated(record.updated_at) ?? 'fecha no disponible'}
          </p>
        </div>
      </div>

      {record.description && <p className="itinerary-card-description">{record.description}</p>}

      <div className="itinerary-card-meta">
        <span>{stopCount} {stopCount === 1 ? 'parada' : 'paradas'}</span>
        {record.start_date && <span>📅 {formatDate(record.start_date)}</span>}
        {record.duration_days && <span>⏱ {record.duration_days} días</span>}
        {record.party_size && <span>👥 {record.party_size} personas</span>}
        {budget && <span>💵 {budget}</span>}
        {origin && <span>⌖ {origin}</span>}
      </div>

      <a className="itinerary-card-link" href={`/itinerarios/${record.id}`}>
        Ver y editar itinerario <span aria-hidden="true">→</span>
      </a>
    </article>
  )
}
