import { useEffect, useState, type FormEvent } from 'react'
import { AlertTriangle, ArrowUpCircle, HelpCircle, SlidersHorizontal } from 'lucide-react'
import { apiFetch, ApiError } from '../lib/api'
import type { EquipmentItem, EquipmentTransaction } from '../types'

type ActionKind = 'приход' | 'поломка' | 'пропажа' | 'корректировка' | null

const COLOR_DOT: Record<EquipmentItem['цвет'], string> = {
  'зелёный': 'bg-emerald-500',
  'жёлтый': 'bg-amber-500',
  'красный': 'bg-red-500',
}

const ACTION_META: Record<Exclude<ActionKind, null>, { label: string; icon: typeof ArrowUpCircle; endpoint: string }> = {
  'приход': { label: 'Приход', icon: ArrowUpCircle, endpoint: 'income' },
  'поломка': { label: 'Поломка', icon: AlertTriangle, endpoint: 'broken' },
  'пропажа': { label: 'Пропажа', icon: HelpCircle, endpoint: 'lost' },
  'корректировка': { label: 'Инвентаризация', icon: SlidersHorizontal, endpoint: 'adjustment' },
}

function formatDate(value: string | null) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('ru-RU')
}

export function EquipmentDetailPanel({
  item,
  onClose,
  onChanged,
}: {
  item: EquipmentItem
  onClose: () => void
  onChanged: () => void
}) {
  const [action, setAction] = useState<ActionKind>(null)
  const [qty, setQty] = useState('')
  const [cost, setCost] = useState('')
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [transactions, setTransactions] = useState<EquipmentTransaction[] | null>(null)
  const [loadingHistory, setLoadingHistory] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoadingHistory(true)
    apiFetch<EquipmentTransaction[]>(`/equipment/${item.id}/transactions`)
      .then((rows) => {
        if (!cancelled) setTransactions(rows)
      })
      .catch(() => {
        if (!cancelled) setTransactions([])
      })
      .finally(() => {
        if (!cancelled) setLoadingHistory(false)
      })
    return () => {
      cancelled = true
    }
  }, [item.id])

  function resetForm() {
    setAction(null)
    setQty('')
    setCost('')
    setComment('')
    setError(null)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!action) return
    setError(null)
    setSubmitting(true)
    try {
      if (action === 'корректировка') {
        await apiFetch(`/equipment/${item.id}/adjustment`, {
          method: 'POST',
          body: JSON.stringify({ actual_qty: Number(qty), comment }),
        })
      } else {
        await apiFetch(`/equipment/${item.id}/${ACTION_META[action].endpoint}`, {
          method: 'POST',
          body: JSON.stringify({
            qty: Number(qty),
            cost: cost ? Number(cost) : undefined,
            comment,
          }),
        })
      }
      resetForm()
      onChanged()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось сохранить.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <div
        className="flex h-full w-full max-w-md flex-col bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-ink/10 px-6 py-5">
          <div className="text-lg font-semibold text-ink">{item['название']}</div>
          <button onClick={onClose} className="text-ink/40 hover:text-ink text-xl leading-none">
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="px-6 py-5 border-b border-ink/10 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-ink/60">Остаток</span>
              <span className="flex items-center gap-2 font-medium">
                <span className={`h-2 w-2 rounded-full ${COLOR_DOT[item['цвет']]}`} />
                {item['остаток']} {item['ед.измерения']}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-ink/60">Мин. остаток</span>
              <span>{item['мин.остаток']} {item['ед.измерения']}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-ink/60">Последнее движение</span>
              <span>{formatDate(item['последнее движение'])}</span>
            </div>
          </div>

          <div className="px-6 py-4 border-b border-ink/10">
            <div className="grid grid-cols-4 gap-2">
              {(['приход', 'поломка', 'пропажа', 'корректировка'] as const).map((kind) => {
                const { label, icon: Icon } = ACTION_META[kind]
                return (
                  <button
                    key={kind}
                    onClick={() => {
                      resetForm()
                      if (action !== kind) setAction(kind)
                    }}
                    className={`flex flex-col items-center gap-1 rounded-lg border py-2.5 text-xs font-medium transition-colors ${
                      action === kind
                        ? 'border-terracotta bg-terracotta text-white shadow-sm'
                        : 'border-ink/15 bg-white text-ink hover:border-terracotta/50 hover:bg-terracotta/5'
                    }`}
                  >
                    <Icon size={16} strokeWidth={2} />
                    {label}
                  </button>
                )
              })}
            </div>

            {action && (
              <form onSubmit={handleSubmit} className="mt-4 space-y-3">
                <div>
                  <label className="block text-xs text-ink/60 mb-1">
                    {action === 'корректировка' ? 'Фактическое количество' : 'Количество'}
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={qty}
                    onChange={(e) => setQty(e.target.value)}
                    className="w-full rounded-lg border border-ink/10 px-3 py-2 text-sm outline-none focus:border-terracotta"
                    required
                  />
                </div>
                {(action === 'приход' || action === 'поломка' || action === 'пропажа') && (
                  <div>
                    <label className="block text-xs text-ink/60 mb-1">
                      {action === 'приход' ? 'Цена (необязательно)' : 'Трата на ремонт/замену (необязательно)'}
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={cost}
                      onChange={(e) => setCost(e.target.value)}
                      className="w-full rounded-lg border border-ink/10 px-3 py-2 text-sm outline-none focus:border-terracotta"
                    />
                  </div>
                )}
                <div>
                  <label className="block text-xs text-ink/60 mb-1">Комментарий</label>
                  <input
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    className="w-full rounded-lg border border-ink/10 px-3 py-2 text-sm outline-none focus:border-terracotta"
                  />
                </div>
                {error && <div className="text-sm text-red-600">{error}</div>}
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-lg bg-terracotta py-2 text-sm font-medium text-white hover:bg-terracotta-dark disabled:opacity-60"
                >
                  {submitting ? 'Сохраняем…' : 'Сохранить'}
                </button>
              </form>
            )}
          </div>

          <div className="px-6 py-4">
            <div className="text-sm font-medium text-ink/70 mb-3">Движение</div>
            {loadingHistory && <div className="text-sm text-ink/40">Загрузка…</div>}
            {!loadingHistory && transactions?.length === 0 && (
              <div className="text-sm text-ink/40">Движений пока нет.</div>
            )}
            <div className="space-y-2">
              {transactions?.map((tx) => (
                <div key={tx.id} className="flex items-start justify-between text-sm border-b border-ink/5 pb-2">
                  <div>
                    <div className="capitalize">{tx['тип']}</div>
                    <div className="text-xs text-ink/40">{formatDate(tx['дата'])}</div>
                    {tx['комментарий'] && <div className="text-xs text-ink/50">{tx['комментарий']}</div>}
                  </div>
                  <div className="text-right">
                    <div className="font-medium">
                      {tx['тип'] === 'поломка' || tx['тип'] === 'пропажа' ? '-' : '+'}
                      {Math.abs(Number(tx['кол-во']))} {item['ед.измерения']}
                    </div>
                    {tx['трата'] !== '' && <div className="text-xs text-ink/50">{tx['трата']} ₽</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
