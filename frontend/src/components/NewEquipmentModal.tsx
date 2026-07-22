import { useState, type FormEvent } from 'react'
import { apiFetch, ApiError } from '../lib/api'

export function NewEquipmentModal({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: () => void
}) {
  const [name, setName] = useState('')
  const [unit, setUnit] = useState('шт')
  const [minStock, setMinStock] = useState('')
  const [initialQty, setInitialQty] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await apiFetch('/equipment', {
        method: 'POST',
        body: JSON.stringify({
          name,
          unit,
          min_stock: minStock ? Number(minStock) : 0,
          initial_qty: initialQty ? Number(initialQty) : 0,
        }),
      })
      onCreated()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось создать инвентарь.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl bg-premium-surface p-6 shadow-2xl space-y-3"
      >
        <div className="text-lg font-semibold text-premium-text mb-2">Новый инвентарь</div>

        <div>
          <label className="block text-xs text-premium-text/60 mb-1">Название</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-premium-border bg-premium-bg px-3 py-2 text-sm text-premium-text outline-none focus:border-premium-gold"
            required
          />
        </div>

        <div>
          <label className="block text-xs text-premium-text/60 mb-1">Ед.измерения</label>
          <input
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            className="w-full rounded-lg border border-premium-border bg-premium-bg px-3 py-2 text-sm text-premium-text outline-none focus:border-premium-gold"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-premium-text/60 mb-1">Мин. остаток</label>
            <input
              type="number"
              step="any"
              value={minStock}
              onChange={(e) => setMinStock(e.target.value)}
              className="w-full rounded-lg border border-premium-border bg-premium-bg px-3 py-2 text-sm text-premium-text outline-none focus:border-premium-gold"
            />
          </div>
          <div>
            <label className="block text-xs text-premium-text/60 mb-1">Начальный остаток</label>
            <input
              type="number"
              step="any"
              value={initialQty}
              onChange={(e) => setInitialQty(e.target.value)}
              className="w-full rounded-lg border border-premium-border bg-premium-bg px-3 py-2 text-sm text-premium-text outline-none focus:border-premium-gold"
            />
          </div>
        </div>

        {error && <div className="text-sm text-red-400">{error}</div>}

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg bg-premium-surface-2 py-2 text-sm font-medium text-premium-text hover:bg-premium-border"
          >
            Отмена
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 rounded-lg bg-premium-gold py-2 text-sm font-medium text-premium-bg hover:bg-premium-gold-hi disabled:opacity-60"
          >
            {submitting ? 'Создаём…' : 'Создать'}
          </button>
        </div>
      </form>
    </div>
  )
}
