import { useState } from 'react'
import { useAuth } from '../context/authContext.js'
import AuthLayout from '../components/auth/AuthLayout.jsx'
import AuthMessage from '../components/auth/AuthMessage.jsx'
import {
  describeAuthError,
  validateEmail,
} from '../utils/authValidation.js'

export default function ForgotPasswordPage({ navigate }) {
  const { requestPasswordReset } = useAuth()
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError(null)

    const emailError = validateEmail(email)
    if (emailError) {
      setError(emailError)
      return
    }

    setSubmitting(true)
    try {
      await requestPasswordReset({
        email,
        redirectTo: `${window.location.origin}/cuenta/restablecer`,
      })
      setSent(true)
    } catch (resetError) {
      setError(describeAuthError(resetError))
    } finally {
      setSubmitting(false)
    }
  }

  if (sent) {
    return (
      <AuthLayout
        eyebrow="RECUPERAR CONTRASEÑA"
        title="Revisa tu correo"
        description="Si existe una cuenta con ese correo, recibirás un enlace para crear una contraseña nueva."
      >
        <AuthMessage tone="success">
          El enlace de recuperación caduca en poco tiempo y solo puede usarse una
          vez. Revisa también la carpeta de spam.
        </AuthMessage>
        <div className="auth-actions">
          <button
            type="button"
            className="button-primary"
            onClick={() => navigate('/cuenta/iniciar-sesion')}
          >
            Volver a iniciar sesión
          </button>
          <button type="button" className="button-secondary" onClick={() => setSent(false)}>
            Enviar a otro correo
          </button>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      eyebrow="RECUPERAR CONTRASEÑA"
      title="¿Olvidaste tu contraseña?"
      description="Escribe el correo de tu cuenta y te enviaremos un enlace seguro para restablecerla."
      footer={
        <p>
          <a href="/cuenta/iniciar-sesion">Volver a iniciar sesión</a>
        </p>
      }
    >
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <div className="form-field">
          <label htmlFor="forgot-email">Correo electrónico</label>
          <input
            id="forgot-email"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </div>

        <AuthMessage>{error}</AuthMessage>

        <button type="submit" className="button-primary" disabled={submitting}>
          {submitting ? 'Enviando…' : 'Enviar enlace de recuperación'}
        </button>
      </form>
    </AuthLayout>
  )
}
