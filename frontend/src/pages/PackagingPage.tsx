import { useEffect, useState } from 'react'
import { apiFetch } from '../lib/api'
import { usePremiumBackground } from '../lib/usePremiumBackground'
import type { PackagingLogEntry } from '../types'
import { NewPackagingModal } from '../components/NewPackagingModal'
import { SkeletonRows } from '../components/SkeletonRows'

function formatDate(value: string | null) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('ru-RU')
}

export function PackagingPage() {
  usePremiumBackground()
  const [log, setLog] = useState<PackagingLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const data = await apiFetch<PackagingLogEntry[]>('/packaging')
      setLog(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  return (
    <div className="relative min-h-full overflow-hidden bg-premium-bg px-4 py-4 sm:px-8 sm:py-6">
      <div className="premium-grain" aria-hidden />
      <div className="relative mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="flex items-baseline gap-2 font-display text-xl font-semibold italic text-premium-text sm:text-2xl">
          Упаковка
          {!loading && <span className="font-sans text-sm font-normal not-italic text-premium-text/40">{log.length}</span>}
        </h1>
        <button
          onClick={() => setShowCreate(true)}
          className="whitespace-nowrap rounded-lg bg-premium-gold px-3 py-2 text-sm font-medium text-premium-bg hover:bg-premium-gold-hi sm:px-4"
        >
          + Внести упаковку
        </button>
      </div>

      <div className="relative space-y-2 md:hidden">
        {loading && (
          <div className="overflow-hidden rounded-xl border border-premium-border bg-premium-surface">
            <SkeletonRows />
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
              <span className="truncate text-sm font-medium text-premium-text">{entry['название продукта']}</span>
              <span className="shrink-0 text-sm font-semibold text-premium-text">{entry['кол-во']} шт</span>
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
              <th className="px-4 py-3 font-medium">Продукт</th>
              <th className="px-4 py-3 font-medium">Сотрудник</th>
              <th className="px-4 py-3 font-medium text-right">Кол-во</th>
              <th className="px-4 py-3 font-medium text-right">Брак</th>
              <th className="px-4 py-3 font-medium">Комментарий</th>
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
                <td className="px-4 py-3 text-premium-text">{entry['название продукта']}</td>
                <td className="px-4 py-3 text-premium-text/60">{entry['ФИО сотрудника']}</td>
                <td className="px-4 py-3 text-right font-medium text-premium-text">{entry['кол-во']}</td>
                <td className="px-4 py-3 text-right text-premium-text/50">{entry['брак']}</td>
                <td className="px-4 py-3 text-premium-text/50">{entry['комментарий']}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <NewPackagingModal
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
