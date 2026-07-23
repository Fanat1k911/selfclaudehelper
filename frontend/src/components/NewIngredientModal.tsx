import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Check, ChevronsUpDown, Plus } from 'lucide-react'
import { apiFetch, ApiError } from '../lib/api'
import { materialCategoryLabel } from '../lib/labels'

// Базовый набор всегда доступен, даже пока /ingredients/categories не загрузился —
// см. app.constants.DEFAULT_MATERIAL_CATEGORIES на бэке, держим синхронно. "тара"
// сюда не входит (2026-07-23) — тара переехала в отдельный раздел «Упаковка» со своей
// формой создания (NewPackagingMaterialModal.tsx), здесь для неё нет смысла в поле.
const DEFAULT_CATEGORIES = ['косм', 'свеч']

function CategoryPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES)
  const [open, setOpen] = useState(false)
  const [creatingNew, setCreatingNew] = useState(false)
  const [newCategory, setNewCategory] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    apiFetch<string[]>('/ingredients/categories')
      .then((cats) => setCategories(cats.filter((c) => c !== 'тара')))
      .catch(() => {})
  }, [])

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
        setCreatingNew(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  function confirmNewCategory() {
    const trimmed = newCategory.trim()
    if (!trimmed) return
    if (!categories.includes(trimmed)) setCategories((prev) => [...prev, trimmed])
    onChange(trimmed)
    setNewCategory('')
    setCreatingNew(false)
    setOpen(false)
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between rounded-lg border border-premium-border bg-premium-bg px-3 py-2 text-sm text-premium-text outline-none focus:border-premium-gold"
      >
        {materialCategoryLabel(value)}
        <ChevronsUpDown size={14} className="text-premium-text/40" />
      </button>

      {open && (
        <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-premium-border bg-premium-surface shadow-lg">
          {!creatingNew ? (
            <>
              {categories.map((c) => (
                <button
                  type="button"
                  key={c}
                  onClick={() => {
                    onChange(c)
                    setOpen(false)
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-premium-text hover:bg-premium-surface-2"
                >
                  <Check size={14} className={c === value ? 'text-premium-gold-hi' : 'text-transparent'} />
                  {materialCategoryLabel(c)}
                </button>
              ))}
              <div className="mx-3 border-t border-dashed border-premium-border" />
              <button
                type="button"
                onClick={() => setCreatingNew(true)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-premium-gold-hi hover:bg-premium-surface-2"
              >
                <Plus size={14} /> Добавить категорию
              </button>
            </>
          ) : (
            <div className="p-3 space-y-2">
              <div className="text-xs font-medium text-premium-text/60">Добавить категорию</div>
              <input
                autoFocus
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    confirmNewCategory()
                  }
                }}
                placeholder="Название категории"
                className="w-full rounded-lg border border-premium-border bg-premium-bg px-3 py-2 text-sm text-premium-text outline-none focus:border-premium-gold"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setCreatingNew(false)
                    setNewCategory('')
                  }}
                  className="flex-1 rounded-lg bg-premium-surface-2 py-1.5 text-xs font-medium text-premium-text hover:bg-premium-border"
                >
                  Назад
                </button>
                <button
                  type="button"
                  onClick={confirmNewCategory}
                  disabled={!newCategory.trim()}
                  className="flex-1 rounded-lg bg-premium-gold py-1.5 text-xs font-medium text-premium-bg hover:bg-premium-gold-hi disabled:opacity-40"
                >
                  Добавить
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function NewIngredientModal({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: () => void
}) {
  const [name, setName] = useState('')
  const [category, setCategory] = useState('косм')
  const [minStock, setMinStock] = useState('')
  const [initialQty, setInitialQty] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await apiFetch('/ingredients', {
        method: 'POST',
        body: JSON.stringify({
          name,
          category,
          unit: 'г',
          min_stock: minStock ? Number(minStock) : 0,
          initial_qty: initialQty ? Number(initialQty) : 0,
        }),
      })
      onCreated()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось создать компонент.')
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
        <div className="text-lg font-semibold text-premium-text mb-2">Новый компонент</div>

        <div>
          <label className="block text-xs text-premium-text/60 mb-1">Название</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-premium-border bg-premium-bg px-3 py-2 text-sm text-premium-text outline-none focus:border-premium-gold"
            required
          />
        </div>

        <div>
          <label className="block text-xs text-premium-text/60 mb-1">Категория</label>
          <CategoryPicker value={category} onChange={setCategory} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-premium-text/60 mb-1">Мин. остаток</label>
            <input
              type="number"
              step="any"
              value={minStock}
              onChange={(e) => setMinStock(e.target.value)}
              className="w-full rounded-lg border border-premium-border bg-premium-bg px-3 py-2 text-sm text-premium-text outline-none focus:border-premium-gold"
            />
          </div>
          <div>
            <label className="block text-xs text-premium-text/60 mb-1">Начальный остаток</label>
            <input
              type="number"
              step="any"
              value={initialQty}
              onChange={(e) => setInitialQty(e.target.value)}
              className="w-full rounded-lg border border-premium-border bg-premium-bg px-3 py-2 text-sm text-premium-text outline-none focus:border-premium-gold"
            />
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
            {submitting ? 'Создаём…' : 'Создать'}
          </button>
        </div>
      </form>
    </div>
  )
}
