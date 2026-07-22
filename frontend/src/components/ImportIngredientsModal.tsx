import { useState, type ChangeEvent } from 'react'
import { apiDownload, apiFetch, apiUpload, ApiError } from '../lib/api'

interface PreviewRow {
  name: string
  material_id: string | null
  current_qty: number | null
  new_qty: number | null
  delta: number | null
  status: string
}

export function ImportIngredientsModal({
  onClose,
  onImported,
}: {
  onClose: () => void
  onImported: () => void
}) {
  const [rows, setRows] = useState<PreviewRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    setLoading(true)
    setRows([])
    try {
      const preview = await apiUpload<PreviewRow[]>('/ingredients/import/preview', file)
      setRows(preview)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось прочитать файл.')
    } finally {
      setLoading(false)
      e.target.value = ''
    }
  }

  const okRows = rows.filter((r) => r.status === 'ok' && r.delta !== 0)

  async function handleConfirm() {
    setSubmitting(true)
    setError(null)
    try {
      await apiFetch('/ingredients/import/commit', {
        method: 'POST',
        body: JSON.stringify({
          rows: okRows.map((r) => ({ material_id: r.material_id, new_qty: r.new_qty })),
          comment: 'импорт из файла',
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
        className="w-full max-w-2xl max-h-[85vh] touch-pan-y overflow-y-auto overflow-x-hidden rounded-2xl bg-premium-surface p-6 shadow-2xl space-y-4"
      >
        <div className="text-lg font-semibold text-premium-text">Импорт остатков из файла</div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => apiDownload('/ingredients/export-template', 'компоненты.xlsx')}
            className="rounded-lg bg-premium-surface-2 px-3 py-2 text-sm font-medium text-premium-text hover:bg-premium-border"
          >
            Скачать шаблон (.xlsx)
          </button>
          <label className="cursor-pointer rounded-lg bg-premium-gold px-3 py-2 text-sm font-medium text-premium-bg hover:bg-premium-gold-hi">
            Загрузить файл
            <input type="file" accept=".xlsx" className="hidden" onChange={handleFile} />
          </label>
        </div>

        {loading && <div className="text-sm text-premium-text/50">Читаем файл…</div>}
        {error && <div className="text-sm text-red-400">{error}</div>}

        {rows.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-premium-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-premium-border text-left text-premium-text/50">
                  <th className="px-3 py-2 font-medium">Название</th>
                  <th className="px-3 py-2 font-medium text-right">Было</th>
                  <th className="px-3 py-2 font-medium text-right">Станет</th>
                  <th className="px-3 py-2 font-medium">Статус</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-b border-premium-border/60 text-premium-text last:border-0">
                    <td className="px-3 py-2">{r.name}</td>
                    <td className="px-3 py-2 text-right text-premium-text/50">{r.current_qty ?? '—'}</td>
                    <td className="px-3 py-2 text-right font-medium">{r.new_qty ?? '—'}</td>
                    <td className={`px-3 py-2 ${r.status === 'ok' ? 'text-premium-sage-hi' : 'text-red-400'}`}>
                      {r.status === 'ok' ? (r.delta === 0 ? 'без изменений' : 'ок') : r.status}
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
