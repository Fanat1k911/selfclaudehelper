import { useEffect, useState } from 'react'
import { apiFetch } from '../lib/api'
import { usePremiumBackground } from '../lib/usePremiumBackground'
import { SkeletonRows } from '../components/SkeletonRows'
import type { FeedbackEntry, TechLogEntry, TechStatus } from '../types'

const FEEDBACK_STATUSES = ['новое', 'просмотрено', 'решено']
const FEEDBACK_STATUS_COLOR: Record<string, string> = {
  'новое': 'text-amber-500',
  'просмотрено': 'text-premium-text/60',
  'решено': 'text-premium-sage-hi',
}

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
  const [feedback, setFeedback] = useState<FeedbackEntry[]>([])
  const [viewingImage, setViewingImage] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [clearing, setClearing] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const [statusData, logsData, feedbackData] = await Promise.all([
        apiFetch<TechStatus>('/techpanel/status'),
        apiFetch<TechLogEntry[]>('/techpanel/logs'),
        apiFetch<FeedbackEntry[]>('/feedback'),
      ])
      setStatus(statusData)
      setLogs(logsData)
      setFeedback(feedbackData)
    } finally {
      setLoading(false)
    }
  }

  async function updateFeedbackStatus(id: string, newStatus: string) {
    await apiFetch(`/feedback/${id}`, { method: 'PATCH', body: JSON.stringify({ status: newStatus }) })
    setFeedback((prev) => prev.map((f) => (f.id === id ? { ...f, 'статус': newStatus } : f)))
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
            className="btn-shine transition-transform whitespace-nowrap rounded-lg bg-premium-gold px-3 py-2 text-sm font-medium text-premium-bg hover:bg-premium-gold-hi disabled:opacity-50 sm:px-4"
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
          <div
            key={i}
            style={{ animationDelay: `${Math.min(i, 12) * 35}ms` }}
            className="premium-row-enter rounded-xl border border-premium-border bg-premium-surface p-3"
          >
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
                <tr
                  key={i}
                  style={{ animationDelay: `${Math.min(i, 12) * 35}ms` }}
                  className="premium-row-enter relative border-t border-premium-border/60 first:border-t-0"
                >
                  <td className="relative whitespace-nowrap px-3 py-2 align-top text-premium-text/40">
                    <span className="premium-row-bar" aria-hidden />
                    {formatTime(row.time)}
                  </td>
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

      <h2 className="relative mb-2 mt-6 text-sm font-semibold text-premium-text/70">Обратная связь</h2>

      <div className="relative space-y-3">
        {!loading && feedback.length === 0 && (
          <div className="rounded-xl border border-premium-border bg-premium-surface px-4 py-6 text-center text-sm text-premium-text/40">
            Сообщений пока нет.
          </div>
        )}
        {feedback.map((f, i) => (
          <div
            key={f.id}
            style={{ animationDelay: `${Math.min(i, 12) * 35}ms` }}
            className="premium-row-enter rounded-xl border border-premium-border bg-premium-surface p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-medium text-premium-text">
                {f['автор']} <span className="text-premium-text/40">({f['роль автора']})</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-premium-text/40">{f['дата']}</span>
                <select
                  value={f['статус']}
                  onChange={(e) => updateFeedbackStatus(f.id, e.target.value)}
                  className={`rounded-lg border border-premium-border bg-premium-bg px-2 py-1 text-xs font-medium outline-none focus:border-premium-gold ${
                    FEEDBACK_STATUS_COLOR[f['статус']] ?? 'text-premium-text'
                  }`}
                >
                  {FEEDBACK_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-2 whitespace-pre-wrap break-words text-sm text-premium-text/80">{f['сообщение']}</div>
            {f['вложения'].length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {f['вложения'].map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => setViewingImage(a['изображение'])}
                    className="h-20 w-20 overflow-hidden rounded-lg border border-premium-border"
                  >
                    <img src={a['изображение']} alt={a['имя файла'] ?? ''} className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {viewingImage && (
        <div
          className="backdrop-fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setViewingImage(null)}
        >
          <img
            src={viewingImage}
            alt=""
            className="modal-pop-in max-h-full max-w-full rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  )
}
