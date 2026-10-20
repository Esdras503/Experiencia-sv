const STATIC_ROUTES = {
  '/cuenta': { name: 'account' },
  '/cuenta/iniciar-sesion': { name: 'login' },
  '/cuenta/registro': { name: 'register' },
  '/cuenta/recuperar': { name: 'forgot-password' },
  '/cuenta/restablecer': { name: 'reset-password' },
  '/itinerarios': { name: 'itineraries' },
}

function decodeSegment(value) {
  try {
    return decodeURIComponent(value)
  } catch {
    return null
  }
}

export function parseRoute(pathname) {
  const normalizedPath = pathname.replace(/\/+$/, '') || '/'

  if (normalizedPath === '/') {
    return { name: 'home' }
  }

  if (STATIC_ROUTES[normalizedPath]) {
    return STATIC_ROUTES[normalizedPath]
  }

  const placeMatch = normalizedPath.match(/^\/lugares\/([^/]+)$/)

  if (placeMatch) {
    const placeId = decodeSegment(placeMatch[1])
    return placeId ? { name: 'place', placeId } : { name: 'not-found' }
  }

  const itineraryMatch = normalizedPath.match(/^\/itinerarios\/([^/]+)$/)

  if (itineraryMatch) {
    const itineraryId = decodeSegment(itineraryMatch[1])
    return itineraryId ? { name: 'itinerary', itineraryId } : { name: 'not-found' }
  }

  return { name: 'not-found' }
}
