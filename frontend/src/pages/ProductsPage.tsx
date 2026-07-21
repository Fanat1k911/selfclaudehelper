import { useEffect, useState } from 'react'
import { apiFetch } from '../lib/api'
import type { Product } from '../types'
import { NewProductModal } from '../components/NewProductModal'
import { ImportProductsModal } from '../components/ImportProductsModal'
import { EditProductModal } from '../components/EditProductModal'

export function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)

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
    <div className="px-4 py-4 sm:px-8 sm:py-6">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="flex items-baseline gap-2 text-xl font-semibold text-ink sm:text-2xl">
          Продукт
          {!loading && <span className="text-sm font-normal text-ink/40">{products.length}</span>}
        </h1>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setShowImport(true)}
            className="whitespace-nowrap rounded-lg bg-cream px-3 py-2 text-sm font-medium text-ink hover:bg-ink/5 sm:px-4"
          >
            Импорт из файла
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="whitespace-nowrap rounded-lg bg-accent-add px-3 py-2 text-sm font-medium text-white hover:bg-accent-add-dark sm:px-4"
          >
            + Новый продукт
          </button>
        </div>
      </div>

      <div className="space-y-2 md:hidden">
        {loading && (
          <div className="rounded-xl border border-ink/10 bg-white px-4 py-6 text-center text-sm text-ink/40">
            Загрузка…
          </div>
        )}
        {!loading && products.length === 0 && (
          <div className="rounded-xl border border-ink/10 bg-white px-4 py-6 text-center text-sm text-ink/40">
            Продуктов пока нет.
          </div>
        )}
        {products.map((p) => (
          <div
            key={p.id}
            onClick={() => setEditing(p)}
            className="cursor-pointer rounded-xl border border-ink/10 bg-white p-4 shadow-sm active:bg-ink/5"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="truncate text-sm font-medium text-ink">{p['название']}</span>
              <span className="shrink-0 text-xs text-ink/50">{p.GTIN}</span>
            </div>
            <div className="mt-1.5 text-xs text-ink/50">{p['категория']}</div>
            <div className="mt-1.5 flex items-center justify-between text-xs">
              <span className="text-ink/50">Готово к отгрузке</span>
              <span className="shrink-0 font-medium text-ink">
                {p['готово к отгрузке'] === null ? (
                  <span className="text-amber-600" title="Нет рецепта — продажа не проверяет остаток">
                    без рецепта
                  </span>
                ) : (
                  p['готово к отгрузке']
                )}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="hidden overflow-hidden rounded-xl border border-ink/10 bg-white shadow-sm md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ink/10 text-left text-ink/50">
              <th className="px-4 py-3 font-medium">Название</th>
              <th className="px-4 py-3 font-medium">Категория</th>
              <th className="px-4 py-3 font-medium">GTIN</th>
              <th className="px-4 py-3 font-medium text-right">Готово к отгрузке</th>
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
                  Продуктов пока нет.
                </td>
              </tr>
            )}
            {products.map((p) => (
              <tr
                key={p.id}
                onClick={() => setEditing(p)}
                className="cursor-pointer border-b border-ink/5 last:border-0 hover:bg-ink/5"
              >
                <td className="px-4 py-3">{p['название']}</td>
                <td className="px-4 py-3 text-ink/60">{p['категория']}</td>
                <td className="px-4 py-3 text-ink/60">{p.GTIN}</td>
                <td className="px-4 py-3 text-right font-medium text-ink">
                  {p['готово к отгрузке'] === null ? (
                    <span className="text-amber-600" title="Нет рецепта — продажа не проверяет остаток">
                      без рецепта
                    </span>
                  ) : (
                    p['готово к отгрузке']
                  )}
                </td>
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

      {showImport && (
        <ImportProductsModal
          onClose={() => setShowImport(false)}
          onImported={() => {
            setShowImport(false)
            load()
          }}
        />
      )}

      {editing && (
        <EditProductModal
          product={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            load()
          }}
        />
      )}
    </div>
  )
}
