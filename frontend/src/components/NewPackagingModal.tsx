import { useEffect, useState, type FormEvent } from 'react'
import { apiFetch, ApiError } from '../lib/api'

interface ProductOption {
  id: string
  'название': string
}

export function NewPackagingModal({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: () => void
}) {
  const [products, setProducts] = useState<ProductOption[]>([])
  const [productId, setProductId] = useState('')
  const [qty, setQty] = useState('')
  const [defects, setDefects] = useState('0')
  const [comment, setComment] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    apiFetch<ProductOption[]>('/packaging/products').then((data) => {
      setProducts(data)
      if (data.length > 0) setProductId(data[0].id)
    })
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await apiFetch('/packaging', {
        method: 'POST',
        body: JSON.stringify({
          product_id: productId,
          qty: Number(qty),
          defects: defects ? Number(defects) : 0,
          comment,
        }),
      })
      onCreated()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось внести упаковку.')
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
        <div className="text-lg font-semibold text-premium-text mb-2">Внести упаковку</div>

        <div>
          <label className="block text-xs text-premium-text/60 mb-1">Продукт</label>
          <select
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            className="w-full rounded-lg border border-premium-border bg-premium-bg px-3 py-2 text-sm text-premium-text outline-none focus:border-premium-gold"
            required
          >
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p['название']}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs text-premium-text/60 mb-1">Количество</label>
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
