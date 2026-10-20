import { useEffect, useRef, useState } from 'react'
import { CHAT_INITIAL_SUGGESTIONS, MAX_CHAT_MESSAGE_LENGTH } from '../../../shared/chat.js'
import { useAuth } from '../../context/authContext.js'
import { createItinerary } from '../../services/itinerariesService.js'
import { createItineraryInsert } from '../../services/itineraryPayload.js'
import { sendChatMessage } from '../../services/chatService'
import { buildLoginHref } from '../../utils/authValidation.js'
import { buildHistory } from '../../utils/chatHistory'
import ChatButton from './ChatButton'
import ChatPanel from './ChatPanel'

const WELCOME_MESSAGE = {
  id: 'welcome',
  role: 'assistant',
  text: '¡Hola! 👋 Soy tu asistente de viajes de Experiencia SV. Busco lugares reales en OpenStreetMap y puedo ayudarte a planear un recorrido en El Salvador. ¿Qué te gustaría descubrir?',
}

function createSessionId() {
  try {
    return crypto.randomUUID()
  } catch {
    return `sesion-${Math.random().toString(36).slice(2)}-${Date.now()}`
  }
}

export default function ChatWidget({ open, onOpen, onClose, navigate }) {
  const [messages, setMessages] = useState([WELCOME_MESSAGE])
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState(null)
  const [pending, setPending] = useState(null)
  const [itinerary, setItinerary] = useState(null)
  const [itineraryToken, setItineraryToken] = useState(null)
  const [suggestions, setSuggestions] = useState(CHAT_INITIAL_SUGGESTIONS)
  const [sessionId] = useState(createSessionId)
  const [saveStatus, setSaveStatus] = useState('idle')
  const [saveError, setSaveError] = useState(null)
  const [savedItineraryId, setSavedItineraryId] = useState(null)

  const { user, configured: accountsConfigured } = useAuth()

  const nextMessageId = useRef(1)
  const requestRef = useRef(null)
  const requestSeq = useRef(0)

  const panelRef = useRef(null)
  const closeButtonRef = useRef(null)
  const inputRef = useRef(null)
  const messagesRef = useRef(null)
  const fabRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined

    const fabNode = fabRef.current
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeButtonRef.current?.focus()

    return () => {
      document.body.style.overflow = previousOverflow
      fabNode?.focus()
    }
  }, [open])

  useEffect(() => {
    if (open && messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight
    }
  }, [messages, itinerary, status, open])

  useEffect(
    () => () => {
      requestRef.current?.abort()
    },
    [],
  )

  async function runRequest({ text, history }) {
    requestRef.current?.abort()

    const controller = new AbortController()
    requestRef.current = controller
    const sequence = requestSeq.current + 1
    requestSeq.current = sequence

    setStatus('loading')
    setError(null)

    try {
      const payload = await sendChatMessage(
        {
          message: text,
          sessionId,
          history,
          itineraryToken,
        },
        { signal: controller.signal },
      )

      if (sequence !== requestSeq.current) return

      setMessages((current) => [
        ...current,
        {
          id: `assistant-${nextMessageId.current++}`,
          role: 'assistant',
          text: payload.message,
          places: Array.isArray(payload.places) ? payload.places : [],
        },
      ])

      // Si el backend no devuelve itinerario, se conserva el actual para no
      // perder el plan por un error parcial.
      if (payload.itinerary && typeof payload.itineraryToken === 'string') {
        setItinerary(payload.itinerary)
        setItineraryToken(payload.itineraryToken)
        setSaveStatus('idle')
        setSaveError(null)
        setSavedItineraryId(null)
      }

      setSuggestions(Array.isArray(payload.suggestions) ? payload.suggestions : [])
      setPending(null)
      setStatus('idle')
    } catch (requestError) {
      if (sequence !== requestSeq.current) return

      if (requestError?.name === 'AbortError') {
        setStatus('cancelled')
        setError(null)
        return
      }

      setStatus('error')
      setError({
        code: requestError?.code ?? 'INTERNAL',
        message:
          requestError?.message ??
          'No se pudo obtener respuesta del asistente. Intenta de nuevo.',
      })
    } finally {
      if (sequence === requestSeq.current) {
        requestRef.current = null
      }
    }
  }

  const handleSubmit = (event) => {
    event.preventDefault()

    if (status === 'loading') return

    const trimmedMessage = message.trim()
    if (!trimmedMessage) {
      setError({ code: 'INVALID_REQUEST', message: 'Escribe un mensaje antes de enviar.' })
      setStatus('error')
      return
    }
    if (trimmedMessage.length > MAX_CHAT_MESSAGE_LENGTH) {
      setError({
        code: 'INVALID_REQUEST',
        message: `El mensaje supera el máximo de ${MAX_CHAT_MESSAGE_LENGTH} caracteres.`,
      })
      setStatus('error')
      return
    }

    const history = buildHistory(messages)
    const userMessageId = `user-${nextMessageId.current++}`

    setMessages((current) => [
      ...current,
      { id: userMessageId, role: 'user', text: trimmedMessage },
    ])
    setMessage('')
    setSuggestions([])
    setPending({ text: trimmedMessage, history, userMessageId })
    runRequest({ text: trimmedMessage, history })
  }

  const handleRetry = () => {
    if (!pending || status === 'loading') return
    runRequest({ text: pending.text, history: pending.history })
  }

  const handleCancel = () => {
    requestRef.current?.abort()
  }

  const handleDismissError = () => {
    requestRef.current?.abort()
    requestSeq.current += 1

    if (pending?.userMessageId) {
      setMessages((current) =>
        current.filter((item) => item.id !== pending.userMessageId),
      )
    }

    setPending(null)
    setError(null)
    setStatus('idle')
  }

  const handleNewConversation = () => {
    requestRef.current?.abort()
    requestSeq.current += 1

    setMessages([WELCOME_MESSAGE])
    setMessage('')
    setStatus('idle')
    setError(null)
    setPending(null)
    setItinerary(null)
    setItineraryToken(null)
    setSuggestions(CHAT_INITIAL_SUGGESTIONS)
    setSaveStatus('idle')
    setSaveError(null)
    setSavedItineraryId(null)
    inputRef.current?.focus()
  }

  const handleSuggestion = (suggestion) => {
    setMessage(suggestion)
    setError(null)
    if (status === 'error') setStatus('idle')
    inputRef.current?.focus()
  }

  // Los errores locales (por ejemplo, un mensaje vacío) se limpian al volver a
  // escribir; los errores de red se conservan hasta reintentar o descartar.
  const handleMessageChange = (value) => {
    setMessage(value)
    if (status === 'error' && !pending) {
      setError(null)
      setStatus('idle')
    }
  }

  const handleOpenPlace = (place) => {
    if (!place?.id) return
    onClose()
    navigate?.(`/lugares/${encodeURIComponent(place.id)}`)
  }

  const handleSaveItinerary = async () => {
    if (!itinerary || saveStatus === 'saving') return

    if (!accountsConfigured) {
      setSaveStatus('error')
      setSaveError(
        'Las cuentas no están configuradas en este entorno. El itinerario sigue disponible para consultarlo.',
      )
      return
    }

    if (!user) {
      setSaveError(null)
      setSaveStatus('idle')
      const nextPath = `${window.location.pathname}${window.location.search}`
      onClose()
      navigate?.(buildLoginHref(nextPath))
      return
    }

    setSaveStatus('saving')
    setSaveError(null)

    try {
      const record = createItineraryInsert(itinerary, user.id)
      const saved = await createItinerary(user.id, record)
      setSavedItineraryId(saved.id)
      setSaveStatus('success')
    } catch (saveItineraryError) {
      setSaveStatus('error')
      setSaveError(
        saveItineraryError?.message ??
          'No se pudo guardar el itinerario. El plan sigue en pantalla; intenta de nuevo.',
      )
    }
  }

  const handleOpenSavedItinerary = (id) => {
    if (!id) return
    onClose()
    navigate?.(`/itinerarios/${encodeURIComponent(id)}`)
  }

  const handleRequireAuth = () => {
    if (!accountsConfigured) {
      setSaveStatus('error')
      setSaveError(
        'Las cuentas no están configuradas en este entorno. El itinerario sigue disponible para consultarlo.',
      )
      return
    }
    const nextPath = `${window.location.pathname}${window.location.search}`
    onClose()
    navigate?.(buildLoginHref(nextPath))
  }

  const handleClose = () => {
    requestRef.current?.abort()
    onClose()
  }

  const handleKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.stopPropagation()
      handleClose()
      return
    }

    if (event.key !== 'Tab' || !panelRef.current) return

    const focusableElements = panelRef.current.querySelectorAll(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), summary, [tabindex]:not([tabindex="-1"])',
    )

    if (focusableElements.length === 0) return

    const firstElement = focusableElements[0]
    const lastElement = focusableElements[focusableElements.length - 1]

    if (event.shiftKey && document.activeElement === firstElement) {
      event.preventDefault()
      lastElement.focus()
    } else if (!event.shiftKey && document.activeElement === lastElement) {
      event.preventDefault()
      firstElement.focus()
    }
  }

  return (
    <>
      {open && <div className="chat-backdrop" aria-hidden="true" onClick={handleClose} />}

      <ChatButton ref={fabRef} open={open} onToggle={open ? handleClose : onOpen} />

      {open && (
        <ChatPanel
          ref={panelRef}
          messages={messages}
          message={message}
          onMessageChange={handleMessageChange}
          onSubmit={handleSubmit}
          onClose={handleClose}
          onSuggestion={handleSuggestion}
          status={status}
          error={error}
          canRetry={Boolean(pending)}
          itinerary={itinerary}
          suggestions={suggestions}
          onRetry={handleRetry}
          onCancel={handleCancel}
          onDismissError={handleDismissError}
          onNewConversation={handleNewConversation}
          onOpenPlace={handleOpenPlace}
          onSaveItinerary={handleSaveItinerary}
          onOpenSavedItinerary={handleOpenSavedItinerary}
          onRequireAuth={handleRequireAuth}
          saveStatus={saveStatus}
          saveError={saveError}
          savedItineraryId={savedItineraryId}
          isAuthenticated={Boolean(user)}
          accountsConfigured={accountsConfigured}
          closeButtonRef={closeButtonRef}
          inputRef={inputRef}
          messagesRef={messagesRef}
          onKeyDown={handleKeyDown}
        />
      )}
    </>
  )
}
