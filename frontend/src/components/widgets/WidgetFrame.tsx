import { ArrowLeftRight, ArrowUpDown, GripVertical, Minus, Move, Plus, X } from 'lucide-react'
import type { ReactNode } from 'react'

function StepButton({
  onClick,
  disabled,
  title,
  children,
}: {
  onClick: () => void
  disabled?: boolean
  title: string
  children: ReactNode
}) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      onMouseDown={(e) => e.stopPropagation()}
      disabled={disabled}
      className="rounded-full p-1 text-premium-text-muted/60 hover:bg-premium-surface-2 hover:text-premium-text disabled:pointer-events-none disabled:opacity-30"
      title={title}
    >
      {children}
    </button>
  )
}

export function WidgetFrame({
  title,
  editing,
  onRemove,
  onHeaderTap,
  selectedForMove,
  onGrow,
  onShrink,
  canShrink,
  onWiden,
  onNarrow,
  canWiden,
  canNarrow,
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
  // Резайз на мобильном (2026-07-24, запрос Александра — "неудобно смотреть" без него, потом
  // явно попросил и горизонтальные +/-) — кнопки вместо drag-resize пальцем: тач-драг
  // ненадёжен на мобильных браузерах (см. фикс перемещения виджетов в этом же коммите).
  onGrow?: () => void
  onShrink?: () => void
  canShrink?: boolean
  onWiden?: () => void
  onNarrow?: () => void
  canWiden?: boolean
  canNarrow?: boolean
  children: ReactNode
}) {
  const hasHeightControls = !!(onGrow || onShrink)
  const hasWidthControls = !!(onWiden || onNarrow)
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
        {editing && (hasHeightControls || hasWidthControls || onRemove) && (
          <div className="flex shrink-0 items-center gap-1">
            {hasWidthControls && (
              <>
                <ArrowLeftRight className="h-3 w-3 shrink-0 text-premium-text-muted/40" />
                {onNarrow && (
                  <StepButton onClick={onNarrow} disabled={canNarrow === false} title="Уменьшить ширину">
                    <Minus className="h-3.5 w-3.5" />
                  </StepButton>
                )}
                {onWiden && (
                  <StepButton onClick={onWiden} disabled={canWiden === false} title="Увеличить ширину">
                    <Plus className="h-3.5 w-3.5" />
                  </StepButton>
                )}
              </>
            )}
            {hasHeightControls && (
              <>
                <ArrowUpDown className="h-3 w-3 shrink-0 text-premium-text-muted/40" />
                {onShrink && (
                  <StepButton onClick={onShrink} disabled={canShrink === false} title="Уменьшить высоту">
                    <Minus className="h-3.5 w-3.5" />
                  </StepButton>
                )}
                {onGrow && (
                  <StepButton onClick={onGrow} title="Увеличить высоту">
                    <Plus className="h-3.5 w-3.5" />
                  </StepButton>
                )}
              </>
            )}
            {onRemove && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onRemove()
                }}
                onMouseDown={(e) => e.stopPropagation()}
                className="rounded-full p-1 text-premium-text-muted/60 hover:bg-red-500/10 hover:text-red-400"
                title="Убрать виджет"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-3">{children}</div>
    </div>
  )
}
