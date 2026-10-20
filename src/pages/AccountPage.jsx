import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../context/authContext.js'
import { getOrCreateProfile, updateProfile } from '../services/profileService.js'
import { validateDisplayName } from '../utils/authValidation.js'
import AuthMessage from '../components/auth/AuthMessage.jsx'
import ErrorState from '../components/ui/ErrorState.jsx'
import LoadingState from '../components/ui/LoadingState.jsx'

function formatDate(value) {
  if (!value) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return new Intl.DateTimeFormat('es-SV', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(parsed)
}

export default function AccountPage({ navigate }) {
  const { user, signOut } = useAuth()
  const [profile, setProfile] = useState(null)
  const [status, setStatus] = useState('loading')
  const [loadError, setLoadError] = useState(null)
  const [reloadToken, setReloadToken] = useState(0)

  const [displayName, setDisplayName] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [notice, setNotice] = useState(null)
  const [signingOut, setSigningOut] = useState(false)

  useEffect(() => {
    if (!user?.id) return undefined
    let cancelled = false

    getOrCreateProfile(user)
      .then((nextProfile) => {
        if (cancelled) return
        setProfile(nextProfile)
        setDisplayName(nextProfile.display_name ?? '')
        setStatus('success')
      })
      .catch((error) => {
        if (cancelled) return
        setLoadError(error)
        setStatus('error')
      })

    return () => {
      cancelled = true
    }
  }, [user, reloadToken])

  const retry = useCallback(() => {
    setStatus('loading')
    setLoadError(null)
    setReloadToken((value) => value + 1)
  }, [])

  const handleSubmit = async (event) => {
    event.preventDefault()
    setNotice(null)
    setSaveError(null)

    const validationError = validateDisplayName(displayName)
    if (validationError) {
      setSaveError(validationError)
      return
    }

    setSaving(true)
    try {
      const updated = await updateProfile(user.id, displayName)
      setProfile(updated)
      setDisplayName(updated.display_name ?? '')
      setNotice('Tu nombre se actualizó correctamente.')
    } catch (error) {
      setSaveError(error?.message ?? 'No se pudo guardar el perfil. Intenta de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  const handleSignOut = async () => {
    setSigningOut(true)
    setSaveError(null)
    try {
      await signOut()
      navigate('/', { replace: true })
    } catch (error) {
      setSaveError(error?.message ?? 'No se pudo cerrar la sesión. Intenta de nuevo.')
      setSigningOut(false)
    }
  }

  if (!user) return null

  return (
    <section className="account-page" aria-labelledby="account-title">
      <nav className="account-breadcrumbs" aria-label="Ruta de navegación">
        <a href="/itinerarios">Mis itinerarios</a>
        <span aria-hidden="true">/</span>
        <span aria-current="page">Mi cuenta</span>
      </nav>

      <header className="account-heading">
        <span className="eyebrow">MI CUENTA</span>
        <h1 id="account-title">
          {profile?.display_name ? `Hola, ${profile.display_name}` : 'Tu cuenta'}
        </h1>
        <p>
          Administra tu nombre y accede a los itinerarios que guardaste con el
          asistente.
        </p>
      </header>

      {status === 'loading' && <LoadingState count={1} message="Cargando tu perfil…" />}

      {status === 'error' && (
        <ErrorState
          title="No pudimos cargar tu perfil"
          description={loadError?.message ?? 'Revisa tu conexión e intenta de nuevo.'}
          actionLabel="Reintentar"
          onAction={retry}
        />
      )}

      {status === 'success' && (
        <div className="account-grid">
          <form className="account-card auth-form" onSubmit={handleSubmit} noValidate>
            <h2>Datos del perfil</h2>

            <div className="form-field">
              <label htmlFor="account-email">Correo electrónico</label>
              <input
                id="account-email"
                type="email"
                value={user.email ?? ''}
                readOnly
                aria-describedby="account-email-hint"
              />
              <p className="form-hint" id="account-email-hint">
                El correo se gestiona de forma segura en Supabase Auth y no se
                puede cambiar aquí.
              </p>
            </div>

            <div className="form-field">
              <label htmlFor="account-name">Nombre para mostrar</label>
              <input
                id="account-name"
                name="displayName"
                type="text"
                autoComplete="name"
                maxLength={80}
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                required
              />
            </div>

            <AuthMessage>{saveError}</AuthMessage>
            <AuthMessage tone="success">{notice}</AuthMessage>

            <button type="submit" className="button-primary" disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </form>

          <aside className="account-side">
            <div className="account-card">
              <h2>Tu cuenta</h2>
              <dl className="account-details">
                <div>
                  <dt>Miembro desde</dt>
                  <dd>{formatDate(profile?.created_at) ?? 'No disponible'}</dd>
                </div>
                <div>
                  <dt>Itinerarios</dt>
                  <dd>
                    <a href="/itinerarios">Ver mis itinerarios guardados</a>
                  </dd>
                </div>
              </dl>
            </div>

            <div className="account-card">
              <h2>Sesión</h2>
              <p>
                Al cerrar sesión, este dispositivo dejará de recordar tu cuenta.
                Tus itinerarios seguirán guardados.
              </p>
              <button
                type="button"
                className="button-secondary account-signout"
                onClick={handleSignOut}
                disabled={signingOut}
              >
                {signingOut ? 'Cerrando sesión…' : 'Cerrar sesión'}
              </button>
            </div>
          </aside>
        </div>
      )}
    </section>
  )
}
