import { forwardRef } from 'react'

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
      <span aria-hidden="true">{open ? '×' : '✳'}</span>
      {!open && (
        <span className="chat-fab-label" aria-hidden="true">
          ¿Te ayudo a explorar?
        </span>
      )}
    </button>
  )
})

export default ChatButton
