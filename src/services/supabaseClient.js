import { createClient } from '@supabase/supabase-js'
import { readSupabaseConfig } from './supabaseConfig.js'

const env =
  typeof import.meta !== 'undefined' && import.meta.env && typeof import.meta.env === 'object'
    ? import.meta.env
    : {}

const config = readSupabaseConfig(env)

let client = null
let initializationError = null

if (config.configured) {
  try {
    client = createClient(config.url, config.key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'experiencia-sv-auth',
      },
      db: { schema: 'public' },
    })
  } catch {
    initializationError =
      'No se pudo inicializar Supabase. Revisa la URL y la clave publicable.'
  }
}

export const isSupabaseConfigured = Boolean(client)
export const supabaseConfigError = config.message ?? initializationError
export const supabase = client
