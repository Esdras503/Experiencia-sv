import { createRequestHandler } from '../server/handlers.js'
import { createNodeHandler } from '../server/httpAdapter.js'

// Función serverless (Vercel): GET /api/place?id=...
export default createNodeHandler(createRequestHandler())
