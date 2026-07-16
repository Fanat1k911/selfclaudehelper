import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { defaultPathForRole, useAuth } from '../lib/auth'
import { ApiError } from '../lib/api'
import { TimezoneClock } from '../components/TimezoneClock'

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
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-obsidian px-4">
      {/* Фоновые блики — единственная декоративная анимация, тихая и медленная */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="login-blob-a absolute left-1/4 top-1/4 h-[36rem] w-[36rem] rounded-full bg-terracotta/20 blur-[120px]" />
        <div className="login-blob-b absolute bottom-1/4 right-1/4 h-[30rem] w-[30rem] rounded-full bg-terracotta-dark/15 blur-[120px]" />
      </div>

      <form
        onSubmit={handleSubmit}
        className="login-card-enter relative w-full max-w-md rounded-2xl border border-white/10 bg-white/[0.04] p-10 shadow-2xl shadow-black/40 backdrop-blur-xl"
      >
        <div className="login-fade-enter mb-10 text-center">
          <div className="mx-auto mb-4 h-px w-10 bg-terracotta/60" />
          <h1 className="text-sm font-medium uppercase tracking-[0.3em] text-white/50">Вход в систему</h1>
        </div>

        <div className="space-y-5">
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-white/40" htmlFor="login">
              Логин
            </label>
            <input
              id="login"
              value={loginValue}
              onChange={(e) => setLoginValue(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white outline-none transition-colors placeholder:text-white/20 focus:border-terracotta/70 focus:bg-white/[0.06]"
              autoComplete="username"
              required
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-white/40" htmlFor="password">
              Пароль
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white outline-none transition-colors placeholder:text-white/20 focus:border-terracotta/70 focus:bg-white/[0.06]"
              autoComplete="current-password"
              required
            />
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="group mt-8 flex w-full items-center justify-center gap-2 rounded-lg bg-terracotta py-3 text-sm font-medium text-white transition-all hover:bg-terracotta-dark hover:shadow-lg hover:shadow-terracotta/20 disabled:opacity-50"
        >
          {loading ? 'Входим…' : 'Войти'}
          {!loading && (
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" strokeWidth={2} />
          )}
        </button>
      </form>

      <TimezoneClock dark />
    </div>
  )
}
