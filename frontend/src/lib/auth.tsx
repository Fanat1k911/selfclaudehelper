import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { apiFetch, clearSession, getStoredUser, getToken, setSession } from './api'
import type { CompanyMembership, User } from '../types'

interface LoginOk {
  needsCompanyChoice: false
  user: User
}

interface LoginNeedsChoice {
  needsCompanyChoice: true
  pendingToken: string
  companies: CompanyMembership[]
}

type LoginResult = LoginOk | LoginNeedsChoice

// Мульти-компанийные пользователи (2026-07-18) добавили user.companies — браузер с уже
// сохранённой сессией ДО этого деплоя (localStorage) несёт старую форму без этого поля.
// Без фоллбека Sidebar падал на user.companies.filter(...) сразу после деплоя, пока
// человек не разлогинится вручную (нашёл code-review). Тот же fallback, что уже
// был в get_current_user на бэке (app/security.py) для того же класса токенов.
function normalizeStoredUser(user: User | null): User | null {
  if (!user) return null
  if (Array.isArray(user.companies)) return user
  return { ...user, companies: [{ id: user.company_id, name: user.company_name, role: user.role }] }
}

interface AuthContextValue {
  user: User | null
  login: (login: string, password: string) => Promise<LoginResult>
  selectCompany: (pendingToken: string, companyId: string) => Promise<User>
  switchCompany: (companyId: string) => Promise<User>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => normalizeStoredUser(getStoredUser<User>()))

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      async login(login: string, password: string) {
        const res = await apiFetch<
          | { access_token: string; user: User }
          | { needs_company_choice: true; pending_token: string; companies: CompanyMembership[] }
        >('/auth/login', { method: 'POST', body: JSON.stringify({ login, password }) })

        if ('needs_company_choice' in res) {
          return { needsCompanyChoice: true, pendingToken: res.pending_token, companies: res.companies }
        }
        setSession(res.access_token, res.user)
        setUser(res.user)
        return { needsCompanyChoice: false, user: res.user }
      },
      async selectCompany(pendingToken: string, companyId: string) {
        const res = await apiFetch<{ access_token: string; user: User }>('/auth/select-company', {
          method: 'POST',
          body: JSON.stringify({ pending_token: pendingToken, company_id: companyId }),
        })
        setSession(res.access_token, res.user)
        setUser(res.user)
        return res.user
      },
      async switchCompany(companyId: string) {
        const res = await apiFetch<{ access_token: string; user: User }>('/auth/switch-company', {
          method: 'POST',
          body: JSON.stringify({ company_id: companyId }),
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
