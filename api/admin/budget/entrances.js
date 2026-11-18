import { createRequestHandler } from '../../../server/handlers.js'
import { createNodeHandler } from '../../../server/httpAdapter.js'

// Función serverless (Vercel): POST/DELETE /api/admin/budget/entrances
export default createNodeHandler(createRequestHandler())
