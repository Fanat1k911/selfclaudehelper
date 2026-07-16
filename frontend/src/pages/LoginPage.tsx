import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { defaultPathForRole, useAuth } from '../lib/auth'
import { ApiError } from '../lib/api'
import { useLoginTheme } from '../lib/useLoginTheme'
import { TimezoneClock } from '../components/TimezoneClock'
import { ThemeToggle } from '../components/ThemeToggle'

export function LoginPage() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const { pref, setPref, resolved } = useLoginTheme()
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
    <div
      data-login-theme={resolved}
      className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 transition-colors duration-300"
      style={{ background: 'var(--login-bg)' }}
    >
      <div className="fixed right-4 top-4 z-10">
        <ThemeToggle value={pref} onChange={setPref} />
      </div>

      {/* Фоновые блики — единственная декоративная анимация, тихая и медленная */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="login-blob-a absolute left-1/4 top-1/4 h-[36rem] w-[36rem] rounded-full blur-[120px]"
          style={{ background: 'var(--login-blob-a)' }}
        />
        <div
          className="login-blob-b absolute bottom-1/4 right-1/4 h-[30rem] w-[30rem] rounded-full blur-[120px]"
          style={{ background: 'var(--login-blob-b)' }}
        />
      </div>

      <form
        onSubmit={handleSubmit}
        className="login-card-enter relative w-full max-w-md rounded-2xl border p-10 shadow-2xl shadow-black/20 backdrop-blur-xl transition-colors duration-300"
        style={{ background: 'var(--login-card-bg)', borderColor: 'var(--login-card-border)' }}
      >
        <div className="login-fade-enter mb-10 text-center">
          <div className="mx-auto mb-4 h-px w-10 bg-terracotta/60" />
          <h1
            className="text-sm font-medium uppercase tracking-[0.3em] transition-colors duration-300"
            style={{ color: 'var(--login-text-muted)' }}
          >
            Вход в систему
          </h1>
        </div>

        <div className="space-y-5">
          <div>
            <label
              className="mb-1.5 block text-xs font-medium uppercase tracking-wider transition-colors duration-300"
              style={{ color: 'var(--login-text-faint)' }}
              htmlFor="login"
            >
              Логин
            </label>
            <input
              id="login"
              value={loginValue}
              onChange={(e) => setLoginValue(e.target.value)}
              className="w-full rounded-lg border px-4 py-3 text-sm outline-none transition-colors focus:border-terracotta/70 focus:bg-[var(--login-input-bg-focus)]"
              style={{ background: 'var(--login-input-bg)', borderColor: 'var(--login-input-border)', color: 'var(--login-text)' }}
              autoComplete="username"
              required
            />
          </div>

          <div>
            <label
              className="mb-1.5 block text-xs font-medium uppercase tracking-wider transition-colors duration-300"
              style={{ color: 'var(--login-text-faint)' }}
              htmlFor="password"
            >
              Пароль
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border px-4 py-3 text-sm outline-none transition-colors focus:border-terracotta/70 focus:bg-[var(--login-input-bg-focus)]"
              style={{ background: 'var(--login-input-bg)', borderColor: 'var(--login-input-border)', color: 'var(--login-text)' }}
              autoComplete="current-password"
              required
            />
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400">
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

      <TimezoneClock />
    </div>
  )
}
