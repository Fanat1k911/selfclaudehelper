import { useEffect, useState } from 'react'
import GridLayout, { WidthProvider } from 'react-grid-layout/legacy'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import { apiFetch } from '../lib/api'
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

  const catalogByKey = Object.fromEntries(catalog.map((w) => [w.key, w]))

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

  function handleRglLayoutChange(rglLayout: { i: string; x: number; y: number; w: number; h: number }[]) {
    const next = rglLayout.map((l) => ({ widget_key: l.i, x: l.x, y: l.y, w: l.w, h: l.h }))
    setLayout(next)
  }

  // onDragStop/onResizeStop получают финальную раскладку первым аргументом — брать её
  // напрямую, а не читать React-state, который onLayoutChange мог ещё не успеть обновить.
  function handleDragOrResizeStop(rglLayout: { i: string; x: number; y: number; w: number; h: number }[]) {
    const next = rglLayout.map((l) => ({ widget_key: l.i, x: l.x, y: l.y, w: l.w, h: l.h }))
    setLayout(next)
    persistLayout(next)
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
    return <div className="px-4 py-4 text-ink/40 sm:px-8 sm:py-6">Загрузка…</div>
  }

  return (
    <div className="px-4 py-4 sm:px-8 sm:py-6">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-semibold text-ink sm:text-2xl">Дашборд</h1>
        <div className="flex gap-2">
          {editing && (
            <button
              onClick={() => setShowAdd(true)}
              className="whitespace-nowrap rounded-lg border border-ink/10 bg-white px-3 py-2 text-sm font-medium text-ink hover:bg-ink/5"
            >
              + Добавить виджет
            </button>
          )}
          <button
            onClick={() => setEditing((v) => !v)}
            className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium ${
              editing ? 'bg-terracotta text-white hover:bg-terracotta-dark' : 'border border-ink/10 text-ink hover:bg-ink/5'
            }`}
          >
            {editing ? 'Готово' : 'Настроить'}
          </button>
        </div>
      </div>

      {layout.length === 0 && (
        <div className="rounded-xl border border-dashed border-ink/20 py-16 text-center text-sm text-ink/40">
          Дашборд пуст. Нажми "Настроить" → "+ Добавить виджет".
        </div>
      )}

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

      {showAdd && <AddWidgetModal available={available} onAdd={handleAdd} onClose={() => setShowAdd(false)} />}
    </div>
  )
}
