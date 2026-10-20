import {
  normalizeEmail,
  validateDisplayName,
  validateEmail,
  validatePassword,
} from '../utils/authValidation.js'

export class AuthConfigurationError extends Error {
  constructor(message) {
    super(message)
    this.name = 'AuthConfigurationError'
    this.code = 'AUTH_NOT_CONFIGURED'
  }
}

function requireClient(client) {
  if (!client) {
    throw new AuthConfigurationError(
      'Las cuentas no están configuradas. Revisa las variables de Supabase.',
    )
  }
  return client
}

function assertValidEmail(email) {
  const error = validateEmail(email)
  if (error) {
    const validationError = new Error(error)
    validationError.code = 'VALIDATION_ERROR'
    throw validationError
  }
  return normalizeEmail(email)
}

function assertValidPassword(password) {
  const error = validatePassword(password)
  if (error) {
    const validationError = new Error(error)
    validationError.code = 'VALIDATION_ERROR'
    throw validationError
  }
}

function assertValidDisplayName(displayName) {
  const error = validateDisplayName(displayName)
  if (error) {
    const validationError = new Error(error)
    validationError.code = 'VALIDATION_ERROR'
    throw validationError
  }
  return displayName.trim()
}

export async function signInWithPassword(client, { email, password }) {
  const auth = requireClient(client)
  const normalizedEmail = assertValidEmail(email)
  assertValidPassword(password)

  const { data, error } = await auth.auth.signInWithPassword({
    email: normalizedEmail,
    password,
  })
  if (error) throw error
  return data
}

export async function signUpWithPassword(
  client,
  { email, password, displayName, emailRedirectTo },
) {
  const auth = requireClient(client)
  const normalizedEmail = assertValidEmail(email)
  assertValidPassword(password)
  const safeDisplayName = assertValidDisplayName(displayName)

  const { data, error } = await auth.auth.signUp({
    email: normalizedEmail,
    password,
    options: {
      data: { display_name: safeDisplayName },
      ...(emailRedirectTo ? { emailRedirectTo } : {}),
    },
  })
  if (error) throw error
  return data
}

export async function signOut(client) {
  const auth = requireClient(client)
  const { error } = await auth.auth.signOut()
  if (error) throw error
}

export async function sendPasswordResetEmail(client, { email, redirectTo }) {
  const auth = requireClient(client)
  const normalizedEmail = assertValidEmail(email)

  const { error } = await auth.auth.resetPasswordForEmail(normalizedEmail, {
    redirectTo,
  })
  if (error) throw error
}

export async function updatePassword(client, password) {
  const auth = requireClient(client)
  assertValidPassword(password)

  const { data, error } = await auth.auth.updateUser({ password })
  if (error) throw error
  return data
}

export async function getSession(client) {
  const auth = requireClient(client)
  const { data, error } = await auth.auth.getSession()
  if (error) throw error
  return data.session ?? null
}
