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

  return (
    <div className="px-8 py-6">
      <div className="relative z-[60] flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-ink">Рецепты</h1>
        {canManage && (
          <button
            onClick={() => {
              setSelected(null)
              setShowCreate(true)
            }}
            className="rounded-lg bg-terracotta px-4 py-2 text-sm font-medium text-white hover:bg-terracotta-dark"
          >
            + Новый рецепт
          </button>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-ink/10 bg-white shadow-sm">
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
                onClick={() => {
                  setShowCreate(false)
                  setSelected(r)
                }}
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
