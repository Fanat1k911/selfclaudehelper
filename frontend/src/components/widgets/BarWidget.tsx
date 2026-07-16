import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { CATEGORICAL, CHROME } from '../../lib/vizColors'
import type { DashboardSpendTopMaterial, TopCounterpartyRow, WidgetKpiRow } from '../../types'

function SingleSeriesBar({ rows, valueKey }: { rows: { name: string; value: number }[]; valueKey: string }) {
  if (rows.length === 0) {
    return <div className="flex h-full items-center justify-center text-sm text-ink/40">Данных пока нет.</div>
  }
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 24, bottom: 4, left: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={CHROME.gridline} horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 12, fill: CHROME.muted }} axisLine={{ stroke: CHROME.baseline }} />
        <YAxis
          type="category"
          dataKey="name"
          width={110}
          tick={{ fontSize: 12, fill: CHROME.textSecondary }}
          axisLine={{ stroke: CHROME.baseline }}
        />
        <Tooltip
          formatter={(v) => [v, valueKey]}
          contentStyle={{ fontSize: 12, borderColor: CHROME.gridline }}
        />
        <Bar dataKey="value" fill={CATEGORICAL[0]} radius={[0, 4, 4, 0]} maxBarSize={24} />
      </BarChart>
    </ResponsiveContainer>
  )
}

function KpiByWorkerBar({ rows }: { rows: WidgetKpiRow[] }) {
  if (rows.length === 0) {
    return <div className="flex h-full items-center justify-center text-sm text-ink/40">Данных пока нет.</div>
  }
  const months = Array.from(new Set(rows.map((r) => r['месяц']))).sort()
  const workers = Array.from(new Set(rows.map((r) => r['ФИО'])))
  const chartData = months.map((month) => {
    const point: Record<string, string | number> = { month }
    for (const worker of workers) {
      const row = rows.find((r) => r['месяц'] === month && r['ФИО'] === worker)
      point[worker] = row ? row['произведено'] : 0
    }
    return point
  })

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={chartData} margin={{ top: 4, right: 8, bottom: 4, left: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={CHROME.gridline} vertical={false} />
        <XAxis dataKey="month" tick={{ fontSize: 12, fill: CHROME.muted }} axisLine={{ stroke: CHROME.baseline }} />
        <YAxis tick={{ fontSize: 12, fill: CHROME.muted }} axisLine={{ stroke: CHROME.baseline }} />
        <Tooltip contentStyle={{ fontSize: 12, borderColor: CHROME.gridline }} />
        {workers.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
        {workers.map((worker, i) => (
          <Bar key={worker} dataKey={worker} fill={CATEGORICAL[i % CATEGORICAL.length]} radius={[4, 4, 0, 0]} maxBarSize={28} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}

export function BarWidget({ widgetKey, data }: { widgetKey: string; data: unknown }) {
  if (widgetKey === 'kpi_by_worker') return <KpiByWorkerBar rows={data as WidgetKpiRow[]} />
  if (widgetKey === 'top_expense_materials') {
    const rows = (data as DashboardSpendTopMaterial[]).map((r) => ({ name: r['название'], value: r['сумма'] }))
    return <SingleSeriesBar rows={rows} valueKey="Сумма, ₽" />
  }
  if (widgetKey === 'top_counterparties') {
    const rows = (data as TopCounterpartyRow[]).map((r) => ({ name: r['название'], value: r['выручка'] }))
    return <SingleSeriesBar rows={rows} valueKey="Выручка, ₽" />
  }
  return null
}
