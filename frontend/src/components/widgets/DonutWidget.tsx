import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { CATEGORICAL_DARK as CATEGORICAL, CHROME_DARK as CHROME } from '../../lib/vizColors'
import type { StockByCategoryRow } from '../../types'

// См. тот же helper в BarWidget.tsx/LineWidget.tsx — не общий импорт специально, три
// независимых виджет-файла с одной строкой не стоят лишнего shared-модуля.
function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function DonutWidget({ widgetKey, data }: { widgetKey: string; data: unknown }) {
  if (widgetKey !== 'stock_by_category') return null

  const rows = data as StockByCategoryRow[]
  if (rows.length === 0 || rows.every((r) => r['остаток'] === 0)) {
    return <div className="flex h-full items-center justify-center text-sm text-premium-text-muted">Данных пока нет.</div>
  }

  const chartData = rows.map((r) => ({ name: r['категория'], value: r['остаток'] }))
  const reduced = prefersReducedMotion()

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={chartData}
          dataKey="value"
          nameKey="name"
          innerRadius="55%"
          outerRadius="80%"
          paddingAngle={2}
          isAnimationActive={!reduced}
          animationDuration={800}
          animationEasing="ease-out"
        >
          {chartData.map((_, i) => (
            <Cell key={i} fill={CATEGORICAL[i % CATEGORICAL.length]} stroke={CHROME.surface} strokeWidth={2} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{ fontSize: 12, background: CHROME.surface, borderColor: CHROME.gridline, color: CHROME.textPrimary }}
          labelStyle={{ color: CHROME.textPrimary }}
        />
        <Legend wrapperStyle={{ fontSize: 12, color: CHROME.textSecondary }} />
      </PieChart>
    </ResponsiveContainer>
  )
}
