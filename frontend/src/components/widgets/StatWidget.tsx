import { STATUS } from '../../lib/vizColors'
import type { DefectRateRow } from '../../types'

function statusColor(pct: number) {
  if (pct < 5) return STATUS.good
  if (pct < 15) return STATUS.warning
  return STATUS.critical
}

export function StatWidget({ widgetKey, data }: { widgetKey: string; data: unknown }) {
  if (widgetKey !== 'defect_rate') return null

  const rows = data as DefectRateRow[]
  if (rows.length === 0) {
    return <div className="flex h-full items-center justify-center text-sm text-premium-text-muted">Данных пока нет.</div>
  }

  const latest = rows[rows.length - 1]
  const prev = rows.length > 1 ? rows[rows.length - 2] : null
  const delta = prev ? latest['брак_процент'] - prev['брак_процент'] : null

  return (
    <div
      className="premium-stat flex h-full flex-col items-center justify-center gap-1 rounded-lg text-center"
      data-watermark={`${latest['брак_процент']}%`}
    >
      <div
        className="font-display text-5xl font-semibold italic tabular-nums"
        style={{ color: statusColor(latest['брак_процент']) }}
      >
        {latest['брак_процент']}%
      </div>
      <div className="text-xs text-premium-text-muted">{latest['месяц']}, брак от выпуска</div>
      {delta !== null && (
        <div className={`text-xs font-medium ${delta <= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
          {delta > 0 ? '+' : ''}
          {delta.toFixed(1)} п.п. к прошлому месяцу
        </div>
      )}
    </div>
  )
}
