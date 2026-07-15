import { useState, type FormEvent } from 'react'
import { apiFetch, ApiError } from '../lib/api'
import { sanitizePhone } from '../lib/validators'
import type { StaffUser } from '../types'

const ROLES: { value: StaffUser['role']; label: string }[] = [
  { value: 'worker', label: 'Сотрудник' },
  { value: 'founder', label: 'Founder' },
  { value: 'developer', label: 'Developer' },
]

function formatDate(value: string) {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('ru-RU')
}

export function StaffDetailPanel({
  staff,
  onClose,
  onChanged,
}: {
  staff: StaffUser
  onClose: () => void
  onChanged: () => void
}) {
  const [fio, setFio] = useState(staff.fio)
  const [role, setRole] = useState<StaffUser['role']>(staff.role)
  const [phone, setPhone] = useState(staff.phone)
  const [messenger, setMessenger] = useState(staff.messenger)
  const [address, setAddress] = useState(staff.address)
  const [document, setDocument] = useState(staff.document)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const [newPassword, setNewPassword] = useState('')
  const [resetting, setResetting] = useState(false)
  const [resetMsg, setResetMsg] = useState<string | null>(null)

  const [statusBusy, setStatusBusy] = useState(false)

  async function handleSave(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await apiFetch(`/users/${staff.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ fio, role, phone, messenger, address, document }),
      })
      onChanged()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось сохранить.')
    } finally {
      setSubmitting(false)
    }
  }

  async function toggleStatus() {
    setStatusBusy(true)
    setError(null)
    try {
      const nextStatus = staff.status === 'активен' ? 'уволен' : 'активен'
      await apiFetch(`/users/${staff.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      })
      onChanged()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось изменить статус.')
    } finally {
      setStatusBusy(false)
    }
  }

  async function handleResetPassword(e: FormEvent) {
    e.preventDefault()
    setResetMsg(null)
    setResetting(true)
    try {
      await apiFetch(`/users/${staff.id}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ new_password: newPassword }),
      })
      setNewPassword('')
      setResetMsg('Пароль обновлён.')
    } catch (err) {
      setResetMsg(err instanceof ApiError ? err.message : 'Не удалось сбросить пароль.')
    } finally {
      setResetting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <div
        className="flex h-full w-full max-w-md flex-col bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-ink/10 px-6 py-5">
          <div>
            <div className="text-lg font-semibold text-ink">{staff.fio}</div>
            <div className="text-sm text-ink/50">
              {staff.login} · создан {formatDate(staff.created_at)}
            </div>
          </div>
          <button onClick={onClose} className="text-ink/40 hover:text-ink text-xl leading-none">
            ×
          </button>
        </div>

        <div className="px-6 py-4 border-b border-ink/10 flex items-center justify-between">
          <span
            className={`inline-flex items-center gap-2 text-sm font-medium ${
              staff.status === 'активен' ? 'text-emerald-600' : 'text-red-600'
            }`}
          >
            <span className={`h-2 w-2 rounded-full ${staff.status === 'активен' ? 'bg-emerald-500' : 'bg-red-500'}`} />
            {staff.status === 'активен' ? 'Активен' : 'Уволен'}
          </span>
          <button
            onClick={toggleStatus}
            disabled={statusBusy}
            className="rounded-lg border border-ink/10 px-4 py-2 text-sm font-medium text-ink hover:bg-cream/60 disabled:opacity-60"
          >
            {staff.status === 'активен' ? 'Уволить' : 'Восстановить'}
          </button>
        </div>

        <form onSubmit={handleSave} className="px-6 py-4 border-b border-ink/10 space-y-3">
          <div>
            <label className="block text-xs text-ink/60 mb-1">ФИО</label>
            <input
              value={fio}
              onChange={(e) => setFio(e.target.value)}
              className="w-full rounded-lg border border-ink/10 px-3 py-2 text-sm outline-none focus:border-terracotta"
              required
            />
          </div>
          <div>
            <label className="block text-xs text-ink/60 mb-1">Роль</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as StaffUser['role'])}
              className="w-full rounded-lg border border-ink/10 px-3 py-2 text-sm outline-none focus:border-terracotta"
            >
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-ink/60 mb-1">Телефон</label>
            <input
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(sanitizePhone(e.target.value))}
              className="w-full rounded-lg border border-ink/10 px-3 py-2 text-sm outline-none focus:border-terracotta"
            />
          </div>
          <div>
            <label className="block text-xs text-ink/60 mb-1">Мессенджер</label>
            <input
              value={messenger}
              onChange={(e) => setMessenger(e.target.value)}
              className="w-full rounded-lg border border-ink/10 px-3 py-2 text-sm outline-none focus:border-terracotta"
            />
          </div>
          <div>
            <label className="block text-xs text-ink/60 mb-1">Адрес проживания</label>
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full rounded-lg border border-ink/10 px-3 py-2 text-sm outline-none focus:border-terracotta"
            />
          </div>
          <div>
            <label className="block text-xs text-ink/60 mb-1">Документ (паспорт/ИНН)</label>
            <input
              value={document}
              onChange={(e) => setDocument(e.target.value)}
              className="w-full rounded-lg border border-ink/10 px-3 py-2 text-sm outline-none focus:border-terracotta"
            />
          </div>
          {error && <div className="text-sm text-red-600">{error}</div>}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-terracotta py-2 text-sm font-medium text-white hover:bg-terracotta-dark disabled:opacity-60"
          >
            {submitting ? 'Сохраняем…' : 'Сохранить'}
          </button>
        </form>

        <form onSubmit={handleResetPassword} className="px-6 py-4 space-y-2">
          <div className="text-sm font-medium text-ink/70">Сбросить пароль</div>
          <div className="flex gap-2">
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Новый пароль"
              className="flex-1 rounded-lg border border-ink/10 px-3 py-2 text-sm outline-none focus:border-terracotta"
              required
              autoComplete="new-password"
            />
            <button
              type="submit"
              disabled={resetting}
              className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white hover:bg-ink/80 disabled:opacity-60"
            >
              {resetting ? '…' : 'Сбросить'}
            </button>
          </div>
          {resetMsg && <div className="text-sm text-ink/60">{resetMsg}</div>}
        </form>
      </div>
    </div>
  )
}
