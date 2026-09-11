import { createContext, useContext } from 'react'

import type { Credentials, User } from '../types/api'

export type AuthContextValue = {
  accessToken: string | null
  user: User | null
  isLoading: boolean
  signIn: (credentials: Credentials) => Promise<void>
  signUp: (credentials: Credentials) => Promise<void>
  signOut: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within an AuthProvider')
  return context
}
