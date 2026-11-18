import test from 'node:test'
import assert from 'node:assert/strict'
import { AppError, ERROR_CODES } from '../errors.js'
import { createRouteService, resolveOsrmConfig } from './routeService.js'

const points = [
  { label: 'San Salvador', latitude: 13.6929, longitude: -89.2182 },
  { label: 'El Tunco', latitude: 13.493, longitude: -89.383 },
]

function response({ status = 200, payload = null } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      if (payload instanceof Error) throw payload
      return payload
    },
  }
}

test('consulta OSRM con longitud,latitud y devuelve tramos con etiquetas', async () => {
  const calls = []
  const service = createRouteService({
    env: { OSRM_URL: 'https://osrm.example.test' },
    fetchImpl: async (url, init) => {
      calls.push({ url, init })
      return response({
        payload: {
          code: 'Ok',
          routes: [
            {
              distance: 35_214.4,
              duration: 2817.2,
              legs: [{ distance: 35_214.4, duration: 2817.2 }],
            },
          ],
        },
      })
    },
    now: () => 1000,
  })

  const route = await service.route(points)
  assert.equal(calls.length, 1)
  assert.match(calls[0].url, /-89\.218200,13\.692900;-89\.383000,13\.493000/)
  assert.match(calls[0].url, /^https:\/\/osrm\.example\.test\/route\/v1\/driving\//)
  assert.equal(calls[0].init.headers['User-Agent'].includes('ExperienciaSV'), true)
  assert.equal(route.source, 'osrm')
  assert.equal(route.distanceMeters, 35_214)
  assert.equal(route.durationSeconds, 2817)
  assert.equal(route.legs[0].fromLabel, 'San Salvador')
  assert.equal(route.legs[0].toLabel, 'El Tunco')
})

test('reutiliza la caché para el mismo recorrido', async () => {
  let calls = 0
  const service = createRouteService({
    env: { OSRM_URL: 'https://osrm.example.test' },
    fetchImpl: async () => {
      calls += 1
      return response({
        payload: {
          code: 'Ok',
          routes: [{ distance: 1000, duration: 60, legs: [] }],
        },
      })
    },
    now: () => 1000,
  })

  await service.route(points)
  await service.route(points)
  assert.equal(calls, 1)
})

test('clasifica errores de OSRM sin inventar una ruta', async () => {
  const limited = createRouteService({
    env: { OSRM_URL: 'https://osrm.example.test' },
    fetchImpl: async () => response({ status: 429 }),
  })
  await assert.rejects(
    () => limited.route(points),
    (error) =>
      error instanceof AppError &&
      error.code === ERROR_CODES.UPSTREAM_RATE_LIMITED &&
      error.status === 429,
  )

  const down = createRouteService({
    env: { OSRM_URL: 'https://osrm.example.test' },
    fetchImpl: async () => response({ status: 503 }),
  })
  await assert.rejects(
    () => down.route(points),
    (error) =>
      error instanceof AppError &&
      error.code === ERROR_CODES.UPSTREAM_UNAVAILABLE,
  )
})

test('rechaza puntos insuficientes o coordenadas inválidas', async () => {
  const service = createRouteService({
    env: { OSRM_URL: 'https://osrm.example.test' },
    fetchImpl: async () => response({ payload: {} }),
  })
  await assert.rejects(
    () => service.route([points[0]]),
    (error) => error instanceof AppError && error.status === 400,
  )
  await assert.rejects(
    () =>
      service.route([
        points[0],
        { latitude: 100, longitude: -89 },
      ]),
    (error) => error instanceof AppError && error.status === 400,
  )
})

test('resuelve una URL inválida como servicio no disponible', async () => {
  const config = resolveOsrmConfig({ OSRM_URL: 'file:///etc/passwd' })
  assert.equal(config.baseUrl, null)
  const service = createRouteService({
    env: { OSRM_URL: 'file:///etc/passwd' },
    fetchImpl: async () => response({ payload: {} }),
  })
  await assert.rejects(
    () => service.route(points),
    (error) =>
      error instanceof AppError &&
      error.code === ERROR_CODES.UPSTREAM_UNAVAILABLE,
  )
})
