import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'

/**
 * Modal informativo reutilizable.
 *
 * Se usa para avisos demostrativos que no piden confirmación destructiva. No
 * envía datos: solo muestra contenido y se cierra con el botón, Escape o el
 * fondo.
 */
export default function InfoDialog({
  open,
  title,
  eyebrow = null,
  children,
  closeLabel = 'Cerrar',
  onClose,
}) {
  const dialogRef = useRef(null)
  const closeRef = useRef(null)
  const titleId = useId()

  useEffect(() => {
    if (!open) return undefined

    const previousFocus = document.activeElement
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }

      if (event.key !== 'Tab' || !dialogRef.current) return
      const focusable = dialogRef.current.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
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
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
      if (previousFocus instanceof HTMLElement) previousFocus.focus()
    }
  }, [open, onClose])

  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div
      className="info-dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        ref={dialogRef}
        className="info-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <button
          type="button"
          className="info-dialog-close"
          onClick={onClose}
          aria-label="Cerrar aviso"
        >
          <span aria-hidden="true">×</span>
        </button>

        <span className="info-dialog-icon" aria-hidden="true">
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 2.8 14.4 9l6.2 2.4-6.2 2.4L12 20l-2.4-6.2L3.4 11.4 9.6 9 12 2.8Z" />
            <path d="m19 3 .6 1.4L21 5l-1.4.6L19 7l-.6-1.4L17 5l1.4-.6L19 3Z" />
          </svg>
        </span>

        {eyebrow && <span className="info-dialog-eyebrow">{eyebrow}</span>}
        <h2 id={titleId}>{title}</h2>
        <div className="info-dialog-body">{children}</div>

        <button
          ref={closeRef}
          type="button"
          className="button-primary info-dialog-action"
          onClick={onClose}
        >
          {closeLabel}
        </button>
      </div>
    </div>,
    document.body,
  )
}
