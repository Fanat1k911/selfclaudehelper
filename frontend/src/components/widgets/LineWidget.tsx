import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { CHROME_DARK as CHROME, SEQUENTIAL_BLUE } from '../../lib/vizColors'
import type { DashboardSpendMonth, MonthlyRevenueRow } from '../../types'

export function LineWidget({ widgetKey, data }: { widgetKey: string; data: unknown }) {
  let rows: { x: string; value: number }[] = []
  let label = ''

  if (widgetKey === 'monthly_spend') {
    rows = (data as DashboardSpendMonth[]).map((r) => ({ x: r['месяц'], value: r['сумма'] }))
    label = 'Траты, ₽'
  } else if (widgetKey === 'monthly_revenue') {
    rows = (data as MonthlyRevenueRow[]).map((r) => ({ x: r['месяц'], value: r['выручка'] }))
    label = 'Выручка, ₽'
  }

  if (rows.length === 0) {
    return <div className="flex h-full items-center justify-center text-sm text-premium-text-muted">Данных пока нет.</div>
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={rows} margin={{ top: 8, right: 16, bottom: 4, left: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={CHROME.gridline} vertical={false} />
        <XAxis dataKey="x" tick={{ fontSize: 12, fill: CHROME.muted }} axisLine={{ stroke: CHROME.baseline }} />
        <YAxis tick={{ fontSize: 12, fill: CHROME.muted }} axisLine={{ stroke: CHROME.baseline }} />
        <Tooltip
          formatter={(v) => [v, label]}
          contentStyle={{ fontSize: 12, background: CHROME.surface, borderColor: CHROME.gridline, color: CHROME.textPrimary }}
          labelStyle={{ color: CHROME.textPrimary }}
        />
        <Line
          type="monotone"
          dataKey="value"
          stroke={SEQUENTIAL_BLUE}
          strokeWidth={2}
          dot={{ r: 4, fill: SEQUENTIAL_BLUE }}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
