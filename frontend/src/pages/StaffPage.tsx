import { useEffect, useState } from 'react'
import { apiFetch } from '../lib/api'
import type { LoginLogEntry, StaffUser } from '../types'
import { NewStaffModal } from '../components/NewStaffModal'
import { StaffDetailPanel } from '../components/StaffDetailPanel'

const ROLE_LABEL: Record<StaffUser['role'], string> = {
  worker: 'Сотрудник',
  founder: 'Founder',
  developer: 'Developer',
}

function formatDateTime(value: string) {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  const pad = (n: number) => String(n).padStart(2, '0')
  const date = `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`
  const weekday = d.toLocaleDateString('ru-RU', { weekday: 'long' })
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  return `${date}, ${weekday}, ${time}`
}

export function StaffPage() {
  const [staff, setStaff] = useState<StaffUser[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [selected, setSelected] = useState<StaffUser | null>(null)
  const [loginLog, setLoginLog] = useState<LoginLogEntry[]>([])

  async function load() {
    setLoading(true)
    try {
      const data = await apiFetch<StaffUser[]>('/users')
      setStaff(data)
      setSelected((prev) => (prev ? data.find((u) => u.id === prev.id) ?? null : null))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    apiFetch<LoginLogEntry[]>('/auth/log').then(setLoginLog)
  }, [])

  function handleRowClick(u: StaffUser) {
    setShowCreate(false)
    setSelected(u)
  }

  return (
    <div className="px-4 py-4 sm:px-8 sm:py-6">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-semibold text-ink sm:text-2xl">Сотрудники</h1>
        <button
          onClick={() => {
            setSelected(null)
            setShowCreate(true)
          }}
          className="whitespace-nowrap rounded-lg bg-terracotta px-3 py-2 text-sm font-medium text-white hover:bg-terracotta-dark sm:px-4"
        >
          + Добавить сотрудника
        </button>
      </div>

      <div className="space-y-2 md:hidden">
        {loading && (
          <div className="rounded-xl border border-ink/10 bg-white px-4 py-6 text-center text-sm text-ink/40">
            Загрузка…
          </div>
        )}
        {!loading && staff.length === 0 && (
          <div className="rounded-xl border border-ink/10 bg-white px-4 py-6 text-center text-sm text-ink/40">
            Сотрудников пока нет.
          </div>
        )}
        {staff.map((u) => (
          <button
            key={u.id}
            onClick={() => handleRowClick(u)}
            className="w-full rounded-xl border border-ink/10 bg-white p-4 text-left shadow-sm active:bg-cream/60"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="truncate text-sm font-medium text-ink">{u.fio}</span>
              <span
                className={`inline-flex shrink-0 items-center gap-1.5 text-xs font-medium ${
                  u.status === 'активен' ? 'text-emerald-600' : 'text-red-600'
                }`}
              >
                <span className={`h-2 w-2 rounded-full ${u.status === 'активен' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                {u.status === 'активен' ? 'Активен' : 'Уволен'}
              </span>
            </div>
            <div className="mt-1.5 flex items-center justify-between text-xs text-ink/50">
              <span className="truncate">
                {ROLE_LABEL[u.role]} · {u.login}
              </span>
              <span className="shrink-0">{u.phone || '—'}</span>
            </div>
          </button>
        ))}
      </div>

      <div className="hidden overflow-hidden rounded-xl border border-ink/10 bg-white shadow-sm md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ink/10 text-left text-ink/50">
              <th className="px-4 py-3 font-medium">ФИО</th>
              <th className="px-4 py-3 font-medium">Логин</th>
              <th className="px-4 py-3 font-medium">Роль</th>
              <th className="px-4 py-3 font-medium">Телефон</th>
              <th className="px-4 py-3 font-medium">Статус</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-ink/40">
                  Загрузка…
                </td>
              </tr>
            )}
            {!loading && staff.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-ink/40">
                  Сотрудников пока нет.
                </td>
              </tr>
            )}
            {staff.map((u) => (
              <tr
                key={u.id}
                onClick={() => handleRowClick(u)}
                className="cursor-pointer border-b border-ink/5 last:border-0 hover:bg-cream/60"
              >
                <td className="px-4 py-3">{u.fio}</td>
                <td className="px-4 py-3 text-ink/60">{u.login}</td>
                <td className="px-4 py-3 text-ink/60">{ROLE_LABEL[u.role]}</td>
                <td className="px-4 py-3 text-ink/60">{u.phone || '—'}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center gap-2 ${
                      u.status === 'активен' ? 'text-emerald-600' : 'text-red-600'
                    }`}
                  >
                    <span
                      className={`h-2 w-2 rounded-full ${
                        u.status === 'активен' ? 'bg-emerald-500' : 'bg-red-500'
                      }`}
                    />
                    {u.status === 'активен' ? 'Активен' : 'Уволен'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-8">
        <h2 className="mb-3 text-lg font-semibold text-ink">История входов</h2>
        <div className="overflow-hidden rounded-xl border border-ink/10 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink/10 text-left text-ink/50">
                <th className="px-4 py-3 font-medium">Сотрудник</th>
                <th className="px-4 py-3 font-medium">Логин</th>
                <th className="px-4 py-3 font-medium">Дата и время</th>
              </tr>
            </thead>
            <tbody>
              {loginLog.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-ink/40">
                    Входов ещё не было.
                  </td>
                </tr>
              )}
              {loginLog.map((entry) => (
                <tr key={entry.id} className="border-b border-ink/5 last:border-0">
                  <td className="px-4 py-3">{entry['ФИО']}</td>
                  <td className="px-4 py-3 text-ink/60">{entry['логин']}</td>
                  <td className="px-4 py-3 text-ink/50">{formatDateTime(entry['дата и время'])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <StaffDetailPanel staff={selected} onClose={() => setSelected(null)} onChanged={load} />
      )}

      {showCreate && (
        <NewStaffModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false)
            load()
          }}
        />
      )}
    </div>
  )
}
