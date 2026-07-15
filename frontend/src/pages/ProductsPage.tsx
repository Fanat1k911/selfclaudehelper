import { useEffect, useState } from 'react'
import { apiFetch } from '../lib/api'
import type { Product } from '../types'
import { NewProductModal } from '../components/NewProductModal'

export function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const data = await apiFetch<Product[]>('/products')
      setProducts(data)
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
        <h1 className="text-2xl font-semibold text-ink">Товары</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="rounded-lg bg-terracotta px-4 py-2 text-sm font-medium text-white hover:bg-terracotta-dark"
        >
          + Новый товар
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-ink/10 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ink/10 text-left text-ink/50">
              <th className="px-4 py-3 font-medium">Название</th>
              <th className="px-4 py-3 font-medium">Категория</th>
              <th className="px-4 py-3 font-medium">GTIN</th>
              <th className="px-4 py-3 font-medium">Рецепт</th>
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
            {!loading && products.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-ink/40">
                  Товаров пока нет.
                </td>
              </tr>
            )}
            {products.map((p) => (
              <tr key={p.id} className="border-b border-ink/5 last:border-0">
                <td className="px-4 py-3">{p['название']}</td>
                <td className="px-4 py-3 text-ink/60">{p['категория']}</td>
                <td className="px-4 py-3 text-ink/60">{p.GTIN}</td>
                <td className="px-4 py-3 text-ink/50">{p['название рецепта'] || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <NewProductModal
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
