import { useEffect, useState } from 'react'
import { apiFetch } from '../lib/api'
import type { ProductionLogEntry } from '../types'
import { NewProductionModal } from '../components/NewProductionModal'

function formatDate(value: string | null) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('ru-RU')
}

export function ProductionPage() {
  const [log, setLog] = useState<ProductionLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const data = await apiFetch<ProductionLogEntry[]>('/production')
      setLog(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  return (
    <div className="px-8 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-ink">Производство</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="rounded-lg bg-terracotta px-4 py-2 text-sm font-medium text-white hover:bg-terracotta-dark"
        >
          + Внести производство
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-ink/10 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ink/10 text-left text-ink/50">
              <th className="px-4 py-3 font-medium">Дата</th>
              <th className="px-4 py-3 font-medium">Рецепт</th>
              <th className="px-4 py-3 font-medium">Сотрудник</th>
              <th className="px-4 py-3 font-medium text-right">Партий</th>
              <th className="px-4 py-3 font-medium text-right">Брак</th>
              <th className="px-4 py-3 font-medium">Комментарий</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-ink/40">
                  Загрузка…
                </td>
              </tr>
            )}
            {!loading && log.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-ink/40">
                  Записей ещё нет.
                </td>
              </tr>
            )}
            {log.map((entry) => (
              <tr key={entry.id} className="border-b border-ink/5 last:border-0">
                <td className="px-4 py-3 text-ink/50">{formatDate(entry['дата'])}</td>
                <td className="px-4 py-3">{entry['название рецепта']}</td>
                <td className="px-4 py-3 text-ink/60">{entry['ФИО сотрудника']}</td>
                <td className="px-4 py-3 text-right font-medium">{entry['кол-во партий']}</td>
                <td className="px-4 py-3 text-right text-ink/50">{entry['брак']}</td>
                <td className="px-4 py-3 text-ink/50">{entry['комментарий']}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <NewProductionModal
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
