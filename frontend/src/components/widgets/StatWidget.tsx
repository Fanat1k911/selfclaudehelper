import { useEffect, useRef, useState } from 'react'
import { STATUS } from '../../lib/vizColors'
import type { ComponentCostValue, DefectRateRow } from '../../types'

// Одноразовая "ignition"-вспышка на герой-числах (component_cost_value, defect_rate) при
// первом появлении данных — не на каждый ре-рендер (данные не перезапрашиваются сами по
// себе после первой загрузки, но виджет может размонтироваться/примонтироваться заново —
// снять/добавить тот же виджет обратно, drag на мобильном и т.п.). Module-scope Set
// переживает ре-монтирование конкретного компонента (в отличие от useRef) в пределах
// вкладки браузера — вспышка не повторяется для уже "зажжённого" виджета в этой сессии.
const ignitedStatWidgets = new Set<string>()

function useIgnite(key: string) {
  const [ignite, setIgnite] = useState(false)
  const firedRef = useRef(false)
  useEffect(() => {
    if (firedRef.current || ignitedStatWidgets.has(key)) return
    firedRef.current = true
    ignitedStatWidgets.add(key)
    setIgnite(true)
  }, [key])
  return ignite
}

function statusColor(pct: number) {
  if (pct < 5) return STATUS.good
  if (pct < 15) return STATUS.warning
  return STATUS.critical
}

function money(v: number) {
  return `${Math.round(v).toLocaleString('ru-RU')} ₽`
}

function ComponentCostStat({ data }: { data: ComponentCostValue }) {
  const sum = data['сумма']
  const components = data['компоненты']
  const packaging = data['тара']
  const priced = data['материалов учтено']
  const unpriced = data['материалов без цены']
  const ignite = useIgnite('component_cost_value')
  return (
    <div
      className="premium-stat flex h-full flex-col items-center justify-center gap-1.5 rounded-lg text-center"
      data-watermark={money(sum)}
    >
      <div
        className={`font-display text-4xl font-semibold italic tabular-nums text-premium-gold-hi ${ignite ? 'premium-stat-ignite' : ''}`}
      >
        {money(sum)}
      </div>
      <div className="text-xs text-premium-text-muted">заморожено в остатках</div>
      <div className="flex gap-4 text-xs text-premium-text-muted">
        <span>компоненты: {money(components)}</span>
        <span>тара: {money(packaging)}</span>
      </div>
      {unpriced > 0 && (
        <div className="text-xs text-premium-text-muted">
          {priced} из {priced + unpriced} компонентов с известной ценой
        </div>
      )}
    </div>
  )
}

// Отдельный компонент (не инлайн в StatWidget) — useIgnite вызывается безусловно на каждый
// рендер ЭТОГО компонента, а StatWidget сам делает несколько ранних return до того, как
// дошли бы до вызова хука (нарушение Rules of Hooks, если бы хук звался прямо в StatWidget).
function DefectRateStat({ rows }: { rows: DefectRateRow[] }) {
  const ignite = useIgnite('defect_rate')
  const latest = rows[rows.length - 1]
  const prev = rows.length > 1 ? rows[rows.length - 2] : null
  const delta = prev ? latest['брак_процент'] - prev['брак_процент'] : null

  return (
    <div
      className="premium-stat flex h-full flex-col items-center justify-center gap-1 rounded-lg text-center"
      data-watermark={`${latest['брак_процент']}%`}
    >
      <div
        className={`font-display text-5xl font-semibold italic tabular-nums ${ignite ? 'premium-stat-ignite' : ''}`}
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

export function StatWidget({ widgetKey, data }: { widgetKey: string; data: unknown }) {
  if (widgetKey === 'component_cost_value') {
    return <ComponentCostStat data={data as ComponentCostValue} />
  }
  if (widgetKey !== 'defect_rate') return null

  const rows = data as DefectRateRow[]
  if (rows.length === 0) {
    return <div className="flex h-full items-center justify-center text-sm text-premium-text-muted">Данных пока нет.</div>
  }

  return <DefectRateStat rows={rows} />
}
