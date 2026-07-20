const TOKEN_KEY = 'oinarri_token'
const USER_KEY = 'oinarri_user'

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setSession(token: string, user: unknown) {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

export function getStoredUser<T>(): T | null {
  const raw = localStorage.getItem(USER_KEY)
  return raw ? (JSON.parse(raw) as T) : null
}

// FastAPI отдаёт detail строкой (HTTPException) либо списком объектов {msg, ...} (pydantic-валидация).
function extractErrorMessage(detail: unknown, fallback: string): string {
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail) && detail.length > 0) {
    const first = detail[0]
    if (typeof first === 'string') return first
    if (first && typeof first.msg === 'string') return first.msg
  }
  return fallback
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  }
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch(`/api${path}`, { ...options, headers })

  // "Сессия истекла" применимо только когда токен реально был отправлен и
  // отклонён — иначе, например, обычный неверный пароль на /auth/login (там
  // токена ещё нет, залогиниться только пытаемся) тоже ловился этим блоком:
  // несуществующую сессию сбрасывало, кидало обратно на /login с чужим
  // сообщением поверх формы вместо настоящего "Неверный логин или пароль"
  // (2026-07-20, репорт Александра — "со 2 раза заходит").
  if (token && res.status === 401) {
    clearSession()
    window.location.href = '/login'
    throw new ApiError(401, 'Сессия истекла, войдите снова.')
  }

  if (!res.ok) {
    let message = 'Ошибка запроса.'
    try {
      const body = await res.json()
      message = extractErrorMessage(body.detail, message)
    } catch {
      // тело не JSON — оставляем стандартное сообщение
    }
    throw new ApiError(res.status, message)
  }

  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export async function apiUpload<T>(path: string, file: File, extra?: Record<string, string>): Promise<T> {
  const token = getToken()
  const form = new FormData()
  form.append('file', file)
  if (extra) {
    for (const [key, value] of Object.entries(extra)) form.append(key, value)
  }

  const res = await fetch(`/api${path}`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  })

  if (token && res.status === 401) {
    clearSession()
    window.location.href = '/login'
    throw new ApiError(401, 'Сессия истекла, войдите снова.')
  }

  if (!res.ok) {
    let message = 'Ошибка запроса.'
    try {
      const body = await res.json()
      message = extractErrorMessage(body.detail, message)
    } catch {
      // тело не JSON — оставляем стандартное сообщение
    }
    throw new ApiError(res.status, message)
  }

  return res.json() as Promise<T>
}

export async function apiDownload(path: string, filename: string): Promise<void> {
  const token = getToken()
  const res = await fetch(`/api${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!res.ok) throw new ApiError(res.status, 'Не удалось скачать файл.')
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
