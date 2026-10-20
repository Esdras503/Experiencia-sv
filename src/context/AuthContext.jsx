import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  getSession as readSession,
  sendPasswordResetEmail,
  signInWithPassword,
  signOut as signOutUser,
  signUpWithPassword,
  updatePassword as updateUserPassword,
} from '../services/authService.js'
import {
  isSupabaseConfigured,
  supabase,
  supabaseConfigError,
} from '../services/supabaseClient.js'
import { describeAuthError } from '../utils/authValidation.js'

import { AuthContext } from './authContext.js'

function initialStatus() {
  return isSupabaseConfigured ? 'loading' : 'unavailable'
}

function messageForSessionError(error) {
  return describeAuthError(error)
}

export function AuthProvider({ children }) {
  const [status, setStatus] = useState(initialStatus)
  const [session, setSession] = useState(null)
  const [error, setError] = useState(null)
  const [isRecovery, setIsRecovery] = useState(false)

  const applySession = useCallback((nextSession) => {
    setSession(nextSession ?? null)
    setStatus(nextSession ? 'authenticated' : 'unauthenticated')
    setError(null)
  }, [])

  useEffect(() => {
    if (!supabase) {
      return undefined
    }

    let active = true

    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!active) return

      if (event === 'PASSWORD_RECOVERY') {
        setIsRecovery(true)
      }
      if (event === 'SIGNED_OUT') {
        setIsRecovery(false)
      }

      setSession(nextSession ?? null)
      setStatus(nextSession ? 'authenticated' : 'unauthenticated')
      setError(null)
    })

    readSession(supabase)
      .then((nextSession) => {
        if (!active) return
        applySession(nextSession)
      })
      .catch((sessionError) => {
        if (!active) return
        setStatus('error')
        setError(messageForSessionError(sessionError))
      })

    return () => {
      active = false
      listener.subscription.unsubscribe()
    }
  }, [applySession])

  const reloadSession = useCallback(async () => {
    if (!supabase) return null
    setStatus('loading')
    setError(null)

    try {
      const nextSession = await readSession(supabase)
      applySession(nextSession)
      return nextSession
    } catch (sessionError) {
      setStatus('error')
      setError(messageForSessionError(sessionError))
      return null
    }
  }, [applySession])

  const signIn = useCallback(
    async (credentials) => {
      const data = await signInWithPassword(supabase, credentials)
      applySession(data.session)
      return data
    },
    [applySession],
  )

  const signUp = useCallback(
    async (details) => {
      const data = await signUpWithPassword(supabase, details)
      if (data.session) applySession(data.session)
      return data
    },
    [applySession],
  )

  const signOut = useCallback(async () => {
    await signOutUser(supabase)
    setSession(null)
    setStatus('unauthenticated')
    setError(null)
    setIsRecovery(false)
  }, [])

  const requestPasswordReset = useCallback(async (details) => {
    await sendPasswordResetEmail(supabase, details)
  }, [])

  const updatePassword = useCallback(async (password) => {
    const data = await updateUserPassword(supabase, password)
    setIsRecovery(false)
    return data
  }, [])

  const clearRecovery = useCallback(() => setIsRecovery(false), [])

  const value = useMemo(
    () => ({
      status,
      session,
      user: session?.user ?? null,
      error,
      isRecovery,
      configured: isSupabaseConfigured,
      configurationError: supabaseConfigError,
      signIn,
      signUp,
      signOut,
      requestPasswordReset,
      updatePassword,
      reloadSession,
      clearRecovery,
    }),
    [
      status,
      session,
      error,
      isRecovery,
      signIn,
      signUp,
      signOut,
      requestPasswordReset,
      updatePassword,
      reloadSession,
      clearRecovery,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
