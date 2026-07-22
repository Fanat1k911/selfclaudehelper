import { useEffect, useState, type FormEvent } from 'react'
import { Check, Copy } from 'lucide-react'
import { apiFetch, ApiError } from '../lib/api'
import type { Product, Recipe } from '../types'

export function EditProductModal({
  product,
  onClose,
  onSaved,
}: {
  product: Product
  onClose: () => void
  onSaved: () => void
}) {
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [name, setName] = useState(product['название'])
  const [category, setCategory] = useState(product['категория'])
  const [gtin, setGtin] = useState(product.GTIN)
  const [composition, setComposition] = useState(product['состав'])
  const [recipeId, setRecipeId] = useState(product.recipe_id)
  const [tnVed, setTnVed] = useState(product['ТН ВЭД'])
  const [declaration, setDeclaration] = useState(product['декларация соответствия'])
  const [declarationExpires, setDeclarationExpires] = useState(product['срок действия РД'])
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [inciCopied, setInciCopied] = useState(false)

  async function copyInci() {
    const value = product['состав по INCI']
    if (!value) return
    await navigator.clipboard.writeText(value)
    setInciCopied(true)
    setTimeout(() => setInciCopied(false), 1500)
  }

  useEffect(() => {
    apiFetch<Recipe[]>('/recipes').then(setRecipes)
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await apiFetch(`/products/${product.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name,
          category,
          gtin,
          composition,
          recipe_id: recipeId,
          tn_ved: tnVed,
          declaration,
          declaration_expires: declarationExpires,
        }),
      })
      onSaved()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось сохранить продукт.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm max-h-[85vh] touch-pan-y overflow-y-auto overflow-x-hidden rounded-2xl bg-premium-surface p-6 shadow-2xl space-y-3"
      >
        <div className="text-lg font-semibold text-premium-text mb-2">Редактировать продукт</div>

        <div>
          <label className="block text-xs text-premium-text/60 mb-1">Название</label>
          <textarea
            value={name}
            onChange={(e) => setName(e.target.value)}
            rows={2}
            className="w-full resize-none rounded-lg border border-premium-border bg-premium-bg px-3 py-2 text-sm text-premium-text outline-none focus:border-premium-gold"
            required
          />
        </div>

        <div>
          <label className="block text-xs text-premium-text/60 mb-1">Категория</label>
          <input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full rounded-lg border border-premium-border bg-premium-bg px-3 py-2 text-sm text-premium-text outline-none focus:border-premium-gold"
            required
          />
        </div>

        <div>
          <label className="block text-xs text-premium-text/60 mb-1">GTIN</label>
          <input
            value={gtin}
            onChange={(e) => setGtin(e.target.value)}
            className="w-full rounded-lg border border-premium-border bg-premium-bg px-3 py-2 text-sm text-premium-text outline-none focus:border-premium-gold"
            required
          />
        </div>

        <div>
          <label className="block text-xs text-premium-text/60 mb-1">Рецепт (необязательно)</label>
          <select
            value={recipeId}
            onChange={(e) => setRecipeId(e.target.value)}
            className="w-full rounded-lg border border-premium-border bg-premium-bg px-3 py-2 text-sm text-premium-text outline-none focus:border-premium-gold"
          >
            <option value="">—</option>
            {recipes.map((r) => (
              <option key={r.id} value={r.id}>
                {r['название']}
              </option>
            ))}
          </select>
          {!product.recipe_id && (
            <p className="mt-1 text-xs text-amber-500">
              Без рецепта «готово к отгрузке» не считается — продажу этого продукта ничто не ограничит.
            </p>
          )}
        </div>

        {product.recipe_id && (
          <div className="rounded-lg bg-premium-bg px-3 py-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-premium-text/60">Себестоимость партии</span>
              <span className="font-medium text-premium-text">
                {product['себестоимость партии'] === null ? '—' : `${product['себестоимость партии']?.toFixed(2)} ₽`}
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between">
              <span className="text-premium-text/60">Себестоимость единицы</span>
              <span className="font-medium text-premium-text">
                {product['себестоимость единицы'] === null ? '—' : `${product['себестоимость единицы']?.toFixed(2)} ₽`}
              </span>
            </div>
            {product['себестоимость партии'] === null && (
              <p className="mt-1 text-xs text-premium-text/40">
                По части сырья в рецепте нет ни цены прихода, ни ручной себестоимости на карточке компонента.
              </p>
            )}
          </div>
        )}

        {product.recipe_id && (
          <div className="rounded-lg bg-premium-bg px-3 py-2 text-sm">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-premium-text/60">Состав по INCI</span>
              {product['состав по INCI'] && (
                <button
                  type="button"
                  onClick={copyInci}
                  className="flex items-center gap-1 text-xs text-premium-gold-hi hover:text-premium-gold"
                >
                  {inciCopied ? <Check size={13} /> : <Copy size={13} />}
                  {inciCopied ? 'Скопировано' : 'Копировать'}
                </button>
              )}
            </div>
            {product['состав по INCI'] ? (
              <p className="text-premium-text">{product['состав по INCI']}</p>
            ) : (
              <p className="text-xs text-premium-text/40">
                Ни у одного компонента рецепта не заполнено поле INCI на карточке компонента —
                собрать состав не из чего.
              </p>
            )}
          </div>
        )}

        <div>
          <label className="block text-xs text-premium-text/60 mb-1">Состав (необязательно)</label>
          <input
            value={composition}
            onChange={(e) => setComposition(e.target.value)}
            className="w-full rounded-lg border border-premium-border bg-premium-bg px-3 py-2 text-sm text-premium-text outline-none focus:border-premium-gold"
          />
        </div>

        <div>
          <label className="block text-xs text-premium-text/60 mb-1">ТН ВЭД (необязательно)</label>
          <input
            value={tnVed}
            onChange={(e) => setTnVed(e.target.value)}
            className="w-full rounded-lg border border-premium-border bg-premium-bg px-3 py-2 text-sm text-premium-text outline-none focus:border-premium-gold"
          />
        </div>

        <div>
          <label className="block text-xs text-premium-text/60 mb-1">Декларация соответствия (необязательно)</label>
          <input
            value={declaration}
            onChange={(e) => setDeclaration(e.target.value)}
            className="w-full rounded-lg border border-premium-border bg-premium-bg px-3 py-2 text-sm text-premium-text outline-none focus:border-premium-gold"
          />
        </div>

        <div>
          <label className="block text-xs text-premium-text/60 mb-1">Срок действия РД (необязательно)</label>
          <div className="relative">
            {/* iOS Safari рендерит выбранную дату в поле своим системным шрифтом крупнее
                остальных полей, и это почти не поддаётся переопределению CSS на самом
                нативном поле (::-webkit-date-and-time-value color:transparent проверено —
                в Chromium даёт наложение текста, ненадёжно кросс-браузерно; Александр,
                2026-07-22, скрин). Вместо борьбы со стилями нативного поля — прячем его
                полностью (opacity-0, но поверх и кликабельно на весь блок, тап открывает
                нативный календарь как раньше) и рисуем свой текст под ним в обычном
                стиле — так реально одинаково рендерится везде. */}
            <input
              type="date"
              value={declarationExpires}
              onChange={(e) => setDeclarationExpires(e.target.value)}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            />
            <div className="pointer-events-none w-full rounded-lg border border-premium-border bg-premium-bg px-3 py-2 text-sm text-premium-text">
              {declarationExpires ? (
                new Date(declarationExpires).toLocaleDateString('ru-RU')
              ) : (
                <span className="text-premium-text/40">дд.мм.гггг</span>
              )}
            </div>
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
            {submitting ? 'Сохраняем…' : 'Сохранить'}
          </button>
        </div>
      </form>
    </div>
  )
}
