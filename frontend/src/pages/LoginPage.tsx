import { useEffect, useRef, useState, type AnimationEvent, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, Eye, EyeOff } from 'lucide-react'
import { defaultPathForRole, useAuth } from '../lib/auth'
import { ApiError } from '../lib/api'
import { useLoginTheme } from '../lib/useLoginTheme'
import { TimezoneClock } from '../components/TimezoneClock'
import { ThemeToggle } from '../components/ThemeToggle'
import type { CompanyMembership } from '../types'

const ROLE_LABEL: Record<CompanyMembership['role'], string> = {
  founder: 'Founder',
  worker: 'Сотрудник',
  developer: 'Developer',
}

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
  const { user, login, selectCompany } = useAuth()
  const navigate = useNavigate()
  const { pref, setPref, resolved } = useLoginTheme()
  const [loginValue, setLoginValue] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [formFocused, setFormFocused] = useState(false)
  // readOnly до фокуса (2026-07-18, категоричный ask Founder после автозаполнения) —
  // браузеры/iOS не предлагают подстановку сохранённых логина/пароля в readOnly-поле,
  // так что превью старых/чужих кредов на /login просто не появляется. Разблокируем
  // ровно в момент фокуса — обычный ручной ввод не затронут, только автопредложение.
  const [loginLocked, setLoginLocked] = useState(true)
  const [passwordLocked, setPasswordLocked] = useState(true)
  // Мульти-компанийные пользователи (2026-07-18) — после пароля, если у логина несколько
  // компаний, вместо навигации показываем выбор; pendingChoice=null — обычный однокомпанийный
  // вход, ничего не меняется для 99% пользователей.
  const [pendingChoice, setPendingChoice] = useState<{ token: string; companies: CompanyMembership[] } | null>(null)
  // Акцент на конкретно кликнутой компании (2026-07-20, ask Александра) — отдельно от
  // общего `loading`, чтобы подсветить именно ЭТУ кнопку, а не просто затемнить все разом.
  const [selectingId, setSelectingId] = useState<string | null>(null)
  const passwordRef = useRef<HTMLInputElement>(null)
  // WebKit/Brave автозаполнение иногда проставляет DOM value без синтетического input-события
  // React — состояние (loginValue/password) остаётся '' даже когда поле визуально уже
  // заполнено браузером. Дальше это стреляет так: пользователь начинает печатать, но
  // следующий ре-рендер форсит DOM обратно к устаревшему React-state (''), визуально стирая
  // то, что он только что ввёл — выглядит будто поле "не даёт ввести". CSS ниже вешает
  // анимацию на :-webkit-autofill (animationName как маркер), которая стреляет ровно в
  // момент автозаполнения — синхронизируем React state с реальным DOM value в этот момент.
  function handleAutofillAnimation(e: AnimationEvent<HTMLInputElement>, setValue: (v: string) => void) {
    if (e.animationName === 'onAutoFillStart') setValue(e.currentTarget.value)
  }
  // Сравнение с ПРЕДЫДУЩИМ значением, не булевый "первый раз ли это" флаг — StrictMode
  // (main.tsx) в dev дважды подряд вызывает mount-эффекты без cleanup между ними, из-за
  // чего булевый флаг "уже true" после первого вызова пропускал вторую защиту вхолостую,
  // и второй вызов проваливался в focus()+клавиатуру на самом первом заходе на /login
  // (retroactive code-review 2026-07-18). Сравнение с prev устойчиво к повтору: на обоих
  // вызовах prev===showPassword===false, оба раза корректно пропускаем.
  const prevShowPassword = useRef(showPassword)
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // key на password-инпуте (см. ниже) форсирует remount при клике на глазик — новый DOM-узел
  // не получает фокус сам по себе, возвращаем его.
  useEffect(() => {
    if (prevShowPassword.current === showPassword) return
    prevShowPassword.current = showPassword
    const el = passwordRef.current
    if (!el) return
    el.focus()
    // Курсор в конец имеет смысл только когда РАСКРЫВАЕМ (type="text") — человек обычно
    // хочет прочитать конец того, что напечатал. При скрытии обратно (type="password")
    // не форсим позицию — retroactive code-review 2026-07-18 поймал: раньше прыгало в
    // конец в обоих направлениях, даже если правили середину строки перед этим.
    if (showPassword) {
      try {
        const len = el.value.length
        el.setSelectionRange(len, len)
      } catch {
        // Safari исторически кидает InvalidStateError на setSelectionRange для некоторых
        // состояний поля — не критично, курсор окажется там, где браузер сам поставил.
      }
    }
  }, [showPassword])

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
      const result = await login(loginValue, password)
      if (result.needsCompanyChoice) {
        setPendingChoice({ token: result.pendingToken, companies: result.companies })
        return
      }
      navigate(defaultPathForRole(result.user.role), { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось войти.')
    } finally {
      setLoading(false)
    }
  }

  async function handleSelectCompany(companyId: string) {
    if (!pendingChoice) return
    setError(null)
    setSelectingId(companyId)
    setLoading(true)
    try {
      const loggedInUser = await selectCompany(pendingChoice.token, companyId)
      navigate(defaultPathForRole(loggedInUser.role), { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось войти.')
      setPendingChoice(null)
      setSelectingId(null)
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

      {pendingChoice ? (
        <div
          className="login-card-enter relative w-full max-w-md rounded-2xl border p-10 shadow-2xl shadow-black/20 backdrop-blur-xl transition-colors duration-300"
          style={{ background: 'var(--login-card-bg)', borderColor: 'var(--login-card-border)' }}
        >
          <div className="login-fade-enter mb-8 text-center">
            <div className="mx-auto mb-4 h-px w-10 bg-terracotta/60" />
            <h1
              className="text-sm font-medium uppercase tracking-[0.3em] transition-colors duration-300"
              style={{ color: 'var(--login-text-muted)' }}
            >
              Выбери компанию
            </h1>
          </div>

          <div className="space-y-2">
            {pendingChoice.companies.map((c) => {
              const selected = c.id === selectingId
              return (
                <button
                  key={c.id}
                  type="button"
                  disabled={loading}
                  onClick={() => handleSelectCompany(c.id)}
                  className={`flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left text-sm transition-all duration-300 ${
                    selected
                      ? 'scale-[1.02] border-terracotta shadow-md shadow-terracotta/20'
                      : 'disabled:opacity-40'
                  }`}
                  style={{
                    background: selected ? 'var(--login-input-bg-focus)' : 'var(--login-input-bg)',
                    borderColor: selected ? undefined : 'var(--login-input-border)',
                    color: 'var(--login-text)',
                  }}
                >
                  <span className="font-medium">{c.name}</span>
                  <span
                    className="flex items-center gap-1.5 text-xs transition-colors duration-300"
                    style={{ color: selected ? 'var(--login-text)' : 'var(--login-text-muted)' }}
                  >
                    {selected && <Check className="h-3.5 w-3.5 text-terracotta" strokeWidth={2.5} />}
                    {ROLE_LABEL[c.role]}
                  </span>
                </button>
              )
            })}
          </div>

          {error && (
            <div className="mt-4 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400">
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={() => setPendingChoice(null)}
            className="mt-6 flex items-center gap-1.5 text-xs transition-colors"
            style={{ color: 'var(--login-text-faint)' }}
          >
            <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} />
            Назад к логину
          </button>
        </div>
      ) : (
      <form
        onSubmit={handleSubmit}
        onFocus={() => {
          // Клик на глазик пароля ремонтит инпут (см. эффект выше) — старый узел блёрится
          // синхронно ДО того, как новый узел получает фокус в следующем commit, так что
          // form ловит blur→focus за миллисекунды. Без дебаунса formFocused успевал стать
          // false и обратно true — часы внизу успевали мигнуть видимыми на один кадр
          // (retroactive code-review 2026-07-18, подтверждено двумя независимыми ревьюерами).
          if (blurTimeoutRef.current) {
            clearTimeout(blurTimeoutRef.current)
            blurTimeoutRef.current = null
          }
          setFormFocused(true)
        }}
        onBlur={() => {
          blurTimeoutRef.current = setTimeout(() => setFormFocused(false), 100)
        }}
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
              onAnimationStart={(e) => handleAutofillAnimation(e, setLoginValue)}
              readOnly={loginLocked}
              onFocus={() => setLoginLocked(false)}
              // pointerdown, не только focus (2026-07-20) — iOS не показывает системную
              // клавиатуру при тапе на readOnly-поле, а к моменту focus (после которого
              // React снял бы readOnly) решение "клавиатуру не показывать" уже принято.
              // pointerdown идёт раньше focus в цепочке событий, так что снимаем readOnly
              // здесь синхронно через DOM — второй тап для клавиатуры больше не нужен.
              onPointerDown={(e) => {
                e.currentTarget.readOnly = false
                setLoginLocked(false)
              }}
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
                // key форсирует remount при смене type — Safari/WebKit держит внутреннее
                // состояние автозаполнения привязанным к type="password", и при смене
                // type на "text" у уже автозаполненного инпута in-place значение визуально
                // пропадает (React-state с паролем остаётся верным, но поле рендерится
                // пустым). Новый DOM-узел с value уже проставленным через React — не
                // задет автозаполнением, значение показывается сразу.
                key={showPassword ? 'text' : 'password'}
                ref={passwordRef}
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onAnimationStart={(e) => handleAutofillAnimation(e, setPassword)}
                readOnly={passwordLocked}
                onFocus={() => setPasswordLocked(false)}
                onPointerDown={(e) => {
                  e.currentTarget.readOnly = false
                  setPasswordLocked(false)
                }}
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
                // Раньше tabIndex={-1} — убирал единственный интерактивный элемент этой
                // формы, добавленный этим же фиксом, из клавиатурной навигации целиком
                // (retroactive code-review 2026-07-18, WCAG 2.1.1). Клавиатурный порядок
                // Логин→Пароль→глазик→Войти вполне естественный, убирать не за чем.
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

        <Link
          to="/register"
          className="mt-6 block text-center text-xs transition-colors"
          style={{ color: 'var(--login-text-faint)' }}
        >
          Ещё нет компании? Зарегистрировать
        </Link>
      </form>
      )}

      {/* Прячется, пока форма в фокусе — на мобильных при открытой клавиатуре fixed-часы
          наплывали на кнопку "Войти" (визуальный viewport сужается, а fixed позиционируется
          от layout viewport). */}
      <TimezoneClock hidden={formFocused} />
    </div>
  )
}
