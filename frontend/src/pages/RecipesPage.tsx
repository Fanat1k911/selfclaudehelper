import { useEffect, useState } from 'react'
import { apiFetch } from '../lib/api'
import { useAuth } from '../lib/auth'
import { usePremiumBackground } from '../lib/usePremiumBackground'
import type { Recipe, User } from '../types'
import { NewRecipeModal } from '../components/NewRecipeModal'
import { RecipeDetailPanel } from '../components/RecipeDetailPanel'
import { SkeletonRows } from '../components/SkeletonRows'

const MANAGEMENT_ROLES: User['role'][] = ['founder', 'developer']

export function RecipesPage() {
  usePremiumBackground()
  const { user } = useAuth()
  const canManage = !!user && MANAGEMENT_ROLES.includes(user.role)
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [selected, setSelected] = useState<Recipe | null>(null)
  const [showArchived, setShowArchived] = useState(false)

  async function load(archived = showArchived) {
    setLoading(true)
    try {
      const data = await apiFetch<Recipe[]>(`/recipes?archived=${archived}`)
      setRecipes(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load(showArchived)
  }, [showArchived])

  function handleRowClick(recipe: Recipe) {
    setShowCreate(false)
    setSelected(recipe)
  }

  return (
    <div className="relative min-h-full overflow-hidden bg-premium-bg px-4 py-4 sm:px-8 sm:py-6">
      <div className="premium-grain" aria-hidden />
      <div className="relative mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="flex items-baseline gap-2 font-display text-xl font-semibold italic text-premium-text sm:text-2xl">
          Рецепты
          {!loading && <span className="font-sans text-sm font-normal not-italic text-premium-text/40">{recipes.length}</span>}
        </h1>
        <div className="flex items-center gap-6">
          {canManage && (
            <button
              onClick={() => setShowArchived((v) => !v)}
              className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium sm:px-4 ${
                showArchived
                  ? 'bg-premium-gold text-premium-bg'
                  : 'border border-premium-border text-premium-text hover:bg-premium-surface-2'
              }`}
            >
              {showArchived ? 'Активные' : 'Архив'}
            </button>
          )}
          {canManage && !showArchived && (
            <button
              onClick={() => {
                setSelected(null)
                setShowCreate(true)
              }}
              className="whitespace-nowrap rounded-lg bg-premium-gold px-3 py-2 text-sm font-medium text-premium-bg hover:bg-premium-gold-hi sm:px-4"
            >
              + Новый рецепт
            </button>
          )}
        </div>
      </div>

      <div className="relative space-y-2 md:hidden">
        {loading && (
          <div className="overflow-hidden rounded-xl border border-premium-border bg-premium-surface">
            <SkeletonRows />
          </div>
        )}
        {!loading && recipes.length === 0 && (
          <div className="rounded-xl border border-premium-border bg-premium-surface px-4 py-6 text-center text-sm text-premium-text/40">
            {showArchived ? 'Архив пуст.' : 'Рецептов пока нет.'}
          </div>
        )}
        {recipes.map((r) => (
          <button
            key={r.id}
            onClick={() => handleRowClick(r)}
            className="premium-card w-full rounded-xl border border-premium-border bg-premium-surface p-4 text-left active:bg-premium-surface-2"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="truncate text-sm font-medium text-premium-text">{r['название']}</span>
              <span className="shrink-0 text-sm font-semibold text-premium-text">{r['выход партии']}</span>
            </div>
            <div className="mt-1.5 truncate text-xs text-premium-text/50">{r['что производим']}</div>
          </button>
        ))}
      </div>

      <div className="relative hidden overflow-hidden rounded-xl border border-premium-border bg-premium-surface md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-premium-border text-left text-premium-text/50">
              <th className="px-4 py-3 font-medium">Название</th>
              <th className="px-4 py-3 font-medium">Что производим</th>
              <th className="px-4 py-3 font-medium text-right">Выход партии</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={3} className="p-0">
                  <SkeletonRows />
                </td>
              </tr>
            )}
            {!loading && recipes.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-premium-text/40">
                  {showArchived ? 'Архив пуст.' : 'Рецептов пока нет.'}
                </td>
              </tr>
            )}
            {recipes.map((r) => (
              <tr
                key={r.id}
                onClick={() => handleRowClick(r)}
                className="cursor-pointer border-b border-premium-border/60 transition-colors last:border-0 hover:bg-premium-surface-2"
              >
                <td className="px-4 py-3 text-premium-text">{r['название']}</td>
                <td className="px-4 py-3 text-premium-text/60">{r['что производим']}</td>
                <td className="px-4 py-3 text-right text-premium-text">{r['выход партии']}</td>
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
          onChanged={() => load(showArchived)}
        />
      )}

      {canManage && showCreate && (
        <NewRecipeModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false)
            load(showArchived)
          }}
        />
      )}
    </div>
  )
}
