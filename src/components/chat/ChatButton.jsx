import { forwardRef } from 'react'
import BrandLogo from '../brand/BrandLogo.jsx'

const ChatButton = forwardRef(function ChatButton({ open, onToggle }, ref) {
  return (
    <button
      ref={ref}
      className="chat-fab"
      type="button"
      aria-expanded={open}
      aria-controls="chat-panel"
      aria-label={
        open
          ? 'Cerrar asistente de viajes'
          : 'Abrir asistente de viajes: ¿Te ayudo a explorar?'
      }
      onClick={onToggle}
    >
      {open ? (
        <span aria-hidden="true">×</span>
      ) : (
        <BrandLogo variant="icon" className="chat-fab-logo" decorative />
      )}
      {!open && (
        <span className="chat-fab-label" aria-hidden="true">
          ¿Te ayudo a explorar?
        </span>
      )}
    </button>
  )
})

export default ChatButton
