import { useEffect, useState } from 'react'
import { apiFetch } from '../lib/api'
import type { Company } from '../types'
import { CompanyDetailPanel } from '../components/CompanyDetailPanel'
import { NewCompanyModal } from '../components/NewCompanyModal'

function formatDate(value: string) {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('ru-RU')
}

export function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    try {
      const data = await apiFetch<Company[]>('/companies')
      setCompanies(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  return (
    <div className="px-4 py-4 sm:px-8 sm:py-6">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-semibold text-ink sm:text-2xl">Компании</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="whitespace-nowrap rounded-lg bg-terracotta px-3 py-2 text-sm font-medium text-white hover:bg-terracotta-dark sm:px-4"
        >
          + Новая компания
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-ink/10 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ink/10 text-left text-ink/50">
              <th className="px-4 py-3 font-medium">Название</th>
              <th className="px-4 py-3 font-medium">ID</th>
              <th className="px-4 py-3 font-medium">Создана</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-ink/40">
                  Загрузка…
                </td>
              </tr>
            )}
            {!loading && companies.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-ink/40">
                  Компаний пока нет.
                </td>
              </tr>
            )}
            {companies.map((c) => (
              <tr
                key={c.id}
                onClick={() => setSelectedId(c.id)}
                className="cursor-pointer border-b border-ink/5 last:border-0 hover:bg-cream/60"
              >
                <td className="px-4 py-3">{c.name}</td>
                <td className="px-4 py-3 text-ink/50 font-mono text-xs">{c.id}</td>
                <td className="px-4 py-3 text-ink/60">{formatDate(c.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedId && (
        <CompanyDetailPanel companyId={selectedId} onClose={() => setSelectedId(null)} />
      )}

      {showCreate && (
        <NewCompanyModal
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
