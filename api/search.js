import { createRequestHandler } from '../server/handlers.js'
import { createNodeHandler } from '../server/httpAdapter.js'

// Función serverless (Vercel): POST /api/search
export default createNodeHandler(createRequestHandler())
