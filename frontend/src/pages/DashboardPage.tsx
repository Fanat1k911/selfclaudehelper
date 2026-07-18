import { useEffect, useState } from 'react'
import GridLayout, { WidthProvider } from 'react-grid-layout/legacy'
import type { Layout } from 'react-grid-layout/legacy'
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

  // Тот же 100vh/rubber-band баг, что чинили на логине (fix(login): мобильный 100vh-баг) —
  // body по умолчанию светлый (--color-cream), Дашборд теперь тёмный. При овербаунсе
  // на iOS/Brave снизу мелькает светлый body вместо тёмного фона страницы.
  useEffect(() => {
    const prevHtml = document.documentElement.style.background
    const prevBody = document.body.style.background
    // var(...), не хардкод hex — раньше дублировал --color-premium-bg (index.css) как
    // отдельную строку, retroactive code-review 2026-07-18 поймал: смена токена в одном
    // месте молча разъезжалась бы с этим забытым вторым.
    document.documentElement.style.background = 'var(--color-premium-bg)'
    document.body.style.background = 'var(--color-premium-bg)'
    return () => {
      document.documentElement.style.background = prevHtml
      document.body.style.background = prevBody
    }
  }, [])

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
            onClick={() => setEditing((v) => !v)}
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
