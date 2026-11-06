/**
 * Configuración compartida del modo demostración.
 *
 * La variable canónica es VITE_DEMO_MODE. En Vercel debe existir tanto en el
 * build como en el entorno de las funciones serverless; el backend la lee de
 * process.env y el frontend de import.meta.env. El backend acepta además
 * DEMO_MODE como alias de runtime para instalaciones que ya usaban ese nombre.
 * Es un indicador público, no un secreto: nunca debe usarse para autorizar
 * acciones por sí solo.
 */

export const DEMO_MODE_ENV_VAR = 'VITE_DEMO_MODE'
export const DEMO_MODE_SERVER_ENV_VAR = 'DEMO_MODE'

export const DEMO_MODE_BANNER =
  'Modo demostración: todas las funciones están habilitadas gratuitamente.'

export const DEMO_MODE_PAYMENT_MESSAGE =
  'El modo demostración no procesa pagos. Todas las funciones ya están habilitadas gratuitamente y no se realizará ningún cobro.'

const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on', 'si', 'sí'])
const FALSE_VALUES = new Set(['0', 'false', 'no', 'off'])

export function parseDemoMode(value) {
  if (value === true) return true
  if (value === false || value === null || value === undefined) return false
  if (typeof value !== 'string' && typeof value !== 'number') return false

  const normalized = String(value).trim().toLowerCase()
  if (!normalized || FALSE_VALUES.has(normalized)) return false
  return TRUE_VALUES.has(normalized)
}

export function resolveDemoMode(env = {}) {
  const primary = env?.[DEMO_MODE_ENV_VAR]
  if (primary !== undefined && primary !== null && String(primary).trim() !== '') {
    return parseDemoMode(primary)
  }

  return parseDemoMode(env?.[DEMO_MODE_SERVER_ENV_VAR])
}
