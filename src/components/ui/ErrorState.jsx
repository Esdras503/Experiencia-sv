export default function ErrorState({
  title = 'No pudimos mostrar esta sección',
  description = 'Ocurrió un problema inesperado. Puedes intentar de nuevo o volver al inicio.',
  actionLabel,
  onAction,
}) {
  return (
    <div className="error-state" role="alert">
      <span className="error-state-icon" aria-hidden="true">
        !
      </span>
      <h2>{title}</h2>
      <p>{description}</p>
      {actionLabel && onAction && (
        <button type="button" className="button-primary" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  )
}
