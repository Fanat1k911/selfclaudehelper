import { useEffect, useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { ArrowRight, Eye, EyeOff } from 'lucide-react'
import { defaultPathForRole, useAuth } from '../lib/auth'
import { ApiError } from '../lib/api'
import { useLoginTheme } from '../lib/useLoginTheme'
import { TimezoneClock } from '../components/TimezoneClock'
import { ThemeToggle } from '../components/ThemeToggle'

// text-base (16px), не text-sm (14px) — iOS Safari/Chrome/Brave автоматически зумят
// страницу при фокусе на любой input мельче 16px, независимо от viewport meta.
const inputClassName =
  'w-full rounded-lg border px-4 py-3 text-base outline-none transition-colors focus:border-terracotta/70 focus:bg-[var(--login-input-bg-focus)]'
const inputStyle = {
  background: 'var(--login-input-bg)',
  borderColor: 'var(--login-input-border)',
  color: 'var(--login-text)',
}

export function LoginPage() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const { pref, setPref, resolved } = useLoginTheme()
  const [loginValue, setLoginValue] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [formFocused, setFormFocused] = useState(false)

  // iOS/Brave rubber-band overscroll (тянешь за верх/низ страницы) показывает фон САМОГО
  // document, а не нашего div — если он остаётся дефолтным белым, за краем экрана мелькают
  // белые полосы независимо от темы логина. Синхронизируем на время жизни страницы,
  // возвращаем как было при уходе (остальное приложение всегда светлое).
  useEffect(() => {
    const bg = resolved === 'dark' ? '#16110d' : '#fdf8f3'
    const prevHtml = document.documentElement.style.background
    const prevBody = document.body.style.background
    document.documentElement.style.background = bg
    document.body.style.background = bg
    return () => {
      document.documentElement.style.background = prevHtml
      document.body.style.background = prevBody
    }
  }, [resolved])

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
      className="relative flex min-h-dvh items-center justify-center overflow-hidden px-4 transition-colors duration-300"
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
        onFocus={() => setFormFocused(true)}
        onBlur={() => setFormFocused(false)}
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
              className={inputClassName}
              style={inputStyle}
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
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`${inputClassName} pr-11`}
                style={inputStyle}
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 transition-colors"
                style={{ color: 'var(--login-text-faint)' }}
                aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                tabIndex={-1}
              >
                <span className="relative block h-4.5 w-4.5">
                  <Eye
                    className={`absolute inset-0 h-4.5 w-4.5 transition-all duration-200 ${showPassword ? 'scale-75 opacity-0' : 'scale-100 opacity-100'}`}
                    strokeWidth={2}
                  />
                  <EyeOff
                    className={`absolute inset-0 h-4.5 w-4.5 transition-all duration-200 ${showPassword ? 'scale-100 opacity-100' : 'scale-75 opacity-0'}`}
                    strokeWidth={2}
                  />
                </span>
              </button>
            </div>
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

      {/* Прячется, пока форма в фокусе — на мобильных при открытой клавиатуре fixed-часы
          наплывали на кнопку "Войти" (визуальный viewport сужается, а fixed позиционируется
          от layout viewport). */}
      <TimezoneClock hidden={formFocused} />
    </div>
  )
}
