import { GripVertical, X } from 'lucide-react'
import type { ReactNode } from 'react'

export function WidgetFrame({
  title,
  editing,
  onRemove,
  children,
}: {
  title: string
  editing: boolean
  onRemove?: () => void
  children: ReactNode
}) {
  return (
    <div className="premium-card flex h-full flex-col overflow-hidden rounded-xl border border-premium-border bg-premium-surface shadow-sm">
      <div className="widget-drag-handle flex shrink-0 items-center justify-between gap-2 border-b border-premium-border px-3 py-2">
        <div className="flex min-w-0 items-center gap-1.5">
          {editing && <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-premium-text-muted/60" />}
          <span className="truncate text-sm font-medium text-premium-text-muted">{title}</span>
        </div>
        {editing && onRemove && (
          <button
            onClick={onRemove}
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
