import { createRequestHandler } from '../../server/handlers.js'
import { createNodeHandler } from '../../server/httpAdapter.js'

// Función serverless (Vercel): POST /api/billing/checkout
export default createNodeHandler(createRequestHandler())
