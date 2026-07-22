import { useEffect, useState, type FormEvent } from 'react'
import { apiFetch, ApiError } from '../lib/api'
import type { Recipe } from '../types'

export function NewProductModal({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: () => void
}) {
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [gtin, setGtin] = useState('')
  const [composition, setComposition] = useState('')
  const [recipeId, setRecipeId] = useState('')
  const [tnVed, setTnVed] = useState('')
  const [declaration, setDeclaration] = useState('')
  const [declarationExpires, setDeclarationExpires] = useState('')
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
      await apiFetch('/products', {
        method: 'POST',
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
      onCreated()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось создать продукт.')
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
        <div className="text-lg font-semibold text-ink mb-2">Новый продукт</div>

        <div>
          <label className="block text-xs text-ink/60 mb-1">Название</label>
          <textarea
            value={name}
            onChange={(e) => setName(e.target.value)}
            rows={2}
            className="w-full resize-none rounded-lg border border-ink/10 px-3 py-2 text-sm outline-none focus:border-terracotta"
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
        </div>

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
          <div className="relative">
            <input
              type="date"
              value={declarationExpires}
              onChange={(e) => setDeclarationExpires(e.target.value)}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            />
            <div className="pointer-events-none w-full rounded-lg border border-ink/10 px-3 py-2 text-sm text-ink">
              {declarationExpires ? (
                new Date(declarationExpires).toLocaleDateString('ru-RU')
              ) : (
                <span className="text-ink/40">дд.мм.гггг</span>
              )}
            </div>
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
            className="flex-1 rounded-lg bg-accent-add py-2 text-sm font-medium text-white hover:bg-accent-add-dark disabled:opacity-60"
          >
            {submitting ? 'Создаём…' : 'Создать'}
          </button>
        </div>
      </form>
    </div>
  )
}
