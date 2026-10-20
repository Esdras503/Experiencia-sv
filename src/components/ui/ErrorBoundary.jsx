import { Component } from 'react'
import ErrorState from './ErrorState'

export default class ErrorBoundary extends Component {
  state = { hasError: false, error: null }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('[Experiencia SV] Error de interfaz:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <ErrorState
          title="No pudimos mostrar esta sección"
          description="Ocurrió un problema inesperado en la interfaz. Los detalles técnicos quedaron registrados para depuración."
          actionLabel="Volver al inicio"
          onAction={() => window.location.assign('/')}
          error={this.state.error}
        />
      )
    }

    return this.props.children
  }
}
