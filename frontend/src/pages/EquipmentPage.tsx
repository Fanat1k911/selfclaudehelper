import { useEffect, useMemo, useState } from 'react'
import { apiFetch } from '../lib/api'
import type { EquipmentItem } from '../types'
import { EquipmentDetailPanel } from '../components/EquipmentDetailPanel'
import { NewEquipmentModal } from '../components/NewEquipmentModal'

const COLOR_DOT: Record<EquipmentItem['цвет'], string> = {
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

export function EquipmentPage() {
  const [items, setItems] = useState<EquipmentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<EquipmentItem | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const data = await apiFetch<EquipmentItem[]>('/equipment')
      setItems(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const rows = q ? items.filter((i) => i['название'].toLowerCase().includes(q)) : items
    return [...rows].sort((a, b) => (a['ниже минимума'] === b['ниже минимума'] ? 0 : a['ниже минимума'] ? -1 : 1))
  }, [items, search])

  function handleChanged() {
    setSelected(null)
    load()
  }

  return (
    <div className="px-4 py-4 sm:px-8 sm:py-6">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="flex items-baseline gap-2 text-xl font-semibold text-ink sm:text-2xl">
          Рабочий инвентарь
          {!loading && <span className="text-sm font-normal text-ink/40">{items.length}</span>}
        </h1>
        <button
          onClick={() => setShowCreate(true)}
          className="w-full whitespace-nowrap rounded-lg bg-accent-add px-3 py-2 text-sm font-medium text-white hover:bg-accent-add-dark sm:w-auto sm:px-4"
        >
          + Добавить инвентарь
        </button>
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
        {filtered.map((it) => (
          <button
            key={it.id}
            onClick={() => setSelected(it)}
            className="w-full rounded-xl border border-ink/10 bg-white p-4 text-left shadow-sm active:bg-cream/60"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <span className={`h-2 w-2 shrink-0 rounded-full ${COLOR_DOT[it['цвет']]}`} />
                <span className="truncate text-sm font-medium text-ink">{it['название']}</span>
              </div>
              <span className="shrink-0 text-sm font-semibold text-ink">
                {it['остаток']} {it['ед.измерения']}
              </span>
            </div>
            <div className="mt-1.5 flex items-center justify-between text-xs text-ink/50">
              <span>мин. {it['мин.остаток']} {it['ед.измерения']}</span>
              <span className="shrink-0">{formatDate(it['последнее движение'])}</span>
            </div>
          </button>
        ))}
      </div>

      <div className="hidden overflow-hidden rounded-xl border border-ink/10 bg-white shadow-sm md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ink/10 text-left text-ink/50">
              <th className="px-4 py-3 font-medium">Название</th>
              <th className="px-4 py-3 font-medium text-right">Остаток</th>
              <th className="px-4 py-3 font-medium text-right">Мин.</th>
              <th className="px-4 py-3 font-medium">Обновлено</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-ink/40">
                  Загрузка…
                </td>
              </tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-ink/40">
                  Ничего не найдено.
                </td>
              </tr>
            )}
            {filtered.map((it) => (
              <tr
                key={it.id}
                onClick={() => setSelected(it)}
                className="cursor-pointer border-b border-ink/5 last:border-0 hover:bg-cream/60"
              >
                <td className="px-4 py-3 flex items-center gap-2">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${COLOR_DOT[it['цвет']]}`} />
                  {it['название']}
                </td>
                <td className="px-4 py-3 text-right font-medium">
                  {it['остаток']} {it['ед.измерения']}
                </td>
                <td className="px-4 py-3 text-right text-ink/50">
                  {it['мин.остаток']} {it['ед.измерения']}
                </td>
                <td className="px-4 py-3 text-ink/50">{formatDate(it['последнее движение'])}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected && (
        <EquipmentDetailPanel item={selected} onClose={() => setSelected(null)} onChanged={handleChanged} />
      )}

      {showCreate && (
        <NewEquipmentModal
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
