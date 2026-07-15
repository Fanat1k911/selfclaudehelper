import { useEffect, useState, type FormEvent } from 'react'
import { apiFetch, ApiError } from '../lib/api'
import type { Ingredient, Recipe, RecipeItem } from '../types'

export function RecipeDetailPanel({
  recipe,
  canEdit,
  onClose,
  onChanged,
}: {
  recipe: Recipe
  canEdit: boolean
  onClose: () => void
  onChanged: () => void
}) {
  const [items, setItems] = useState<RecipeItem[] | null>(null)
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [materialId, setMaterialId] = useState('')
  const [qty, setQty] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [editing, setEditing] = useState(false)

  function loadItems() {
    apiFetch<RecipeItem[]>(`/recipes/${recipe.id}/items`).then(setItems)
  }

  useEffect(() => {
    loadItems()
    if (!canEdit) return
    apiFetch<Ingredient[]>('/ingredients').then((data) => {
      setIngredients(data)
      if (data.length > 0) setMaterialId(data[0].id)
    })
  }, [recipe.id, canEdit])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await apiFetch(`/recipes/${recipe.id}/items`, {
        method: 'POST',
        body: JSON.stringify({ material_id: materialId, qty_per_batch: Number(qty) }),
      })
      setQty('')
      loadItems()
      onChanged()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось добавить компонент.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <div
        className="flex h-full w-full max-w-md flex-col bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-ink/10 px-6 py-5">
          <div>
            <div className="text-lg font-semibold text-ink">{recipe['название']}</div>
            <div className="text-sm text-ink/50">{recipe['что производим']}</div>
          </div>
          <button onClick={onClose} className="text-ink/40 hover:text-ink text-xl leading-none">
            ×
          </button>
        </div>

        {canEdit && (
          <div className="px-6 py-4 border-b border-ink/10 space-y-3">
            {!editing ? (
              <button
                onClick={() => setEditing(true)}
                className="rounded-lg border border-ink/10 px-4 py-2 text-sm font-medium text-ink hover:bg-cream/60"
              >
                Редактировать состав
              </button>
            ) : (
              <>
                <div className="text-sm font-medium text-ink/70">Добавить компонент в состав</div>
                <form onSubmit={handleSubmit} className="space-y-3">
                  <select
                    value={materialId}
                    onChange={(e) => setMaterialId(e.target.value)}
                    className="w-full rounded-lg border border-ink/10 px-3 py-2 text-sm outline-none focus:border-terracotta"
                  >
                    {ingredients.map((ing) => (
                      <option key={ing.id} value={ing.id}>
                        {ing['название']}
                      </option>
                    ))}
                  </select>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={qty}
                      onChange={(e) => setQty(e.target.value)}
                      placeholder="Кол-во на 1 партию"
                      className="flex-1 rounded-lg border border-ink/10 px-3 py-2 text-sm outline-none focus:border-terracotta"
                      required
                    />
                    <button
                      type="submit"
                      disabled={submitting || !materialId}
                      className="rounded-lg bg-terracotta px-4 py-2 text-sm font-medium text-white hover:bg-terracotta-dark disabled:opacity-60"
                    >
                      {submitting ? '…' : 'Добавить'}
                    </button>
                  </div>
                  {error && <div className="text-sm text-red-600">{error}</div>}
                </form>
              </>
            )}
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="text-sm font-medium text-ink/70 mb-3">Состав рецепта</div>
          {items === null && <div className="text-sm text-ink/40">Загрузка…</div>}
          {items?.length === 0 && <div className="text-sm text-ink/40">Состав пока не задан.</div>}
          <div className="space-y-2">
            {items?.map((item, i) => (
              <div key={i} className="flex items-center justify-between text-sm border-b border-ink/5 pb-2">
                <span>{item['название материала']}</span>
                <span className="font-medium">{item['кол-во на 1 партию']}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
