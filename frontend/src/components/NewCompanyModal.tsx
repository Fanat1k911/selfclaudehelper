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
      await apiFetch('/companies', {
        method: 'POST',
        body: JSON.stringify({ company_name: companyName, fio, login, password }),
      })
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
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl space-y-3 max-h-[90vh] overflow-y-auto"
      >
        <div className="text-lg font-semibold text-ink mb-2">Новая компания</div>
        <p className="text-xs text-ink/50 -mt-2 mb-2">
          Founder этой компании заводится отдельно после — здесь только тенант и первый Developer-аккаунт.
        </p>

        <div>
          <label className="block text-xs text-ink/60 mb-1">Название компании</label>
          <input
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            className="w-full rounded-lg border border-ink/10 px-3 py-2 text-sm outline-none focus:border-terracotta"
            required
          />
        </div>

        <div>
          <label className="block text-xs text-ink/60 mb-1">ФИО (Developer)</label>
          <input
            value={fio}
            onChange={(e) => setFio(e.target.value)}
            className="w-full rounded-lg border border-ink/10 px-3 py-2 text-sm outline-none focus:border-terracotta"
            required
          />
        </div>

        <div>
          <label className="block text-xs text-ink/60 mb-1">Логин</label>
          <input
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            className="w-full rounded-lg border border-ink/10 px-3 py-2 text-sm outline-none focus:border-terracotta"
            autoComplete="off"
            required
          />
        </div>

        <div>
          <label className="block text-xs text-ink/60 mb-1">Пароль</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-ink/10 px-3 py-2 text-sm outline-none focus:border-terracotta"
            autoComplete="new-password"
            required
          />
        </div>

        {error && <div className="text-sm text-red-600">{error}</div>}

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg bg-cream py-2 text-sm font-medium text-ink hover:bg-ink/5"
          >
            Отмена
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 rounded-lg bg-terracotta py-2 text-sm font-medium text-white hover:bg-terracotta-dark disabled:opacity-60"
          >
            {submitting ? 'Создаём…' : 'Создать'}
          </button>
        </div>
      </form>
    </div>
  )
}
