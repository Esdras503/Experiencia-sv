export const MAX_HISTORY_MESSAGES = 10

/**
 * Historial de texto que se envía al backend. Se excluye el saludo local
 * (`welcome`), los errores y los mensajes sin texto. El itinerario no va aquí:
 * viaja en el token firmado por el servidor.
 */
export function buildHistory(messages) {
  if (!Array.isArray(messages)) return []

  return messages
    .filter(
      (item) =>
        item &&
        item.id !== 'welcome' &&
        typeof item.text === 'string' &&
        item.text.trim() &&
        !item.error &&
        (item.role === 'user' || item.role === 'assistant'),
    )
    .slice(-MAX_HISTORY_MESSAGES)
    .map((item) => ({ role: item.role, content: item.text.trim() }))
}
