import { useEffect, useState } from 'react'
import { apiFetch } from '../lib/api'
import type { LeaderboardRow, ProductionLogEntry } from '../types'
import { NewProductionModal } from '../components/NewProductionModal'

function formatDate(value: string | null) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('ru-RU')
}

export function ProductionPage() {
  const [log, setLog] = useState<ProductionLogEntry[]>([])
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([])
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
    apiFetch<LeaderboardRow[]>('/production/leaderboard').then(setLeaderboard)
  }, [])

  return (
    <div className="px-4 py-4 sm:px-8 sm:py-6">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-semibold text-ink sm:text-2xl">Производство</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="whitespace-nowrap rounded-lg bg-accent-add px-3 py-2 text-sm font-medium text-white hover:bg-accent-add-dark sm:px-4"
        >
          + Внести производство
        </button>
      </div>

      {leaderboard.length > 0 && (
        <div className="mb-6 overflow-hidden rounded-xl border border-ink/10 bg-white shadow-sm">
          <div className="border-b border-ink/10 px-4 py-2.5 text-sm font-medium text-ink/70">
            Кто сколько сделал
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-ink/40">
                <th className="px-4 py-2 font-medium">Сотрудник</th>
                <th className="px-4 py-2 text-right font-medium">Сегодня</th>
                <th className="px-4 py-2 text-right font-medium">За месяц</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((row) => (
                <tr key={row.worker_id} className="border-t border-ink/5">
                  <td className="px-4 py-2 text-ink">{row['ФИО']}</td>
                  <td className="px-4 py-2 text-right font-medium">{row['сегодня']}</td>
                  <td className="px-4 py-2 text-right font-medium">{row['месяц']}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="space-y-2 md:hidden">
        {loading && (
          <div className="rounded-xl border border-ink/10 bg-white px-4 py-6 text-center text-sm text-ink/40">
            Загрузка…
          </div>
        )}
        {!loading && log.length === 0 && (
          <div className="rounded-xl border border-ink/10 bg-white px-4 py-6 text-center text-sm text-ink/40">
            Записей ещё нет.
          </div>
        )}
        {log.map((entry) => (
          <div key={entry.id} className="rounded-xl border border-ink/10 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <span className="truncate text-sm font-medium text-ink">{entry['название рецепта']}</span>
              <span className="shrink-0 text-sm font-semibold text-ink">{entry['кол-во партий']} партий</span>
            </div>
            <div className="mt-1.5 flex items-center justify-between text-xs text-ink/50">
              <span className="truncate">{entry['ФИО сотрудника']}</span>
              <span className="shrink-0">{formatDate(entry['дата'])}</span>
            </div>
            {(entry['брак'] > 0 || entry['комментарий']) && (
              <div className="mt-1.5 text-xs text-ink/50">
                {entry['брак'] > 0 && <span className="text-red-600">брак: {entry['брак']}</span>}
                {entry['брак'] > 0 && entry['комментарий'] && ' · '}
                {entry['комментарий']}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="hidden overflow-hidden rounded-xl border border-ink/10 bg-white shadow-sm md:block">
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
