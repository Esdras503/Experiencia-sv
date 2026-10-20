import { AppError, ERROR_CODES, redactSecrets, publicMessageFor } from './errors.js'

const MAX_BODY_BYTES = 49152

function getClientIp(req) {
  const forwarded = req.headers?.['x-forwarded-for']
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim()
  }
  return req.socket?.remoteAddress ?? 'unknown'
}

async function readRequestBody(req) {
  // Vercel puede entregar el cuerpo ya analizado cuando es JSON.
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === 'string') {
      if (req.body.length === 0) return {}
      try {
        return JSON.parse(req.body)
      } catch {
        throw new AppError(ERROR_CODES.INVALID_REQUEST, {
          status: 400,
          message: 'El cuerpo de la solicitud no es JSON válido.',
        })
      }
    }
    return req.body
  }

  const chunks = []
  let size = 0

  return new Promise((resolve, reject) => {
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > MAX_BODY_BYTES) {
        reject(
          new AppError(ERROR_CODES.INVALID_REQUEST, {
            status: 413,
            message: 'El cuerpo de la solicitud es demasiado grande.',
          }),
        )
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      if (size === 0) {
        resolve({})
        return
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))
      } catch {
        reject(
          new AppError(ERROR_CODES.INVALID_REQUEST, {
            status: 400,
            message: 'El cuerpo de la solicitud no es JSON válido.',
          }),
        )
      }
    })
    req.on('error', reject)
  })
}

function send(res, result) {
  const headers = { ...(result.headers ?? {}) }

  for (const [name, value] of Object.entries(headers)) {
    res.setHeader(name, value)
  }

  if (result.bytes) {
    res.statusCode = result.status
    if (result.contentType) res.setHeader('Content-Type', result.contentType)
    res.setHeader('Content-Length', result.bytes.length)
    res.end(result.bytes)
    return
  }

  const payload = JSON.stringify(result.json ?? {})
  res.statusCode = result.status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(payload)
}

/**
 * Adapta el manejador central a la firma (req, res) de Node,
 * compatible con funciones serverless de Vercel y con el servidor local.
 */
export function createNodeHandler(handleRequest, { logError = console.error } = {}) {
  return async function nodeHandler(req, res) {
    let result

    // Si el cliente cancela la petición, se abortan las llamadas al proveedor
    // de IA que aún estén en curso (si el entorno lo permite).
    const abortController = new AbortController()
    if (typeof res.on === 'function') {
      res.on('close', () => {
        if (!res.writableEnded) abortController.abort()
      })
    }

    try {
      const url = new URL(req.url ?? '/', `http://${req.headers?.host ?? 'localhost'}`)
      const pathname = url.pathname.length > 1 ? url.pathname.replace(/\/+$/, '') : url.pathname
      const body = await readRequestBody(req)

      result = await handleRequest({
        method: req.method ?? 'GET',
        pathname,
        query: Object.fromEntries(url.searchParams.entries()),
        body,
        headers: req.headers ?? {},
        ip: getClientIp(req),
        signal: abortController.signal,
      })
    } catch (error) {
      if (error instanceof AppError) {
        result = {
          status: error.status,
          json: {
            error: {
              code: error.code,
              message: error.message || publicMessageFor(error.code),
            },
          },
        }
      } else {
        logError('[api] error inesperado', {
          code: error?.name ?? 'UNKNOWN',
          message: redactSecrets(error?.message ?? '').slice(0, 300),
        })
        result = {
          status: 500,
          json: {
            error: { code: ERROR_CODES.INTERNAL, message: publicMessageFor(ERROR_CODES.INTERNAL) },
          },
        }
      }
    }

    try {
      send(res, result)
    } catch (error) {
      logError('[api] no se pudo enviar la respuesta', {
        message: redactSecrets(error?.message ?? '').slice(0, 200),
      })
      if (!res.headersSent) {
        res.statusCode = 500
        res.end()
      }
    }
  }
}
