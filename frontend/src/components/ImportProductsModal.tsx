import { useEffect, useState, type ChangeEvent } from 'react'
import { apiFetch, apiUpload, ApiError } from '../lib/api'
import type { Recipe } from '../types'

interface PreviewRow {
  name: string
  category: string
  gtin: string
  tn_ved: string
  declaration: string
  declaration_expires: string
  status: string
}

export function ImportProductsModal({
  onClose,
  onImported,
}: {
  onClose: () => void
  onImported: () => void
}) {
  const [file, setFile] = useState<File | null>(null)
  const [sheets, setSheets] = useState<string[]>([])
  const [sheetName, setSheetName] = useState('')
  const [rows, setRows] = useState<PreviewRow[]>([])
  const [recipeByRow, setRecipeByRow] = useState<Record<number, string>>({})
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    apiFetch<Recipe[]>('/recipes').then(setRecipes)
  }, [])

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0]
    if (!picked) return
    setError(null)
    setLoading(true)
    setRows([])
    setSheets([])
    setSheetName('')
    setFile(picked)
    try {
      const { sheets: names } = await apiUpload<{ sheets: string[] }>('/products/import/sheets', picked)
      if (names.length === 1) {
        setSheetName(names[0])
        const preview = await apiUpload<PreviewRow[]>('/products/import/preview', picked, { sheet_name: names[0] })
        setRows(preview)
      } else {
        setSheets(names)
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось прочитать файл.')
    } finally {
      setLoading(false)
      e.target.value = ''
    }
  }

  async function handleSheetSelect(name: string) {
    if (!file) return
    setSheetName(name)
    setError(null)
    setLoading(true)
    setRows([])
    try {
      const preview = await apiUpload<PreviewRow[]>('/products/import/preview', file, { sheet_name: name })
      setRows(preview)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось прочитать вкладку.')
    } finally {
      setLoading(false)
    }
  }

  const okRows = rows.map((r, i) => ({ r, i })).filter(({ r }) => r.status === 'ok')

  async function handleConfirm() {
    setSubmitting(true)
    setError(null)
    try {
      await apiFetch('/products/import/commit', {
        method: 'POST',
        body: JSON.stringify({
          rows: okRows.map(({ r, i }) => ({
            name: r.name,
            category: r.category,
            gtin: r.gtin,
            tn_ved: r.tn_ved,
            declaration: r.declaration,
            declaration_expires: r.declaration_expires,
            recipe_id: recipeByRow[i] || '',
          })),
        }),
      })
      onImported()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось применить импорт.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-3xl max-h-[85vh] touch-pan-y overflow-y-auto overflow-x-hidden rounded-2xl bg-premium-surface p-6 shadow-2xl space-y-4"
      >
        <div className="text-lg font-semibold text-premium-text">Импорт продуктов из файла</div>
        <p className="text-sm text-premium-text/50">
          Ожидаются колонки: Наименование, Категория, GTIN, ТН ВЭД, Декларация соответствия, Срок действия РД.
          Импорт только создаёт новые продукты — если GTIN уже есть в базе, строка пропускается.
          Рецепт выбирается вручную по каждой строке — без него «готово к отгрузке» не будет считаться.
        </p>

        <label className="inline-block cursor-pointer rounded-lg bg-premium-gold px-3 py-2 text-sm font-medium text-premium-bg hover:bg-premium-gold-hi">
          Загрузить файл
          <input type="file" accept=".xlsx" className="hidden" onChange={handleFile} />
        </label>

        {sheets.length > 0 && (
          <div className="space-y-1">
            <div className="text-sm text-premium-text/70">В файле несколько вкладок — выберите нужную:</div>
            <select
              value={sheetName}
              onChange={(e) => handleSheetSelect(e.target.value)}
              className="w-full max-w-sm rounded-lg border border-premium-border bg-premium-bg px-3 py-2 text-sm text-premium-text outline-none focus:border-premium-gold"
            >
              <option value="" disabled>
                Выберите вкладку…
              </option>
              {sheets.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>
        )}

        {loading && <div className="text-sm text-premium-text/50">Читаем файл…</div>}
        {error && <div className="text-sm text-red-400">{error}</div>}

        {rows.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-premium-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-premium-border text-left text-premium-text/50">
                  <th className="px-3 py-2 font-medium">Название</th>
                  <th className="px-3 py-2 font-medium">Категория</th>
                  <th className="px-3 py-2 font-medium">GTIN</th>
                  <th className="px-3 py-2 font-medium">ТН ВЭД</th>
                  <th className="px-3 py-2 font-medium">Рецепт</th>
                  <th className="px-3 py-2 font-medium">Статус</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-b border-premium-border/60 text-premium-text last:border-0">
                    <td className="px-3 py-2">{r.name}</td>
                    <td className="px-3 py-2 text-premium-text/60">{r.category}</td>
                    <td className="px-3 py-2 text-premium-text/60">{r.gtin}</td>
                    <td className="px-3 py-2 text-premium-text/50">{r.tn_ved || '—'}</td>
                    <td className="px-3 py-2">
                      {r.status === 'ok' ? (
                        <select
                          value={recipeByRow[i] || ''}
                          onChange={(e) => setRecipeByRow((prev) => ({ ...prev, [i]: e.target.value }))}
                          className="w-full max-w-[10rem] rounded-lg border border-premium-border bg-premium-bg px-2 py-1 text-xs text-premium-text outline-none focus:border-premium-gold"
                        >
                          <option value="">без рецепта</option>
                          {recipes.map((rec) => (
                            <option key={rec.id} value={rec.id}>
                              {rec['название']}
                            </option>
                          ))}
                        </select>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className={`px-3 py-2 ${r.status === 'ok' ? 'text-premium-sage-hi' : 'text-red-400'}`}>
                      {r.status === 'ok' ? 'ок' : r.status}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg bg-premium-surface-2 py-2 text-sm font-medium text-premium-text hover:bg-premium-border"
          >
            Закрыть
          </button>
          <button
            onClick={handleConfirm}
            disabled={submitting || okRows.length === 0}
            className="flex-1 rounded-lg bg-premium-gold py-2 text-sm font-medium text-premium-bg hover:bg-premium-gold-hi disabled:opacity-60"
          >
            {submitting ? 'Применяем…' : `Применить (${okRows.length})`}
          </button>
        </div>
      </div>
    </div>
  )
}
