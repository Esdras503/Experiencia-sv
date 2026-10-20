import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../context/authContext.js'
import { getItinerary, removeItinerary } from '../services/itinerariesService.js'
import { itineraryToView } from '../services/itineraryPayload.js'
import { useDocumentTitle } from '../hooks/useDocumentTitle.js'
import AuthMessage from '../components/auth/AuthMessage.jsx'
import ConfirmDialog from '../components/ui/ConfirmDialog.jsx'
import ErrorState from '../components/ui/ErrorState.jsx'
import LoadingState from '../components/ui/LoadingState.jsx'
import ItineraryEditor from '../components/itineraries/ItineraryEditor.jsx'
import ItineraryView from '../components/itineraries/ItineraryView.jsx'

function formatDate(value) {
  if (!value) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return new Intl.DateTimeFormat('es-SV', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(parsed)
}

export default function ItineraryDetailPage({ itineraryId, navigate }) {
  const { user } = useAuth()
  const [record, setRecord] = useState(null)
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState(null)
  const [reloadToken, setReloadToken] = useState(0)
  const [editing, setEditing] = useState(false)
  const [notice, setNotice] = useState(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [actionError, setActionError] = useState(null)

  useDocumentTitle(record?.title ? `${record.title} — Experiencia SV` : null)

  useEffect(() => {
    if (!user?.id) return undefined
    let cancelled = false

    getItinerary(user.id, itineraryId)
      .then((item) => {
        if (cancelled) return
        setRecord(item)
        setStatus('success')
      })
      .catch((loadError) => {
        if (cancelled) return
        setError(loadError)
        setStatus('error')
      })

    return () => {
      cancelled = true
    }
  }, [user, itineraryId, reloadToken])

  const retry = useCallback(() => {
    setStatus('loading')
    setError(null)
    setReloadToken((value) => value + 1)
  }, [])

  const handleSaved = (updated) => {
    setRecord(updated)
    setEditing(false)
    setNotice('Los cambios se guardaron correctamente.')
    setActionError(null)
  }

  const handleDelete = async () => {
    setDeleting(true)
    setActionError(null)
    try {
      await removeItinerary(user.id, record.id)
      navigate('/itinerarios', { replace: true })
    } catch (deleteError) {
      setConfirmOpen(false)
      setActionError(
        deleteError?.message ?? 'No se pudo eliminar el itinerario. Intenta de nuevo.',
      )
      setDeleting(false)
    }
  }

  if (!user) return null

  if (status === 'loading') {
    return (
      <section className="account-page" aria-busy="true">
        <LoadingState count={1} message="Cargando el itinerario…" />
      </section>
    )
  }

  if (status === 'error' || !record) {
    const notFound = error?.code === 'NOT_FOUND'
    return (
      <section className="account-page">
        <ErrorState
          title={notFound ? 'Itinerario no disponible' : 'No pudimos cargar el itinerario'}
          description={
            notFound
              ? 'No existe o pertenece a otra cuenta. La base de datos no permite acceder a itinerarios ajenos.'
              : (error?.message ?? 'Revisa tu conexión e intenta de nuevo.')
          }
          actionLabel={notFound ? 'Volver a mis itinerarios' : 'Reintentar'}
          onAction={notFound ? () => navigate('/itinerarios') : retry}
        />
      </section>
    )
  }

  const view = itineraryToView(record)
  const createdAt = formatDate(record.created_at)
  const updatedAt = formatDate(record.updated_at)

  return (
    <section className="saved-page itinerary-detail" aria-labelledby="itinerary-title">
      <nav className="account-breadcrumbs" aria-label="Ruta de navegación">
        <a href="/itinerarios">Mis itinerarios</a>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{record.title}</span>
      </nav>

      <header className="itinerary-detail-heading">
        <div>
          <span className="eyebrow">ITINERARIO</span>
          <h1 id="itinerary-title">{record.title}</h1>
          <p className="itinerary-detail-dates">
            {createdAt && <>Creado: {createdAt}. </>}
            {updatedAt && <>Actualizado: {updatedAt}.</>}
          </p>
        </div>

        {!editing && (
          <div className="itinerary-detail-actions">
            <button
              type="button"
              className="button-primary"
              onClick={() => {
                setEditing(true)
                setNotice(null)
                setActionError(null)
              }}
            >
              Editar itinerario
            </button>
            <button
              type="button"
              className="button-secondary"
              onClick={() => setConfirmOpen(true)}
            >
              Eliminar
            </button>
          </div>
        )}
      </header>

      <AuthMessage tone="success">{notice}</AuthMessage>
      <AuthMessage>{actionError}</AuthMessage>

      {editing ? (
        <ItineraryEditor
          key={record.id}
          record={record}
          userId={user.id}
          onSaved={handleSaved}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <ItineraryView itinerary={view} navigate={navigate} />
      )}

      <ConfirmDialog
        open={confirmOpen}
        title="¿Eliminar este itinerario?"
        description={`Se eliminará “${record.title}” de tu cuenta. Esta acción no se puede deshacer.`}
        confirmLabel="Sí, eliminar"
        busy={deleting}
        onConfirm={handleDelete}
        onCancel={() => {
          if (!deleting) setConfirmOpen(false)
        }}
      />
    </section>
  )
}
