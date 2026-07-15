import { useState, type FormEvent } from 'react'
import { apiFetch, ApiError } from '../lib/api'

export function NewRecipeModal({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: () => void
}) {
  const [name, setName] = useState('')
  const [produces, setProduces] = useState('')
  const [batchYield, setBatchYield] = useState('')
  const [technology, setTechnology] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await apiFetch('/recipes', {
        method: 'POST',
        body: JSON.stringify({
          name,
          produces,
          batch_yield: batchYield ? Number(batchYield) : 0,
          technology,
        }),
      })
      onCreated()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось создать рецепт.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl space-y-3"
      >
        <div className="text-lg font-semibold text-ink mb-2">Новый рецепт</div>

        <div>
          <label className="block text-xs text-ink/60 mb-1">Название</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-ink/10 px-3 py-2 text-sm outline-none focus:border-terracotta"
            required
          />
        </div>

        <div>
          <label className="block text-xs text-ink/60 mb-1">Что производим</label>
          <input
            value={produces}
            onChange={(e) => setProduces(e.target.value)}
            className="w-full rounded-lg border border-ink/10 px-3 py-2 text-sm outline-none focus:border-terracotta"
            required
          />
        </div>

        <div>
          <label className="block text-xs text-ink/60 mb-1">Выход партии</label>
          <input
            type="number"
            step="any"
            value={batchYield}
            onChange={(e) => setBatchYield(e.target.value)}
            className="w-full rounded-lg border border-ink/10 px-3 py-2 text-sm outline-none focus:border-terracotta"
          />
        </div>

        <div>
          <label className="block text-xs text-ink/60 mb-1">Технология</label>
          <textarea
            value={technology}
            onChange={(e) => setTechnology(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-ink/10 px-3 py-2 text-sm outline-none focus:border-terracotta"
          />
        </div>

        {error && <div className="text-sm text-red-600">{error}</div>}

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg bg-cream py-2 text-sm font-medium text-ink hover:bg-ink/5"
          >
            Отмена
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 rounded-lg bg-terracotta py-2 text-sm font-medium text-white hover:bg-terracotta-dark disabled:opacity-60"
          >
            {submitting ? 'Создаём…' : 'Создать'}
          </button>
        </div>
      </form>
    </div>
  )
}
