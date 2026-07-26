import { useEffect, useState, type FormEvent } from 'react'
import { apiFetch, ApiError } from '../lib/api'
import { blockNonIntegerKeys, blockNonNumericKeys, clampNumericInput } from '../lib/numericInput'
import { MaterialCombobox } from './MaterialCombobox'
import type { Ingredient, ProducibleProduct } from '../types'

export function NewProductionModal({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: () => void
}) {
  const [products, setProducts] = useState<ProducibleProduct[] | null>(null)
  const [tara, setTara] = useState<Ingredient[]>([])
  const [productId, setProductId] = useState('')
  const [qty, setQty] = useState('1')
  const [defects, setDefects] = useState('0')
  // "Упаковано" (2026-07-26, запрос Александра) — обязательный выбор, дефолт "нет". Тара —
  // презентационная ёмкость (флакон/банка), которую видит покупатель, не путать с
  // технической упаковкой (короб/скотч) — см. CLAUDE.md.
  const [packaged, setPackaged] = useState<'нет' | 'да'>('нет')
  const [packagingMaterialId, setPackagingMaterialId] = useState('')
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
    apiFetch<Ingredient[]>('/ingredients').then((list) => {
      setTara(list.filter((i) => i['категория'] === 'тара'))
    })
  }, [])

  // Подставляем тару, выбранную для этого продукта в прошлый раз (не жёсткая
  // привязка — просто подсказка, можно сменить перед сохранением).
  useEffect(() => {
    const product = (products ?? []).find((p) => p.id === productId)
    setPackagingMaterialId(product?.default_packaging_material_id ?? '')
  }, [productId, products])

  const selectedProduct = (products ?? []).find((p) => p.id === productId)
  const maxAvailable = selectedProduct?.['доступно сейчас'] ?? null
  // Мягкое предупреждение (2026-07-26, запрос Александра со скрина) — не блокирует
  // отправку, сервер всё равно проверит и отклонит недостачу с точной раскладкой по
  // материалам (create_production); тут просто не даём узнать об этом постфактум.
  const exceedsMax = maxAvailable !== null && Number(qty || 0) > maxAvailable

  if (products !== null && products.length === 0) {
    return (
      <div className="backdrop-fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
        <div
          className="modal-pop-in w-full max-w-sm rounded-2xl bg-premium-surface p-6 shadow-2xl space-y-3"
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

  function handlePackagedChange(value: 'нет' | 'да') {
    setPackaged(value)
    if (value === 'да' && !packagedQty) {
      const produced = Math.max(0, Number(qty || 0) - Number(defects || 0))
      setPackagedQty(String(produced))
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const product = (products ?? []).find((p) => p.id === productId)
    if (!product) return
    if (packaged === 'да' && !packagingMaterialId) {
      setError('Выберите тару — без неё нельзя отметить продукт как упакованный.')
      return
    }
    if (packaged === 'да' && !(Number(packagedQty) > 0)) {
      setError('Укажите, сколько штук упаковано.')
      return
    }
    setSubmitting(true)
    try {
      await apiFetch('/production', {
        method: 'POST',
        body: JSON.stringify({
          product_id: product.id,
          recipe_id: product.recipe_id,
          qty: Number(qty),
          defects: defects ? Number(defects) : 0,
          packaged_qty: packaged === 'да' ? Number(packagedQty || 0) : 0,
          packaged_defects: packaged === 'да' && packagedDefects ? Number(packagedDefects) : 0,
          packaging_material_id: packaged === 'да' ? packagingMaterialId : null,
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
    <div className="backdrop-fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="modal-pop-in max-h-[90vh] w-full max-w-sm overflow-y-auto overflow-x-hidden rounded-2xl bg-premium-surface p-6 shadow-2xl space-y-3"
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
          <div className="mb-1 flex items-center justify-between">
            <label className="text-xs text-premium-text/60">Количество продукта</label>
            {maxAvailable !== null && (
              <span className={`text-xs font-medium ${exceedsMax ? 'text-red-400' : 'text-premium-text/40'}`}>
                Доступно: {Number(maxAvailable.toFixed(2))}
              </span>
            )}
          </div>
          <input
            type="number" onKeyDown={blockNonNumericKeys}
            step="any"
            min="0"
            value={qty}
            onChange={(e) => setQty(clampNumericInput(e.target.value))}
            className={`w-full rounded-lg border bg-premium-bg px-3 py-2 text-sm text-premium-text outline-none focus:border-premium-gold ${
              exceedsMax ? 'border-red-500' : 'border-premium-border'
            }`}
            required
          />
        </div>

        <div>
          <label className="block text-xs text-premium-text/60 mb-1">Брак</label>
          <input
            type="number" onKeyDown={blockNonIntegerKeys}
            step="any"
            min="0"
            value={defects}
            onChange={(e) => setDefects(clampNumericInput(e.target.value))}
            className="w-full rounded-lg border border-premium-border bg-premium-bg px-3 py-2 text-sm text-premium-text outline-none focus:border-premium-gold"
          />
        </div>

        <div className="border-t border-premium-border pt-3">
          <label className="block text-xs text-premium-text/60 mb-1">Упаковано</label>
          <select
            value={packaged}
            onChange={(e) => handlePackagedChange(e.target.value as 'нет' | 'да')}
            className="w-full rounded-lg border border-premium-border bg-premium-bg px-3 py-2 text-sm text-premium-text outline-none focus:border-premium-gold"
            required
          >
            <option value="нет">Нет</option>
            <option value="да">Да</option>
          </select>

          {packaged === 'да' && (
            <div className="mt-3 space-y-3">
              <div>
                <label className="block text-xs text-premium-text/60 mb-1">Тара</label>
                <MaterialCombobox
                  ingredients={tara}
                  value={packagingMaterialId}
                  onChange={setPackagingMaterialId}
                  placeholder="Начните вводить название тары…"
                />
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-xs text-premium-text/60 mb-1">Упаковано, шт</label>
                  <input
                    type="number" onKeyDown={blockNonIntegerKeys}
                    step="any"
                    min="0"
                    value={packagedQty}
                    onChange={(e) => setPackagedQty(clampNumericInput(e.target.value))}
                    placeholder="0"
                    className="w-full rounded-lg border border-premium-border bg-premium-bg px-3 py-2 text-sm text-premium-text outline-none focus:border-premium-gold"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs text-premium-text/60 mb-1">Брак упаковки</label>
                  <input
                    type="number" onKeyDown={blockNonIntegerKeys}
                    step="any"
                    min="0"
                    value={packagedDefects}
                    onChange={(e) => setPackagedDefects(clampNumericInput(e.target.value))}
                    className="w-full rounded-lg border border-premium-border bg-premium-bg px-3 py-2 text-sm text-premium-text outline-none focus:border-premium-gold"
                  />
                </div>
              </div>
            </div>
          )}
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
