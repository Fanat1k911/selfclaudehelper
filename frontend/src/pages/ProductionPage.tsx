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
    <div className="relative min-h-full overflow-hidden bg-premium-bg px-4 py-4 sm:px-8 sm:py-6">
      <div className="premium-grain" aria-hidden />
      <div className="relative mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-display text-xl font-semibold italic text-premium-text sm:text-2xl">Производство</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="whitespace-nowrap rounded-lg bg-premium-gold px-3 py-2 text-sm font-medium text-premium-bg hover:bg-premium-gold-hi sm:px-4"
        >
          + Внести производство
        </button>
      </div>

      {leaderboard.length > 0 && (
        <div className="relative mb-6 overflow-hidden rounded-xl border border-premium-border bg-premium-surface">
          <div className="border-b border-premium-border px-4 py-2.5 text-sm font-medium text-premium-text/70">
            Кто сколько сделал
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-premium-text/40">
                <th className="px-4 py-2 font-medium">Сотрудник</th>
                <th className="px-4 py-2 text-right font-medium">Сегодня</th>
                <th className="px-4 py-2 text-right font-medium">За месяц</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((row) => (
                <tr key={row.worker_id} className="border-t border-premium-border/60">
                  <td className="px-4 py-2 text-premium-text">{row['ФИО']}</td>
                  <td className="px-4 py-2 text-right font-medium text-premium-text">{row['сегодня']}</td>
                  <td className="px-4 py-2 text-right font-medium text-premium-text">{row['месяц']}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="relative space-y-2 md:hidden">
        {loading && (
          <div className="rounded-xl border border-premium-border bg-premium-surface px-4 py-6 text-center text-sm text-premium-text/40">
            Загрузка…
          </div>
        )}
        {!loading && log.length === 0 && (
          <div className="rounded-xl border border-premium-border bg-premium-surface px-4 py-6 text-center text-sm text-premium-text/40">
            Записей ещё нет.
          </div>
        )}
        {log.map((entry) => (
          <div key={entry.id} className="premium-card rounded-xl border border-premium-border bg-premium-surface p-4">
            <div className="flex items-start justify-between gap-2">
              <span className="truncate text-sm font-medium text-premium-text">{entry['название рецепта']}</span>
              <span className="shrink-0 text-sm font-semibold text-premium-text">{entry['кол-во продукта']}</span>
            </div>
            <div className="mt-1.5 flex items-center justify-between text-xs text-premium-text/50">
              <span className="truncate">{entry['ФИО сотрудника']}</span>
              <span className="shrink-0">{formatDate(entry['дата'])}</span>
            </div>
            {(entry['брак'] > 0 || entry['комментарий']) && (
              <div className="mt-1.5 text-xs text-premium-text/50">
                {entry['брак'] > 0 && <span className="text-red-400">брак: {entry['брак']}</span>}
                {entry['брак'] > 0 && entry['комментарий'] && ' · '}
                {entry['комментарий']}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="relative hidden overflow-hidden rounded-xl border border-premium-border bg-premium-surface md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-premium-border text-left text-premium-text/50">
              <th className="px-4 py-3 font-medium">Дата</th>
              <th className="px-4 py-3 font-medium">Рецепт</th>
              <th className="px-4 py-3 font-medium">Сотрудник</th>
              <th className="px-4 py-3 font-medium text-right">Кол-во</th>
              <th className="px-4 py-3 font-medium text-right">Брак</th>
              <th className="px-4 py-3 font-medium">Комментарий</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-premium-text/40">
                  Загрузка…
                </td>
              </tr>
            )}
            {!loading && log.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-premium-text/40">
                  Записей ещё нет.
                </td>
              </tr>
            )}
            {log.map((entry) => (
              <tr key={entry.id} className="border-b border-premium-border/60 last:border-0">
                <td className="px-4 py-3 text-premium-text/50">{formatDate(entry['дата'])}</td>
                <td className="px-4 py-3 text-premium-text">{entry['название рецепта']}</td>
                <td className="px-4 py-3 text-premium-text/60">{entry['ФИО сотрудника']}</td>
                <td className="px-4 py-3 text-right font-medium text-premium-text">{entry['кол-во продукта']}</td>
                <td className="px-4 py-3 text-right text-premium-text/50">{entry['брак']}</td>
                <td className="px-4 py-3 text-premium-text/50">{entry['комментарий']}</td>
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
