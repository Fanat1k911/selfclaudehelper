import { useEffect, useState, type FormEvent } from 'react'
import { apiFetch, ApiError } from '../lib/api'
import type { Counterparty, Product, Sale } from '../types'

export function SaleModal({
  sale,
  onClose,
  onSaved,
}: {
  sale?: Sale
  onClose: () => void
  onSaved: () => void
}) {
  const editing = Boolean(sale)
  const [products, setProducts] = useState<Product[]>([])
  const [productId, setProductId] = useState(sale?.product_id ?? '')
  const [counterparties, setCounterparties] = useState<Counterparty[]>([])
  const [counterpartyId, setCounterpartyId] = useState(sale?.counterparty_id ?? '')
  const [qty, setQty] = useState(sale ? String(sale['кол-во']) : '')
  const [price, setPrice] = useState(sale && sale['цена'] !== '' ? String(sale['цена']) : '')
  const [comment, setComment] = useState(sale?.['комментарий'] ?? '')
  const [boxCount, setBoxCount] = useState(sale?.['коробки'] != null ? String(sale['коробки']) : '')
  const [tapeCm, setTapeCm] = useState(sale?.['скотч_см'] != null ? String(sale['скотч_см']) : '')
  const [stickerCount, setStickerCount] = useState(sale?.['наклейки'] != null ? String(sale['наклейки']) : '')
  const [courierCost, setCourierCost] = useState(sale?.['трата_курьер'] != null ? String(sale['трата_курьер']) : '')
  const [logistCost, setLogistCost] = useState(sale?.['трата_логист'] != null ? String(sale['трата_логист']) : '')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    apiFetch<Product[]>('/products').then((data) => {
      setProducts(data)
      if (!editing && data.length > 0) setProductId(data[0].id)
    })
    apiFetch<Counterparty[]>('/counterparties').then(setCounterparties)
    // editing/onCreated намеренно не в deps — форма заполняется один раз при открытии.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const body = {
        product_id: productId,
        counterparty_id: counterpartyId,
        qty: Number(qty),
        price: price ? Number(price) : null,
        comment,
        box_count: boxCount ? Number(boxCount) : null,
        tape_cm: tapeCm ? Number(tapeCm) : null,
        sticker_count: stickerCount ? Number(stickerCount) : null,
        courier_cost: courierCost ? Number(courierCost) : null,
        logist_cost: logistCost ? Number(logistCost) : null,
      }
      if (editing) {
        await apiFetch(`/sales/${sale!.id}`, { method: 'PATCH', body: JSON.stringify(body) })
      } else {
        await apiFetch('/sales', { method: 'POST', body: JSON.stringify(body) })
      }
      onSaved()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось сохранить отгрузку.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-sm touch-pan-y overflow-y-auto overflow-x-hidden rounded-2xl bg-premium-surface p-6 shadow-2xl space-y-3"
      >
        <div className="text-lg font-semibold text-premium-text mb-2">{editing ? 'Отгрузка' : 'Новая отгрузка'}</div>

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
          <label className="block text-xs text-premium-text/60 mb-1">Контрагент (необязательно)</label>
          <select
            value={counterpartyId}
            onChange={(e) => setCounterpartyId(e.target.value)}
            className="w-full rounded-lg border border-premium-border bg-premium-bg px-3 py-2 text-sm text-premium-text outline-none focus:border-premium-gold"
          >
            <option value="">— не указан —</option>
            {counterparties.map((c) => (
              <option key={c.id} value={c.id}>
                {c['название']}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-premium-text/60 mb-1">Количество</label>
            <input
              type="number" step="any" min="0" value={qty}
              onChange={(e) => setQty(e.target.value)}
              className="w-full rounded-lg border border-premium-border bg-premium-bg px-3 py-2 text-sm text-premium-text outline-none focus:border-premium-gold"
              required
            />
          </div>
          <div>
            <label className="block text-xs text-premium-text/60 mb-1">Цена (необязательно)</label>
            <input
              type="number" step="any" value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="w-full rounded-lg border border-premium-border bg-premium-bg px-3 py-2 text-sm text-premium-text outline-none focus:border-premium-gold"
            />
          </div>
        </div>

        <div className="border-t border-premium-border pt-3">
          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-premium-text/40">Упаковка и логистика</div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-premium-text/60 mb-1">Коробки, шт</label>
              <input
                type="number" step="any" min="0" value={boxCount}
                onChange={(e) => setBoxCount(e.target.value)}
                className="w-full rounded-lg border border-premium-border bg-premium-bg px-3 py-2 text-sm text-premium-text outline-none focus:border-premium-gold"
              />
            </div>
            <div>
              <label className="block text-xs text-premium-text/60 mb-1">Скотч, см</label>
              <input
                type="number" step="any" min="0" value={tapeCm}
                onChange={(e) => setTapeCm(e.target.value)}
                className="w-full rounded-lg border border-premium-border bg-premium-bg px-3 py-2 text-sm text-premium-text outline-none focus:border-premium-gold"
              />
            </div>
            <div>
              <label className="block text-xs text-premium-text/60 mb-1">Наклейки, шт</label>
              <input
                type="number" step="any" min="0" value={stickerCount}
                onChange={(e) => setStickerCount(e.target.value)}
                className="w-full rounded-lg border border-premium-border bg-premium-bg px-3 py-2 text-sm text-premium-text outline-none focus:border-premium-gold"
              />
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-premium-text/60 mb-1">Курьер, ₽</label>
              <input
                type="number" step="any" min="0" value={courierCost}
                onChange={(e) => setCourierCost(e.target.value)}
                className="w-full rounded-lg border border-premium-border bg-premium-bg px-3 py-2 text-sm text-premium-text outline-none focus:border-premium-gold"
              />
            </div>
            <div>
              <label className="block text-xs text-premium-text/60 mb-1">Логист, ₽</label>
              <input
                type="number" step="any" min="0" value={logistCost}
                onChange={(e) => setLogistCost(e.target.value)}
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
