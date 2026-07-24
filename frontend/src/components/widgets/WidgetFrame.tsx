import { GripVertical, Move, X } from 'lucide-react'
import type { ReactNode } from 'react'

export function WidgetFrame({
  title,
  editing,
  onRemove,
  onHeaderTap,
  selectedForMove,
  children,
}: {
  title: string
  editing: boolean
  onRemove?: () => void
  // Тач-перемещение виджетов на мобильном (2026-07-24, запрос Александра) — двойной тап
  // по заголовку выбирает виджет ("взял"), одиночный тап по другому виджету меняет их
  // местами. Отдельный путь от desktop drag (react-grid-layout) — на мобильном грид вообще
  // не рендерится, см. DashboardPage.tsx::isMobile ветку, там же и живёт вся эта логика.
  onHeaderTap?: () => void
  selectedForMove?: boolean
  children: ReactNode
}) {
  return (
    <div
      className={`premium-card flex h-full flex-col overflow-hidden rounded-xl border bg-premium-surface shadow-sm transition-colors ${
        selectedForMove ? 'border-premium-gold ring-2 ring-premium-gold' : 'border-premium-border'
      }`}
    >
      <div
        className="widget-drag-handle flex shrink-0 select-none items-center justify-between gap-2 border-b border-premium-border px-3 py-2"
        style={editing ? { touchAction: 'none' } : undefined}
        onClick={onHeaderTap}
      >
        <div className="flex min-w-0 items-center gap-1.5">
          {editing && onHeaderTap && (
            <Move className={`h-4 w-4 shrink-0 ${selectedForMove ? 'text-premium-gold' : 'text-premium-text-muted/60'}`} />
          )}
          {editing && !onHeaderTap && <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-premium-text-muted/60" />}
          <span className="truncate text-sm font-medium text-premium-text-muted">{title}</span>
        </div>
        {editing && onRemove && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onRemove()
            }}
            onMouseDown={(e) => e.stopPropagation()}
            className="shrink-0 rounded-full p-1 text-premium-text-muted/60 hover:bg-red-500/10 hover:text-red-400"
            title="Убрать виджет"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-3">{children}</div>
    </div>
  )
}
