import { useState, type FormEvent } from 'react'
import { apiFetch, ApiError } from '../lib/api'

const CATEGORIES = ['сыпучее', 'жидкое', 'тара'] as const

export function NewIngredientModal({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: () => void
}) {
  const [name, setName] = useState('')
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>('сыпучее')
  const [unit, setUnit] = useState('')
  const [minStock, setMinStock] = useState('')
  const [initialQty, setInitialQty] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await apiFetch('/ingredients', {
        method: 'POST',
        body: JSON.stringify({
          name,
          category,
          unit,
          min_stock: minStock ? Number(minStock) : 0,
          initial_qty: initialQty ? Number(initialQty) : 0,
        }),
      })
      onCreated()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось создать ингредиент.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl space-y-3"
      >
        <div className="text-lg font-semibold text-ink mb-2">Новый ингредиент</div>

        <div>
          <label className="block text-xs text-ink/60 mb-1">Название</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-ink/10 px-3 py-2 text-sm outline-none focus:border-terracotta"
            required
          />
        </div>

        <div>
          <label className="block text-xs text-ink/60 mb-1">Категория</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as (typeof CATEGORIES)[number])}
            className="w-full rounded-lg border border-ink/10 px-3 py-2 text-sm outline-none focus:border-terracotta"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs text-ink/60 mb-1">Единица измерения</label>
          <input
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            placeholder="кг, л, шт"
            className="w-full rounded-lg border border-ink/10 px-3 py-2 text-sm outline-none focus:border-terracotta"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-ink/60 mb-1">Мин. остаток</label>
            <input
              type="number"
              step="any"
              value={minStock}
              onChange={(e) => setMinStock(e.target.value)}
              className="w-full rounded-lg border border-ink/10 px-3 py-2 text-sm outline-none focus:border-terracotta"
            />
          </div>
          <div>
            <label className="block text-xs text-ink/60 mb-1">Начальный остаток</label>
            <input
              type="number"
              step="any"
              value={initialQty}
              onChange={(e) => setInitialQty(e.target.value)}
              className="w-full rounded-lg border border-ink/10 px-3 py-2 text-sm outline-none focus:border-terracotta"
            />
          </div>
        </div>

        {error && <div className="text-sm text-red-600">{error}</div>}

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg bg-cream py-2 text-sm font-medium text-ink hover:bg-ink/5"
          >
            Отмена
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 rounded-lg bg-terracotta py-2 text-sm font-medium text-white hover:bg-terracotta-dark disabled:opacity-60"
          >
            {submitting ? 'Создаём…' : 'Создать'}
          </button>
        </div>
      </form>
    </div>
  )
}
