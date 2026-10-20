const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]'])

function isLocalHostname(hostname) {
  return LOCAL_HOSTS.has(hostname)
}

function decodeJwtPayload(token) {
  const parts = token.split('.')
  if (parts.length !== 3) return null

  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')
    const json = typeof atob === 'function' ? atob(padded) : ''
    return json ? JSON.parse(json) : null
  } catch {
    return null
  }
}

/**
 * Rechaza claves que claramente son secretas. La clave publicable/anon de
 * Supabase es pública por diseño; la service_role nunca debe llegar al navegador.
 */
export function isLikelyServiceRoleKey(key) {
  if (typeof key !== 'string') return false
  const value = key.trim()
  if (!value) return false
  if (value.startsWith('sb_secret_')) return true

  const payload = decodeJwtPayload(value)
  return payload?.role === 'service_role'
}

/**
 * Lee y valida la configuración pública de Supabase. Devuelve `configured`
 * en false sin lanzar errores para que la exploración pública siga funcionando
 * cuando todavía no se ha creado el proyecto de Supabase.
 */
export function readSupabaseConfig(env = {}) {
  const rawUrl = typeof env.VITE_SUPABASE_URL === 'string' ? env.VITE_SUPABASE_URL.trim() : ''
  const rawAnonKey =
    typeof env.VITE_SUPABASE_ANON_KEY === 'string'
      ? env.VITE_SUPABASE_ANON_KEY.trim()
      : ''
  const rawPublishableKey =
    typeof env.VITE_SUPABASE_PUBLISHABLE_KEY === 'string'
      ? env.VITE_SUPABASE_PUBLISHABLE_KEY.trim()
      : ''
  const rawKey = rawAnonKey || rawPublishableKey

  if (!rawUrl && !rawKey) {
    return {
      configured: false,
      error: 'missing',
      url: '',
      key: '',
      message:
        'Las cuentas no están configuradas. Define VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.',
    }
  }

  if (!rawUrl || !rawKey) {
    return {
      configured: false,
      error: 'incomplete',
      url: '',
      key: '',
      message:
        'La configuración de Supabase está incompleta. Define la URL y la clave publicable.',
    }
  }

  let parsed
  try {
    parsed = new URL(rawUrl)
  } catch {
    return {
      configured: false,
      error: 'invalid-url',
      url: '',
      key: '',
      message: 'La URL de Supabase no es válida.',
    }
  }

  if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && isLocalHostname(parsed.hostname))) {
    return {
      configured: false,
      error: 'insecure-url',
      url: '',
      key: '',
      message: 'La URL de Supabase debe usar HTTPS (HTTP solo se permite en localhost).',
    }
  }

  if (isLikelyServiceRoleKey(rawKey)) {
    return {
      configured: false,
      error: 'secret-key',
      url: '',
      key: '',
      message:
        'La clave configurada parece ser service_role. Usa solo la clave publicable/anon en el navegador.',
    }
  }

  return {
    configured: true,
    error: null,
    url: parsed.origin,
    key: rawKey,
    message: null,
  }
}
