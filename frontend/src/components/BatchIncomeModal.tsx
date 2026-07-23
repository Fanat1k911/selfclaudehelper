import { useMemo, useState, type FormEvent } from 'react'
import { Truck, X } from 'lucide-react'
import { apiFetch, ApiError } from '../lib/api'
import { MaterialCombobox } from './MaterialCombobox'
import type { Ingredient } from '../types'

interface Row {
  materialId: string
  qty: string
  price: string
}

function unitWeight(ing: Ingredient | undefined): number {
  const weight = ing?.['вес минимальной партии']
  const qty = ing?.['минимальная партия для закупки']
  if (weight && qty) return weight / qty
  return 1 // fallback: делим по количеству, не по весу — как на бэке
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

  const byId = useMemo(() => new Map(ingredients.map((i) => [i.id, i])), [ingredients])

  const freightPreview = useMemo(() => {
    const cost = Number(transportCost)
    if (!cost) return null
    const weights = rows.map((r) => unitWeight(byId.get(r.materialId)) * (Number(r.qty) || 0))
    const total = weights.reduce((a, b) => a + b, 0)
    if (total <= 0) return null
    return weights.map((w) => (w / total) * cost)
  }, [rows, transportCost, byId])

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
        className="flex w-full max-w-lg max-h-[90vh] flex-col overflow-hidden rounded-2xl bg-premium-surface shadow-2xl"
      >
        <div className="flex items-start justify-between border-b border-premium-border px-6 py-5">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-premium-gold/15 text-premium-gold-hi">
              <Truck size={18} strokeWidth={2} />
            </div>
            <div>
              <div className="text-lg font-semibold text-premium-text">Поставка</div>
              <div className="mt-0.5 text-xs text-premium-text/50">
                Несколько материалов одним приходом — транспортные расходы разделятся между ними по весу.
              </div>
            </div>
          </div>
          <button type="button" onClick={onClose} className="shrink-0 text-premium-text/40 hover:text-premium-text">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 touch-pan-y overflow-y-auto overflow-x-hidden px-6 py-4 space-y-3">
          {rows.map((row, i) => (
            <div key={i} className="rounded-xl border border-premium-border bg-premium-bg/60 p-3">
              <div className="flex items-center gap-2">
                <MaterialCombobox
                  ingredients={ingredients}
                  value={row.materialId}
                  onChange={(id) => updateRow(i, { materialId: id })}
                />
                <button
                  type="button"
                  onClick={() => removeRow(i)}
                  disabled={rows.length === 1}
                  className="shrink-0 rounded-lg p-2 text-premium-text/40 hover:bg-red-500/10 hover:text-red-400 disabled:opacity-30"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-premium-text/50 mb-1">
                    Кол-во{row.materialId && byId.get(row.materialId) ? `, ${byId.get(row.materialId)!['ед.измерения']}` : ''}
                  </label>
                  <input
                    type="number" step="any" required
                    value={row.qty}
                    onChange={(e) => updateRow(i, { qty: e.target.value })}
                    className="w-full rounded-lg border border-premium-border bg-premium-bg px-3 py-2 text-sm text-premium-text outline-none focus:border-premium-gold"
                  />
                </div>
                <div>
                  <label className="block text-xs text-premium-text/50 mb-1">Цена за единицу</label>
                  <input
                    type="number" step="any"
                    value={row.price}
                    onChange={(e) => updateRow(i, { price: e.target.value })}
                    className="w-full rounded-lg border border-premium-border bg-premium-bg px-3 py-2 text-sm text-premium-text outline-none focus:border-premium-gold"
                  />
                </div>
              </div>
              {freightPreview && freightPreview[i] > 0 && (
                <div className="mt-2 text-xs text-premium-text/50">
                  + доставка ≈ <span className="font-medium text-premium-gold-hi">{freightPreview[i].toFixed(2)} ₽</span>
                </div>
              )}
            </div>
          ))}

          <button
            type="button"
            onClick={addRow}
            disabled={rows.length >= ingredients.length}
            className="text-sm font-medium text-premium-gold-hi hover:text-premium-gold disabled:opacity-40"
          >
            + добавить материал
          </button>

          <div className="pt-2 border-t border-premium-border">
            <label className="block text-xs text-premium-text/60 mb-1">Транспортные расходы за всю поставку (₽, необязательно)</label>
            <input
              type="number" step="any"
              value={transportCost}
              onChange={(e) => setTransportCost(e.target.value)}
              className="w-full rounded-lg border border-premium-border bg-premium-bg px-3 py-2 text-sm text-premium-text outline-none focus:border-premium-gold"
            />
          </div>

          <div>
            <label className="block text-xs text-premium-text/60 mb-1">Комментарий</label>
            <input
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="w-full rounded-lg border border-premium-border bg-premium-bg px-3 py-2 text-sm text-premium-text outline-none focus:border-premium-gold"
            />
          </div>

          {error && <div className="text-sm text-red-400">{error}</div>}
        </div>

        <div className="flex gap-2 border-t border-premium-border px-6 py-4">
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
            {submitting ? 'Сохраняем…' : 'Сохранить поставку'}
          </button>
        </div>
      </form>
    </div>
  )
}
