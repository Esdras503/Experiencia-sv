import { createRequestHandler } from '../../../server/handlers.js'
import { createNodeHandler } from '../../../server/httpAdapter.js'

// Función serverless (Vercel): PUT /api/admin/budget/settings
export default createNodeHandler(createRequestHandler())
