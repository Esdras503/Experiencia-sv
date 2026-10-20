import { createServer } from 'node:http'
import { createRequestHandler } from './handlers.js'
import { createNodeHandler } from './httpAdapter.js'

// Carga .env sin dependencias externas (Node 20.12+).
try {
  process.loadEnvFile('.env')
} catch {
  // Sin archivo .env: se usan las variables del entorno actuales.
}

const port = Number(process.env.API_PORT ?? 8787)

const handleRequest = createRequestHandler()
const handler = createNodeHandler(handleRequest)

const server = createServer((req, res) => {
  if (!req.url?.startsWith('/api/')) {
    res.statusCode = 404
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.end(
      JSON.stringify({
        error: {
          code: 'NOT_FOUND',
          message: 'Este servidor solo expone rutas /api. El frontend lo sirve Vite.',
        },
      }),
    )
    return
  }

  handler(req, res)
})

server.listen(port, () => {
  console.log(`API local escuchando en http://localhost:${port}`)
  console.log('Datos de OpenStreetMap vía Nominatim y Overpass: no se requieren claves.')
  if (!process.env.OSM_USER_AGENT) {
    console.log(
      'Aviso: define OSM_USER_AGENT con un contacto real antes de desplegar; las políticas de Nominatim exigen identificar la aplicación.',
    )
  }
})
