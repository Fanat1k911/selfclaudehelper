import { useEffect, useState } from 'react'
import { apiFetch } from '../lib/api'
import type { Sale } from '../types'
import { NewSaleModal } from '../components/NewSaleModal'

function formatDate(value: string | null) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('ru-RU')
}

export function SalesPage() {
  const [sales, setSales] = useState<Sale[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)

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
    <div className="px-8 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-ink">Продажи</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="rounded-lg bg-terracotta px-4 py-2 text-sm font-medium text-white hover:bg-terracotta-dark"
        >
          + Внести продажу
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-ink/10 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ink/10 text-left text-ink/50">
              <th className="px-4 py-3 font-medium">Дата</th>
              <th className="px-4 py-3 font-medium">Товар</th>
              <th className="px-4 py-3 font-medium text-right">Кол-во</th>
              <th className="px-4 py-3 font-medium text-right">Цена</th>
              <th className="px-4 py-3 font-medium">Комментарий</th>
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
            {!loading && sales.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-ink/40">
                  Продаж пока нет.
                </td>
              </tr>
            )}
            {sales.map((s) => (
              <tr key={s.id} className="border-b border-ink/5 last:border-0">
                <td className="px-4 py-3 text-ink/50">{formatDate(s['дата'])}</td>
                <td className="px-4 py-3">{s['название']}</td>
                <td className="px-4 py-3 text-right font-medium">{s['кол-во']}</td>
                <td className="px-4 py-3 text-right text-ink/50">{s['цена']}</td>
                <td className="px-4 py-3 text-ink/50">{s['комментарий']}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <NewSaleModal
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
