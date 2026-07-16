import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { CATEGORICAL, CHROME } from '../../lib/vizColors'
import type { StockByCategoryRow } from '../../types'

export function DonutWidget({ widgetKey, data }: { widgetKey: string; data: unknown }) {
  if (widgetKey !== 'stock_by_category') return null

  const rows = data as StockByCategoryRow[]
  if (rows.length === 0 || rows.every((r) => r['остаток'] === 0)) {
    return <div className="flex h-full items-center justify-center text-sm text-ink/40">Данных пока нет.</div>
  }

  const chartData = rows.map((r) => ({ name: r['категория'], value: r['остаток'] }))

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie data={chartData} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="80%" paddingAngle={2}>
          {chartData.map((_, i) => (
            <Cell key={i} fill={CATEGORICAL[i % CATEGORICAL.length]} stroke={CHROME.surface} strokeWidth={2} />
          ))}
        </Pie>
        <Tooltip contentStyle={{ fontSize: 12, borderColor: CHROME.gridline }} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  )
}
