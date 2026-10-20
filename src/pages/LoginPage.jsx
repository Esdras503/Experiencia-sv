import { useEffect, useState } from 'react'
import { useAuth } from '../context/authContext.js'
import AuthLayout from '../components/auth/AuthLayout.jsx'
import AuthMessage from '../components/auth/AuthMessage.jsx'
import {
  DEFAULT_POST_AUTH_PATH,
  describeAuthError,
  parseAuthHashError,
  sanitizeRedirectPath,
  validateEmail,
  validatePassword,
} from '../utils/authValidation.js'

function withNext(path, next) {
  if (!next || next === '/itinerarios') return path
  return `${path}?next=${encodeURIComponent(next)}`
}

export default function LoginPage({ search, hash = '', navigate }) {
  const { status, signIn } = useAuth()
  const params = new URLSearchParams(search)
  const nextPath = sanitizeRedirectPath(params.get('next'), DEFAULT_POST_AUTH_PATH)
  const confirmationError = parseAuthHashError(hash)
  const hasConfirmationError = Boolean(confirmationError)
  const justConfirmed = params.get('confirmado') === '1' && !hasConfirmationError

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (status === 'authenticated' && !justConfirmed && !hasConfirmationError) {
      navigate(nextPath, { replace: true })
    }
  }, [status, justConfirmed, hasConfirmationError, nextPath, navigate])

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError(null)

    const emailError = validateEmail(email)
    if (emailError) {
      setError(emailError)
      return
    }
    const passwordError = validatePassword(password)
    if (passwordError) {
      setError(passwordError)
      return
    }

    setSubmitting(true)
    try {
      await signIn({ email, password })
      navigate(nextPath, { replace: true })
    } catch (signInError) {
      setError(describeAuthError(signInError))
    } finally {
      setSubmitting(false)
    }
  }

  if (confirmationError) {
    const alreadySignedIn = status === 'authenticated'

    return (
      <AuthLayout
        eyebrow="ENLACE NO VÁLIDO"
        title="No pudimos confirmar tu correo"
        description={
          alreadySignedIn
            ? 'El enlace caducó o ya se utilizó, pero tu sesión sigue activa.'
            : 'El enlace caducó o ya se utilizó. Los enlaces de confirmación solo se pueden usar una vez.'
        }
      >
        <AuthMessage>
          {alreadySignedIn
            ? 'No se hicieron cambios en tu cuenta. Puedes continuar con tu sesión actual.'
            : 'Inicia sesión si ya confirmaste tu cuenta o vuelve a registrarte para recibir un enlace nuevo.'}
        </AuthMessage>
        <div className="auth-actions">
          {alreadySignedIn ? (
            <button
              type="button"
              className="button-primary"
              onClick={() => navigate(nextPath, { replace: true })}
            >
              Ir a mis itinerarios
            </button>
          ) : (
            <>
              <a className="button-primary" href="/cuenta/iniciar-sesion">
                Iniciar sesión
              </a>
              <a className="button-secondary" href="/cuenta/registro">
                Crear una cuenta
              </a>
            </>
          )}
        </div>
      </AuthLayout>
    )
  }

  if (status === 'authenticated' && justConfirmed) {
    return (
      <AuthLayout
        eyebrow="CORREO CONFIRMADO"
        title="Tu cuenta está lista"
        description="La sesión se inició correctamente. Ya puedes guardar y administrar tus itinerarios."
      >
        <AuthMessage tone="success">
          Correo confirmado. Bienvenido a Experiencia SV.
        </AuthMessage>
        <div className="auth-actions">
          <button
            type="button"
            className="button-primary"
            onClick={() => navigate(nextPath, { replace: true })}
          >
            Continuar
          </button>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      eyebrow="INICIAR SESIÓN"
      title="Bienvenido de nuevo"
      description="Entra para guardar itinerarios y volver a tus planes cuando quieras."
      footer={
        <p>
          ¿Todavía no tienes cuenta?{' '}
          <a href={withNext('/cuenta/registro', nextPath)}>Crea una gratis</a>.
        </p>
      }
    >
      {justConfirmed && (
        <AuthMessage tone="success">
          Correo confirmado. Inicia sesión con tu contraseña.
        </AuthMessage>
      )}

      {status === 'loading' && (
        <AuthMessage tone="info">Comprobando tu sesión…</AuthMessage>
      )}

      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <div className="form-field">
          <label htmlFor="login-email">Correo electrónico</label>
          <input
            id="login-email"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            aria-invalid={Boolean(error) || undefined}
            required
          />
        </div>

        <div className="form-field">
          <label htmlFor="login-password">Contraseña</label>
          <input
            id="login-password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </div>

        <AuthMessage>{error}</AuthMessage>

        <div className="auth-form-row">
          <a href="/cuenta/recuperar">¿Olvidaste tu contraseña?</a>
        </div>

        <button type="submit" className="button-primary" disabled={submitting}>
          {submitting ? 'Entrando…' : 'Iniciar sesión'}
        </button>
      </form>
    </AuthLayout>
  )
}
