import { useEffect, useRef, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { CATEGORICAL_DARK as CATEGORICAL, CHROME_DARK as CHROME } from '../../lib/vizColors'
import type { DashboardSpendTopMaterial, TopCounterpartyRow, WidgetKpiRow } from '../../types'

// ~6.5px на символ при fontSize 11 для кириллицы — грубая, но достаточная оценка
// для переноса строк без замера реального текста (Canvas measureText — overkill
// для подписи оси). Если ошибаемся на пару символов, второй строки/многоточия
// достаточно, чтобы не наехать на бар.
const AVG_CHAR_WIDTH_PX = 6.5
const AXIS_LABEL_PADDING_PX = 8

// Название на 2 строки вместо одной обрезанной (2026-07-20, повторный запрос
// Александра — обрезка в одну строку всё ещё нечитаема). Перенос по словам, если
// получится; если единственное слово не влезает даже в одну строку — режем его.
function wrapLabel(text: string, maxCharsPerLine: number): [string, string] {
  if (maxCharsPerLine < 1) return [text, '']
  if (text.length <= maxCharsPerLine) return [text, '']

  const words = text.split(' ')
  let line1 = ''
  let i = 0
  for (; i < words.length; i++) {
    const candidate = line1 ? `${line1} ${words[i]}` : words[i]
    if (candidate.length > maxCharsPerLine) break
    line1 = candidate
  }

  if (!line1) {
    // Первое слово само по себе длиннее лимита строки.
    const rest = text.slice(maxCharsPerLine)
    const line2 = rest.length > maxCharsPerLine ? `${rest.slice(0, maxCharsPerLine - 1)}…` : rest
    return [text.slice(0, maxCharsPerLine), line2]
  }

  let line2 = words.slice(i).join(' ')
  if (line2.length > maxCharsPerLine) line2 = `${line2.slice(0, maxCharsPerLine - 1)}…`
  return [line1, line2]
}

// Ниже этой ширины колонки под подпись — 2 строки уже не помещаются по высоте
// строки графика на тесных мобильных виджетах (2026-07-20, повторный репорт
// Александра со скриншотом мобильной версии — строки наезжали друг на друга).
// На узких экранах уходим на 1 строку помельче шрифтом — влезает, и по тексту
// всё ещё понятно, что за компонент, а не 2 строки покрупнее, которые не влезают.
const NARROW_AXIS_WIDTH_PX = 90

// Recharts не переносит и не обрезает длинные category-подписи сами по себе —
// без этого длинные названия материалов из номенклатуры (2026-07-19) стопкой
// наезжают друг на друга по вертикали. Полное имя всё ещё видно в tooltip при
// наведении (Recharts подставляет его туда как label автоматически).
function WrappedYAxisTick({
  x,
  y,
  payload,
  axisWidth,
}: {
  x: string | number
  y: string | number
  payload: { value: string }
  axisWidth: number
}) {
  const narrow = axisWidth < NARROW_AXIS_WIDTH_PX
  const fontSize = narrow ? 9 : 11
  const avgCharWidth = narrow ? 5 : AVG_CHAR_WIDTH_PX
  const maxChars = Math.max(1, Math.floor((axisWidth - AXIS_LABEL_PADDING_PX) / avgCharWidth))

  if (narrow) {
    const oneLine = payload.value.length > maxChars ? `${payload.value.slice(0, maxChars - 1)}…` : payload.value
    return (
      <text x={x} y={y} dy={3} textAnchor="end" fontSize={fontSize} fill={CHROME.textSecondary}>
        {oneLine}
      </text>
    )
  }

  const [line1, line2] = wrapLabel(payload.value, maxChars)
  return (
    <text x={x} y={y} textAnchor="end" fontSize={fontSize} fill={CHROME.textSecondary}>
      <tspan x={x} dy={line2 ? -3 : 4}>
        {line1}
      </tspan>
      {line2 && (
        <tspan x={x} dy={13}>
          {line2}
        </tspan>
      )}
    </text>
  )
}

// Только цена, без названия компонента (2026-07-20, повторный репорт Александра —
// длинное название в тултипе раздувало его вширь настолько, что у карточки виджета
// на дашборде появлялся горизонтальный скролл при наведении). Строка и так
// подсвечивается родным курсором Recharts — имя тут не нужно, только цена.
function ValueOnlyTooltip({ active, payload, valueKey }: { active?: boolean; payload?: { value: number }[]; valueKey: string }) {
  if (!active || !payload || payload.length === 0) return null
  return (
    <div
      style={{
        fontSize: 12,
        background: CHROME.surface,
        border: `1px solid ${CHROME.gridline}`,
        color: CHROME.textPrimary,
        padding: '4px 8px',
        borderRadius: 4,
      }}
    >
      {payload[0].value} {valueKey}
    </div>
  )
}

function SingleSeriesBar({ rows, valueKey }: { rows: { name: string; value: number }[]; valueKey: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(400)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    // Дебаунс (2026-07-20, репорт Александра — "появляется какой-то скролл, не могу
    // остановиться") — react-grid-layout на дашборде делает несколько проходов
    // раскладки сразу после монтирования, каждый чуть меняет ширину контейнера
    // виджета. Без дебаунса каждый проход тут же перерендеривал график с новой
    // axisWidth, а это ЕЩЁ немного меняло геометрию — несколько дребезжащих
    // реframe подряд выглядели как самопроизвольный скролл/дёрганье страницы.
    // Ждём, пока размер не перестанет меняться 150мс, и коммитим один раз.
    let timeoutId: ReturnType<typeof setTimeout> | null = null
    const update = () => {
      if (timeoutId) clearTimeout(timeoutId)
      timeoutId = setTimeout(() => setContainerWidth(el.clientWidth), 600)
    }
    setContainerWidth(el.clientWidth)
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => {
      if (timeoutId) clearTimeout(timeoutId)
      ro.disconnect()
    }
  }, [])

  if (rows.length === 0) {
    return <div className="flex h-full items-center justify-center text-sm text-premium-text-muted">Данных пока нет.</div>
  }

  // Запись компонента (название) — четверть ширины виджета, как просил Александр.
  // На тесных мобильных карточках четверти не хватает даже на однострочную
  // читаемую обрезку ("Флак…" ни о чём не говорит) — там отдаём под подпись
  // больше места (40%), бары всё равно вторичны при таком узком виджете.
  const isMobileNarrow = containerWidth < 260
  const axisWidth = Math.round(containerWidth * (isMobileNarrow ? 0.4 : 0.25))

  return (
    <div ref={containerRef} className="h-full w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 24, bottom: 4, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={CHROME.gridline} horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 12, fill: CHROME.muted }} axisLine={{ stroke: CHROME.baseline }} />
          <YAxis
            type="category"
            dataKey="name"
            width={axisWidth}
            tick={(props) => <WrappedYAxisTick {...props} axisWidth={axisWidth} />}
            axisLine={{ stroke: CHROME.baseline }}
          />
          <Tooltip content={<ValueOnlyTooltip valueKey={valueKey} />} />
          <Bar dataKey="value" fill={CATEGORICAL[0]} radius={[0, 4, 4, 0]} maxBarSize={24} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function KpiByWorkerBar({ rows }: { rows: WidgetKpiRow[] }) {
  if (rows.length === 0) {
    return <div className="flex h-full items-center justify-center text-sm text-premium-text-muted">Данных пока нет.</div>
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
        <Tooltip
          contentStyle={{ fontSize: 12, background: CHROME.surface, borderColor: CHROME.gridline, color: CHROME.textPrimary }}
          labelStyle={{ color: CHROME.textPrimary }}
        />
        {workers.length > 1 && <Legend wrapperStyle={{ fontSize: 12, color: CHROME.textSecondary }} />}
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
