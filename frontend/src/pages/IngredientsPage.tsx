import { useEffect, useMemo, useState } from 'react'
import { Download, Plus, Truck, Upload } from 'lucide-react'
import { apiFetch, apiDownload } from '../lib/api'
import { useAuth } from '../lib/auth'
import { materialCategoryLabel } from '../lib/labels'
import { usePremiumBackground } from '../lib/usePremiumBackground'
import type { Ingredient, User } from '../types'
import { IngredientDetailPanel } from '../components/IngredientDetailPanel'
import { NewIngredientModal } from '../components/NewIngredientModal'
import { ImportIngredientsModal } from '../components/ImportIngredientsModal'
import { BatchIncomeModal } from '../components/BatchIncomeModal'
import { SkeletonRows } from '../components/SkeletonRows'

const MANAGEMENT_ROLES: User['role'][] = ['founder', 'developer']

const COLOR_DOT: Record<Ingredient['цвет'], string> = {
  'зелёный': 'bg-premium-sage-hi',
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
  usePremiumBackground()
  const { user } = useAuth()
  const canManage = !!user && MANAGEMENT_ROLES.includes(user.role)
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Ingredient | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [showBatchIncome, setShowBatchIncome] = useState(false)
  const [showArchived, setShowArchived] = useState(false)

  async function load(archived = showArchived) {
    setLoading(true)
    try {
      const data = await apiFetch<Ingredient[]>(`/ingredients?archived=${archived}`)
      setIngredients(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load(showArchived)
  }, [showArchived])

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
    load(showArchived)
  }

  return (
    <div className="relative min-h-full overflow-hidden bg-premium-bg px-4 py-4 sm:px-8 sm:py-6">
      <div className="premium-grain" aria-hidden />
      <div className="relative mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="flex items-baseline gap-2 font-display text-xl font-semibold italic text-premium-text sm:text-2xl">
          Компоненты
          {!loading && <span className="font-sans text-sm font-normal not-italic text-premium-text/40">{ingredients.length}</span>}
        </h1>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
          {/* Два явных блока (Александр, 2026-07-21): служебное (Экспорт/Импорт/Архив —
              все "про просмотр", не мутируют остаток) отдельно от действий над остатком
              (Поставка/Добавить) — разделены собственным gap-3 и, на десктопе, вертикальной
              чертой между блоками. Внутри каждого блока — ровная сетка на мобильном, в ряд
              на десктопе. Архив — нечётный третий в первом блоке, спан на всю ширину строки. */}
          <div className="grid grid-cols-3 gap-2 sm:flex sm:gap-2">
            <button
              onClick={() => apiDownload('/ingredients/export', 'компоненты.xlsx')}
              className="flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-premium-border bg-premium-surface px-3 py-2 text-sm font-medium text-premium-text hover:bg-premium-surface-2 sm:w-auto sm:px-4"
            >
              <Download size={15} /> Экспорт
            </button>
            <button
              onClick={() => setShowImport(true)}
              className="flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-premium-border bg-premium-surface px-3 py-2 text-sm font-medium text-premium-text hover:bg-premium-surface-2 sm:w-auto sm:px-4"
            >
              <Upload size={15} /> Импорт
            </button>
            {canManage && (
              <button
                onClick={() => setShowArchived((v) => !v)}
                className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium sm:w-auto sm:px-4 ${
                  showArchived
                    ? 'bg-premium-gold text-premium-bg'
                    : 'border border-premium-border text-premium-text hover:bg-premium-surface-2'
                }`}
              >
                {showArchived ? 'Активные' : 'Архив'}
              </button>
            )}
          </div>

          <div className="hidden h-8 w-px bg-premium-border sm:block" />

          {!showArchived && (
            <div className="grid grid-cols-2 gap-2 sm:flex sm:gap-2">
              <button
                onClick={() => setShowBatchIncome(true)}
                disabled={ingredients.length === 0}
                className="flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg bg-premium-gold px-3 py-2 text-sm font-medium text-premium-bg shadow-sm hover:bg-premium-gold-hi disabled:opacity-40 sm:w-auto sm:px-4"
              >
                <Truck size={15} /> Поставка
              </button>
              <button
                onClick={() => setShowCreate(true)}
                className="flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-premium-gold/50 px-3 py-2 text-sm font-medium text-premium-gold-hi hover:bg-premium-gold/10 sm:w-auto sm:px-4"
              >
                <Plus size={15} /> Добавить компонент
              </button>
            </div>
          )}
        </div>
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Поиск по названию…"
        className="relative mb-4 w-full max-w-sm rounded-lg border border-premium-border bg-premium-surface px-3 py-2 text-sm text-premium-text outline-none placeholder:text-premium-text/40 focus:border-premium-gold"
      />

      <div className="relative space-y-2 md:hidden">
        {loading && (
          <div className="overflow-hidden rounded-xl border border-premium-border bg-premium-surface">
            <SkeletonRows />
          </div>
        )}
        {!loading && filtered.length === 0 && (
          <div className="rounded-xl border border-premium-border bg-premium-surface px-4 py-6 text-center text-sm text-premium-text/40">
            {showArchived ? 'Архив пуст.' : 'Ничего не найдено.'}
          </div>
        )}
        {filtered.map((ing) => (
          <button
            key={ing.id}
            onClick={() => handleRowClick(ing)}
            className="premium-card w-full rounded-xl border border-premium-border bg-premium-surface p-4 text-left active:bg-premium-surface-2"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <span className={`h-2 w-2 shrink-0 rounded-full ${COLOR_DOT[ing['цвет']]}`} />
                <span className="truncate text-sm font-medium text-premium-text">{ing['название']}</span>
              </div>
              <span className="shrink-0 text-sm font-semibold text-premium-text">
                {ing['остаток']} {ing['ед.измерения']}
              </span>
            </div>
            <div className="mt-1.5 flex items-center justify-between text-xs text-premium-text/50">
              <span className="truncate">{materialCategoryLabel(ing['категория']) || '—'}</span>
              <span className="shrink-0">
                мин. {ing['мин.остаток']} {ing['ед.измерения']} · {formatDate(ing['последнее движение'])}
              </span>
            </div>
          </button>
        ))}
      </div>

      <div className="relative hidden overflow-hidden rounded-xl border border-premium-border bg-premium-surface md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-premium-border text-left text-premium-text/50">
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
                <td colSpan={5} className="p-0">
                  <SkeletonRows />
                </td>
              </tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-premium-text/40">
                  {showArchived ? 'Архив пуст.' : 'Ничего не найдено.'}
                </td>
              </tr>
            )}
            {filtered.map((ing) => (
              <tr
                key={ing.id}
                onClick={() => handleRowClick(ing)}
                className="cursor-pointer border-b border-premium-border/60 transition-colors last:border-0 hover:bg-premium-surface-2"
              >
                <td className="px-4 py-3 flex items-center gap-2 text-premium-text">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${COLOR_DOT[ing['цвет']]}`} />
                  {ing['название']}
                </td>
                <td className="px-4 py-3 text-premium-text/60">{materialCategoryLabel(ing['категория'])}</td>
                <td className="px-4 py-3 text-right font-medium text-premium-text">
                  {ing['остаток']} {ing['ед.измерения']}
                </td>
                <td className="px-4 py-3 text-right text-premium-text/50">
                  {ing['мин.остаток']} {ing['ед.измерения']}
                </td>
                <td className="px-4 py-3 text-premium-text/50">{formatDate(ing['последнее движение'])}</td>
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

      {showBatchIncome && (
        <BatchIncomeModal
          ingredients={ingredients}
          onClose={() => setShowBatchIncome(false)}
          onCreated={() => {
            setShowBatchIncome(false)
            load()
          }}
        />
      )}
    </div>
  )
}
