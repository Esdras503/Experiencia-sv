import { DEMO_MODE_BANNER } from '../../../shared/demoMode.js'
import { usePlanStatus } from '../../context/planContext.js'

/**
 * Aviso global y discreto. El backend devuelve demoMode en
 * /api/billing/status; el valor de compilación solo sirve como respaldo
 * mientras se consulta el estado.
 */
export default function DemoModeBanner() {
  const { demoMode } = usePlanStatus()

  if (!demoMode) return null

  return (
    <div className="demo-mode-banner" role="status">
      <span className="demo-mode-banner-dot" aria-hidden="true" />
      <span>{DEMO_MODE_BANNER}</span>
    </div>
  )
}
