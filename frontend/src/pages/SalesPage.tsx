import { useEffect, useState } from 'react'
import { apiFetch } from '../lib/api'
import { usePremiumBackground } from '../lib/usePremiumBackground'
import type { Sale } from '../types'
import { SaleModal } from '../components/SaleModal'
import { SkeletonRows } from '../components/SkeletonRows'

function formatDate(value: string | null) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('ru-RU')
}

export function SalesPage() {
  usePremiumBackground()
  const [sales, setSales] = useState<Sale[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [editingSale, setEditingSale] = useState<Sale | null>(null)

  async function load() {
    setLoading(true)
    try {
      const data = await apiFetch<Sale[]>('/sales')
      setSales(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  return (
    <div className="relative min-h-full overflow-hidden bg-premium-bg px-4 py-4 sm:px-8 sm:py-6">
      <div className="premium-grain" aria-hidden />
      <div className="relative mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-display text-xl font-semibold italic text-premium-text sm:text-2xl">Отгрузка</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="whitespace-nowrap rounded-lg bg-premium-gold px-3 py-2 text-sm font-medium text-premium-bg hover:bg-premium-gold-hi sm:px-4"
        >
          + Внести отгрузку
        </button>
      </div>

      <div className="relative space-y-2 md:hidden">
        {loading && (
          <div className="overflow-hidden rounded-xl border border-premium-border bg-premium-surface">
            <SkeletonRows />
          </div>
        )}
        {!loading && sales.length === 0 && (
          <div className="rounded-xl border border-premium-border bg-premium-surface px-4 py-6 text-center text-sm text-premium-text/40">
            Отгрузок пока нет.
          </div>
        )}
        {sales.map((s) => (
          <button
            key={s.id}
            onClick={() => setEditingSale(s)}
            className="premium-card w-full rounded-xl border border-premium-border bg-premium-surface p-4 text-left active:bg-premium-surface-2"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="truncate text-sm font-medium text-premium-text">{s['название']}</span>
              <span className="shrink-0 text-sm font-semibold text-premium-text">{s['кол-во']} шт</span>
            </div>
            <div className="mt-1.5 flex items-center justify-between text-xs text-premium-text/50">
              <span className="truncate">{formatDate(s['дата'])}</span>
              <span className="shrink-0">{s['цена']} ₽</span>
            </div>
            {s['контрагент'] && <div className="mt-1.5 truncate text-xs text-premium-text/50">{s['контрагент']}</div>}
            {s['комментарий'] && <div className="mt-1.5 truncate text-xs text-premium-text/50">{s['комментарий']}</div>}
          </button>
        ))}
      </div>

      <div className="relative hidden overflow-hidden rounded-xl border border-premium-border bg-premium-surface md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-premium-border text-left text-premium-text/50">
              <th className="px-4 py-3 font-medium">Дата</th>
              <th className="px-4 py-3 font-medium">Продукт</th>
              <th className="px-4 py-3 font-medium">Контрагент</th>
              <th className="px-4 py-3 font-medium text-right">Кол-во</th>
              <th className="px-4 py-3 font-medium text-right">Цена</th>
              <th className="px-4 py-3 font-medium">Комментарий</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} className="p-0">
                  <SkeletonRows />
                </td>
              </tr>
            )}
            {!loading && sales.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-premium-text/40">
                  Отгрузок пока нет.
                </td>
              </tr>
            )}
            {sales.map((s) => (
              <tr
                key={s.id}
                onClick={() => setEditingSale(s)}
                className="cursor-pointer border-b border-premium-border/60 transition-colors last:border-0 hover:bg-premium-surface-2"
              >
                <td className="px-4 py-3 text-premium-text/50">{formatDate(s['дата'])}</td>
                <td className="px-4 py-3 text-premium-text">{s['название']}</td>
                <td className="px-4 py-3 text-premium-text/50">{s['контрагент'] || '—'}</td>
                <td className="px-4 py-3 text-right font-medium text-premium-text">{s['кол-во']}</td>
                <td className="px-4 py-3 text-right text-premium-text/50">{s['цена']}</td>
                <td className="px-4 py-3 text-premium-text/50">{s['комментарий']}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <SaleModal
          onClose={() => setShowCreate(false)}
          onSaved={() => {
            setShowCreate(false)
            load()
          }}
        />
      )}

      {editingSale && (
        <SaleModal
          sale={editingSale}
          onClose={() => setEditingSale(null)}
          onSaved={() => {
            setEditingSale(null)
            load()
          }}
        />
      )}
    </div>
  )
}
