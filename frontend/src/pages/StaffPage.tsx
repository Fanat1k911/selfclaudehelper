import { useEffect, useState } from 'react'
import { apiFetch } from '../lib/api'
import type { StaffUser } from '../types'
import { NewStaffModal } from '../components/NewStaffModal'
import { StaffDetailPanel } from '../components/StaffDetailPanel'

const ROLE_LABEL: Record<StaffUser['role'], string> = {
  worker: 'Сотрудник',
  founder: 'Founder',
  developer: 'Developer',
}

export function StaffPage() {
  const [staff, setStaff] = useState<StaffUser[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [selected, setSelected] = useState<StaffUser | null>(null)

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
  }, [])

  return (
    <div className="px-8 py-6">
      <div className="relative z-[60] flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-ink">Сотрудники</h1>
        <button
          onClick={() => {
            setSelected(null)
            setShowCreate(true)
          }}
          className="rounded-lg bg-terracotta px-4 py-2 text-sm font-medium text-white hover:bg-terracotta-dark"
        >
          + Добавить сотрудника
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-ink/10 bg-white shadow-sm">
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
                onClick={() => {
                  setShowCreate(false)
                  setSelected(u)
                }}
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
