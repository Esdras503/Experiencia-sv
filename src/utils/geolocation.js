/**
 * Traduce un error de geolocalización del navegador a un mensaje en español.
 * La ubicación solo se solicita cuando la persona activa "Buscar cerca de mí".
 */
export function describeGeolocationError(error) {
  switch (error?.code) {
    case 1:
      return 'Permiso de ubicación denegado. Puedes buscar normalmente o escribir una ciudad como referencia.'
    case 2:
      return 'No pudimos obtener tu ubicación en este momento. Escribe una ciudad como referencia.'
    case 3:
      return 'La solicitud de ubicación tardó demasiado. Intenta de nuevo o escribe una ciudad.'
    default:
      return 'No se pudo obtener tu ubicación. Escribe una ciudad como referencia.'
  }
}
