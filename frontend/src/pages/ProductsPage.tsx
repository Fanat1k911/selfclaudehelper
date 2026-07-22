import { useEffect, useState } from 'react'
import { apiFetch } from '../lib/api'
import { usePremiumBackground } from '../lib/usePremiumBackground'
import type { Product } from '../types'
import { NewProductModal } from '../components/NewProductModal'
import { ImportProductsModal } from '../components/ImportProductsModal'
import { EditProductModal } from '../components/EditProductModal'
import { SkeletonRows } from '../components/SkeletonRows'

export function ProductsPage() {
  usePremiumBackground()
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
    <div className="relative min-h-full overflow-hidden bg-premium-bg px-4 py-4 sm:px-8 sm:py-6">
      <div className="premium-grain" aria-hidden />
      <div className="relative mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="flex items-baseline gap-2 font-display text-xl font-semibold italic text-premium-text sm:text-2xl">
          Продукт
          {!loading && <span className="font-sans text-sm font-normal not-italic text-premium-text/40">{products.length}</span>}
        </h1>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setShowCreate(true)}
            className="whitespace-nowrap rounded-lg bg-premium-gold px-3 py-2 text-sm font-medium text-premium-bg hover:bg-premium-gold-hi sm:px-4"
          >
            + Новый продукт
          </button>
          <button
            onClick={() => setShowImport(true)}
            className="whitespace-nowrap rounded-lg border border-premium-border px-3 py-2 text-sm font-medium text-premium-text hover:bg-premium-surface-2 sm:px-4"
          >
            Импорт из файла
          </button>
        </div>
      </div>

      <div className="relative space-y-2 md:hidden">
        {loading && (
          <div className="overflow-hidden rounded-xl border border-premium-border bg-premium-surface">
            <SkeletonRows />
          </div>
        )}
        {!loading && products.length === 0 && (
          <div className="rounded-xl border border-premium-border bg-premium-surface px-4 py-6 text-center text-sm text-premium-text/40">
            Продуктов пока нет.
          </div>
        )}
        {products.map((p) => (
          <div
            key={p.id}
            onClick={() => setEditing(p)}
            className="premium-card cursor-pointer rounded-xl border border-premium-border bg-premium-surface p-4 active:bg-premium-surface-2"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="truncate text-sm font-medium text-premium-text">{p['название']}</span>
              <span className="shrink-0 text-xs text-premium-text/50">{p.GTIN}</span>
            </div>
            <div className="mt-1.5 text-xs text-premium-text/50">{p['категория']}</div>
            <div className="mt-1.5 flex items-center justify-between text-xs">
              <span className="text-premium-text/50">Готово к отгрузке</span>
              <span className="shrink-0 font-medium text-premium-text">
                {p['готово к отгрузке'] === null ? (
                  <span className="text-amber-500" title="Нет рецепта — продажа не проверяет остаток">
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

      <div className="relative hidden overflow-hidden rounded-xl border border-premium-border bg-premium-surface md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-premium-border text-left text-premium-text/50">
              <th className="px-4 py-3 font-medium">Название</th>
              <th className="px-4 py-3 font-medium">Категория</th>
              <th className="px-4 py-3 font-medium">GTIN</th>
              <th className="px-4 py-3 font-medium text-right">Готово к отгрузке</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={4} className="p-0">
                  <SkeletonRows />
                </td>
              </tr>
            )}
            {!loading && products.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-premium-text/40">
                  Продуктов пока нет.
                </td>
              </tr>
            )}
            {products.map((p) => (
              <tr
                key={p.id}
                onClick={() => setEditing(p)}
                className="cursor-pointer border-b border-premium-border/60 transition-colors last:border-0 hover:bg-premium-surface-2"
              >
                <td className="px-4 py-3 text-premium-text">{p['название']}</td>
                <td className="px-4 py-3 text-premium-text/60">{p['категория']}</td>
                <td className="px-4 py-3 text-premium-text/60">{p.GTIN}</td>
                <td className="px-4 py-3 text-right font-medium text-premium-text">
                  {p['готово к отгрузке'] === null ? (
                    <span className="text-amber-500" title="Нет рецепта — продажа не проверяет остаток">
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
