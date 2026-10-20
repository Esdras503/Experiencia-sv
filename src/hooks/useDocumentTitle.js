import { useEffect } from 'react'

/**
 * Actualiza el título del documento. Un valor vacío o nulo se ignora,
 * para que una página pueda definir su propio título cuando cargue datos.
 */
export function useDocumentTitle(title) {
  useEffect(() => {
    if (title) {
      document.title = title
    }
  }, [title])
}
