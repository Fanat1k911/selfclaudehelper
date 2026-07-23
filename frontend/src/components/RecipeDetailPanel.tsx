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
  const [materialName, setMaterialName] = useState('')
  const [qty, setQty] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [editing, setEditing] = useState(false)
  const [archiving, setArchiving] = useState(false)
  const [editingLoss, setEditingLoss] = useState(false)
  const [lossPercent, setLossPercent] = useState(recipe['процент потерь'].toString())
  const [savingLoss, setSavingLoss] = useState(false)
  const [lossError, setLossError] = useState<string | null>(null)
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [editedQty, setEditedQty] = useState('')
  const [savingItem, setSavingItem] = useState(false)
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null)

  function loadItems() {
    apiFetch<RecipeItem[]>(`/recipes/${recipe.id}/items`).then(setItems)
  }

  useEffect(() => {
    loadItems()
    if (!canEdit) return
    apiFetch<Ingredient[]>('/ingredients').then(setIngredients)
  }, [recipe.id, canEdit])

  // Поиск компонента вводом текста (2026-07-23, запрос Александра — раньше был только
  // <select>, приходилось скроллить весь список). datalist — тот же паттерн, что уже
  // в NewRecipeModal.tsx: печатаешь, браузер подсказывает совпадения, выбор резолвится
  // в materialId по точному совпадению названия.
  function selectMaterialByName(value: string) {
    const match = ingredients.find((ing) => ing['название'].toLowerCase() === value.toLowerCase())
    setMaterialName(value)
    setMaterialId(match ? match.id : '')
  }

  async function toggleArchived() {
    setArchiving(true)
    try {
      await apiFetch(`/recipes/${recipe.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ archived: !recipe['архив'] }),
      })
      onChanged()
      onClose()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось изменить статус архива.')
    } finally {
      setArchiving(false)
    }
  }

  async function saveLossPercent(e: FormEvent) {
    e.preventDefault()
    setLossError(null)
    setSavingLoss(true)
    try {
      await apiFetch(`/recipes/${recipe.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ loss_percent: Number(lossPercent) }),
      })
      setEditingLoss(false)
      onChanged()
    } catch (err) {
      setLossError(err instanceof ApiError ? err.message : 'Не удалось сохранить.')
    } finally {
      setSavingLoss(false)
    }
  }

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
      setMaterialName('')
      setMaterialId('')
      loadItems()
      onChanged()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось добавить компонент.')
    } finally {
      setSubmitting(false)
    }
  }

  function startEditItem(item: RecipeItem) {
    setEditingItemId(item.material_id)
    setEditedQty(item['кол-во на 1 партию'].toString())
    setError(null)
  }

  async function saveEditItem(materialIdToSave: string) {
    setError(null)
    setSavingItem(true)
    try {
      await apiFetch(`/recipes/${recipe.id}/items`, {
        method: 'POST',
        body: JSON.stringify({ material_id: materialIdToSave, qty_per_batch: Number(editedQty) }),
      })
      setEditingItemId(null)
      loadItems()
      onChanged()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось сохранить.')
    } finally {
      setSavingItem(false)
    }
  }

  async function deleteItem(materialIdToDelete: string) {
    setError(null)
    setDeletingItemId(materialIdToDelete)
    try {
      await apiFetch(`/recipes/${recipe.id}/items/${materialIdToDelete}`, { method: 'DELETE' })
      loadItems()
      onChanged()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось убрать компонент.')
    } finally {
      setDeletingItemId(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <div
        className="flex h-full w-full max-w-md flex-col bg-premium-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-premium-border px-6 py-5">
          <div>
            <div className="text-lg font-semibold text-premium-text">{recipe['название']}</div>
            <div className="text-sm text-premium-text/50">{recipe['что производим']}</div>
          </div>
          <button onClick={onClose} className="text-premium-text/40 hover:text-premium-text text-xl leading-none">
            ×
          </button>
        </div>

        <div className="px-6 py-3 border-b border-premium-border text-sm">
          {!editingLoss ? (
            <div className="flex items-center justify-between">
              <span className="text-premium-text/60">Потери сырья при производстве</span>
              <span className="flex items-center gap-2 font-medium text-premium-text">
                {lossPercent}%
                {canEdit && (
                  <button onClick={() => setEditingLoss(true)} className="text-xs text-premium-text/40 hover:text-premium-gold-hi">
                    изменить
                  </button>
                )}
              </span>
            </div>
          ) : (
            <form onSubmit={saveLossPercent} className="flex items-center gap-2">
              <input
                type="number"
                step="any"
                min="0"
                value={lossPercent}
                onChange={(e) => setLossPercent(e.target.value)}
                className="w-20 rounded-lg border border-premium-border bg-premium-bg px-2 py-1 text-sm text-premium-text outline-none focus:border-premium-gold"
                autoFocus
              />
              <span className="text-premium-text/60">%</span>
              <button
                type="button"
                onClick={() => {
                  setEditingLoss(false)
                  setLossPercent(recipe['процент потерь'].toString())
                }}
                className="ml-auto rounded-lg border border-premium-border px-3 py-1 text-xs font-medium text-premium-text hover:bg-premium-surface-2"
              >
                Отмена
              </button>
              <button
                type="submit"
                disabled={savingLoss}
                className="rounded-lg bg-premium-gold px-3 py-1 text-xs font-medium text-premium-bg hover:bg-premium-gold-hi disabled:opacity-60"
              >
                {savingLoss ? '…' : 'Сохранить'}
              </button>
            </form>
          )}
          {lossError && <div className="mt-1 text-xs text-red-400">{lossError}</div>}
        </div>

        {canEdit && (
          <div className="px-6 py-4 border-b border-premium-border space-y-3">
            {!editing ? (
              <div className="flex gap-2">
                <button
                  onClick={() => setEditing(true)}
                  className="rounded-lg border border-premium-border px-4 py-2 text-sm font-medium text-premium-text hover:bg-premium-surface-2"
                >
                  Редактировать состав
                </button>
                <button
                  onClick={toggleArchived}
                  disabled={archiving}
                  className="rounded-lg border border-premium-border px-4 py-2 text-sm font-medium text-premium-text hover:bg-premium-surface-2 disabled:opacity-60"
                >
                  {recipe['архив'] ? 'Вернуть из архива' : 'Переместить в архив'}
                </button>
              </div>
            ) : (
              <>
                <div className="text-sm font-medium text-premium-text/70">Добавить компонент в состав</div>
                <form onSubmit={handleSubmit} className="space-y-3">
                  <input
                    list="recipe-detail-materials"
                    value={materialName}
                    onChange={(e) => selectMaterialByName(e.target.value)}
                    placeholder="Начните вводить название компонента…"
                    className="w-full rounded-lg border border-premium-border bg-premium-bg px-3 py-2 text-sm text-premium-text outline-none focus:border-premium-gold"
                  />
                  <datalist id="recipe-detail-materials">
                    {ingredients.map((ing) => (
                      <option key={ing.id} value={ing['название']} />
                    ))}
                  </datalist>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={qty}
                      onChange={(e) => setQty(e.target.value)}
                      placeholder="Вес на 1 единицу продукта"
                      className="no-spinner flex-1 rounded-lg border border-premium-border bg-premium-bg px-3 py-2 text-sm text-premium-text outline-none focus:border-premium-gold"
                      required
                    />
                    <button
                      type="submit"
                      disabled={submitting || !materialId}
                      className="rounded-lg bg-premium-gold px-4 py-2 text-sm font-medium text-premium-bg hover:bg-premium-gold-hi disabled:opacity-60"
                    >
                      {submitting ? '…' : 'Добавить'}
                    </button>
                  </div>
                  {error && <div className="text-sm text-red-400">{error}</div>}
                </form>
              </>
            )}
          </div>
        )}

        <div className="flex-1 touch-pan-y overflow-y-auto overflow-x-hidden px-6 py-4">
          <div className="text-sm font-medium text-premium-text/70 mb-3">Состав рецепта</div>
          {items === null && <div className="text-sm text-premium-text/40">Загрузка…</div>}
          {items?.length === 0 && <div className="text-sm text-premium-text/40">Состав пока не задан.</div>}
          <div className="space-y-2">
            {items?.map((item) => (
              <div key={item.material_id} className="border-b border-premium-border/60 pb-2 text-sm text-premium-text">
                {editingItemId === item.material_id ? (
                  <div className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate">{item['название материала']}</span>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      autoFocus
                      value={editedQty}
                      onChange={(e) => setEditedQty(e.target.value)}
                      className="no-spinner w-20 shrink-0 rounded-lg border border-premium-border bg-premium-bg px-2 py-1 text-sm text-premium-text outline-none focus:border-premium-gold"
                    />
                    <button
                      type="button"
                      onClick={() => setEditingItemId(null)}
                      className="shrink-0 rounded-lg border border-premium-border px-2 py-1 text-xs font-medium text-premium-text hover:bg-premium-surface-2"
                    >
                      Отмена
                    </button>
                    <button
                      type="button"
                      onClick={() => saveEditItem(item.material_id)}
                      disabled={savingItem}
                      className="shrink-0 rounded-lg bg-premium-gold px-2 py-1 text-xs font-medium text-premium-bg hover:bg-premium-gold-hi disabled:opacity-60"
                    >
                      {savingItem ? '…' : 'OK'}
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate">{item['название материала']}</span>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className="font-medium">{item['кол-во на 1 партию']}</span>
                      {canEdit && (
                        <>
                          <button
                            type="button"
                            onClick={() => startEditItem(item)}
                            className="text-xs text-premium-text/40 hover:text-premium-gold-hi"
                          >
                            изменить
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteItem(item.material_id)}
                            disabled={deletingItemId === item.material_id}
                            className="text-xs text-premium-text/40 hover:text-red-400 disabled:opacity-60"
                          >
                            {deletingItemId === item.material_id ? '…' : 'убрать'}
                          </button>
                        </>
                      )}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
