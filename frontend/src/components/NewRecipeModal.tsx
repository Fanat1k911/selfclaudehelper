import { useEffect, useState, type FormEvent } from 'react'
import { apiFetch, ApiError } from '../lib/api'
import type { Ingredient, Product } from '../types'

const DEFAULT_ROWS = 3

interface CompositionRow {
  materialName: string
  materialId: string
  qty: string
}

export function NewRecipeModal({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: () => void
}) {
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [produces, setProduces] = useState('')
  const [batchYield, setBatchYield] = useState('')
  const [technology, setTechnology] = useState('')
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [productCategories, setProductCategories] = useState<string[]>([])
  const [rows, setRows] = useState<CompositionRow[]>(
    Array.from({ length: DEFAULT_ROWS }, () => ({ materialName: '', materialId: '', qty: '' })),
  )
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    apiFetch<Ingredient[]>('/ingredients').then(setIngredients)
    apiFetch<Product[]>('/products').then((products) => {
      const categories = [...new Set(products.map((p) => p['категория']).filter(Boolean))].sort()
      setProductCategories(categories)
    })
  }, [])

  function updateRow(i: number, patch: Partial<CompositionRow>) {
    setRows((prev) => prev.map((row, idx) => (idx === i ? { ...row, ...patch } : row)))
  }

  function addRow() {
    setRows((prev) => [...prev, { materialName: '', materialId: '', qty: '' }])
  }

  function selectMaterialByName(i: number, value: string) {
    const match = ingredients.find((ing) => ing['название'].toLowerCase() === value.toLowerCase())
    updateRow(i, { materialName: value, materialId: match ? match.id : '' })
  }

  function updateQty(i: number, raw: string) {
    let value = raw.replace(/[^0-9,]/g, '')
    const firstComma = value.indexOf(',')
    if (firstComma !== -1) {
      value = value.slice(0, firstComma + 1) + value.slice(firstComma + 1).replace(/,/g, '')
    }
    updateRow(i, { qty: value })
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const items = rows
      .filter((row) => row.materialId && row.qty)
      .map((row) => ({ material_id: row.materialId, qty_per_batch: Number(row.qty.replace(',', '.')) }))
    if (items.length === 0) {
      setError('Добавьте хотя бы один компонент состава.')
      return
    }
    setSubmitting(true)
    try {
      await apiFetch('/recipes', {
        method: 'POST',
        body: JSON.stringify({
          name,
          category,
          produces,
          batch_yield: batchYield ? Number(batchYield) : 0,
          technology,
          items,
        }),
      })
      onCreated()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось создать рецепт.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-md overflow-x-hidden overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl space-y-3"
      >
        <div className="text-lg font-semibold text-ink mb-2">Новый рецепт</div>

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
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full rounded-lg border border-ink/10 px-3 py-2 text-sm outline-none focus:border-terracotta"
            required
          >
            <option value="">— категория —</option>
            {productCategories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs text-ink/60 mb-1">Что производим</label>
          <input
            value={produces}
            onChange={(e) => setProduces(e.target.value)}
            className="w-full rounded-lg border border-ink/10 px-3 py-2 text-sm outline-none focus:border-terracotta"
            required
          />
        </div>

        <div>
          <label className="block text-xs text-ink/60 mb-1">Выход партии</label>
          <input
            type="number"
            step="any"
            value={batchYield}
            onChange={(e) => setBatchYield(e.target.value)}
            className="w-full rounded-lg border border-ink/10 px-3 py-2 text-sm outline-none focus:border-terracotta"
          />
        </div>

        <div>
          <label className="block text-xs text-ink/60 mb-1">Технология</label>
          <textarea
            value={technology}
            onChange={(e) => setTechnology(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-ink/10 px-3 py-2 text-sm outline-none focus:border-terracotta"
          />
        </div>

        <div>
          <label className="block text-xs text-ink/60 mb-1">Состав</label>
          <div className="space-y-2">
            {rows.map((row, i) => (
              <div key={i} className="flex gap-2">
                <input
                  list="composition-materials"
                  value={row.materialName}
                  onChange={(e) => selectMaterialByName(i, e.target.value)}
                  placeholder="Компонент"
                  className="min-w-0 flex-1 rounded-lg border border-ink/10 px-3 py-2 text-sm outline-none focus:border-terracotta"
                />
                <input
                  type="text"
                  inputMode="decimal"
                  value={row.qty}
                  onChange={(e) => updateQty(i, e.target.value)}
                  placeholder="Кол-во"
                  className="w-24 shrink-0 rounded-lg border border-ink/10 px-3 py-2 text-sm outline-none focus:border-terracotta"
                />
              </div>
            ))}
          </div>
          <datalist id="composition-materials">
            {ingredients.map((ing) => (
              <option key={ing.id} value={ing['название']} />
            ))}
          </datalist>
          <button
            type="button"
            onClick={addRow}
            className="mt-2 text-sm font-medium text-accent-add hover:text-accent-add-dark"
          >
            + Добавить компонент
          </button>
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
