import { useEffect, useState } from 'react'
import { apiFetch } from '../lib/api'
import type { Counterparty } from '../types'
import { NewCounterpartyModal } from '../components/NewCounterpartyModal'
import { CounterpartyDetailPanel } from '../components/CounterpartyDetailPanel'

export function CounterpartiesPage() {
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
    <div className="px-4 py-4 sm:px-8 sm:py-6">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-semibold text-ink sm:text-2xl">Контрагенты</h1>
        <button
          onClick={() => {
            setSelected(null)
            setShowCreate(true)
          }}
          className="whitespace-nowrap rounded-lg bg-terracotta px-3 py-2 text-sm font-medium text-white hover:bg-terracotta-dark sm:px-4"
        >
          + Добавить контрагента
        </button>
      </div>

      <div className="space-y-2 md:hidden">
        {loading && (
          <div className="rounded-xl border border-ink/10 bg-white px-4 py-6 text-center text-sm text-ink/40">
            Загрузка…
          </div>
        )}
        {!loading && items.length === 0 && (
          <div className="rounded-xl border border-ink/10 bg-white px-4 py-6 text-center text-sm text-ink/40">
            Контрагентов пока нет.
          </div>
        )}
        {items.map((c) => (
          <button
            key={c.id}
            onClick={() => handleRowClick(c)}
            className="w-full rounded-xl border border-ink/10 bg-white p-4 text-left shadow-sm active:bg-cream/60"
          >
            <div className="truncate text-sm font-medium text-ink">{c['название']}</div>
            <div className="mt-1.5 text-xs text-ink/50">
              ИНН {c['ИНН'] || '—'} · {c['телефон'] || '—'}
            </div>
          </button>
        ))}
      </div>

      <div className="hidden overflow-hidden rounded-xl border border-ink/10 bg-white shadow-sm md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ink/10 text-left text-ink/50">
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
                <td colSpan={6} className="px-4 py-6 text-center text-ink/40">
                  Загрузка…
                </td>
              </tr>
            )}
            {!loading && items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-ink/40">
                  Контрагентов пока нет.
                </td>
              </tr>
            )}
            {items.map((c) => (
              <tr
                key={c.id}
                onClick={() => handleRowClick(c)}
                className="cursor-pointer border-b border-ink/5 last:border-0 hover:bg-cream/60"
              >
                <td className="px-4 py-3">{c['название']}</td>
                <td className="px-4 py-3 text-ink/60">{c['ИНН'] || '—'}</td>
                <td className="px-4 py-3 text-ink/60">{c['КПП'] || '—'}</td>
                <td className="px-4 py-3 text-ink/60">{c['ОГРН'] || '—'}</td>
                <td className="px-4 py-3 text-ink/60">{c['телефон'] || '—'}</td>
                <td className="px-4 py-3 text-ink/60">{c['контактное лицо'] || '—'}</td>
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
