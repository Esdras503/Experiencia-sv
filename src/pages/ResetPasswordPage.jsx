import { useState } from 'react'
import { useAuth } from '../context/authContext.js'
import AuthLayout from '../components/auth/AuthLayout.jsx'
import AuthMessage from '../components/auth/AuthMessage.jsx'
import LoadingState from '../components/ui/LoadingState.jsx'
import {
  MIN_PASSWORD_LENGTH,
  describeAuthError,
  validatePassword,
  validatePasswordConfirmation,
} from '../utils/authValidation.js'

export default function ResetPasswordPage({ navigate }) {
  const { status, session, updatePassword, reloadSession } = useAuth()
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [updated, setUpdated] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError(null)

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
      await updatePassword(password)
      setUpdated(true)
      setPassword('')
      setConfirmation('')
    } catch (updateError) {
      setError(describeAuthError(updateError))
    } finally {
      setSubmitting(false)
    }
  }

  if (status === 'loading') {
    return (
      <section className="account-page" aria-busy="true">
        <LoadingState count={1} message="Validando el enlace de recuperación…" />
      </section>
    )
  }

  if (status === 'error') {
    return (
      <AuthLayout
        eyebrow="RECUPERAR CONTRASEÑA"
        title="No pudimos validar el enlace"
        description="Puede que hayas perdido la conexión. Vuelve a intentarlo o solicita un enlace nuevo."
      >
        <AuthMessage>{error ?? 'Revisa tu conexión.'}</AuthMessage>
        <div className="auth-actions">
          <button type="button" className="button-primary" onClick={reloadSession}>
            Reintentar
          </button>
          <a className="button-secondary" href="/cuenta/recuperar">
            Solicitar otro enlace
          </a>
        </div>
      </AuthLayout>
    )
  }

  if (!session) {
    return (
      <AuthLayout
        eyebrow="RECUPERAR CONTRASEÑA"
        title="Este enlace ya no es válido"
        description="Los enlaces de recuperación caducan y solo pueden usarse una vez. Solicita uno nuevo para continuar."
      >
        <div className="auth-actions">
          <a className="button-primary" href="/cuenta/recuperar">
            Solicitar un enlace nuevo
          </a>
          <a className="button-secondary" href="/cuenta/iniciar-sesion">
            Volver a iniciar sesión
          </a>
        </div>
      </AuthLayout>
    )
  }

  if (updated) {
    return (
      <AuthLayout
        eyebrow="CONTRASEÑA ACTUALIZADA"
        title="Tu contraseña cambió"
        description="La sesión actual sigue abierta. Usa la nueva contraseña la próxima vez que inicies sesión."
      >
        <AuthMessage tone="success">
          El cambio se completó correctamente.
        </AuthMessage>
        <div className="auth-actions">
          <button
            type="button"
            className="button-primary"
            onClick={() => navigate('/itinerarios', { replace: true })}
          >
            Ir a mis itinerarios
          </button>
          <button
            type="button"
            className="button-secondary"
            onClick={() => navigate('/cuenta', { replace: true })}
          >
            Ver mi cuenta
          </button>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      eyebrow="NUEVA CONTRASEÑA"
      title="Crea una contraseña nueva"
      description="Usa una contraseña que no reutilices en otros sitios. Al guardarla, el enlace quedará invalidado."
      footer={
        <p>
          <a href="/cuenta/iniciar-sesion">Cancelar y volver al inicio de sesión</a>
        </p>
      }
    >
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <div className="form-field">
          <label htmlFor="reset-password">Contraseña nueva</label>
          <input
            id="reset-password"
            name="newPassword"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            aria-describedby="reset-password-hint"
            required
          />
          <p className="form-hint" id="reset-password-hint">
            Al menos {MIN_PASSWORD_LENGTH} caracteres.
          </p>
        </div>

        <div className="form-field">
          <label htmlFor="reset-confirmation">Repite la contraseña nueva</label>
          <input
            id="reset-confirmation"
            name="newPasswordConfirmation"
            type="password"
            autoComplete="new-password"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            required
          />
        </div>

        <AuthMessage>{error}</AuthMessage>

        <button type="submit" className="button-primary" disabled={submitting}>
          {submitting ? 'Guardando…' : 'Guardar contraseña'}
        </button>
      </form>
    </AuthLayout>
  )
}
