import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto'

export const ANONYMOUS_COOKIE_NAME = 'experiencia_sv_anon'
const ANONYMOUS_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365
const MIN_SECRET_LENGTH = 16

function readCookie(cookieHeader, name) {
  if (typeof cookieHeader !== 'string' || !cookieHeader) return null

  for (const part of cookieHeader.split(';')) {
    const separator = part.indexOf('=')
    if (separator === -1) continue
    const key = part.slice(0, separator).trim()
    if (key !== name) continue
    try {
      return decodeURIComponent(part.slice(separator + 1).trim())
    } catch {
      return null
    }
  }

  return null
}

function normalizeSecret(secret) {
  if (typeof secret !== 'string' || secret.trim().length < MIN_SECRET_LENGTH) {
    throw new Error('El secreto de identidad anónima no está configurado.')
  }
  return secret.trim()
}

function signatureFor(id, secret) {
  return createHmac('sha256', normalizeSecret(secret)).update(id).digest('hex')
}

export function hashAnonymousId(id) {
  return createHash('sha256').update(String(id)).digest('hex')
}

export function verifyAnonymousValue(value, secret) {
  if (typeof value !== 'string') return null
  const separator = value.indexOf('.')
  if (separator <= 0) return null

  const id = value.slice(0, separator)
  const signature = value.slice(separator + 1)
  if (!/^[a-f0-9]{32}$/.test(id) || !/^[a-f0-9]{64}$/.test(signature)) {
    return null
  }

  let expected
  try {
    expected = signatureFor(id, secret)
  } catch {
    return null
  }

  const actualBuffer = Buffer.from(signature, 'hex')
  const expectedBuffer = Buffer.from(expected, 'hex')
  if (
    actualBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(actualBuffer, expectedBuffer)
  ) {
    return null
  }

  return id
}

export function buildAnonymousCookie(id, { secure = false, secret } = {}) {
  const signature = signatureFor(id, secret)
  const value = `${id}.${signature}`
  const attributes = [
    `${ANONYMOUS_COOKIE_NAME}=${value}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${ANONYMOUS_COOKIE_MAX_AGE_SECONDS}`,
  ]

  if (secure) attributes.push('Secure')
  return attributes.join('; ')
}

/**
 * Devuelve un identificador seudónimo para el cupo gratuito de visitantes sin
 * cuenta. La cookie está firmada para que no se pueda inventar un identificador
 * distinto desde el navegador. El valor que llega a la base de datos es un hash,
 * no la cookie ni la IP.
 */
export function resolveAnonymousIdentity({
  headers,
  secret,
  secure = false,
} = {}) {
  const cookieHeader = headers?.cookie ?? headers?.Cookie ?? ''
  const existing = readCookie(cookieHeader, ANONYMOUS_COOKIE_NAME)
  const existingId = verifyAnonymousValue(existing, secret)

  if (existingId) {
    return {
      anonymousKey: hashAnonymousId(existingId),
      setCookie: null,
    }
  }

  const id = randomBytes(16).toString('hex')
  return {
    anonymousKey: hashAnonymousId(id),
    setCookie: buildAnonymousCookie(id, { secure, secret }),
  }
}
