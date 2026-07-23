import { useEffect, useMemo, useState } from 'react'
import { Plus, Truck } from 'lucide-react'
import { apiFetch } from '../lib/api'
import { useAuth } from '../lib/auth'
import { usePremiumBackground } from '../lib/usePremiumBackground'
import type { Ingredient, User } from '../types'
import { IngredientDetailPanel } from '../components/IngredientDetailPanel'
import { NewPackagingMaterialModal } from '../components/NewPackagingMaterialModal'
import { BatchIncomeModal } from '../components/BatchIncomeModal'
import { SkeletonRows } from '../components/SkeletonRows'
import { SearchInput } from '../components/SearchInput'

const MANAGEMENT_ROLES: User['role'][] = ['founder', 'developer']

// Порядок вкладок — держим синхронно с PACKAGING_TYPES в backend/app/constants.py.
const TYPE_TABS = ['все', 'короб', 'флакон', 'наклейка', 'лента', 'прочее'] as const

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

function taraSummary(ing: Ingredient): string {
  switch (ing['тип тары']) {
    case 'короб':
      return [ing['длина, мм'], ing['ширина, мм'], ing['высота, мм']].every((v) => v != null)
        ? `${ing['длина, мм']}×${ing['ширина, мм']}×${ing['высота, мм']} мм`
        : '—'
    case 'флакон':
      return ing['объём, мл'] != null ? `${ing['объём, мл']} мл` : '—'
    case 'наклейка':
      return ing['длина, мм'] != null && ing['ширина, мм'] != null ? `${ing['длина, мм']}×${ing['ширина, мм']} мм` : '—'
    case 'лента':
      return ing['ширина, мм'] != null ? `${ing['ширина, мм']} мм` : '—'
    default:
      return '—'
  }
}

export function PackagingMaterialsPage() {
  usePremiumBackground()
  const { user } = useAuth()
  const canManage = !!user && MANAGEMENT_ROLES.includes(user.role)
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeTab, setTypeTab] = useState<(typeof TYPE_TABS)[number]>('все')
  const [selected, setSelected] = useState<Ingredient | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [showBatchIncome, setShowBatchIncome] = useState(false)
  const [showArchived, setShowArchived] = useState(false)

  async function load(archived = showArchived) {
    setLoading(true)
    try {
      const data = await apiFetch<Ingredient[]>(`/ingredients?archived=${archived}`)
      setIngredients(data.filter((i) => i['категория'] === 'тара'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load(showArchived)
  }, [showArchived])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    let rows = typeTab === 'все' ? ingredients : ingredients.filter((i) => i['тип тары'] === typeTab)
    if (q) rows = rows.filter((i) => i['название'].toLowerCase().includes(q))
    return [...rows].sort((a, b) => a['название'].localeCompare(b['название'], 'ru'))
  }, [ingredients, search, typeTab])

  function handleChanged() {
    setSelected(null)
    load(showArchived)
  }

  return (
    <div className="relative min-h-full overflow-hidden bg-premium-bg px-4 py-4 sm:px-8 sm:py-6">
      <div className="premium-grain" aria-hidden />
      <div className="relative mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="flex items-baseline gap-2 font-display text-xl font-semibold italic text-premium-text sm:text-2xl">
          Упаковка
          {!loading && <span className="font-sans text-sm font-normal not-italic text-premium-text/40">{ingredients.length}</span>}
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          {canManage && (
            <button
              onClick={() => setShowArchived((v) => !v)}
              className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium ${
                showArchived
                  ? 'bg-premium-gold text-premium-bg'
                  : 'border border-premium-border text-premium-text hover:bg-premium-surface-2'
              }`}
            >
              {showArchived ? 'Активные' : 'Архив'}
            </button>
          )}
          {!showArchived && (
            <>
              <button
                onClick={() => setShowBatchIncome(true)}
                disabled={ingredients.length === 0}
                className="flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg bg-premium-gold px-3 py-2 text-sm font-medium text-premium-bg shadow-sm hover:bg-premium-gold-hi disabled:opacity-40"
              >
                <Truck size={15} /> Поставка
              </button>
              <button
                onClick={() => setShowCreate(true)}
                className="flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-premium-gold/50 px-3 py-2 text-sm font-medium text-premium-gold-hi hover:bg-premium-gold/10"
              >
                <Plus size={15} /> Добавить тару
              </button>
            </>
          )}
        </div>
      </div>

      <div className="relative mb-4 flex flex-wrap gap-1.5">
        {TYPE_TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTypeTab(t)}
            className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium capitalize ${
              typeTab === t
                ? 'bg-premium-gold text-premium-bg'
                : 'border border-premium-border text-premium-text/70 hover:bg-premium-surface-2'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <SearchInput value={search} onChange={setSearch} className="relative mb-4" />

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
            onClick={() => setSelected(ing)}
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
              <span className="truncate capitalize">{ing['тип тары'] || '—'} · {taraSummary(ing)}</span>
              <span className="shrink-0">{formatDate(ing['последнее движение'])}</span>
            </div>
          </button>
        ))}
      </div>

      <div className="relative hidden overflow-hidden rounded-xl border border-premium-border bg-premium-surface md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-premium-border text-left text-premium-text/50">
              <th className="px-4 py-3 font-medium">Название</th>
              <th className="px-4 py-3 font-medium">Тип</th>
              <th className="px-4 py-3 font-medium">Параметры</th>
              <th className="px-4 py-3 font-medium text-right">Остаток</th>
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
                onClick={() => setSelected(ing)}
                className="cursor-pointer border-b border-premium-border/60 transition-colors last:border-0 hover:bg-premium-surface-2"
              >
                <td className="px-4 py-3 flex items-center gap-2 text-premium-text">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${COLOR_DOT[ing['цвет']]}`} />
                  {ing['название']}
                </td>
                <td className="px-4 py-3 capitalize text-premium-text/60">{ing['тип тары'] || '—'}</td>
                <td className="px-4 py-3 text-premium-text/60">{taraSummary(ing)}</td>
                <td className="px-4 py-3 text-right font-medium text-premium-text">
                  {ing['остаток']} {ing['ед.измерения']}
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
        <NewPackagingMaterialModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false)
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
