export default function EmptyState({
  icon = '⌕',
  title,
  description,
  actionLabel,
  onAction,
}) {
  return (
    <div className="empty-state" role="status">
      <span className="empty-state-icon" aria-hidden="true">
        {icon}
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {actionLabel && onAction && (
        <button type="button" className="button-primary" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  )
}
