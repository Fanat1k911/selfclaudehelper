import { useEffect, useState } from 'react'
import { apiFetch } from '../lib/api'
import type { Company } from '../types'

interface CompanyMember {
  id: string
  fio: string
  login: string
  role: 'founder' | 'worker' | 'developer'
  status: string
}

interface CompanyDetail extends Company {
  members: CompanyMember[]
}

function formatDate(value: string) {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('ru-RU')
}

export function CompanyDetailPanel({ companyId, onClose }: { companyId: string; onClose: () => void }) {
  const [detail, setDetail] = useState<CompanyDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    apiFetch<CompanyDetail>(`/companies/${companyId}`)
      .then(setDetail)
      .catch(() => setError('Не удалось загрузить компанию.'))
      .finally(() => setLoading(false))
  }, [companyId])

  const groups: { role: CompanyMember['role']; label: string }[] = [
    { role: 'developer', label: 'Developer' },
    { role: 'founder', label: 'Founder' },
    { role: 'worker', label: 'Сотрудники' },
  ]

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <div className="flex h-full w-full max-w-md flex-col bg-premium-surface shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between border-b border-premium-border px-6 py-5">
          <div>
            <div className="text-lg font-semibold text-premium-text">{detail?.name ?? '…'}</div>
            <div className="text-sm text-premium-text/50">
              {detail ? `создана ${formatDate(detail.created_at)}` : ''}
            </div>
          </div>
          <button onClick={onClose} className="text-premium-text/40 hover:text-premium-text text-xl leading-none">
            ×
          </button>
        </div>

        <div className="flex-1 touch-pan-y overflow-y-auto overflow-x-hidden px-6 py-4">
          {loading && <div className="text-sm text-premium-text/40 text-center py-6">Загрузка…</div>}
          {!loading && error && <div className="text-sm text-red-400 text-center py-6">{error}</div>}
          {!loading && detail && detail.members.length === 0 && (
            <div className="text-sm text-premium-text/40 text-center py-6">В компании пока никого нет.</div>
          )}
          {!loading &&
            detail &&
            groups.map(({ role, label }) => {
              const members = detail.members.filter((m) => m.role === role)
              if (members.length === 0) return null
              return (
                <div key={role} className="mb-5">
                  <div className="text-xs font-medium uppercase tracking-wider text-premium-text/40 mb-2">{label}</div>
                  <div className="space-y-2">
                    {members.map((m) => (
                      <div
                        key={m.id}
                        className="flex items-center justify-between rounded-lg border border-premium-border px-3 py-2"
                      >
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-premium-text">{m.fio}</div>
                          <div className="text-xs text-premium-text/50">{m.login}</div>
                        </div>
                        <span
                          className={`shrink-0 text-xs font-medium ${
                            m.status === 'активен' ? 'text-premium-sage-hi' : 'text-red-400'
                          }`}
                        >
                          {m.status === 'активен' ? 'Активен' : 'Уволен'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
        </div>
      </div>
    </div>
  )
}
