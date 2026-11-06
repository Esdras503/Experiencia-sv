import { useAuth } from '../context/authContext.js'
import AuthLayout from '../components/auth/AuthLayout.jsx'
import AuthMessage from '../components/auth/AuthMessage.jsx'

function shouldHandleClick(event) {
  return !(
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  )
}

export default function AuthUnavailablePage({ navigate }) {
  const { configurationError } = useAuth()

  const handleHome = (event) => {
    if (!shouldHandleClick(event)) return
    event.preventDefault()
    navigate('/')
  }

  return (
    <AuthLayout
      eyebrow="CUENTAS"
      title="Las cuentas todavía no están configuradas"
      description="Puedes seguir explorando lugares, usar los filtros y consultar el asistente. Solo guardar itinerarios y gestionar tu cuenta necesitan Supabase."
    >
      <AuthMessage tone="info">
        {configurationError ??
          'Falta conectar el proyecto de Supabase en las variables de entorno.'}
      </AuthMessage>

      <div className="auth-setup">
        <h2>Qué debe definir quien administra el sitio</h2>
        <ol>
          <li>
            Crear un proyecto en Supabase y aplicar las migraciones de{' '}
            <code>supabase/migrations/</code>.
          </li>
          <li>
            Configurar <code>VITE_SUPABASE_URL</code> y{' '}
            <code>VITE_SUPABASE_ANON_KEY</code> con la URL y la clave publicable.
          </li>
          <li>
            En local, reiniciar el servidor de Vite. En Vercel, guardar las
            variables para el entorno <strong>Production</strong> y volver a
            desplegar: las variables <code>VITE_*</code> se incorporan durante el
            build y no se actualizan en un despliegue ya publicado.
          </li>
        </ol>
        <p>
          Nunca uses <code>service_role</code> en el navegador. Los pasos completos
          están en el README.
        </p>
      </div>

      <a className="button-primary" href="/" onClick={handleHome}>
        Volver a explorar lugares
      </a>
    </AuthLayout>
  )
}
