const DEFAULT_BASE_URL = 'https://api.openai.com/v1'
const DEFAULT_MODEL = 'gpt-4o-mini'
const DEFAULT_PROVIDER_NAME = 'OpenAI'
const DEFAULT_TIMEOUT_MS = 15000
const DEFAULT_MAX_OUTPUT_TOKENS = 900
const REASONING_EFFORTS = new Set(['low', 'medium', 'high'])

function normalizeReasoningEffort(value) {
  if (typeof value !== 'string') return null
  const effort = value.trim().toLowerCase()
  return REASONING_EFFORTS.has(effort) ? effort : null
}

function clampInteger(value, fallback, minimum, maximum) {
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(maximum, Math.max(minimum, parsed))
}

function normalizeBaseUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return null

  try {
    const url = new URL(value.trim())
    const isLocal =
      url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '::1'

    // Nunca se envía la clave por HTTP sin cifrar, salvo a un modelo local.
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && isLocal)) return null

    return url.href.replace(/\/+$/, '')
  } catch {
    return null
  }
}

/**
 * Configuración del proveedor de IA (compatible con la API de Chat
 * Completions de OpenAI). La clave vive solo en el servidor.
 *
 * `AI_BASE_URL` permite usar Groq, OpenRouter, DeepSeek, Ollama u otro
 * proveedor compatible sin cambiar el código.
 */
export function resolveAiConfig(env = {}) {
  const apiKey = typeof env.AI_API_KEY === 'string' ? env.AI_API_KEY.trim() : ''
  const baseUrl = normalizeBaseUrl(env.AI_BASE_URL) ?? DEFAULT_BASE_URL
  const model =
    typeof env.AI_MODEL === 'string' && env.AI_MODEL.trim()
      ? env.AI_MODEL.trim().slice(0, 120)
      : DEFAULT_MODEL
  const providerName =
    typeof env.AI_PROVIDER_NAME === 'string' && env.AI_PROVIDER_NAME.trim()
      ? env.AI_PROVIDER_NAME.trim().slice(0, 60)
      : DEFAULT_PROVIDER_NAME

  return {
    enabled: Boolean(apiKey),
    apiKey,
    baseUrl,
    model,
    providerName,
    timeoutMs: clampInteger(env.AI_TIMEOUT_MS, DEFAULT_TIMEOUT_MS, 3000, 25000),
    maxOutputTokens: clampInteger(
      env.AI_MAX_OUTPUT_TOKENS,
      DEFAULT_MAX_OUTPUT_TOKENS,
      200,
      2000,
    ),
    // Opcional y compatible con OpenAI: reduce el razonamiento en modelos que
    // lo admiten (por ejemplo Gemini 3). Sin definir, se usa el valor del
    // proveedor.
    reasoningEffort: normalizeReasoningEffort(env.AI_REASONING_EFFORT),
  }
}

export const AI_CONFIG_DEFAULTS = {
  baseUrl: DEFAULT_BASE_URL,
  model: DEFAULT_MODEL,
  providerName: DEFAULT_PROVIDER_NAME,
  timeoutMs: DEFAULT_TIMEOUT_MS,
  maxOutputTokens: DEFAULT_MAX_OUTPUT_TOKENS,
  reasoningEffort: null,
}
