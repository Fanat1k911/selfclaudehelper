import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { defaultPathForRole, useAuth } from '../lib/auth'
import { ApiError } from '../lib/api'
import { useLoginTheme } from '../lib/useLoginTheme'
import { ThemeToggle } from '../components/ThemeToggle'

const inputClassName =
  'w-full rounded-lg border px-4 py-3 text-base outline-none transition-colors focus:border-terracotta/70 focus:bg-[var(--login-input-bg-focus)]'
const inputStyle = {
  background: 'var(--login-input-bg)',
  borderColor: 'var(--login-input-border)',
  color: 'var(--login-text)',
}

export function RegisterPage() {
  const { user, registerCompany } = useAuth()
  const navigate = useNavigate()
  const { pref, setPref, resolved } = useLoginTheme()
  const [companyName, setCompanyName] = useState('')
  const [fio, setFio] = useState('')
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [phone, setPhone] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  if (user) return <Navigate to={defaultPathForRole(user.role)} replace />

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (password !== passwordConfirm) {
      setError('Пароли не совпадают.')
      return
    }
    setLoading(true)
    try {
      const registeredUser = await registerCompany({ companyName, fio, login, password, phone })
      navigate(defaultPathForRole(registeredUser.role), { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось зарегистрировать компанию.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      data-login-theme={resolved}
      className="relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-10 transition-colors duration-300"
      style={{ background: 'var(--login-bg)' }}
    >
      <div className="fixed right-4 top-4 z-10">
        <ThemeToggle value={pref} onChange={setPref} />
      </div>

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
        <div className="login-fade-enter mb-8 text-center">
          <div className="mx-auto mb-4 h-px w-10 bg-terracotta/60" />
          <h1
            className="text-sm font-medium uppercase tracking-[0.3em] transition-colors duration-300"
            style={{ color: 'var(--login-text-muted)' }}
          >
            Регистрация компании
          </h1>
        </div>

        <div className="space-y-5">
          <div>
            <label
              className="mb-1.5 block text-xs font-medium uppercase tracking-wider"
              style={{ color: 'var(--login-text-faint)' }}
              htmlFor="company_name"
            >
              Название компании
            </label>
            <input
              id="company_name"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className={inputClassName}
              style={inputStyle}
              autoComplete="organization"
              required
            />
          </div>

          <div>
            <label
              className="mb-1.5 block text-xs font-medium uppercase tracking-wider"
              style={{ color: 'var(--login-text-faint)' }}
              htmlFor="fio"
            >
              Ваше ФИО
            </label>
            <input
              id="fio"
              value={fio}
              onChange={(e) => setFio(e.target.value)}
              className={inputClassName}
              style={inputStyle}
              autoComplete="name"
              required
            />
          </div>

          <div>
            <label
              className="mb-1.5 block text-xs font-medium uppercase tracking-wider"
              style={{ color: 'var(--login-text-faint)' }}
              htmlFor="phone"
            >
              Телефон
            </label>
            <input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={inputClassName}
              style={inputStyle}
              autoComplete="tel"
              required
            />
          </div>

          <div>
            <label
              className="mb-1.5 block text-xs font-medium uppercase tracking-wider"
              style={{ color: 'var(--login-text-faint)' }}
              htmlFor="register_login"
            >
              Логин
            </label>
            <input
              id="register_login"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              className={inputClassName}
              style={inputStyle}
              autoComplete="username"
              required
            />
          </div>

          <div>
            <label
              className="mb-1.5 block text-xs font-medium uppercase tracking-wider"
              style={{ color: 'var(--login-text-faint)' }}
              htmlFor="register_password"
            >
              Пароль
            </label>
            <input
              id="register_password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClassName}
              style={inputStyle}
              autoComplete="new-password"
              required
            />
          </div>

          <div>
            <label
              className="mb-1.5 block text-xs font-medium uppercase tracking-wider"
              style={{ color: 'var(--login-text-faint)' }}
              htmlFor="register_password_confirm"
            >
              Повторите пароль
            </label>
            <input
              id="register_password_confirm"
              type="password"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              className={inputClassName}
              style={inputStyle}
              autoComplete="new-password"
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
          {loading ? 'Регистрируем…' : 'Зарегистрировать'}
          {!loading && (
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" strokeWidth={2} />
          )}
        </button>

        <Link
          to="/login"
          className="mt-6 block text-center text-xs transition-colors"
          style={{ color: 'var(--login-text-faint)' }}
        >
          Уже есть аккаунт? Войти
        </Link>
      </form>
    </div>
  )
}
