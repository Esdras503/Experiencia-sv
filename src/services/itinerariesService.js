import { isValidUuid } from './itineraryPayload.js'
import { supabase } from './supabaseClient.js'

export const ITINERARY_COLUMNS = [
  'id',
  'title',
  'description',
  'start_date',
  'duration_days',
  'party_size',
  'budget_amount',
  'budget_currency',
  'preferences',
  'stops',
  'created_at',
  'updated_at',
].join(', ')

const INSERT_FIELDS = [
  'title',
  'description',
  'start_date',
  'duration_days',
  'party_size',
  'budget_amount',
  'budget_currency',
  'preferences',
  'stops',
]

export class ItineraryDataError extends Error {
  constructor(code, message, status = 0) {
    super(message)
    this.name = 'ItineraryDataError'
    this.code = code
    this.status = status
  }
}

export function describeDatabaseError(error) {
  const code = typeof error?.code === 'string' ? error.code : ''
  const message = typeof error?.message === 'string' ? error.message.toLowerCase() : ''
  const status = Number(error?.status)

  if (
    code === '42501' ||
    message.includes('row-level security') ||
    message.includes('permission denied')
  ) {
    return new ItineraryDataError(
      'FORBIDDEN',
      'No tienes permiso para acceder a este itinerario.',
      status,
    )
  }

  if (
    code === 'PGRST116' ||
    code === 'PGRST301' ||
    status === 401 ||
    message.includes('jwt expired') ||
    message.includes('invalid jwt')
  ) {
    return new ItineraryDataError(
      'SESSION_EXPIRED',
      'Tu sesión expiró. Inicia sesión de nuevo para continuar.',
      status,
    )
  }

  if (
    code === '23514' ||
    code === '23502' ||
    code === '22P02' ||
    status === 400
  ) {
    return new ItineraryDataError(
      'VALIDATION_ERROR',
      'Los datos del itinerario no cumplen los límites permitidos.',
      status,
    )
  }

  if (code === '23503') {
    return new ItineraryDataError(
      'FORBIDDEN',
      'La cuenta ya no está disponible. Inicia sesión de nuevo.',
      status,
    )
  }

  if (
    code === 'PGRST000' ||
    (code === '' &&
      (message.includes('failed to fetch') ||
        message.includes('network') ||
        message.includes('fetch failed')))
  ) {
    return new ItineraryDataError(
      'NETWORK_ERROR',
      'No se pudo conectar con la base de datos. Revisa tu conexión.',
      status,
    )
  }

  return new ItineraryDataError(
    'INTERNAL',
    'No se pudo completar la operación con los itinerarios. Intenta de nuevo.',
    status,
  )
}

function assertUserId(userId) {
  if (!isValidUuid(userId)) {
    throw new ItineraryDataError(
      'SESSION_EXPIRED',
      'Tu sesión no es válida. Inicia sesión de nuevo.',
    )
  }
}

function assertId(id) {
  if (!isValidUuid(id)) {
    throw new ItineraryDataError('NOT_FOUND', 'El itinerario no existe o no tienes acceso.')
  }
}

function pickInsert(record) {
  const payload = {}
  for (const field of INSERT_FIELDS) {
    if (record && Object.hasOwn(record, field)) payload[field] = record[field]
  }
  return payload
}

function pickUpdate(patch) {
  const payload = {}
  for (const field of INSERT_FIELDS) {
    if (patch && Object.hasOwn(patch, field)) payload[field] = patch[field]
  }
  return payload
}

/**
 * Repositorio inyectable para pruebas. Todas las consultas incluyen el
 * propietario además de RLS: si una política se configurara mal, la consulta
 * seguiría sin pedir datos de otra cuenta.
 */
export function createItinerariesRepository(client) {
  if (!client) {
    throw new ItineraryDataError(
      'NOT_CONFIGURED',
      'Supabase no está configurado. Revisa VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.',
    )
  }

  return {
    async list(userId) {
      assertUserId(userId)
      const { data, error } = await client
        .from('itineraries')
        .select(ITINERARY_COLUMNS)
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .limit(100)

      if (error) throw describeDatabaseError(error)
      return Array.isArray(data) ? data : []
    },

    async get(userId, id) {
      assertUserId(userId)
      assertId(id)
      const { data, error } = await client
        .from('itineraries')
        .select(ITINERARY_COLUMNS)
        .eq('id', id)
        .eq('user_id', userId)
        .maybeSingle()

      if (error) throw describeDatabaseError(error)
      if (!data) {
        throw new ItineraryDataError(
          'NOT_FOUND',
          'El itinerario no existe o no tienes acceso.',
        )
      }
      return data
    },

    async create(userId, record) {
      assertUserId(userId)
      const { data, error } = await client
        .from('itineraries')
        .insert({ ...pickInsert(record), user_id: userId })
        .select(ITINERARY_COLUMNS)
        .single()

      if (error) throw describeDatabaseError(error)
      return data
    },

    async update(userId, id, patch) {
      assertUserId(userId)
      assertId(id)
      const { data, error } = await client
        .from('itineraries')
        .update(pickUpdate(patch))
        .eq('id', id)
        .eq('user_id', userId)
        .select(ITINERARY_COLUMNS)
        .maybeSingle()

      if (error) throw describeDatabaseError(error)
      if (!data) {
        throw new ItineraryDataError(
          'NOT_FOUND',
          'El itinerario no existe o no tienes acceso.',
        )
      }
      return data
    },

    async remove(userId, id) {
      assertUserId(userId)
      assertId(id)
      const { data, error } = await client
        .from('itineraries')
        .delete()
        .eq('id', id)
        .eq('user_id', userId)
        .select('id')
        .maybeSingle()

      if (error) throw describeDatabaseError(error)
      if (!data) {
        throw new ItineraryDataError(
          'NOT_FOUND',
          'El itinerario no existe o no tienes acceso.',
        )
      }
      return true
    },
  }
}

function getRepository() {
  if (!supabase) {
    throw new ItineraryDataError(
      'NOT_CONFIGURED',
      'Las cuentas y los itinerarios guardados no están configurados.',
    )
  }
  return createItinerariesRepository(supabase)
}

export function listItineraries(userId) {
  return getRepository().list(userId)
}

export function getItinerary(userId, id) {
  return getRepository().get(userId, id)
}

export function createItinerary(userId, record) {
  return getRepository().create(userId, record)
}

export function updateItinerary(userId, id, patch) {
  return getRepository().update(userId, id, patch)
}

export function removeItinerary(userId, id) {
  return getRepository().remove(userId, id)
}
