import { useEffect } from 'react'
import { useAuth } from '../../context/authContext.js'
import { buildLoginHref } from '../../utils/authValidation.js'
import ErrorState from '../ui/ErrorState.jsx'
import LoadingState from '../ui/LoadingState.jsx'
import AuthUnavailablePage from '../../pages/AuthUnavailablePage.jsx'

export default function RequireAuth({ children, navigate, pathname, search }) {
  const { status, error, reloadSession, configured } = useAuth()
  const nextPath = `${pathname}${search ?? ''}`

  useEffect(() => {
    if (status !== 'unauthenticated' || !configured) return
    navigate(buildLoginHref(nextPath), { replace: true })
  }, [status, configured, navigate, nextPath])

  if (!configured || status === 'unavailable') {
    return <AuthUnavailablePage navigate={navigate} />
  }

  if (status === 'loading') {
    return (
      <section className="account-page" aria-busy="true">
        <LoadingState count={1} message="Comprobando tu sesión…" />
      </section>
    )
  }

  if (status === 'error') {
    return (
      <section className="account-page">
        <ErrorState
          title="No pudimos comprobar tu sesión"
          description={error ?? 'Revisa tu conexión e intenta de nuevo.'}
          actionLabel="Reintentar"
          onAction={reloadSession}
        />
      </section>
    )
  }

  if (status === 'unauthenticated') {
    return (
      <section className="account-page" aria-busy="true">
        <LoadingState count={1} message="Redirigiendo al inicio de sesión…" />
      </section>
    )
  }

  return children
}
