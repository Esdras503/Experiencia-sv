import { AppError, ERROR_CODES } from '../errors.js'

/**
 * Contrato mínimo para conectar una pasarela real más adelante.
 *
 * No se implementa ninguna pasarela ficticia. Cuando se elija un proveedor:
 *   1. crearCheckout debe devolver una URL de su sitio alojado y una referencia
 *      interna pendiente, sin activar ningún plan;
 *   2. parseWebhook debe verificar la firma con el secreto del proveedor;
 *   3. el webhook debe registrar provider_event_id en payment_events y ser
 *      idempotente antes de activar una suscripción o un pase;
 *   4. las fechas del pase se completan desde el backend, nunca desde el
 *      navegador, y solo después de confirmar el pago.
 */
export function createPaymentProvider() {
  return {
    enabled: false,
    name: null,
    async createCheckout() {
      throw new AppError(ERROR_CODES.PAYMENTS_NOT_CONFIGURED, { status: 503 })
    },
    async parseWebhook() {
      return { accepted: false, reason: 'not_configured' }
    },
  }
}
