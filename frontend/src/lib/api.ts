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

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  }
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch(`/api${path}`, { ...options, headers })

  if (res.status === 401) {
    clearSession()
    window.location.href = '/login'
    throw new ApiError(401, 'Сессия истекла, войдите снова.')
  }

  if (!res.ok) {
    let message = 'Ошибка запроса.'
    try {
      const body = await res.json()
      message = body.detail ?? message
    } catch {
      // тело не JSON — оставляем стандартное сообщение
    }
    throw new ApiError(res.status, message)
  }

  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}
