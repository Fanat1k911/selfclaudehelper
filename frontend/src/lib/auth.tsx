import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { apiFetch, clearSession, getStoredUser, getToken, setSession } from './api'
import type { User } from '../types'

interface AuthContextValue {
  user: User | null
  login: (login: string, password: string) => Promise<User>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => getStoredUser<User>())

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      async login(login: string, password: string) {
        const res = await apiFetch<{ access_token: string; user: User }>('/auth/login', {
          method: 'POST',
          body: JSON.stringify({ login, password }),
        })
        setSession(res.access_token, res.user)
        setUser(res.user)
        return res.user
      },
      logout() {
        clearSession()
        setUser(null)
      },
    }),
    [user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth должен использоваться внутри AuthProvider')
  return ctx
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  if (!user || !getToken()) return <Navigate to="/login" replace />
  return <>{children}</>
}

const MANAGEMENT_ROLES: User['role'][] = ['founder', 'developer']

export function defaultPathForRole(role: User['role'] | undefined): string {
  return role && MANAGEMENT_ROLES.includes(role) ? '/dashboard' : '/ingredients'
}

export function RequireRole({ roles, children }: { roles: User['role'][]; children: ReactNode }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (!roles.includes(user.role)) return <Navigate to={defaultPathForRole(user.role)} replace />
  return <>{children}</>
}
