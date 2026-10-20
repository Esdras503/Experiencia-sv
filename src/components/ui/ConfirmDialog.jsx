import { useEffect, useId, useRef } from 'react'

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Eliminar',
  cancelLabel = 'Cancelar',
  busy = false,
  onConfirm,
  onCancel,
}) {
  const dialogRef = useRef(null)
  const cancelRef = useRef(null)
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    if (!open) return undefined
    cancelRef.current?.focus()

    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !busy) {
        event.preventDefault()
        onCancel()
        return
      }
      if (event.key !== 'Tab' || !dialogRef.current) return

      const focusable = dialogRef.current.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, busy, onCancel])

  if (!open) return null

  return (
    <div
      className="confirm-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onCancel()
      }}
    >
      <div
        ref={dialogRef}
        className="confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
      >
        <h2 id={titleId}>{title}</h2>
        <p id={descriptionId}>{description}</p>
        <div className="confirm-actions">
          <button
            ref={cancelRef}
            type="button"
            className="button-secondary"
            onClick={onCancel}
            disabled={busy}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className="button-danger"
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? 'Eliminando…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
