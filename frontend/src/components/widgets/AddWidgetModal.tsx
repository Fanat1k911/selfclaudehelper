import type { WidgetCatalogItem } from '../../types'

export function AddWidgetModal({
  available,
  onAdd,
  onClose,
}: {
  available: WidgetCatalogItem[]
  onAdd: (widget: WidgetCatalogItem) => void
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={onClose}>
      <div
        className="max-h-[80vh] w-full max-w-md overflow-auto rounded-xl border border-premium-border bg-premium-surface p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-3 text-base font-semibold text-premium-text">Добавить виджет</h2>
        {available.length === 0 ? (
          <div className="py-6 text-center text-sm text-premium-text-muted">Все виджеты уже на дашборде.</div>
        ) : (
          <ul className="space-y-1.5">
            {available.map((w) => (
              <li key={w.key}>
                <button
                  onClick={() => onAdd(w)}
                  className="w-full rounded-lg border border-premium-border px-3 py-2.5 text-left text-sm text-premium-text hover:bg-premium-surface-2"
                >
                  {w.title}
                </button>
              </li>
            ))}
          </ul>
        )}
        <button
          onClick={onClose}
          className="mt-4 w-full rounded-lg border border-premium-border px-3 py-2 text-sm font-medium text-premium-text-muted hover:bg-premium-surface-2"
        >
          Закрыть
        </button>
      </div>
    </div>
  )
}
