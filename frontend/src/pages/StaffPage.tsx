import { useEffect, useMemo, useState } from 'react'
import { apiFetch } from '../lib/api'
import { usePremiumBackground } from '../lib/usePremiumBackground'
import type { LoginLogEntry, StaffUser } from '../types'
import { NewStaffModal } from '../components/NewStaffModal'
import { StaffDetailPanel } from '../components/StaffDetailPanel'
import { SkeletonRows } from '../components/SkeletonRows'

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

const WEEKDAY_SHORT = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']

// Короткий формат для карточки/таблицы сотрудника (2026-07-22, запрос Александра) —
// чч:мм, ДН, дд.мм.гггг — компактнее, чем полный formatDateTime (используется в
// "Истории входов" ниже, там формат оставлен как был).
function formatLastLoginShort(value: string) {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  const pad = (n: number) => String(n).padStart(2, '0')
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`
  const date = `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`
  return `${time}, ${WEEKDAY_SHORT[d.getDay()]}, ${date}`
}

export function StaffPage() {
  usePremiumBackground()
  const [staff, setStaff] = useState<StaffUser[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [selected, setSelected] = useState<StaffUser | null>(null)
  const [loginLog, setLoginLog] = useState<LoginLogEntry[]>([])

  const lastLoginByLogin = useMemo(() => {
    const map = new Map<string, string>()
    for (const entry of loginLog) {
      const login = entry['логин']
      const existing = map.get(login)
      if (!existing || new Date(entry['дата и время']) > new Date(existing)) {
        map.set(login, entry['дата и время'])
      }
    }
    return map
  }, [loginLog])

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
    <div className="relative min-h-full overflow-hidden bg-premium-bg px-4 py-4 sm:px-8 sm:py-6">
      <div className="premium-grain" aria-hidden />
      <div className="relative mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-display text-xl font-semibold italic text-premium-text sm:text-2xl">Сотрудники</h1>
        <button
          onClick={() => {
            setSelected(null)
            setShowCreate(true)
          }}
          className="whitespace-nowrap rounded-lg bg-premium-gold px-3 py-2 text-sm font-medium text-premium-bg hover:bg-premium-gold-hi sm:px-4"
        >
          + Добавить сотрудника
        </button>
      </div>

      <div className="relative space-y-2 md:hidden">
        {loading && (
          <div className="overflow-hidden rounded-xl border border-premium-border bg-premium-surface">
            <SkeletonRows />
          </div>
        )}
        {!loading && staff.length === 0 && (
          <div className="rounded-xl border border-premium-border bg-premium-surface px-4 py-6 text-center text-sm text-premium-text/40">
            Сотрудников пока нет.
          </div>
        )}
        {staff.map((u) => (
          <button
            key={u.id}
            onClick={() => handleRowClick(u)}
            className="premium-card w-full rounded-xl border border-premium-border bg-premium-surface p-4 text-left active:bg-premium-surface-2"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="truncate text-sm font-medium text-premium-text">{u.fio}</span>
              <span
                className={`inline-flex shrink-0 items-center gap-1.5 text-xs font-medium ${
                  u.status === 'активен' ? 'text-premium-sage-hi' : 'text-red-400'
                }`}
              >
                <span className={`h-2 w-2 rounded-full ${u.status === 'активен' ? 'bg-premium-sage-hi' : 'bg-red-500'}`} />
                {u.status === 'активен' ? 'Активен' : 'Уволен'}
              </span>
            </div>
            <div className="mt-1.5 flex items-center justify-between text-xs text-premium-text/50">
              <span className="truncate">
                {ROLE_LABEL[u.role]} · {u.login}
              </span>
              <span className="shrink-0">
                {lastLoginByLogin.has(u.login) ? formatLastLoginShort(lastLoginByLogin.get(u.login)!) : '—'}
              </span>
            </div>
          </button>
        ))}
      </div>

      <div className="relative hidden overflow-hidden rounded-xl border border-premium-border bg-premium-surface md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-premium-border text-left text-premium-text/50">
              <th className="px-4 py-3 font-medium">ФИО</th>
              <th className="px-4 py-3 font-medium">Логин</th>
              <th className="px-4 py-3 font-medium">Роль</th>
              <th className="px-4 py-3 font-medium">Телефон</th>
              <th className="px-4 py-3 font-medium">Последний вход</th>
              <th className="px-4 py-3 font-medium">Статус</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} className="p-0">
                  <SkeletonRows />
                </td>
              </tr>
            )}
            {!loading && staff.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-premium-text/40">
                  Сотрудников пока нет.
                </td>
              </tr>
            )}
            {staff.map((u) => (
              <tr
                key={u.id}
                onClick={() => handleRowClick(u)}
                className="cursor-pointer border-b border-premium-border/60 transition-colors last:border-0 hover:bg-premium-surface-2"
              >
                <td className="px-4 py-3 text-premium-text">{u.fio}</td>
                <td className="px-4 py-3 text-premium-text/60">{u.login}</td>
                <td className="px-4 py-3 text-premium-text/60">{ROLE_LABEL[u.role]}</td>
                <td className="px-4 py-3 text-premium-text/60">{u.phone || '—'}</td>
                <td className="px-4 py-3 text-premium-text/60">
                  {lastLoginByLogin.has(u.login) ? formatLastLoginShort(lastLoginByLogin.get(u.login)!) : '—'}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center gap-2 ${
                      u.status === 'активен' ? 'text-premium-sage-hi' : 'text-red-400'
                    }`}
                  >
                    <span
                      className={`h-2 w-2 rounded-full ${
                        u.status === 'активен' ? 'bg-premium-sage-hi' : 'bg-red-500'
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

      <div className="relative mt-8">
        <h2 className="mb-3 font-display text-lg font-semibold italic text-premium-text">История входов</h2>
        <div className="overflow-hidden rounded-xl border border-premium-border bg-premium-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-premium-border text-left text-premium-text/50">
                <th className="px-4 py-3 font-medium">Сотрудник</th>
                <th className="px-4 py-3 font-medium">Логин</th>
                <th className="px-4 py-3 font-medium">Дата и время</th>
              </tr>
            </thead>
            <tbody>
              {loginLog.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-premium-text/40">
                    Входов ещё не было.
                  </td>
                </tr>
              )}
              {loginLog.map((entry) => (
                <tr key={entry.id} className="border-b border-premium-border/60 last:border-0">
                  <td className="px-4 py-3 text-premium-text">{entry['ФИО']}</td>
                  <td className="px-4 py-3 text-premium-text/60">{entry['логин']}</td>
                  <td className="px-4 py-3 text-premium-text/50">{formatDateTime(entry['дата и время'])}</td>
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
