import { useEffect, useState, type FormEvent } from 'react'
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
        className="w-full max-w-sm max-h-[85vh] touch-pan-y overflow-y-auto overflow-x-hidden rounded-2xl bg-white p-6 shadow-2xl space-y-3"
      >
        <div className="text-lg font-semibold text-ink mb-2">Редактировать продукт</div>

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
          <input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full rounded-lg border border-ink/10 px-3 py-2 text-sm outline-none focus:border-terracotta"
            required
          />
        </div>

        <div>
          <label className="block text-xs text-ink/60 mb-1">GTIN</label>
          <input
            value={gtin}
            onChange={(e) => setGtin(e.target.value)}
            className="w-full rounded-lg border border-ink/10 px-3 py-2 text-sm outline-none focus:border-terracotta"
            required
          />
        </div>

        <div>
          <label className="block text-xs text-ink/60 mb-1">Рецепт (необязательно)</label>
          <select
            value={recipeId}
            onChange={(e) => setRecipeId(e.target.value)}
            className="w-full rounded-lg border border-ink/10 px-3 py-2 text-sm outline-none focus:border-terracotta"
          >
            <option value="">—</option>
            {recipes.map((r) => (
              <option key={r.id} value={r.id}>
                {r['название']}
              </option>
            ))}
          </select>
          {!product.recipe_id && (
            <p className="mt-1 text-xs text-amber-600">
              Без рецепта «готово к отгрузке» не считается — продажу этого продукта ничто не ограничит.
            </p>
          )}
        </div>

        {product.recipe_id && (
          <div className="rounded-lg bg-cream px-3 py-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-ink/60">Себестоимость партии</span>
              <span className="font-medium text-ink">
                {product['себестоимость партии'] === null ? '—' : `${product['себестоимость партии']?.toFixed(2)} ₽`}
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between">
              <span className="text-ink/60">Себестоимость единицы</span>
              <span className="font-medium text-ink">
                {product['себестоимость единицы'] === null ? '—' : `${product['себестоимость единицы']?.toFixed(2)} ₽`}
              </span>
            </div>
            {product['себестоимость партии'] === null && (
              <p className="mt-1 text-xs text-ink/40">
                По части сырья в рецепте нет ни цены прихода, ни ручной себестоимости на карточке компонента.
              </p>
            )}
          </div>
        )}

        <div>
          <label className="block text-xs text-ink/60 mb-1">Состав (необязательно)</label>
          <input
            value={composition}
            onChange={(e) => setComposition(e.target.value)}
            className="w-full rounded-lg border border-ink/10 px-3 py-2 text-sm outline-none focus:border-terracotta"
          />
        </div>

        <div>
          <label className="block text-xs text-ink/60 mb-1">ТН ВЭД (необязательно)</label>
          <input
            value={tnVed}
            onChange={(e) => setTnVed(e.target.value)}
            className="w-full rounded-lg border border-ink/10 px-3 py-2 text-sm outline-none focus:border-terracotta"
          />
        </div>

        <div>
          <label className="block text-xs text-ink/60 mb-1">Декларация соответствия (необязательно)</label>
          <input
            value={declaration}
            onChange={(e) => setDeclaration(e.target.value)}
            className="w-full rounded-lg border border-ink/10 px-3 py-2 text-sm outline-none focus:border-terracotta"
          />
        </div>

        <div>
          <label className="block text-xs text-ink/60 mb-1">Срок действия РД (необязательно)</label>
          <input
            type="date"
            value={declarationExpires}
            onChange={(e) => setDeclarationExpires(e.target.value)}
            className="w-full rounded-lg border border-ink/10 px-3 py-2 text-sm outline-none focus:border-terracotta [&::-webkit-date-and-time-value]:text-sm [&::-webkit-datetime-edit]:text-sm"
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
            disabled={submitting}
            className="flex-1 rounded-lg bg-accent-add py-2 text-sm font-medium text-white hover:bg-accent-add-dark disabled:opacity-60"
          >
            {submitting ? 'Сохраняем…' : 'Сохранить'}
          </button>
        </div>
      </form>
    </div>
  )
}
