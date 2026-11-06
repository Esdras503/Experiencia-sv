import { parseDemoMode } from '../../shared/demoMode.js'

/**
 * Valor de compilación para mostrar el modo demostración antes de que responda
 * el API. El backend sigue siendo la fuente de verdad: /api/billing/status
 * devuelve demoMode y prevalece sobre este valor.
 */
const env = import.meta.env ?? {}

export const DEMO_MODE = parseDemoMode(env.VITE_DEMO_MODE)
