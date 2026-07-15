import { useEffect, useState } from 'react'
import { apiFetch } from '../lib/api'
import { useAuth } from '../lib/auth'
import type { Recipe, User } from '../types'
import { NewRecipeModal } from '../components/NewRecipeModal'
import { RecipeDetailPanel } from '../components/RecipeDetailPanel'

const MANAGEMENT_ROLES: User['role'][] = ['founder', 'developer']

export function RecipesPage() {
  const { user } = useAuth()
  const canManage = !!user && MANAGEMENT_ROLES.includes(user.role)
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [selected, setSelected] = useState<Recipe | null>(null)

  async function load() {
    setLoading(true)
    try {
      const data = await apiFetch<Recipe[]>('/recipes')
      setRecipes(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  function handleRowClick(recipe: Recipe) {
    setShowCreate(false)
    setSelected(recipe)
  }

  return (
    <div className="px-4 py-4 sm:px-8 sm:py-6">
      <div className="relative z-[60] mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-semibold text-ink sm:text-2xl">Рецепты</h1>
        {canManage && (
          <button
            onClick={() => {
              setSelected(null)
              setShowCreate(true)
            }}
            className="whitespace-nowrap rounded-lg bg-terracotta px-3 py-2 text-sm font-medium text-white hover:bg-terracotta-dark sm:px-4"
          >
            + Новый рецепт
          </button>
        )}
      </div>

      <div className="space-y-2 md:hidden">
        {loading && (
          <div className="rounded-xl border border-ink/10 bg-white px-4 py-6 text-center text-sm text-ink/40">
            Загрузка…
          </div>
        )}
        {!loading && recipes.length === 0 && (
          <div className="rounded-xl border border-ink/10 bg-white px-4 py-6 text-center text-sm text-ink/40">
            Рецептов пока нет.
          </div>
        )}
        {recipes.map((r) => (
          <button
            key={r.id}
            onClick={() => handleRowClick(r)}
            className="w-full rounded-xl border border-ink/10 bg-white p-4 text-left shadow-sm active:bg-cream/60"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="truncate text-sm font-medium text-ink">{r['название']}</span>
              <span className="shrink-0 text-sm font-semibold text-ink">{r['выход партии']}</span>
            </div>
            <div className="mt-1.5 truncate text-xs text-ink/50">{r['что производим']}</div>
          </button>
        ))}
      </div>

      <div className="hidden overflow-hidden rounded-xl border border-ink/10 bg-white shadow-sm md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ink/10 text-left text-ink/50">
              <th className="px-4 py-3 font-medium">Название</th>
              <th className="px-4 py-3 font-medium">Что производим</th>
              <th className="px-4 py-3 font-medium text-right">Выход партии</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-ink/40">
                  Загрузка…
                </td>
              </tr>
            )}
            {!loading && recipes.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-ink/40">
                  Рецептов пока нет.
                </td>
              </tr>
            )}
            {recipes.map((r) => (
              <tr
                key={r.id}
                onClick={() => handleRowClick(r)}
                className="cursor-pointer border-b border-ink/5 last:border-0 hover:bg-cream/60"
              >
                <td className="px-4 py-3">{r['название']}</td>
                <td className="px-4 py-3 text-ink/60">{r['что производим']}</td>
                <td className="px-4 py-3 text-right">{r['выход партии']}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected && (
        <RecipeDetailPanel
          recipe={selected}
          canEdit={canManage}
          onClose={() => setSelected(null)}
          onChanged={load}
        />
      )}

      {canManage && showCreate && (
        <NewRecipeModal
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
