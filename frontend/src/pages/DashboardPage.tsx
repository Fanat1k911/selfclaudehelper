import { useEffect, useRef, useState } from 'react'
import GridLayout, { WidthProvider } from 'react-grid-layout/legacy'
import type { Layout } from 'react-grid-layout/legacy'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import { apiFetch } from '../lib/api'
import { usePremiumBackground } from '../lib/usePremiumBackground'
import { useIsMobile } from '../lib/useIsMobile'
import type { WidgetCatalogItem, WidgetLayoutItem } from '../types'
import { AddWidgetModal } from '../components/widgets/AddWidgetModal'
import { WidgetFrame } from '../components/widgets/WidgetFrame'
import { WidgetRenderer } from '../components/widgets/WidgetRenderer'

const ReactGridLayout = WidthProvider(GridLayout)
const COLS = 12
const ROW_HEIGHT = 36

export function DashboardPage() {
  const [catalog, setCatalog] = useState<WidgetCatalogItem[]>([])
  const [layout, setLayout] = useState<WidgetLayoutItem[]>([])
  const [widgetData, setWidgetData] = useState<Record<string, unknown>>({})
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [selectedForMove, setSelectedForMove] = useState<string | null>(null)
  const lastTapRef = useRef<{ key: string; time: number } | null>(null)

  const catalogByKey = Object.fromEntries(catalog.map((w) => [w.key, w]))

  usePremiumBackground()
  const isMobile = useIsMobile()

  async function loadWidgetData(key: string) {
    const data = await apiFetch(`/dashboard/widgets/${key}/data`)
    setWidgetData((prev) => ({ ...prev, [key]: data }))
  }

  useEffect(() => {
    Promise.all([
      apiFetch<WidgetCatalogItem[]>('/dashboard/widgets/catalog'),
      apiFetch<WidgetLayoutItem[]>('/dashboard/widgets/layout'),
    ])
      .then(async ([catalogRes, layoutRes]) => {
        setCatalog(catalogRes)
        setLayout(layoutRes)
        await Promise.all(layoutRes.map((item) => loadWidgetData(item.widget_key)))
      })
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function persistLayout(next: WidgetLayoutItem[]) {
    apiFetch('/dashboard/widgets/layout', { method: 'PUT', body: JSON.stringify(next) })
  }

  function handleRglLayoutChange(rglLayout: Layout) {
    const next = rglLayout.map((l) => ({ widget_key: l.i, x: l.x, y: l.y, w: l.w, h: l.h }))
    setLayout(next)
  }

  // onDragStop/onResizeStop получают финальную раскладку первым аргументом — брать её
  // напрямую, а не читать React-state, который onLayoutChange мог ещё не успеть обновить.
  function handleDragOrResizeStop(rglLayout: Layout) {
    const next = rglLayout.map((l) => ({ widget_key: l.i, x: l.x, y: l.y, w: l.w, h: l.h }))
    setLayout(next)
    persistLayout(next)
  }

  // Двойной тап по виджету "берёт" его (см. WidgetFrame), одиночный тап по другому виджету
  // меняет их местами — свап x/y (позиция в мобильном стеке сортируется по ним) между двумя
  // записями layout, widget_key/w/h каждой НЕ трогаем. Раньше свапался widget_key при чужих
  // x/y/w/h — виджет физически принимал размер чужого слота (репорт Александра, 2026-07-24).
  function handleWidgetHeaderTap(key: string) {
    const now = Date.now()
    const last = lastTapRef.current
    const isDoubleTap = !!last && last.key === key && now - last.time < 400

    if (isDoubleTap) {
      lastTapRef.current = null
      setSelectedForMove((prev) => (prev === key ? null : key))
      return
    }
    lastTapRef.current = { key, time: now }

    if (selectedForMove && selectedForMove !== key) {
      const a = layout.find((l) => l.widget_key === selectedForMove)
      const b = layout.find((l) => l.widget_key === key)
      if (!a || !b) return
      const next = layout.map((l) => {
        if (l.widget_key === selectedForMove) return { ...l, x: b.x, y: b.y }
        if (l.widget_key === key) return { ...l, x: a.x, y: a.y }
        return l
      })
      setLayout(next)
      persistLayout(next)
      setSelectedForMove(null)
      lastTapRef.current = null
    }
  }

  function handleRemove(key: string) {
    const next = layout.filter((l) => l.widget_key !== key)
    setLayout(next)
    persistLayout(next)
  }

  function handleAdd(widget: WidgetCatalogItem) {
    const maxY = layout.reduce((max, l) => Math.max(max, l.y + l.h), 0)
    const next = [...layout, { widget_key: widget.key, x: 0, y: maxY, w: widget.w, h: widget.h }]
    setLayout(next)
    persistLayout(next)
    setShowAdd(false)
    loadWidgetData(widget.key)
  }

  const available = catalog.filter((w) => !layout.some((l) => l.widget_key === w.key))

  if (loading) {
    return (
      <div className="min-h-full bg-premium-bg px-4 py-4 text-premium-text-muted sm:px-8 sm:py-6">Загрузка…</div>
    )
  }

  return (
    <div className="relative min-h-full overflow-hidden bg-premium-bg px-4 py-4 sm:px-8 sm:py-6">
      <div className="premium-grain" aria-hidden />
      <div className="relative mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-display text-2xl font-semibold italic text-premium-text sm:text-3xl">
          Дашборд
        </h1>
        <div className="flex gap-2">
          {editing && (
            <button
              onClick={() => setShowAdd(true)}
              className="whitespace-nowrap rounded-lg border border-premium-border bg-premium-surface px-3 py-2 text-sm font-medium text-premium-text hover:bg-premium-surface-2"
            >
              + Добавить виджет
            </button>
          )}
          <button
            onClick={() => {
              setEditing((v) => !v)
              setSelectedForMove(null)
            }}
            className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              editing
                ? 'bg-premium-gold text-premium-bg hover:bg-premium-gold-hi'
                : 'border border-premium-border text-premium-text hover:bg-premium-surface-2'
            }`}
          >
            {editing ? 'Готово' : 'Настроить'}
          </button>
        </div>
      </div>

      {layout.length === 0 && (
        <div className="relative rounded-xl border border-dashed border-premium-border py-16 text-center text-sm text-premium-text-muted">
          Дашборд пуст. Нажми "Настроить" → "+ Добавить виджет".
        </div>
      )}

      {isMobile ? (
        // Мобильный вид (2026-07-23, репорт Александра) — отдельный от десктопной сетки:
        // react-grid-layout считает ширину колонки от viewport, на телефоне это давало
        // ~30px/колонку и обрезанные в один символ заголовки виджетов. Вместо попытки
        // ужать grid — просто стек full-width карточек в порядке y (drag/resize на тач-экране
        // всё равно неудобны), высота каждой берётся из той же h-величины, что и на десктопе,
        // чтобы графики (recharts ResponsiveContainer) не схлопывались без заданной высоты.
        <div className="relative space-y-3">
          {editing && selectedForMove && (
            <div className="rounded-lg border border-premium-gold bg-premium-gold/10 px-3 py-2 text-sm text-premium-gold">
              Виджет выбран — нажми на другой, чтобы поменять местами.
            </div>
          )}
          {[...layout]
            .sort((a, b) => a.y - b.y || a.x - b.x)
            .map((l) => {
              const widget = catalogByKey[l.widget_key]
              if (!widget) return null
              const height = Math.max(widget.min_h ?? 2, l.h) * ROW_HEIGHT
              return (
                <div key={l.widget_key} style={{ height }}>
                  <WidgetFrame
                    title={widget.title}
                    editing={editing}
                    onRemove={() => handleRemove(l.widget_key)}
                    onHeaderTap={editing ? () => handleWidgetHeaderTap(l.widget_key) : undefined}
                    selectedForMove={selectedForMove === l.widget_key}
                  >
                    <WidgetRenderer widget={widget} data={widgetData[l.widget_key]} />
                  </WidgetFrame>
                </div>
              )
            })}
        </div>
      ) : (
        <ReactGridLayout
          className="layout"
          cols={COLS}
          rowHeight={ROW_HEIGHT}
          layout={layout.map((l) => {
            const widget = catalogByKey[l.widget_key]
            return { i: l.widget_key, x: l.x, y: l.y, w: l.w, h: l.h, minW: widget?.min_w ?? 2, minH: widget?.min_h ?? 2 }
          })}
          onLayoutChange={handleRglLayoutChange}
          onDragStop={handleDragOrResizeStop}
          onResizeStop={handleDragOrResizeStop}
          isDraggable={editing}
          isResizable={editing}
          draggableHandle=".widget-drag-handle"
          compactType="vertical"
          margin={[12, 12]}
        >
          {layout.map((l) => {
            const widget = catalogByKey[l.widget_key]
            if (!widget) return null
            return (
              <div key={l.widget_key}>
                <WidgetFrame title={widget.title} editing={editing} onRemove={() => handleRemove(l.widget_key)}>
                  <WidgetRenderer widget={widget} data={widgetData[l.widget_key]} />
                </WidgetFrame>
              </div>
            )
          })}
        </ReactGridLayout>
      )}

      {showAdd && <AddWidgetModal available={available} onAdd={handleAdd} onClose={() => setShowAdd(false)} />}
    </div>
  )
}
