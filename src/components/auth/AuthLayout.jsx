export default function AuthLayout({
  eyebrow = 'TU CUENTA',
  title,
  description,
  children,
  footer,
}) {
  return (
    <section className="auth-page" aria-labelledby="auth-title">
      <div className="auth-card">
        <span className="eyebrow">{eyebrow}</span>
        <h1 id="auth-title">{title}</h1>
        {description && <p className="auth-description">{description}</p>}
        {children}
        {footer && <div className="auth-footer">{footer}</div>}
      </div>

      <aside className="auth-aside" aria-label="Ventajas de tener una cuenta">
        <span className="auth-aside-icon" aria-hidden="true">
          ✳
        </span>
        <h2>Tu viaje, en un solo lugar</h2>
        <ul>
          <li>Guarda los itinerarios que creas con el asistente.</li>
          <li>Consulta y edita tus paradas cuando quieras.</li>
          <li>Vuelve a tus planes desde cualquier dispositivo.</li>
        </ul>
        <p>
          Explorar lugares y hablar con el asistente sigue siendo posible sin
          crear una cuenta.
        </p>
      </aside>
    </section>
  )
}
