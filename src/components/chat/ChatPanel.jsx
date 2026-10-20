import { forwardRef, useEffect } from 'react'
import { MAX_CHAT_MESSAGE_LENGTH } from '../../../shared/chat.js'
import ChatItinerary from './ChatItinerary'
import ChatPlaceCard from './ChatPlaceCard'

function resizeTextarea(node) {
  if (!node) return
  node.style.height = 'auto'
  node.style.height = `${Math.min(node.scrollHeight, 120)}px`
}

const ChatPanel = forwardRef(function ChatPanel(
  {
    messages,
    message,
    onMessageChange,
    onSubmit,
    onClose,
    onSuggestion,
    status,
    error,
    canRetry,
    itinerary,
    suggestions,
    onRetry,
    onCancel,
    onDismissError,
    onNewConversation,
    onOpenPlace,
    onSaveItinerary,
    onOpenSavedItinerary,
    onRequireAuth,
    saveStatus,
    saveError,
    savedItineraryId,
    isAuthenticated,
    accountsConfigured,
    closeButtonRef,
    inputRef,
    messagesRef,
    onKeyDown,
  },
  panelRef,
) {
  useEffect(() => {
    resizeTextarea(inputRef.current)
  }, [message, inputRef])

  const handleComposerKeyDown = (event) => {
    if (
      event.key === 'Enter' &&
      !event.shiftKey &&
      !event.nativeEvent?.isComposing &&
      status !== 'loading'
    ) {
      event.preventDefault()
      event.currentTarget.form?.requestSubmit()
    }
  }

  return (
    <aside
      id="chat-panel"
      ref={panelRef}
      className="chat-panel"
      role="dialog"
      aria-modal="true"
      aria-labelledby="chat-title"
      onKeyDown={onKeyDown}
    >
      <div className="chat-header">
        <div className="chat-avatar" aria-hidden="true">
          ✳
        </div>
        <div className="chat-header-text">
          <strong id="chat-title">Asistente Experiencia SV</strong>
          <span>
            <span className="status-dot" aria-hidden="true" /> Datos de OpenStreetMap + IA
          </span>
        </div>
        <div className="chat-header-actions">
          <button
            type="button"
            className="chat-new"
            onClick={onNewConversation}
            aria-label="Iniciar una conversación nueva"
            title="Nueva conversación"
          >
            ↺
          </button>
          <button
            ref={closeButtonRef}
            type="button"
            className="chat-close"
            aria-label="Cerrar chat"
            onClick={onClose}
          >
            ×
          </button>
        </div>
      </div>

      <div className="chat-body" ref={messagesRef}>
        <div className="chat-messages" role="log" aria-live="polite">
          {messages.map((item) => (
            <div
              className={`chat-message ${item.role === 'user' ? 'user' : 'assistant'}${
                item.places?.length ? ' with-places' : ''
              }`}
              key={item.id}
            >
              <p className="chat-message-text">{item.text}</p>

              {item.places?.length > 0 && (
                <div className="chat-place-list">
                  {item.places.map((place) => (
                    <ChatPlaceCard
                      key={place.id}
                      place={place}
                      detailHref={`/lugares/${encodeURIComponent(place.id)}`}
                      onOpen={onOpenPlace}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}

          {status === 'loading' && (
            <div className="chat-message assistant chat-loading" role="status">
              <span className="chat-typing" aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
              <span className="chat-loading-text">
                Buscando en OpenStreetMap y preparando la respuesta…
              </span>
              <button type="button" className="chat-cancel" onClick={onCancel}>
                Cancelar
              </button>
            </div>
          )}
        </div>

        {itinerary && (
          <ChatItinerary
            itinerary={itinerary}
            onOpenPlace={onOpenPlace}
            onSuggestion={onSuggestion}
            onSave={onSaveItinerary}
            onOpenSaved={onOpenSavedItinerary}
            onRequireAuth={onRequireAuth}
            saveStatus={saveStatus}
            saveError={saveError}
            savedItineraryId={savedItineraryId}
            isAuthenticated={isAuthenticated}
            accountsConfigured={accountsConfigured}
          />
        )}

        {(status === 'error' || status === 'cancelled') && (
          <div
            className={`chat-error${status === 'cancelled' ? ' chat-cancelled' : ''}`}
            role="alert"
          >
            <p>
              {status === 'cancelled'
                ? 'Cancelaste la respuesta.'
                : error?.message ?? 'No se pudo obtener respuesta del asistente.'}
            </p>
            <div className="chat-error-actions">
              {canRetry && (
                <button type="button" onClick={onRetry}>
                  Reintentar
                </button>
              )}
              <button type="button" className="chat-dismiss" onClick={onDismissError}>
                {canRetry ? 'Descartar' : 'Cerrar'}
              </button>
            </div>
          </div>
        )}

        {status !== 'loading' && status !== 'error' && suggestions?.length > 0 && (
          <div className="chat-suggestions" aria-label="Sugerencias para continuar">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => onSuggestion(suggestion)}
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}

        <p className="chat-disclaimer" id="chat-disclaimer">
          Los lugares provienen de OpenStreetMap. El asistente no confirma horarios,
          precios, disponibilidad ni condiciones actuales: verifícalos antes de viajar.
        </p>
      </div>

      <form className="chat-input" onSubmit={onSubmit}>
        <label className="visually-hidden" htmlFor="chat-message">
          Mensaje para el asistente
        </label>
        <textarea
          id="chat-message"
          ref={inputRef}
          value={message}
          onChange={(event) => onMessageChange(event.target.value)}
          onKeyDown={handleComposerKeyDown}
          placeholder="Escribe tu consulta…"
          rows={1}
          maxLength={MAX_CHAT_MESSAGE_LENGTH}
          autoComplete="off"
          aria-describedby="chat-disclaimer"
          disabled={status === 'loading'}
        />
        <button
          type="submit"
          aria-label="Enviar mensaje"
          disabled={status === 'loading' || !message.trim()}
        >
          ↑
        </button>
      </form>
    </aside>
  )
})

export default ChatPanel
