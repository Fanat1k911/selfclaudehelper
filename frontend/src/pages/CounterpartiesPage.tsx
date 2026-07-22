import { useEffect, useState } from 'react'
import { apiFetch } from '../lib/api'
import { usePremiumBackground } from '../lib/usePremiumBackground'
import type { Counterparty } from '../types'
import { NewCounterpartyModal } from '../components/NewCounterpartyModal'
import { CounterpartyDetailPanel } from '../components/CounterpartyDetailPanel'
import { SkeletonRows } from '../components/SkeletonRows'

export function CounterpartiesPage() {
  usePremiumBackground()
  const [items, setItems] = useState<Counterparty[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [selected, setSelected] = useState<Counterparty | null>(null)

  async function load() {
    setLoading(true)
    try {
      const data = await apiFetch<Counterparty[]>('/counterparties')
      setItems(data)
      setSelected((prev) => (prev ? data.find((c) => c.id === prev.id) ?? null : null))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  function handleRowClick(c: Counterparty) {
    setShowCreate(false)
    setSelected(c)
  }

  return (
    <div className="relative min-h-full overflow-hidden bg-premium-bg px-4 py-4 sm:px-8 sm:py-6">
      <div className="premium-grain" aria-hidden />
      <div className="relative mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-display text-xl font-semibold italic text-premium-text sm:text-2xl">Контрагенты</h1>
        <button
          onClick={() => {
            setSelected(null)
            setShowCreate(true)
          }}
          className="whitespace-nowrap rounded-lg bg-premium-gold px-3 py-2 text-sm font-medium text-premium-bg hover:bg-premium-gold-hi sm:px-4"
        >
          + Добавить контрагента
        </button>
      </div>

      <div className="relative space-y-2 md:hidden">
        {loading && (
          <div className="overflow-hidden rounded-xl border border-premium-border bg-premium-surface">
            <SkeletonRows />
          </div>
        )}
        {!loading && items.length === 0 && (
          <div className="rounded-xl border border-premium-border bg-premium-surface px-4 py-6 text-center text-sm text-premium-text/40">
            Контрагентов пока нет.
          </div>
        )}
        {items.map((c) => (
          <button
            key={c.id}
            onClick={() => handleRowClick(c)}
            className="premium-card w-full rounded-xl border border-premium-border bg-premium-surface p-4 text-left active:bg-premium-surface-2"
          >
            <div className="truncate text-sm font-medium text-premium-text">{c['название']}</div>
            <div className="mt-1.5 text-xs text-premium-text/50">
              ИНН {c['ИНН'] || '—'} · {c['телефон'] || '—'}
            </div>
          </button>
        ))}
      </div>

      <div className="relative hidden overflow-hidden rounded-xl border border-premium-border bg-premium-surface md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-premium-border text-left text-premium-text/50">
              <th className="px-4 py-3 font-medium">Наименование</th>
              <th className="px-4 py-3 font-medium">ИНН</th>
              <th className="px-4 py-3 font-medium">КПП</th>
              <th className="px-4 py-3 font-medium">ОГРН</th>
              <th className="px-4 py-3 font-medium">Телефон</th>
              <th className="px-4 py-3 font-medium">Контактное лицо</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} className="p-0">
                  <SkeletonRows />
                </td>
              </tr>
            )}
            {!loading && items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-premium-text/40">
                  Контрагентов пока нет.
                </td>
              </tr>
            )}
            {items.map((c) => (
              <tr
                key={c.id}
                onClick={() => handleRowClick(c)}
                className="cursor-pointer border-b border-premium-border/60 transition-colors last:border-0 hover:bg-premium-surface-2"
              >
                <td className="px-4 py-3 text-premium-text">{c['название']}</td>
                <td className="px-4 py-3 text-premium-text/60">{c['ИНН'] || '—'}</td>
                <td className="px-4 py-3 text-premium-text/60">{c['КПП'] || '—'}</td>
                <td className="px-4 py-3 text-premium-text/60">{c['ОГРН'] || '—'}</td>
                <td className="px-4 py-3 text-premium-text/60">{c['телефон'] || '—'}</td>
                <td className="px-4 py-3 text-premium-text/60">{c['контактное лицо'] || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected && (
        <CounterpartyDetailPanel counterparty={selected} onClose={() => setSelected(null)} onChanged={load} />
      )}

      {showCreate && (
        <NewCounterpartyModal
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
