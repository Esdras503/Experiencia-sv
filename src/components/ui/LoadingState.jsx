export default function LoadingState({ count = 5, message = 'Cargando lugares…' }) {
  return (
    <div className="loading-state" role="status" aria-live="polite">
      <span className="visually-hidden">{message}</span>
      <div className="skeleton-grid" aria-hidden="true">
        {Array.from({ length: count }, (_, index) => (
          <div className="skeleton-card" key={index}>
            <div className="skeleton-image" />
            <div className="skeleton-body">
              <div className="skeleton-line skeleton-line-short" />
              <div className="skeleton-line" />
              <div className="skeleton-line skeleton-line-medium" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
