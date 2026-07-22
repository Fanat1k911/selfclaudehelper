import { useEffect, useState } from 'react'
import { apiFetch } from '../lib/api'
import { usePremiumBackground } from '../lib/usePremiumBackground'
import { SkeletonRows } from '../components/SkeletonRows'
import type { TechLogEntry, TechStatus } from '../types'

function formatUptime(seconds: number) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return `${h}ч ${m}м ${s}с`
}

function formatTime(value: string) {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

const LEVEL_COLOR: Record<string, string> = {
  ERROR: 'text-red-400',
  CRITICAL: 'text-red-400',
  WARNING: 'text-amber-500',
  INFO: 'text-premium-text/60',
  DEBUG: 'text-premium-text/40',
}

export function TechPanelPage() {
  usePremiumBackground()
  const [status, setStatus] = useState<TechStatus | null>(null)
  const [logs, setLogs] = useState<TechLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [clearing, setClearing] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const [statusData, logsData] = await Promise.all([
        apiFetch<TechStatus>('/techpanel/status'),
        apiFetch<TechLogEntry[]>('/techpanel/logs'),
      ])
      setStatus(statusData)
      setLogs(logsData)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function handleClearCache() {
    setClearing(true)
    try {
      await apiFetch('/techpanel/cache/clear', { method: 'POST' })
    } finally {
      setClearing(false)
    }
  }

  return (
    <div className="relative min-h-full overflow-hidden bg-premium-bg px-4 py-4 sm:px-8 sm:py-6">
      <div className="premium-grain" aria-hidden />
      <div className="relative mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-display text-xl font-semibold italic text-premium-text sm:text-2xl">Техпанель</h1>
        <div className="flex gap-2">
          <button
            onClick={handleClearCache}
            disabled={clearing}
            className="whitespace-nowrap rounded-lg border border-premium-border bg-premium-surface px-3 py-2 text-sm font-medium text-premium-text hover:bg-premium-surface-2 disabled:opacity-50 sm:px-4"
          >
            {clearing ? 'Сброс…' : 'Сбросить кэш'}
          </button>
          <button
            onClick={load}
            disabled={loading}
            className="whitespace-nowrap rounded-lg bg-premium-gold px-3 py-2 text-sm font-medium text-premium-bg hover:bg-premium-gold-hi disabled:opacity-50 sm:px-4"
          >
            Обновить
          </button>
        </div>
      </div>

      <div className="relative mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-premium-border bg-premium-surface px-4 py-3">
          <div className="text-xs text-premium-text/40">API</div>
          <div className={`text-lg font-semibold ${status?.api === 'ok' ? 'text-premium-sage-hi' : 'text-red-400'}`}>
            {status ? status.api : '—'}
          </div>
        </div>
        <div className="rounded-xl border border-premium-border bg-premium-surface px-4 py-3">
          <div className="text-xs text-premium-text/40">База данных</div>
          <div className={`text-lg font-semibold ${status?.db === 'ok' ? 'text-premium-sage-hi' : 'text-red-400'}`}>
            {status ? status.db : '—'}
          </div>
        </div>
        <div className="rounded-xl border border-premium-border bg-premium-surface px-4 py-3">
          <div className="text-xs text-premium-text/40">Аптайм</div>
          <div className="text-lg font-semibold text-premium-text">
            {status ? formatUptime(status.uptime_seconds) : '—'}
          </div>
        </div>
      </div>

      <h2 className="relative mb-2 text-sm font-semibold text-premium-text/70">Последние записи логов</h2>

      <div className="relative space-y-2 md:hidden">
        {loading && (
          <div className="overflow-hidden rounded-xl border border-premium-border bg-premium-surface">
            <SkeletonRows />
          </div>
        )}
        {!loading && logs.length === 0 && (
          <div className="rounded-xl border border-premium-border bg-premium-surface px-4 py-6 text-center text-sm text-premium-text/40">
            Логов пока нет.
          </div>
        )}
        {logs.map((row, i) => (
          <div key={i} className="rounded-xl border border-premium-border bg-premium-surface p-3">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className={`font-medium ${LEVEL_COLOR[row.level] ?? 'text-premium-text/60'}`}>{row.level}</span>
              <span className="shrink-0 text-premium-text/40">{formatTime(row.time)}</span>
            </div>
            <div className="mt-0.5 truncate text-xs text-premium-text/40">{row.logger}</div>
            <div className="mt-1 break-words text-sm text-premium-text">{row.message}</div>
          </div>
        ))}
      </div>

      <div className="relative hidden overflow-hidden rounded-xl border border-premium-border bg-premium-surface md:block">
        {loading && (
          <div className="p-0">
            <SkeletonRows />
          </div>
        )}
        {!loading && logs.length === 0 && (
          <div className="px-4 py-6 text-center text-sm text-premium-text/40">Логов пока нет.</div>
        )}
        {!loading && logs.length > 0 && (
          <table className="w-full table-fixed text-sm">
            <colgroup>
              <col className="w-20" />
              <col className="w-24" />
              <col className="w-48" />
              <col />
            </colgroup>
            <tbody>
              {logs.map((row, i) => (
                <tr key={i} className="border-t border-premium-border/60 first:border-t-0">
                  <td className="whitespace-nowrap px-3 py-2 align-top text-premium-text/40">{formatTime(row.time)}</td>
                  <td className={`whitespace-nowrap px-3 py-2 align-top font-medium ${LEVEL_COLOR[row.level] ?? 'text-premium-text/60'}`}>
                    {row.level}
                  </td>
                  <td className="truncate px-3 py-2 align-top text-premium-text/40" title={row.logger}>
                    {row.logger}
                  </td>
                  <td className="break-words px-3 py-2 align-top text-premium-text">{row.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
