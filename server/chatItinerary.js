import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { MAX_ITINERARY_STOPS } from '../shared/chat.js'
import { haversineMeters, isValidLatitude, isValidLongitude } from '../shared/geo.js'
import { OSM_ATTRIBUTION, OSM_COPYRIGHT_URL } from '../shared/osm.js'

const TOKEN_VERSION = 1
const MAX_TOKEN_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000
const DEFAULT_TOKEN_LIFETIME_MS = 12 * 60 * 60 * 1000

function stripDisallowedControls(value, { keepNewlines = false } = {}) {
  let output = ''

  for (const character of value) {
    const code = character.codePointAt(0)
    if (code === 13) continue
    if (code === 10 || code === 9) {
      output += keepNewlines ? character : ' '
      continue
    }
    if (code <= 31 || code === 127) {
      output += ' '
      continue
    }
    output += character
  }

  return output
}

function cleanText(value, maximum) {
  if (typeof value !== 'string') return null
  const cleaned = stripDisallowedControls(value).replace(/\s+/g, ' ').trim()
  return cleaned ? cleaned.slice(0, maximum) : null
}

function cleanMultilineText(value, maximum) {
  if (typeof value !== 'string') return null
  const cleaned = stripDisallowedControls(value, { keepNewlines: true })
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim()
  return cleaned ? cleaned.slice(0, maximum) : null
}

export function normalizePublicPlace(place) {
  if (!place || typeof place !== 'object' || typeof place.id !== 'string') return null
  if (!isValidLatitude(place.location?.latitude) || !isValidLongitude(place.location?.longitude)) {
    return null
  }

  return {
    id: place.id,
    name: cleanText(place.name, 200) ?? 'Lugar sin nombre',
    address: cleanText(place.address, 400),
    category: cleanText(place.category, 120),
    icon: cleanText(place.icon, 12) ?? '📍',
    location: {
      latitude: place.location.latitude,
      longitude: place.location.longitude,
    },
    distanceMeters:
      typeof place.distanceMeters === 'number' && Number.isFinite(place.distanceMeters)
        ? Math.max(0, Math.round(place.distanceMeters))
        : null,
    osmUrl: cleanText(place.osmUrl, 500),
  }
}

function normalizeDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const parsed = new Date(`${value}T12:00:00Z`)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString().slice(0, 10) === value ? value : null
}

const SPANISH_MONTHS = {
  enero: 1,
  febrero: 2,
  marzo: 3,
  abril: 4,
  mayo: 5,
  junio: 6,
  julio: 7,
  agosto: 8,
  septiembre: 9,
  setiembre: 9,
  octubre: 10,
  noviembre: 11,
  diciembre: 12,
}

function formatIsoDate(year, month, day) {
  if (!Number.isInteger(year) || year < 2000 || year > 2100) return null
  if (!Number.isInteger(month) || month < 1 || month > 12) return null
  if (!Number.isInteger(day) || day < 1 || day > 31) return null

  const date = new Date(Date.UTC(year, month - 1, day))
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null
  }

  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function resolveMentionedYear(month, day, today) {
  const currentYear = Number.parseInt(today.slice(0, 4), 10)
  const current = formatIsoDate(currentYear, month, day)
  if (current && current >= today) return currentYear
  const next = currentYear + 1
  return formatIsoDate(next, month, day) ? next : currentYear
}

/**
 * Fechas que la persona mencionó explícitamente en su mensaje. El modelo no
 * puede introducir una fecha distinta: el servidor solo acepta las que estén
 * en esta lista.
 */
export function extractMentionedDates(text, { today = new Date().toISOString().slice(0, 10) } = {}) {
  if (typeof text !== 'string' || !text.trim()) return []

  const base = /^\d{4}-\d{2}-\d{2}$/.test(today)
    ? today
    : new Date().toISOString().slice(0, 10)
  const dates = new Set()
  const isoDates = []

  let match
  const isoPattern = /\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/g
  while ((match = isoPattern.exec(text))) {
    const iso = formatIsoDate(Number(match[1]), Number(match[2]), Number(match[3]))
    if (iso) {
      dates.add(iso)
      isoDates.push(match[0])
    }
  }

  // Se quitan las fechas ISO para que el patrón numérico no vuelva a leerlas
  // como día/mes.
  let remaining = text
  for (const raw of isoDates) remaining = remaining.replace(raw, ' ')

  const numericPattern = /\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/g
  while ((match = numericPattern.exec(remaining))) {
    const day = Number(match[1])
    const month = Number(match[2])
    let year = match[3] ? Number(match[3]) : null
    if (year !== null && year < 100) year += 2000
    const iso = formatIsoDate(year ?? resolveMentionedYear(month, day, base), month, day)
    if (iso) dates.add(iso)
  }

  const monthNames = Object.keys(SPANISH_MONTHS).join('|')
  const monthPattern = new RegExp(
    `\\b(\\d{1,2})\\s+de\\s+(${monthNames})(?:\\s+(?:de\\s+)?(\\d{4}))?\\b`,
    'gi',
  )
  while ((match = monthPattern.exec(text))) {
    const day = Number(match[1])
    const month = SPANISH_MONTHS[match[2].toLocaleLowerCase('es')]
    const year = match[3] ? Number(match[3]) : resolveMentionedYear(month, day, base)
    const iso = formatIsoDate(year, month, day)
    if (iso) dates.add(iso)
  }

  return [...dates].sort()
}

function normalizeBudget(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const amount = Number(value.amount)
  if (!Number.isFinite(amount) || amount < 0 || amount > 100_000_000) return null
  const currency =
    typeof value.currency === 'string' && /^[A-Z]{3}$/.test(value.currency.trim().toUpperCase())
      ? value.currency.trim().toUpperCase()
      : 'USD'
  const scope = value.scope === 'persona' || value.scope === 'total' ? value.scope : null
  if (!scope) return null

  return { amount: Math.round(amount * 100) / 100, currency, scope }
}

function normalizeOrigin(value, fallback = null) {
  const candidate = value && typeof value === 'object' && !Array.isArray(value) ? value : null
  if (
    candidate &&
    isValidLatitude(candidate.latitude) &&
    isValidLongitude(candidate.longitude) &&
    cleanText(candidate.label, 160)
  ) {
    return {
      label: cleanText(candidate.label, 160),
      latitude: candidate.latitude,
      longitude: candidate.longitude,
    }
  }

  return fallback
}

function normalizeWarnings(rawWarnings, serverWarnings) {
  const warnings = []
  const seen = new Set()

  const add = (warning) => {
    const cleaned = cleanText(warning, 260)
    if (!cleaned) return
    const key = cleaned.toLocaleLowerCase('es')
    if (seen.has(key)) return
    seen.add(key)
    warnings.push(cleaned)
  }

  if (Array.isArray(rawWarnings)) {
    for (const warning of rawWarnings.slice(0, 6)) add(warning)
  }
  for (const warning of serverWarnings) add(warning)

  return warnings.slice(0, 10)
}

/**
 * Convierte la propuesta de la IA en un itinerario público y validado.
 *
 * - Solo acepta lugares del conjunto permitido (resultados reales de las
 *   herramientas o paradas del itinerario firmado anterior).
 * - Calcula distancias en línea recta; no inventa tiempos de conducción.
 * - Descarta cualquier precio, horario o dato de disponibilidad no aportado
 *   por una fuente verificable.
 */
export function buildItinerary(
  raw,
  {
    allowedPlaces,
    allowedDates = null,
    currentItinerary = null,
    now = Date.now(),
  } = {},
) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  if (!Array.isArray(raw.stops)) return null

  const allowed = allowedPlaces instanceof Map ? allowedPlaces : new Map()
  const seen = new Set()
  const stops = []
  const skippedIds = []

  for (const rawStop of raw.stops.slice(0, MAX_ITINERARY_STOPS)) {
    if (!rawStop || typeof rawStop !== 'object') continue

    const placeId = typeof rawStop.placeId === 'string' ? rawStop.placeId.trim() : ''
    if (!placeId || seen.has(placeId)) continue

    const place = normalizePublicPlace(allowed.get(placeId))
    if (!place) {
      skippedIds.push(placeId)
      continue
    }

    seen.add(placeId)
    const visitMinutes = Number(rawStop.visitMinutes)
    const hasVisitEstimate =
      Number.isInteger(visitMinutes) && visitMinutes >= 15 && visitMinutes <= 480

    stops.push({
      order: stops.length + 1,
      place,
      reason:
        cleanText(rawStop.reason, 320) ??
        'Parada incluida en el itinerario sugerido por el asistente.',
      visitMinutes: hasVisitEstimate ? visitMinutes : null,
      // OpenStreetMap no publica duraciones de visita; cualquier duración se
      // presenta siempre como estimación.
      visitEstimate: hasVisitEstimate,
      distanceFromPreviousMeters: null,
      distanceFromOriginMeters: null,
    })
  }

  if (stops.length === 0) return null

  const origin = normalizeOrigin(raw.origin, currentItinerary?.origin ?? null)
  let previousPlace = null

  for (const stop of stops) {
    if (previousPlace) {
      stop.distanceFromPreviousMeters = Math.round(
        haversineMeters(previousPlace.location, stop.place.location),
      )
    }
    if (!previousPlace && origin) {
      stop.distanceFromOriginMeters = Math.round(
        haversineMeters(origin, stop.place.location),
      )
    }
    previousPlace = stop.place
  }

  const hasVisitEstimates = stops.some((stop) => stop.visitMinutes !== null)
  const budget = normalizeBudget(raw.budget)
  const serverWarnings = [
    'Las distancias son en línea recta y no representan una ruta ni un tiempo de conducción.',
    'El orden de las paradas es una sugerencia; no se calculó una ruta óptima por carretera.',
    'Confirma horarios, precios, disponibilidad y condiciones antes de viajar: no se consultaron fuentes en tiempo real.',
  ]

  if (hasVisitEstimates) {
    serverWarnings.push(
      'Los tiempos de visita son estimaciones orientativas; no son datos verificados.',
    )
  }
  if (budget) {
    serverWarnings.push(
      'El presupuesto es solo una referencia: OpenStreetMap no ofrece precios verificados de entradas, comidas, transporte o alojamiento.',
    )
  }
  if (skippedIds.length > 0) {
    serverWarnings.push(
      'Se omitió al menos una parada que no correspondía a un lugar verificado de OpenStreetMap.',
    )
  }

  const requestedDate = normalizeDate(raw.date)
  const date =
    requestedDate && (allowedDates === null || allowedDates.includes(requestedDate))
      ? requestedDate
      : (currentItinerary?.date ?? null)

  return {
    title:
      cleanText(raw.title, 120) ??
      cleanText(currentItinerary?.title, 120) ??
      'Itinerario por El Salvador',
    summary:
      cleanMultilineText(raw.summary, 600) ??
      cleanMultilineText(currentItinerary?.summary, 600) ??
      'Plan sugerido con lugares de OpenStreetMap.',
    date,
    travelers:
      Number.isInteger(Number(raw.travelers)) &&
      Number(raw.travelers) >= 1 &&
      Number(raw.travelers) <= 50
        ? Number(raw.travelers)
        : (currentItinerary?.travelers ?? null),
    budget: budget ?? currentItinerary?.budget ?? null,
    origin,
    stops,
    warnings: normalizeWarnings(raw.warnings, serverWarnings),
    dataSource: 'openstreetmap',
    attribution: OSM_ATTRIBUTION,
    attributionUrl: OSM_COPYRIGHT_URL,
    distanceMethod: 'haversine',
    generatedAt: new Date(now).toISOString(),
  }
}

export function compactItineraryForPrompt(itinerary) {
  if (!itinerary || !Array.isArray(itinerary.stops)) return null

  return {
    title: itinerary.title,
    summary: itinerary.summary,
    date: itinerary.date,
    travelers: itinerary.travelers,
    budget: itinerary.budget,
    origin: itinerary.origin,
    stops: itinerary.stops.map((stop) => ({
      placeId: stop.place.id,
      name: stop.place.name,
      category: stop.place.category,
      reason: stop.reason,
      visitMinutes: stop.visitMinutes,
      distanceFromPreviousMeters: stop.distanceFromPreviousMeters,
    })),
  }
}

function resolveTokenLifetime(value) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_TOKEN_LIFETIME_MS
  return Math.min(MAX_TOKEN_LIFETIME_MS, Math.max(5 * 60 * 1000, Math.round(parsed)))
}

function signPayload(payload, secret) {
  return createHmac('sha256', secret).update(payload).digest('base64url')
}

export function signItinerary(
  itinerary,
  { secret, now = Date.now(), ttlMs = DEFAULT_TOKEN_LIFETIME_MS } = {},
) {
  if (!itinerary || typeof secret !== 'string' || !secret) return null

  const payload = Buffer.from(
    JSON.stringify({
      v: TOKEN_VERSION,
      exp: now + resolveTokenLifetime(ttlMs),
      itinerary,
    }),
    'utf8',
  ).toString('base64url')
  const signature = signPayload(payload, secret)

  return `${payload}.${signature}`
}

export function verifyItineraryToken(token, { secret, now = Date.now() } = {}) {
  if (typeof token !== 'string' || typeof secret !== 'string' || !secret) return null

  const separatorIndex = token.lastIndexOf('.')
  if (separatorIndex <= 0) return null

  const payload = token.slice(0, separatorIndex)
  const signature = token.slice(separatorIndex + 1)
  if (!payload || !signature) return null

  try {
    const expected = Buffer.from(signPayload(payload, secret), 'utf8')
    const received = Buffer.from(signature, 'utf8')
    if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
      return null
    }

    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    if (decoded?.v !== TOKEN_VERSION || !Number.isFinite(decoded?.exp) || decoded.exp < now) {
      return null
    }
    if (!decoded.itinerary || !Array.isArray(decoded.itinerary.stops)) return null

    return decoded.itinerary
  } catch {
    return null
  }
}

/**
 * Secreto para firmar el itinerario que viaja al navegador. El navegador no
 * puede modificar el itinerario sin invalidar la firma.
 *
 * - `CHAT_SIGNING_SECRET` (recomendado, mínimo 16 caracteres) permite mantener
 *   la validez entre instancias serverless.
 * - Si no existe, se deriva de la clave de IA (estable mientras no rote).
 * - Como último recurso se usa un secreto aleatorio por proceso; en ese caso
 *   los itinerarios no sobreviven a un reinicio o a otra instancia.
 */
export function resolveItinerarySigningSecret(env = {}, apiKey = '') {
  const explicit = typeof env.CHAT_SIGNING_SECRET === 'string' ? env.CHAT_SIGNING_SECRET.trim() : ''
  if (explicit.length >= 16) return explicit

  if (typeof apiKey === 'string' && apiKey.length > 0) {
    return createHash('sha256').update(`experiencia-sv/chat-itinerary/${apiKey}`).digest('hex')
  }

  return randomBytes(32).toString('hex')
}
