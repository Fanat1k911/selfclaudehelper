import { useEffect, useMemo, useState } from 'react'
import { apiFetch, apiDownload } from '../lib/api'
import type { Ingredient } from '../types'
import { IngredientDetailPanel } from '../components/IngredientDetailPanel'
import { NewIngredientModal } from '../components/NewIngredientModal'
import { ImportIngredientsModal } from '../components/ImportIngredientsModal'

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
  const [showImport, setShowImport] = useState(false)

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
    <div className="px-4 py-4 sm:px-8 sm:py-6">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-semibold text-ink sm:text-2xl">Компоненты</h1>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
          {/* Экспорт+Импорт в одной строке на мобильном, Добавить — отдельной строкой ниже
              (2026-07-18, уточнение Founder: "экспорт/импорт в 1 строку, кнопку на другую,
              без расстояния между ними"). sm:contents на мобильной паре — только группировка
              для grid-cols-2, на sm+ она "исчезает" и оба button становятся обычными flex-item
              родителя, как раньше (десктоп без изменений). */}
          <div className="grid grid-cols-2 gap-2 sm:contents">
            <button
              onClick={() => apiDownload('/ingredients/export', 'компоненты.xlsx')}
              className="whitespace-nowrap rounded-lg border border-ink/15 bg-cream px-3 py-2 text-sm font-medium text-ink hover:bg-ink/5 sm:w-auto sm:px-4"
            >
              Экспорт (.xlsx)
            </button>
            <button
              onClick={() => setShowImport(true)}
              className="whitespace-nowrap rounded-lg border border-ink/15 bg-cream px-3 py-2 text-sm font-medium text-ink hover:bg-ink/5 sm:w-auto sm:px-4"
            >
              Импорт из файла
            </button>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="w-full whitespace-nowrap rounded-lg bg-accent-add px-3 py-2 text-sm font-medium text-white hover:bg-accent-add-dark sm:w-auto sm:px-4"
          >
            + Добавить компонент
          </button>
        </div>
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Поиск по названию…"
        className="mb-4 w-full max-w-sm rounded-lg border border-ink/10 bg-white px-3 py-2 text-sm outline-none focus:border-terracotta"
      />

      <div className="space-y-2 md:hidden">
        {loading && (
          <div className="rounded-xl border border-ink/10 bg-white px-4 py-6 text-center text-sm text-ink/40">
            Загрузка…
          </div>
        )}
        {!loading && filtered.length === 0 && (
          <div className="rounded-xl border border-ink/10 bg-white px-4 py-6 text-center text-sm text-ink/40">
            Ничего не найдено.
          </div>
        )}
        {filtered.map((ing) => (
          <button
            key={ing.id}
            onClick={() => handleRowClick(ing)}
            className="w-full rounded-xl border border-ink/10 bg-white p-4 text-left shadow-sm active:bg-cream/60"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <span className={`h-2 w-2 shrink-0 rounded-full ${COLOR_DOT[ing['цвет']]}`} />
                <span className="truncate text-sm font-medium text-ink">{ing['название']}</span>
              </div>
              <span className="shrink-0 text-sm font-semibold text-ink">
                {ing['остаток']} {ing['ед.измерения']}
              </span>
            </div>
            <div className="mt-1.5 flex items-center justify-between text-xs text-ink/50">
              <span className="truncate">{ing['категория'] || '—'}</span>
              <span className="shrink-0">
                мин. {ing['мин.остаток']} {ing['ед.измерения']} · {formatDate(ing['последнее движение'])}
              </span>
            </div>
          </button>
        ))}
      </div>

      <div className="hidden overflow-hidden rounded-xl border border-ink/10 bg-white shadow-sm md:block">
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

      {showImport && (
        <ImportIngredientsModal
          onClose={() => setShowImport(false)}
          onImported={() => {
            setShowImport(false)
            load()
          }}
        />
      )}
    </div>
  )
}
