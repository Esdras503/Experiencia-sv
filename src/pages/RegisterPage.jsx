import { useEffect, useState } from 'react'
import { useAuth } from '../context/authContext.js'
import AuthLayout from '../components/auth/AuthLayout.jsx'
import AuthMessage from '../components/auth/AuthMessage.jsx'
import {
  DEFAULT_POST_AUTH_PATH,
  MAX_DISPLAY_NAME_LENGTH,
  MIN_PASSWORD_LENGTH,
  describeAuthError,
  sanitizeRedirectPath,
  validateDisplayName,
  validateEmail,
  validatePassword,
  validatePasswordConfirmation,
} from '../utils/authValidation.js'

function withNext(path, next) {
  if (!next || next === '/itinerarios') return path
  return `${path}?next=${encodeURIComponent(next)}`
}

export default function RegisterPage({ search, navigate }) {
  const { status, signUp } = useAuth()
  const params = new URLSearchParams(search)
  const nextPath = sanitizeRedirectPath(params.get('next'), DEFAULT_POST_AUTH_PATH)

  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [pendingEmail, setPendingEmail] = useState(null)

  useEffect(() => {
    if (status === 'authenticated') {
      navigate(nextPath, { replace: true })
    }
  }, [status, nextPath, navigate])

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError(null)

    const nameError = validateDisplayName(displayName)
    if (nameError) {
      setError(nameError)
      return
    }
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
    const confirmationError = validatePasswordConfirmation(password, confirmation)
    if (confirmationError) {
      setError(confirmationError)
      return
    }

    setSubmitting(true)
    try {
      const data = await signUp({
        email,
        password,
        displayName,
        emailRedirectTo: `${window.location.origin}/cuenta/iniciar-sesion?confirmado=1`,
      })

      if (data.session) {
        navigate(nextPath, { replace: true })
        return
      }

      setPendingEmail(email.trim().toLowerCase())
    } catch (signUpError) {
      setError(describeAuthError(signUpError))
    } finally {
      setSubmitting(false)
    }
  }

  if (pendingEmail) {
    return (
      <AuthLayout
        eyebrow="REVISA TU CORREO"
        title="Confirma tu cuenta"
        description="Te enviamos un enlace de confirmación. Debes abrirlo antes de iniciar sesión."
      >
        <AuthMessage tone="success">
          Si el correo <strong>{pendingEmail}</strong> puede registrarse, recibirás un
          mensaje con el enlace de confirmación. Revisa también la carpeta de spam.
        </AuthMessage>

        <div className="auth-actions">
          <a
            className="button-primary"
            href={withNext('/cuenta/iniciar-sesion', nextPath)}
          >
            Ir a iniciar sesión
          </a>
          <a className="button-secondary" href="/">
            Explorar sin cuenta
          </a>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      eyebrow="CREAR CUENTA"
      title="Guarda tus próximos viajes"
      description="Solo necesitamos tu nombre, un correo y una contraseña. Explorar El Salvador sigue siendo libre."
      footer={
        <p>
          ¿Ya tienes cuenta?{' '}
          <a href={withNext('/cuenta/iniciar-sesion', nextPath)}>Inicia sesión</a>.
        </p>
      }
    >
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <div className="form-field">
          <label htmlFor="register-name">Nombre para mostrar</label>
          <input
            id="register-name"
            name="displayName"
            type="text"
            autoComplete="name"
            maxLength={MAX_DISPLAY_NAME_LENGTH}
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            required
          />
          <p className="form-hint">
            Es el nombre que aparecerá en tu cuenta, no en los lugares públicos.
          </p>
        </div>

        <div className="form-field">
          <label htmlFor="register-email">Correo electrónico</label>
          <input
            id="register-email"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </div>

        <div className="form-field">
          <label htmlFor="register-password">Contraseña</label>
          <input
            id="register-password"
            name="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            aria-describedby="register-password-hint"
            required
          />
          <p className="form-hint" id="register-password-hint">
            Al menos {MIN_PASSWORD_LENGTH} caracteres.
          </p>
        </div>

        <div className="form-field">
          <label htmlFor="register-confirmation">Repite la contraseña</label>
          <input
            id="register-confirmation"
            name="passwordConfirmation"
            type="password"
            autoComplete="new-password"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            required
          />
        </div>

        <AuthMessage>{error}</AuthMessage>

        <button type="submit" className="button-primary" disabled={submitting}>
          {submitting ? 'Creando cuenta…' : 'Crear mi cuenta'}
        </button>
      </form>
    </AuthLayout>
  )
}
