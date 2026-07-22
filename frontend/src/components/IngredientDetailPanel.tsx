import { useEffect, useState, type FormEvent } from 'react'
import { ArrowDownCircle, ArrowUpCircle, Pencil, SlidersHorizontal } from 'lucide-react'
import { apiFetch, ApiError } from '../lib/api'
import { useAuth } from '../lib/auth'
import { materialCategoryLabel } from '../lib/labels'
import type { Ingredient, Transaction } from '../types'

type ActionKind = 'приход' | 'расход' | 'корректировка' | null

const COLOR_DOT: Record<Ingredient['цвет'], string> = {
  'зелёный': 'bg-premium-sage-hi',
  'жёлтый': 'bg-amber-500',
  'красный': 'bg-red-500',
}

const ACTION_META: Record<Exclude<ActionKind, null>, { label: string; icon: typeof ArrowUpCircle }> = {
  'приход': { label: 'Приход', icon: ArrowUpCircle },
  'расход': { label: 'Расход', icon: ArrowDownCircle },
  'корректировка': { label: 'Корректировка', icon: SlidersHorizontal },
}

function formatDate(value: string | null) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('ru-RU')
}

export function IngredientDetailPanel({
  ingredient,
  onClose,
  onChanged,
}: {
  ingredient: Ingredient
  onClose: () => void
  onChanged: () => void
}) {
  const { user } = useAuth()
  const canEditAttrs = user?.role === 'founder' || user?.role === 'developer'
  const [action, setAction] = useState<ActionKind>(null)
  const [qty, setQty] = useState('')
  const [price, setPrice] = useState('')
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [transactions, setTransactions] = useState<Transaction[] | null>(null)
  const [loadingHistory, setLoadingHistory] = useState(false)

  const [editingAttrs, setEditingAttrs] = useState(false)
  const [attrs, setAttrs] = useState({
    unitCost: ingredient['себестоимость 1 шт']?.toString() ?? '',
    minBatchQty: ingredient['минимальная партия для закупки']?.toString() ?? '',
    minBatchCost: ingredient['себестоимость минимальной партии']?.toString() ?? '',
    minBatchWeight: ingredient['вес минимальной партии']?.toString() ?? '',
    supplier: ingredient['поставщик'],
    inci: ingredient['INCI'],
  })
  const [savingAttrs, setSavingAttrs] = useState(false)
  const [attrsError, setAttrsError] = useState<string | null>(null)
  const [archiving, setArchiving] = useState(false)

  async function toggleArchived() {
    setArchiving(true)
    try {
      await apiFetch(`/ingredients/${ingredient.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ archived: !ingredient['архив'] }),
      })
      onChanged()
      onClose()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось изменить статус архива.')
    } finally {
      setArchiving(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    setLoadingHistory(true)
    apiFetch<Transaction[]>(`/ingredients/${ingredient.id}/transactions`)
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
  }, [ingredient.id])

  function resetForm() {
    setAction(null)
    setQty('')
    setPrice('')
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
        await apiFetch(`/ingredients/${ingredient.id}/adjustment`, {
          method: 'POST',
          body: JSON.stringify({ actual_qty: Number(qty), comment }),
        })
      } else {
        const endpoint = action === 'приход' ? 'income' : 'expense'
        await apiFetch(`/ingredients/${ingredient.id}/${endpoint}`, {
          method: 'POST',
          body: JSON.stringify({
            qty: Number(qty),
            price: action === 'приход' && price ? Number(price) : undefined,
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

  async function handleSaveAttrs(e: FormEvent) {
    e.preventDefault()
    setAttrsError(null)
    setSavingAttrs(true)
    try {
      await apiFetch(`/ingredients/${ingredient.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          unit_cost: attrs.unitCost === '' ? null : Number(attrs.unitCost),
          min_purchase_batch_qty: attrs.minBatchQty === '' ? null : Number(attrs.minBatchQty),
          min_purchase_batch_cost: attrs.minBatchCost === '' ? null : Number(attrs.minBatchCost),
          min_purchase_batch_weight: attrs.minBatchWeight === '' ? null : Number(attrs.minBatchWeight),
          supplier: attrs.supplier || null,
          inci: attrs.inci || null,
        }),
      })
      onChanged()
    } catch (err) {
      setAttrsError(err instanceof ApiError ? err.message : 'Не удалось сохранить.')
    } finally {
      setSavingAttrs(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <div
        className="flex h-full w-full max-w-md flex-col bg-premium-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-premium-border px-6 py-5">
          <div>
            <div className="text-lg font-semibold text-premium-text">{ingredient['название']}</div>
            <div className="text-sm text-premium-text/50">{materialCategoryLabel(ingredient['категория'])}</div>
          </div>
          <button onClick={onClose} className="text-premium-text/40 hover:text-premium-text text-xl leading-none">
            ×
          </button>
        </div>

        <div className="flex-1 touch-pan-y overflow-y-auto overflow-x-hidden">
        <div className="px-6 py-5 border-b border-premium-border space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-premium-text/60">Остаток на складе</span>
            <span className="flex items-center gap-2 font-medium text-premium-text">
              <span className={`h-2 w-2 rounded-full ${COLOR_DOT[ingredient['цвет']]}`} />
              {ingredient['остаток']} {ingredient['ед.измерения']}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-premium-text/60">Мин. остаток</span>
            <span className="text-premium-text">{ingredient['мин.остаток']} {ingredient['ед.измерения']}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-premium-text/60">Последнее движение</span>
            <span className="text-premium-text">{formatDate(ingredient['последнее движение'])}</span>
          </div>
          {canEditAttrs && (
            <>
              <button
                onClick={toggleArchived}
                disabled={archiving}
                className="mt-1 w-full rounded-lg border border-premium-border px-4 py-2 text-sm font-medium text-premium-text hover:bg-premium-surface-2 disabled:opacity-60"
              >
                {ingredient['архив'] ? 'Вернуть из архива' : 'Переместить в архив'}
              </button>
              {error && <div className="text-sm text-red-400">{error}</div>}
            </>
          )}
        </div>

        <div className="px-6 py-4 border-b border-premium-border">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm font-medium text-premium-text/70">Закупка</div>
            {!editingAttrs && canEditAttrs && (
              <button
                onClick={() => setEditingAttrs(true)}
                className="flex items-center gap-1 text-xs text-premium-text/50 hover:text-premium-gold-hi"
              >
                <Pencil size={13} /> Редактировать
              </button>
            )}
          </div>

          {!editingAttrs || !canEditAttrs ? (
            <div className="space-y-1.5 text-sm text-premium-text">
              <div className="flex items-center justify-between">
                <span className="text-premium-text/60">Себестоимость 1 {ingredient['ед.измерения']}</span>
                <span>{ingredient['себестоимость 1 шт'] ?? '—'} ₽</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-premium-text/60">Мин. партия для закупки</span>
                <span>{ingredient['минимальная партия для закупки'] ?? '—'} {ingredient['ед.измерения']}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-premium-text/60">Себестоимость мин. партии</span>
                <span>{ingredient['себестоимость минимальной партии'] ?? '—'} ₽</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-premium-text/60">Вес мин. партии</span>
                <span>{ingredient['вес минимальной партии'] ?? '—'} {ingredient['ед.измерения']}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-premium-text/60">Поставщик</span>
                <span className="max-w-[60%] truncate text-right">{ingredient['поставщик'] || '—'}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="shrink-0 text-premium-text/60">INCI</span>
                <span className="truncate text-right text-xs text-premium-text/70">{ingredient['INCI'] || '—'}</span>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSaveAttrs} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-premium-text/60 mb-1">Себестоимость 1 {ingredient['ед.измерения']}</label>
                  <input
                    type="number" step="any" value={attrs.unitCost}
                    onChange={(e) => setAttrs({ ...attrs, unitCost: e.target.value })}
                    className="w-full rounded-lg border border-premium-border bg-premium-bg px-3 py-2 text-sm text-premium-text outline-none focus:border-premium-gold"
                  />
                </div>
                <div>
                  <label className="block text-xs text-premium-text/60 mb-1">Мин. партия для закупки</label>
                  <input
                    type="number" step="any" value={attrs.minBatchQty}
                    onChange={(e) => setAttrs({ ...attrs, minBatchQty: e.target.value })}
                    className="w-full rounded-lg border border-premium-border bg-premium-bg px-3 py-2 text-sm text-premium-text outline-none focus:border-premium-gold"
                  />
                </div>
                <div>
                  <label className="block text-xs text-premium-text/60 mb-1">Себестоимость мин. партии</label>
                  <input
                    type="number" step="any" value={attrs.minBatchCost}
                    onChange={(e) => setAttrs({ ...attrs, minBatchCost: e.target.value })}
                    className="w-full rounded-lg border border-premium-border bg-premium-bg px-3 py-2 text-sm text-premium-text outline-none focus:border-premium-gold"
                  />
                </div>
                <div>
                  <label className="block text-xs text-premium-text/60 mb-1">Вес мин. партии</label>
                  <input
                    type="number" step="any" value={attrs.minBatchWeight}
                    onChange={(e) => setAttrs({ ...attrs, minBatchWeight: e.target.value })}
                    className="w-full rounded-lg border border-premium-border bg-premium-bg px-3 py-2 text-sm text-premium-text outline-none focus:border-premium-gold"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-premium-text/60 mb-1">Поставщик</label>
                <input
                  value={attrs.supplier}
                  onChange={(e) => setAttrs({ ...attrs, supplier: e.target.value })}
                  className="w-full rounded-lg border border-premium-border bg-premium-bg px-3 py-2 text-sm text-premium-text outline-none focus:border-premium-gold"
                />
              </div>
              <div>
                <label className="block text-xs text-premium-text/60 mb-1">INCI</label>
                <input
                  value={attrs.inci}
                  onChange={(e) => setAttrs({ ...attrs, inci: e.target.value })}
                  className="w-full rounded-lg border border-premium-border bg-premium-bg px-3 py-2 text-sm text-premium-text outline-none focus:border-premium-gold"
                />
              </div>
              {attrsError && <div className="text-sm text-red-400">{attrsError}</div>}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditingAttrs(false)}
                  className="flex-1 rounded-lg border border-premium-border py-2 text-sm font-medium text-premium-text hover:bg-premium-surface-2"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={savingAttrs}
                  className="flex-1 rounded-lg bg-premium-gold py-2 text-sm font-medium text-premium-bg hover:bg-premium-gold-hi disabled:opacity-60"
                >
                  {savingAttrs ? 'Сохраняем…' : 'Сохранить'}
                </button>
              </div>
            </form>
          )}
        </div>

        <div className="px-6 py-4 border-b border-premium-border">
          <div className="grid grid-cols-3 gap-2">
            {(['приход', 'расход', 'корректировка'] as const).map((kind) => {
              const { label, icon: Icon } = ACTION_META[kind]
              return (
                <button
                  key={kind}
                  onClick={() => {
                    resetForm()
                    if (action !== kind) setAction(kind)
                  }}
                  className={`flex flex-col items-center gap-1 rounded-lg border py-2.5 text-sm font-medium transition-colors ${
                    action === kind
                      ? 'border-premium-gold bg-premium-gold text-premium-bg shadow-sm'
                      : 'border-premium-border bg-premium-bg text-premium-text hover:border-premium-gold/50 hover:bg-premium-gold/10'
                  }`}
                >
                  <Icon size={18} strokeWidth={2} />
                  {label}
                </button>
              )
            })}
          </div>

          {action && (
            <form onSubmit={handleSubmit} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs text-premium-text/60 mb-1">
                  {action === 'корректировка' ? 'Фактическое количество' : 'Количество'}
                </label>
                <input
                  type="number"
                  step="any"
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  className="w-full rounded-lg border border-premium-border bg-premium-bg px-3 py-2 text-sm text-premium-text outline-none focus:border-premium-gold"
                  required
                />
              </div>
              {action === 'приход' && (
                <div>
                  <label className="block text-xs text-premium-text/60 mb-1">Цена за единицу (необязательно)</label>
                  <input
                    type="number"
                    step="any"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="w-full rounded-lg border border-premium-border bg-premium-bg px-3 py-2 text-sm text-premium-text outline-none focus:border-premium-gold"
                  />
                </div>
              )}
              <div>
                <label className="block text-xs text-premium-text/60 mb-1">Комментарий</label>
                <input
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  className="w-full rounded-lg border border-premium-border bg-premium-bg px-3 py-2 text-sm text-premium-text outline-none focus:border-premium-gold"
                />
              </div>
              {error && <div className="text-sm text-red-400">{error}</div>}
              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-lg bg-premium-gold py-2 text-sm font-medium text-premium-bg hover:bg-premium-gold-hi disabled:opacity-60"
              >
                {submitting ? 'Сохраняем…' : 'Сохранить'}
              </button>
            </form>
          )}
        </div>

        <div className="px-6 py-4">
          <div className="text-sm font-medium text-premium-text/70 mb-3">Движение товара</div>
          {loadingHistory && <div className="text-sm text-premium-text/40">Загрузка…</div>}
          {!loadingHistory && transactions?.length === 0 && (
            <div className="text-sm text-premium-text/40">Движений пока нет.</div>
          )}
          <div className="space-y-2">
            {transactions?.map((tx) => (
              <div key={tx.id} className="flex items-start justify-between gap-3 text-sm border-b border-premium-border/60 pb-2">
                <div className="min-w-0">
                  <div className="capitalize text-premium-text">{tx['тип']}</div>
                  <div className="text-xs text-premium-text/40">{formatDate(tx['дата'])}</div>
                  {tx['комментарий'] && <div className="text-xs text-premium-text/50">{tx['комментарий']}</div>}
                </div>
                <div className="shrink-0 whitespace-nowrap font-medium text-premium-text">
                  {tx['тип'] === 'расход' ? '-' : '+'}
                  {Math.abs(Number(tx['кол-во']))} {ingredient['ед.измерения']}
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
