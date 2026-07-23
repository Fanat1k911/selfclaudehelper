import { useEffect, useState, type FormEvent } from 'react'
import { apiFetch, ApiError } from '../lib/api'
import type { ProducibleProduct } from '../types'

export function NewProductionModal({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: () => void
}) {
  const [products, setProducts] = useState<ProducibleProduct[] | null>(null)
  const [productId, setProductId] = useState('')
  const [qty, setQty] = useState('1')
  const [defects, setDefects] = useState('0')
  const [packagedQty, setPackagedQty] = useState('')
  const [packagedDefects, setPackagedDefects] = useState('0')
  const [comment, setComment] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    apiFetch<ProducibleProduct[]>('/production/products').then((data) => {
      setProducts(data)
      if (data.length > 0) setProductId(data[0].id)
    })
  }, [])

  if (products !== null && products.length === 0) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
        <div
          className="w-full max-w-sm rounded-2xl bg-premium-surface p-6 shadow-2xl space-y-3"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="text-lg font-semibold text-premium-text">Нечего производить</div>
          <p className="text-sm text-premium-text/70">
            Ни один продукт не привязан к рецепту (или рецепт в архиве). Зайди в раздел
            «Продукт», открой нужную карточку и выбери рецепт в поле «Рецепт» — после
            этого он появится здесь.
          </p>
          <button
            onClick={onClose}
            className="w-full rounded-lg bg-premium-surface-2 py-2 text-sm font-medium text-premium-text hover:bg-premium-border"
          >
            Понятно
          </button>
        </div>
      </div>
    )
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const product = (products ?? []).find((p) => p.id === productId)
    if (!product) return
    setSubmitting(true)
    try {
      await apiFetch('/production', {
        method: 'POST',
        body: JSON.stringify({
          product_id: product.id,
          recipe_id: product.recipe_id,
          qty: Number(qty),
          defects: defects ? Number(defects) : 0,
          packaged_qty: packagedQty ? Number(packagedQty) : 0,
          packaged_defects: packagedDefects ? Number(packagedDefects) : 0,
          comment,
        }),
      })
      onCreated()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось внести производство.')
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
        <div className="text-lg font-semibold text-premium-text mb-2">Внести производство</div>

        <div>
          <label className="block text-xs text-premium-text/60 mb-1">Продукт</label>
          <select
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            className="w-full rounded-lg border border-premium-border bg-premium-bg px-3 py-2 text-sm text-premium-text outline-none focus:border-premium-gold"
            required
          >
            {(products ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p['название']}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs text-premium-text/60 mb-1">Количество продукта</label>
          <input
            type="number"
            step="any"
            min="0"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            className="w-full rounded-lg border border-premium-border bg-premium-bg px-3 py-2 text-sm text-premium-text outline-none focus:border-premium-gold"
            required
          />
        </div>

        <div>
          <label className="block text-xs text-premium-text/60 mb-1">Брак</label>
          <input
            type="number"
            step="any"
            min="0"
            value={defects}
            onChange={(e) => setDefects(e.target.value)}
            className="w-full rounded-lg border border-premium-border bg-premium-bg px-3 py-2 text-sm text-premium-text outline-none focus:border-premium-gold"
          />
        </div>

        <div className="border-t border-premium-border pt-3">
          <div className="mb-2 text-xs font-medium text-premium-text/50">Упаковка (необязательно)</div>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-xs text-premium-text/60 mb-1">Упаковано, шт</label>
              <input
                type="number"
                step="any"
                min="0"
                value={packagedQty}
                onChange={(e) => setPackagedQty(e.target.value)}
                placeholder="0"
                className="w-full rounded-lg border border-premium-border bg-premium-bg px-3 py-2 text-sm text-premium-text outline-none focus:border-premium-gold"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs text-premium-text/60 mb-1">Брак упаковки</label>
              <input
                type="number"
                step="any"
                min="0"
                value={packagedDefects}
                onChange={(e) => setPackagedDefects(e.target.value)}
                className="w-full rounded-lg border border-premium-border bg-premium-bg px-3 py-2 text-sm text-premium-text outline-none focus:border-premium-gold"
              />
            </div>
          </div>
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
            disabled={submitting || !productId}
            className="flex-1 rounded-lg bg-premium-gold py-2 text-sm font-medium text-premium-bg hover:bg-premium-gold-hi disabled:opacity-60"
          >
            {submitting ? 'Сохраняем…' : 'Сохранить'}
          </button>
        </div>
      </form>
    </div>
  )
}
