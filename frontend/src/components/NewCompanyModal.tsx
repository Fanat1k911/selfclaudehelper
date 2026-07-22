import { useState, type FormEvent } from 'react'
import { apiFetch, ApiError } from '../lib/api'

export function NewCompanyModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [companyName, setCompanyName] = useState('')
  const [fio, setFio] = useState('')
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const res = await apiFetch<{ company_id: string; user_id: string; attached_existing: boolean }>(
        '/companies',
        { method: 'POST', body: JSON.stringify({ company_name: companyName, fio, login, password }) },
      )
      // Вариант А (см. CLAUDE.md) — существующий логин привязывается как Developer новой
      // компании вместо создания нового аккаунта, ФИО из формы не применяется. Пароль в
      // форме тогда — не новый пароль, а подтверждение текущего (проверяется на бэке).
      if (res.attached_existing) {
        alert('Такой логин уже существовал — привязали этот аккаунт как Developer новой компании. ФИО из формы не применялось.')
      }
      onCreated()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось создать компанию.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl bg-premium-surface p-6 shadow-2xl space-y-3 max-h-[90vh] touch-pan-y overflow-y-auto overflow-x-hidden"
      >
        <div className="text-lg font-semibold text-premium-text mb-2">Новая компания</div>
        <p className="text-xs text-premium-text/50 -mt-2 mb-2">
          Founder этой компании заводится отдельно после — здесь только тенант и первый Developer-аккаунт.
          Если логин уже существует (например, твой собственный) — введи ЕГО текущий пароль,
          это подтвердит что аккаунт твой, а не чужой угаданный логин.
        </p>

        <div>
          <label className="block text-xs text-premium-text/60 mb-1">Название компании</label>
          <input
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            className="w-full rounded-lg border border-premium-border bg-premium-bg px-3 py-2 text-sm text-premium-text outline-none focus:border-premium-gold"
            required
          />
        </div>

        <div>
          <label className="block text-xs text-premium-text/60 mb-1">ФИО (Developer)</label>
          <input
            value={fio}
            onChange={(e) => setFio(e.target.value)}
            className="w-full rounded-lg border border-premium-border bg-premium-bg px-3 py-2 text-sm text-premium-text outline-none focus:border-premium-gold"
            required
          />
        </div>

        <div>
          <label className="block text-xs text-premium-text/60 mb-1">Логин</label>
          <input
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            className="w-full rounded-lg border border-premium-border bg-premium-bg px-3 py-2 text-sm text-premium-text outline-none focus:border-premium-gold"
            autoComplete="off"
            required
          />
        </div>

        <div>
          <label className="block text-xs text-premium-text/60 mb-1">Пароль</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-premium-border bg-premium-bg px-3 py-2 text-sm text-premium-text outline-none focus:border-premium-gold"
            autoComplete="new-password"
            required
          />
        </div>

        {error && <div className="text-sm text-red-400">{error}</div>}

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg bg-premium-surface-2 py-2 text-sm font-medium text-premium-text hover:bg-premium-border"
          >
            Отмена
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 rounded-lg bg-premium-gold py-2 text-sm font-medium text-premium-bg hover:bg-premium-gold-hi disabled:opacity-60"
          >
            {submitting ? 'Создаём…' : 'Создать'}
          </button>
        </div>
      </form>
    </div>
  )
}
