import { useState, type FormEvent } from 'react'
import { Trash2 } from 'lucide-react'
import { apiFetch, ApiError } from '../lib/api'
import type { Ingredient } from '../types'

interface Row {
  materialId: string
  qty: string
  price: string
}

export function BatchIncomeModal({
  ingredients,
  onClose,
  onCreated,
}: {
  ingredients: Ingredient[]
  onClose: () => void
  onCreated: () => void
}) {
  const [rows, setRows] = useState<Row[]>([{ materialId: ingredients[0]?.id ?? '', qty: '', price: '' }])
  const [transportCost, setTransportCost] = useState('')
  const [comment, setComment] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  function updateRow(i: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  }

  function addRow() {
    const used = new Set(rows.map((r) => r.materialId))
    const next = ingredients.find((i) => !used.has(i.id))
    setRows((prev) => [...prev, { materialId: next?.id ?? ingredients[0]?.id ?? '', qty: '', price: '' }])
  }

  function removeRow(i: number) {
    setRows((prev) => prev.filter((_, idx) => idx !== i))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await apiFetch('/ingredients/income/batch', {
        method: 'POST',
        body: JSON.stringify({
          items: rows.map((r) => ({
            material_id: r.materialId,
            qty: Number(r.qty),
            price: r.price ? Number(r.price) : undefined,
          })),
          transport_cost: transportCost ? Number(transportCost) : 0,
          comment,
        }),
      })
      onCreated()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось сохранить поставку.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-lg max-h-[90vh] flex-col rounded-2xl bg-white shadow-2xl"
      >
        <div className="px-6 py-5 border-b border-ink/10">
          <div className="text-lg font-semibold text-ink">Групповой приход (поставка)</div>
          <div className="mt-1 text-xs text-ink/50">
            Несколько материалов одной поставкой — транспортные расходы разделятся между ними по весу.
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {rows.map((row, i) => (
            <div key={i} className="flex items-end gap-2">
              <div className="flex-1 min-w-0">
                <label className="block text-xs text-ink/60 mb-1">Материал</label>
                <select
                  value={row.materialId}
                  onChange={(e) => updateRow(i, { materialId: e.target.value })}
                  className="w-full rounded-lg border border-ink/10 px-3 py-2 text-sm outline-none focus:border-terracotta"
                  required
                >
                  {ingredients.map((ing) => (
                    <option key={ing.id} value={ing.id}>
                      {ing['название']}
                    </option>
                  ))}
                </select>
              </div>
              <div className="w-20">
                <label className="block text-xs text-ink/60 mb-1">Кол-во</label>
                <input
                  type="number" step="any" required
                  value={row.qty}
                  onChange={(e) => updateRow(i, { qty: e.target.value })}
                  className="w-full rounded-lg border border-ink/10 px-3 py-2 text-sm outline-none focus:border-terracotta"
                />
              </div>
              <div className="w-24">
                <label className="block text-xs text-ink/60 mb-1">Цена/ед.</label>
                <input
                  type="number" step="any"
                  value={row.price}
                  onChange={(e) => updateRow(i, { price: e.target.value })}
                  className="w-full rounded-lg border border-ink/10 px-3 py-2 text-sm outline-none focus:border-terracotta"
                />
              </div>
              <button
                type="button"
                onClick={() => removeRow(i)}
                disabled={rows.length === 1}
                className="mb-0.5 shrink-0 rounded-lg p-2 text-ink/40 hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}

          <button
            type="button"
            onClick={addRow}
            disabled={rows.length >= ingredients.length}
            className="text-sm font-medium text-terracotta hover:text-terracotta-dark disabled:opacity-40"
          >
            + добавить материал
          </button>

          <div className="pt-2 border-t border-ink/10">
            <label className="block text-xs text-ink/60 mb-1">Транспортные расходы за всю поставку (₽, необязательно)</label>
            <input
              type="number" step="any"
              value={transportCost}
              onChange={(e) => setTransportCost(e.target.value)}
              className="w-full rounded-lg border border-ink/10 px-3 py-2 text-sm outline-none focus:border-terracotta"
            />
          </div>

          <div>
            <label className="block text-xs text-ink/60 mb-1">Комментарий</label>
            <input
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="w-full rounded-lg border border-ink/10 px-3 py-2 text-sm outline-none focus:border-terracotta"
            />
          </div>

          {error && <div className="text-sm text-red-600">{error}</div>}
        </div>

        <div className="flex gap-2 border-t border-ink/10 px-6 py-4">
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
            className="flex-1 rounded-lg bg-accent-add py-2 text-sm font-medium text-white hover:bg-accent-add-dark disabled:opacity-60"
          >
            {submitting ? 'Сохраняем…' : 'Сохранить поставку'}
          </button>
        </div>
      </form>
    </div>
  )
}
