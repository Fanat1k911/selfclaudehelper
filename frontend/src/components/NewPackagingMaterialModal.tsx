import { useState, type FormEvent } from 'react'
import { apiFetch, ApiError } from '../lib/api'

const PACKAGING_TYPES = ['короб', 'флакон', 'наклейка', 'лента', 'прочее']

export function NewPackagingMaterialModal({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: () => void
}) {
  const [name, setName] = useState('')
  const [packagingType, setPackagingType] = useState('короб')
  const [unit, setUnit] = useState('шт')
  const [minStock, setMinStock] = useState('')
  const [initialQty, setInitialQty] = useState('')
  const [widthMm, setWidthMm] = useState('')
  const [heightMm, setHeightMm] = useState('')
  const [lengthMm, setLengthMm] = useState('')
  const [volumeMl, setVolumeMl] = useState('')
  const [materialFinish, setMaterialFinish] = useState('')
  const [tapeFeature, setTapeFeature] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await apiFetch('/ingredients', {
        method: 'POST',
        body: JSON.stringify({
          name,
          category: 'тара',
          unit,
          min_stock: minStock ? Number(minStock) : 0,
          initial_qty: initialQty ? Number(initialQty) : 0,
          packaging_type: packagingType,
          width_mm: widthMm ? Number(widthMm) : null,
          height_mm: heightMm ? Number(heightMm) : null,
          length_mm: lengthMm ? Number(lengthMm) : null,
          volume_ml: volumeMl ? Number(volumeMl) : null,
          material_finish: materialFinish || null,
          tape_feature: tapeFeature || null,
        }),
      })
      onCreated()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось создать тару.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-2xl bg-premium-surface p-6 shadow-2xl space-y-3"
      >
        <div className="text-lg font-semibold text-premium-text mb-2">Новая тара</div>

        <div>
          <label className="block text-xs text-premium-text/60 mb-1">Название</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-premium-border bg-premium-bg px-3 py-2 text-sm text-premium-text outline-none focus:border-premium-gold"
            required
          />
        </div>

        <div>
          <label className="block text-xs text-premium-text/60 mb-1">Тип тары</label>
          <select
            value={packagingType}
            onChange={(e) => setPackagingType(e.target.value)}
            className="w-full rounded-lg border border-premium-border bg-premium-bg px-3 py-2 text-sm text-premium-text outline-none focus:border-premium-gold"
          >
            {PACKAGING_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        {packagingType === 'короб' && (
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-premium-text/60 mb-1">Длина, мм</label>
              <input type="number" step="any" min="0" value={lengthMm} onChange={(e) => setLengthMm(e.target.value)} className="w-full rounded-lg border border-premium-border bg-premium-bg px-3 py-2 text-sm text-premium-text outline-none focus:border-premium-gold" />
            </div>
            <div>
              <label className="block text-xs text-premium-text/60 mb-1">Ширина, мм</label>
              <input type="number" step="any" min="0" value={widthMm} onChange={(e) => setWidthMm(e.target.value)} className="w-full rounded-lg border border-premium-border bg-premium-bg px-3 py-2 text-sm text-premium-text outline-none focus:border-premium-gold" />
            </div>
            <div>
              <label className="block text-xs text-premium-text/60 mb-1">Высота, мм</label>
              <input type="number" step="any" min="0" value={heightMm} onChange={(e) => setHeightMm(e.target.value)} className="w-full rounded-lg border border-premium-border bg-premium-bg px-3 py-2 text-sm text-premium-text outline-none focus:border-premium-gold" />
            </div>
          </div>
        )}

        {packagingType === 'флакон' && (
          <>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-premium-text/60 mb-1">Объём, мл</label>
                <input type="number" step="any" min="0" value={volumeMl} onChange={(e) => setVolumeMl(e.target.value)} className="w-full rounded-lg border border-premium-border bg-premium-bg px-3 py-2 text-sm text-premium-text outline-none focus:border-premium-gold" />
              </div>
              <div>
                <label className="block text-xs text-premium-text/60 mb-1">Ширина, мм</label>
                <input type="number" step="any" min="0" value={widthMm} onChange={(e) => setWidthMm(e.target.value)} className="w-full rounded-lg border border-premium-border bg-premium-bg px-3 py-2 text-sm text-premium-text outline-none focus:border-premium-gold" />
              </div>
              <div>
                <label className="block text-xs text-premium-text/60 mb-1">Высота, мм</label>
                <input type="number" step="any" min="0" value={heightMm} onChange={(e) => setHeightMm(e.target.value)} className="w-full rounded-lg border border-premium-border bg-premium-bg px-3 py-2 text-sm text-premium-text outline-none focus:border-premium-gold" />
              </div>
            </div>
            <div>
              <label className="block text-xs text-premium-text/60 mb-1">Материал исполнения (алюминий/стекло/пластик)</label>
              <input value={materialFinish} onChange={(e) => setMaterialFinish(e.target.value)} className="w-full rounded-lg border border-premium-border bg-premium-bg px-3 py-2 text-sm text-premium-text outline-none focus:border-premium-gold" />
            </div>
          </>
        )}

        {packagingType === 'наклейка' && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-premium-text/60 mb-1">Длина, мм</label>
              <input type="number" step="any" min="0" value={lengthMm} onChange={(e) => setLengthMm(e.target.value)} className="w-full rounded-lg border border-premium-border bg-premium-bg px-3 py-2 text-sm text-premium-text outline-none focus:border-premium-gold" />
            </div>
            <div>
              <label className="block text-xs text-premium-text/60 mb-1">Ширина, мм</label>
              <input type="number" step="any" min="0" value={widthMm} onChange={(e) => setWidthMm(e.target.value)} className="w-full rounded-lg border border-premium-border bg-premium-bg px-3 py-2 text-sm text-premium-text outline-none focus:border-premium-gold" />
            </div>
          </div>
        )}

        {packagingType === 'лента' && (
          <>
            <div>
              <label className="block text-xs text-premium-text/60 mb-1">Ширина, мм</label>
              <input type="number" step="any" min="0" value={widthMm} onChange={(e) => setWidthMm(e.target.value)} className="w-full rounded-lg border border-premium-border bg-premium-bg px-3 py-2 text-sm text-premium-text outline-none focus:border-premium-gold" />
            </div>
            <div>
              <label className="block text-xs text-premium-text/60 mb-1">Особенность</label>
              <input value={tapeFeature} onChange={(e) => setTapeFeature(e.target.value)} className="w-full rounded-lg border border-premium-border bg-premium-bg px-3 py-2 text-sm text-premium-text outline-none focus:border-premium-gold" />
            </div>
          </>
        )}

        <div>
          <label className="block text-xs text-premium-text/60 mb-1">Единица измерения</label>
          <input
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            placeholder="шт / г / м"
            className="w-full rounded-lg border border-premium-border bg-premium-bg px-3 py-2 text-sm text-premium-text outline-none focus:border-premium-gold"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-premium-text/60 mb-1">Мин. остаток</label>
            <input
              type="number"
              step="any"
              min="0"
              value={minStock}
              onChange={(e) => setMinStock(e.target.value)}
              className="w-full rounded-lg border border-premium-border bg-premium-bg px-3 py-2 text-sm text-premium-text outline-none focus:border-premium-gold"
            />
          </div>
          <div>
            <label className="block text-xs text-premium-text/60 mb-1">Начальный остаток</label>
            <input
              type="number"
              step="any"
              min="0"
              value={initialQty}
              onChange={(e) => setInitialQty(e.target.value)}
              className="w-full rounded-lg border border-premium-border bg-premium-bg px-3 py-2 text-sm text-premium-text outline-none focus:border-premium-gold"
            />
          </div>
        </div>

        {error && <div className="text-sm text-red-400">{error}</div>}

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg bg-premium-surface-2 py-2 text-sm font-medium text-premium-text hover:bg-premium-border"
          >
            Отмена
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 rounded-lg bg-premium-gold py-2 text-sm font-medium text-premium-bg hover:bg-premium-gold-hi disabled:opacity-60"
          >
            {submitting ? 'Создаём…' : 'Создать'}
          </button>
        </div>
      </form>
    </div>
  )
}
