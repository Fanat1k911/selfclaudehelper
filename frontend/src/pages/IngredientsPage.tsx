import { useEffect, useMemo, useState } from 'react'
import { apiFetch } from '../lib/api'
import type { Ingredient } from '../types'
import { IngredientDetailPanel } from '../components/IngredientDetailPanel'
import { NewIngredientModal } from '../components/NewIngredientModal'

const COLOR_DOT: Record<Ingredient['цвет'], string> = {
  'зелёный': 'bg-emerald-500',
  'жёлтый': 'bg-amber-500',
  'красный': 'bg-red-500',
}

function formatDate(value: string | null) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('ru-RU')
}

export function IngredientsPage() {
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Ingredient | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const data = await apiFetch<Ingredient[]>('/ingredients')
      setIngredients(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const rows = q ? ingredients.filter((i) => i['название'].toLowerCase().includes(q)) : ingredients
    return [...rows].sort((a, b) => (a['ниже минимума'] === b['ниже минимума'] ? 0 : a['ниже минимума'] ? -1 : 1))
  }, [ingredients, search])

  function handleRowClick(ingredient: Ingredient) {
    setSelected(ingredient)
  }

  function handleChanged() {
    setSelected(null)
    load()
  }

  return (
    <div className="px-8 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-ink">Ингредиенты</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="rounded-lg bg-terracotta px-4 py-2 text-sm font-medium text-white hover:bg-terracotta-dark"
        >
          + Добавить ингредиент
        </button>
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Поиск по названию…"
        className="mb-4 w-full max-w-sm rounded-lg border border-ink/10 bg-white px-3 py-2 text-sm outline-none focus:border-terracotta"
      />

      <div className="overflow-hidden rounded-xl border border-ink/10 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ink/10 text-left text-ink/50">
              <th className="px-4 py-3 font-medium">Название</th>
              <th className="px-4 py-3 font-medium">Категория</th>
              <th className="px-4 py-3 font-medium text-right">Остаток</th>
              <th className="px-4 py-3 font-medium text-right">Мин.</th>
              <th className="px-4 py-3 font-medium">Обновлено</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-ink/40">
                  Загрузка…
                </td>
              </tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-ink/40">
                  Ничего не найдено.
                </td>
              </tr>
            )}
            {filtered.map((ing) => (
              <tr
                key={ing.id}
                onClick={() => handleRowClick(ing)}
                className="cursor-pointer border-b border-ink/5 last:border-0 hover:bg-cream/60"
              >
                <td className="px-4 py-3 flex items-center gap-2">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${COLOR_DOT[ing['цвет']]}`} />
                  {ing['название']}
                </td>
                <td className="px-4 py-3 text-ink/60">{ing['категория']}</td>
                <td className="px-4 py-3 text-right font-medium">
                  {ing['остаток']} {ing['ед.измерения']}
                </td>
                <td className="px-4 py-3 text-right text-ink/50">
                  {ing['мин.остаток']} {ing['ед.измерения']}
                </td>
                <td className="px-4 py-3 text-ink/50">{formatDate(ing['последнее движение'])}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected && (
        <IngredientDetailPanel
          ingredient={selected}
          onClose={() => setSelected(null)}
          onChanged={handleChanged}
        />
      )}

      {showCreate && (
        <NewIngredientModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false)
            load()
          }}
        />
      )}
    </div>
  )
}
