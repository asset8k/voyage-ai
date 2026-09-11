import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

import { ApiError, getCurrentUser, login, register } from '../lib/api'
import type { Credentials, User } from '../types/api'
import { clearAccessToken, readAccessToken, writeAccessToken } from './auth-storage'
import { AuthContext } from './auth-context'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [accessToken, setAccessToken] = useState<string | null>(() => readAccessToken())
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function restoreSession() {
      const storedToken = readAccessToken()
      if (!storedToken) {
        setIsLoading(false)
        return
      }

      try {
        setUser(await getCurrentUser(storedToken))
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          clearAccessToken()
          setAccessToken(null)
        }
      } finally {
        setIsLoading(false)
      }
    }

    void restoreSession()
  }, [])

  async function startSession(credentials: Credentials): Promise<void> {
    const tokenResponse = await login(credentials)
    writeAccessToken(tokenResponse.access_token)
    setAccessToken(tokenResponse.access_token)
    setUser(await getCurrentUser(tokenResponse.access_token))
  }

  async function signIn(credentials: Credentials): Promise<void> {
    await startSession(credentials)
  }

  async function signUp(credentials: Credentials): Promise<void> {
    await register(credentials)
    await startSession(credentials)
  }

  function signOut() {
    clearAccessToken()
    setAccessToken(null)
    setUser(null)
    setIsLoading(false)
  }

  const value = useMemo(
    () => ({ accessToken, user, isLoading, signIn, signUp, signOut }),
    [accessToken, isLoading, user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
