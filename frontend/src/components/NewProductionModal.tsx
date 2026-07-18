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
  const [products, setProducts] = useState<ProducibleProduct[]>([])
  const [productId, setProductId] = useState('')
  const [batches, setBatches] = useState('1')
  const [startedAt, setStartedAt] = useState('')
  const [finishedAt, setFinishedAt] = useState('')
  const [defects, setDefects] = useState('0')
  const [comment, setComment] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    apiFetch<ProducibleProduct[]>('/production/products').then((data) => {
      setProducts(data)
      if (data.length > 0) setProductId(data[0].id)
    })
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const product = products.find((p) => p.id === productId)
    if (!product) return
    setSubmitting(true)
    try {
      await apiFetch('/production', {
        method: 'POST',
        body: JSON.stringify({
          recipe_id: product.recipe_id,
          batches: Number(batches),
          started_at: startedAt,
          finished_at: finishedAt,
          defects: defects ? Number(defects) : 0,
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
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl space-y-3"
      >
        <div className="text-lg font-semibold text-ink mb-2">Внести производство</div>

        <div>
          <label className="block text-xs text-ink/60 mb-1">Продукт</label>
          <select
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            className="w-full rounded-lg border border-ink/10 px-3 py-2 text-sm outline-none focus:border-terracotta"
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
          <label className="block text-xs text-ink/60 mb-1">Количество партий</label>
          <input
            type="number"
            step="any"
            min="0"
            value={batches}
            onChange={(e) => setBatches(e.target.value)}
            className="w-full rounded-lg border border-ink/10 px-3 py-2 text-sm outline-none focus:border-terracotta"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* min-w-0 на обоих ячейках грида (2026-07-18, наплыв полей на мобильном
              Brave/iOS) — datetime-local у WebKit несёт собственный минимальный
              intrinsic-размер нативного пикера; без min-w-0 дефолтный min-width:auto
              грид-ячейки не даёт полю сжаться до назначенной 1fr-доли на узком экране,
              и одно поле раздувается, наезжая на соседнее. */}
          <div className="min-w-0">
            <label className="block text-xs text-ink/60 mb-1">Начало</label>
            <input
              type="datetime-local"
              value={startedAt}
              onChange={(e) => setStartedAt(e.target.value)}
              className="w-full min-w-0 rounded-lg border border-ink/10 px-3 py-2 text-sm outline-none focus:border-terracotta"
              required
            />
          </div>
          <div className="min-w-0">
            <label className="block text-xs text-ink/60 mb-1">Окончание</label>
            <input
              type="datetime-local"
              value={finishedAt}
              onChange={(e) => setFinishedAt(e.target.value)}
              className="w-full min-w-0 rounded-lg border border-ink/10 px-3 py-2 text-sm outline-none focus:border-terracotta"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-xs text-ink/60 mb-1">Брак</label>
          <input
            type="number"
            step="any"
            min="0"
            value={defects}
            onChange={(e) => setDefects(e.target.value)}
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
            disabled={submitting || !productId}
            className="flex-1 rounded-lg bg-accent-add py-2 text-sm font-medium text-white hover:bg-accent-add-dark disabled:opacity-60"
          >
            {submitting ? 'Сохраняем…' : 'Сохранить'}
          </button>
        </div>
      </form>
    </div>
  )
}
