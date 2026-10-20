import test from 'node:test'
import assert from 'node:assert/strict'
import {
  AuthConfigurationError,
  getSession,
  sendPasswordResetEmail,
  signInWithPassword,
  signOut,
  signUpWithPassword,
  updatePassword,
} from './authService.js'

function createAuthClient(overrides = {}) {
  const calls = []
  const client = {
    auth: {
      signInWithPassword: async (input) => {
        calls.push(['signInWithPassword', input])
        return { data: overrides.signIn ?? { session: { access_token: 'x' } }, error: null }
      },
      signUp: async (input) => {
        calls.push(['signUp', input])
        return { data: overrides.signUp ?? { user: { id: 'u' }, session: null }, error: null }
      },
      signOut: async () => {
        calls.push(['signOut'])
        return { error: null }
      },
      resetPasswordForEmail: async (email, options) => {
        calls.push(['resetPasswordForEmail', email, options])
        return { error: null }
      },
      updateUser: async (input) => {
        calls.push(['updateUser', input])
        return { data: { user: { id: 'u' } }, error: null }
      },
      getSession: async () => {
        calls.push(['getSession'])
        return { data: { session: overrides.session ?? null }, error: null }
      },
    },
  }
  return { client, calls }
}

test('inicia sesión normalizando el correo', async () => {
  const { client, calls } = createAuthClient()
  await signInWithPassword(client, {
    email: '  Persona@Example.COM ',
    password: '12345678',
  })
  assert.deepEqual(calls[0], [
    'signInWithPassword',
    { email: 'persona@example.com', password: '12345678' },
  ])
})

test('no llama a Supabase si los datos no pasan la validación', async () => {
  const { client, calls } = createAuthClient()
  await assert.rejects(
    () => signInWithPassword(client, { email: 'mal', password: '12345678' }),
    /correo electrónico válido/,
  )
  assert.equal(calls.length, 0)

  await assert.rejects(
    () => signInWithPassword(client, { email: 'a@b.co', password: '123' }),
    /al menos 8/,
  )
  assert.equal(calls.length, 0)
})

test('el registro envía el nombre y la URL de confirmación', async () => {
  const { client, calls } = createAuthClient()
  await signUpWithPassword(client, {
    email: 'Nueva@Example.com',
    password: '12345678',
    displayName: '  Nueva Viajera ',
    emailRedirectTo: 'https://app.example/cuenta/iniciar-sesion?confirmado=1',
  })
  assert.deepEqual(calls[0], [
    'signUp',
    {
      email: 'nueva@example.com',
      password: '12345678',
      options: {
        data: { display_name: 'Nueva Viajera' },
        emailRedirectTo: 'https://app.example/cuenta/iniciar-sesion?confirmado=1',
      },
    },
  ])
})

test('solicita el restablecimiento con la redirección indicada', async () => {
  const { client, calls } = createAuthClient()
  await sendPasswordResetEmail(client, {
    email: ' Persona@Example.com ',
    redirectTo: 'https://app.example/cuenta/restablecer',
  })
  assert.deepEqual(calls[0], [
    'resetPasswordForEmail',
    'persona@example.com',
    { redirectTo: 'https://app.example/cuenta/restablecer' },
  ])
})

test('actualiza la contraseña y lee la sesión', async () => {
  const { client, calls } = createAuthClient({ session: { user: { id: 'u' } } })
  await updatePassword(client, '12345678')
  const session = await getSession(client)
  await signOut(client)

  assert.deepEqual(calls[0], ['updateUser', { password: '12345678' }])
  assert.deepEqual(calls[1], ['getSession'])
  assert.deepEqual(calls[2], ['signOut'])
  assert.equal(session.user.id, 'u')
})

test('sin cliente devuelve un error de configuración claro', async () => {
  await assert.rejects(
    () => signInWithPassword(null, { email: 'a@b.co', password: '12345678' }),
    (error) => error instanceof AuthConfigurationError,
  )
})
