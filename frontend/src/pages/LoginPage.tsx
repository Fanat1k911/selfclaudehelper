import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { defaultPathForRole, useAuth } from '../lib/auth'
import { ApiError } from '../lib/api'
import { TimezoneClock } from '../components/TimezoneClock'
import logo from '../assets/logo-dark.png'

export function LoginPage() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const [loginValue, setLoginValue] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  if (user) return <Navigate to={defaultPathForRole(user.role)} replace />

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const loggedInUser = await login(loginValue, password)
      navigate(defaultPathForRole(loggedInUser.role), { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось войти.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-cream px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-lg rounded-2xl bg-white p-8 shadow-lg shadow-black/5"
      >
        <div className="mb-8 text-center">
          <img src={logo} alt="oinarri" className="mx-auto h-8 w-auto" />
        </div>

        <label className="block text-sm text-ink/70 mb-1" htmlFor="login">
          Логин
        </label>
        <input
          id="login"
          value={loginValue}
          onChange={(e) => setLoginValue(e.target.value)}
          className="mb-4 w-full rounded-lg border border-ink/10 px-3 py-2 text-sm outline-none focus:border-terracotta"
          autoComplete="username"
          required
        />

        <label className="block text-sm text-ink/70 mb-1" htmlFor="password">
          Пароль
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mb-6 w-full rounded-lg border border-ink/10 px-3 py-2 text-sm outline-none focus:border-terracotta"
          autoComplete="current-password"
          required
        />

        {error && <div className="mb-4 text-sm text-red-600">{error}</div>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-terracotta py-2.5 text-sm font-medium text-white transition-colors hover:bg-terracotta-dark disabled:opacity-60"
        >
          {loading ? 'Входим…' : 'Войти'}
        </button>
      </form>

      <TimezoneClock />
    </div>
  )
}
