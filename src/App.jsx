import { useEffect, useState } from 'react'
import './App.css'
import Header from './components/layout/Header'
import Footer from './components/layout/Footer'
import ChatWidget from './components/chat/ChatWidget'
import ErrorBoundary from './components/ui/ErrorBoundary'
import RequireAuth from './components/auth/RequireAuth'
import HomePage from './pages/HomePage'
import PlaceDetailPage from './pages/PlaceDetailPage'
import NotFoundPage from './pages/NotFoundPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import AccountPage from './pages/AccountPage'
import AccountUnavailablePage from './pages/AuthUnavailablePage'
import ItinerariesPage from './pages/ItinerariesPage'
import ItineraryDetailPage from './pages/ItineraryDetailPage'
import { useAuth } from './context/authContext.js'
import { useAppRoute } from './hooks/useAppRoute'
import { useDocumentTitle } from './hooks/useDocumentTitle'
import { parseRoute } from './utils/routes'

const AUTH_ROUTES = new Set([
  'login',
  'register',
  'forgot-password',
  'reset-password',
])

const PAGE_TITLES = {
  login: 'Iniciar sesión — Experiencia SV',
  register: 'Crear cuenta — Experiencia SV',
  'forgot-password': 'Recuperar contraseña — Experiencia SV',
  'reset-password': 'Nueva contraseña — Experiencia SV',
  account: 'Mi cuenta — Experiencia SV',
  itineraries: 'Mis itinerarios — Experiencia SV',
  itinerary: 'Itinerario guardado — Experiencia SV',
  'not-found': 'Página no encontrada — Experiencia SV',
}

function App() {
  const { pathname, search, hash, navigate } = useAppRoute()
  const [chatOpen, setChatOpen] = useState(false)
  const { configured } = useAuth()
  const route = parseRoute(pathname)

  const pageTitle = (() => {
    if (route.name === 'home') return 'Experiencia SV — Descubre El Salvador'
    // El detalle y el itinerario definen su título cuando cargan datos.
    if (route.name === 'place' || route.name === 'itinerary') return null
    return PAGE_TITLES[route.name] ?? 'Página no encontrada — Experiencia SV'
  })()

  useDocumentTitle(pageTitle)

  useEffect(() => {
    if (route.name !== 'home') {
      window.scrollTo({ top: 0, behavior: 'auto' })
    }
  }, [route.name, pathname])

  // Navegación interna para los enlaces normales de las páginas nuevas. Los
  // componentes existentes que ya llaman a navigate siguen funcionando porque
  // su onClick marca el evento como prevenido.
  useEffect(() => {
    const handleDocumentClick = (event) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return
      }

      const anchor = event.target.closest?.('a')
      if (!anchor) return
      if (anchor.target && anchor.target !== '_self') return
      if (anchor.hasAttribute('download')) return

      const href = anchor.getAttribute('href')
      if (
        !href ||
        href.startsWith('#') ||
        href.startsWith('mailto:') ||
        href.startsWith('tel:')
      ) {
        return
      }

      let url
      try {
        url = new URL(anchor.href, window.location.href)
      } catch {
        return
      }

      if (url.origin !== window.location.origin) return
      if (url.protocol !== 'http:' && url.protocol !== 'https:') return

      event.preventDefault()
      navigate(`${url.pathname}${url.search}${url.hash}`)
    }

    document.addEventListener('click', handleDocumentClick)
    return () => document.removeEventListener('click', handleDocumentClick)
  }, [navigate])

  const handleNavigateSection = (sectionId) => {
    navigate(`/#${sectionId}`)
  }

  const authRoute = AUTH_ROUTES.has(route.name)
  const showUnavailable =
    !configured &&
    (authRoute ||
      route.name === 'account' ||
      route.name === 'itineraries' ||
      route.name === 'itinerary')

  return (
    <div className="app">
      <a className="skip-link" href="#contenido">
        Saltar al contenido
      </a>

      <Header
        pathname={pathname}
        onNavigateSection={handleNavigateSection}
        onNavigateHome={() => navigate('/')}
      />

      <main id="contenido" tabIndex={-1}>
        <ErrorBoundary key={`${pathname}${search}${hash}`}>
          {route.name === 'home' && (
            <HomePage
              search={search}
              navigate={navigate}
              onOpenChat={() => setChatOpen(true)}
            />
          )}

          {route.name === 'place' && (
            <PlaceDetailPage
              key={route.placeId}
              placeId={route.placeId}
              search={search}
              navigate={navigate}
            />
          )}

          {showUnavailable && <AccountUnavailablePage navigate={navigate} />}

          {configured && route.name === 'login' && (
            <LoginPage search={search} hash={hash} navigate={navigate} />
          )}

          {configured && route.name === 'register' && (
            <RegisterPage search={search} navigate={navigate} />
          )}

          {configured && route.name === 'forgot-password' && (
            <ForgotPasswordPage navigate={navigate} />
          )}

          {configured && route.name === 'reset-password' && (
            <ResetPasswordPage navigate={navigate} />
          )}

          {configured && route.name === 'account' && (
            <RequireAuth
              navigate={navigate}
              pathname={pathname}
              search={search}
            >
              <AccountPage navigate={navigate} />
            </RequireAuth>
          )}

          {configured && route.name === 'itineraries' && (
            <RequireAuth
              navigate={navigate}
              pathname={pathname}
              search={search}
            >
              <ItinerariesPage
                navigate={navigate}
                onOpenChat={() => setChatOpen(true)}
              />
            </RequireAuth>
          )}

          {configured && route.name === 'itinerary' && (
            <RequireAuth
              navigate={navigate}
              pathname={pathname}
              search={search}
            >
              <ItineraryDetailPage
                key={route.itineraryId}
                itineraryId={route.itineraryId}
                navigate={navigate}
              />
            </RequireAuth>
          )}

          {route.name === 'not-found' && <NotFoundPage navigate={navigate} />}
        </ErrorBoundary>
      </main>

      <Footer pathname={pathname} onNavigateHome={() => navigate('/')} />

      <ChatWidget
        open={chatOpen}
        onOpen={() => setChatOpen(true)}
        onClose={() => setChatOpen(false)}
        navigate={navigate}
      />
    </div>
  )
}

export default App
