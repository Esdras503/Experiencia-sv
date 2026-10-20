import { validateDisplayName } from '../utils/authValidation.js'
import { supabase } from './supabaseClient.js'

const PROFILE_COLUMNS = 'id, display_name, created_at, updated_at'

export class ProfileDataError extends Error {
  constructor(code, message, status = 0) {
    super(message)
    this.name = 'ProfileDataError'
    this.code = code
    this.status = status
  }
}

function mapProfileError(error) {
  const code = typeof error?.code === 'string' ? error.code : ''
  const message = typeof error?.message === 'string' ? error.message.toLowerCase() : ''
  const status = Number(error?.status)

  if (
    code === '42501' ||
    message.includes('row-level security') ||
    message.includes('permission denied')
  ) {
    return new ProfileDataError(
      'FORBIDDEN',
      'No tienes permiso para acceder a este perfil.',
      status,
    )
  }

  if (
    code === 'PGRST301' ||
    status === 401 ||
    message.includes('jwt expired') ||
    message.includes('invalid jwt')
  ) {
    return new ProfileDataError(
      'SESSION_EXPIRED',
      'Tu sesión expiró. Inicia sesión de nuevo.',
      status,
    )
  }

  if (
    code === '23514' ||
    code === '23502' ||
    code === '22P02' ||
    status === 400
  ) {
    return new ProfileDataError(
      'VALIDATION_ERROR',
      'El nombre no cumple los límites permitidos.',
      status,
    )
  }

  if (
    code === 'PGRST000' ||
    message.includes('failed to fetch') ||
    message.includes('network')
  ) {
    return new ProfileDataError(
      'NETWORK_ERROR',
      'No se pudo conectar con la base de datos. Revisa tu conexión.',
      status,
    )
  }

  return new ProfileDataError(
    'INTERNAL',
    'No se pudo cargar el perfil. Intenta de nuevo.',
    status,
  )
}

function getClient() {
  if (!supabase) {
    throw new ProfileDataError(
      'NOT_CONFIGURED',
      'Las cuentas no están configuradas. Revisa las variables de Supabase.',
    )
  }
  return supabase
}

export function profileDisplayNameFromMetadata(user) {
  const candidate = user?.user_metadata?.display_name
  if (typeof candidate !== 'string') return null
  const trimmed = candidate.trim()
  return trimmed ? trimmed.slice(0, 80) : null
}

export async function getOrCreateProfile(user) {
  if (!user?.id) {
    throw new ProfileDataError('SESSION_EXPIRED', 'No hay una sesión activa.')
  }

  const client = getClient()
  const { data, error } = await client
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('id', user.id)
    .maybeSingle()

  if (error) throw mapProfileError(error)
  if (data) return data

  // Si el trigger de alta falló, se intenta crear el perfil propio. La política
  // RLS permite insertar únicamente la fila con auth.uid() = id.
  const displayName = profileDisplayNameFromMetadata(user)
  const { data: created, error: insertError } = await client
    .from('profiles')
    .insert({ id: user.id, display_name: displayName })
    .select(PROFILE_COLUMNS)
    .single()

  if (!insertError) return created

  // Otra pestaña pudo crear el perfil entre la lectura y la inserción.
  if (insertError.code === '23505') {
    const { data: existing, error: retryError } = await client
      .from('profiles')
      .select(PROFILE_COLUMNS)
      .eq('id', user.id)
      .single()
    if (retryError) throw mapProfileError(retryError)
    return existing
  }

  throw mapProfileError(insertError)
}

export async function updateProfile(userId, displayName) {
  if (!userId) {
    throw new ProfileDataError('SESSION_EXPIRED', 'No hay una sesión activa.')
  }

  const validationError = validateDisplayName(displayName)
  if (validationError) {
    throw new ProfileDataError('VALIDATION_ERROR', validationError)
  }

  const client = getClient()
  const { data, error } = await client
    .from('profiles')
    .update({ display_name: displayName.trim() })
    .eq('id', userId)
    .select(PROFILE_COLUMNS)
    .maybeSingle()

  if (error) throw mapProfileError(error)
  if (!data) {
    throw new ProfileDataError(
      'NOT_FOUND',
      'No se encontró tu perfil. Vuelve a cargar la página.',
    )
  }
  return data
}
