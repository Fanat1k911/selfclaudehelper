import { useState, type FormEvent } from 'react'
import { apiFetch, ApiError } from '../lib/api'
import { sanitizeDigits, sanitizePhone } from '../lib/validators'
import type { Counterparty } from '../types'

export function CounterpartyDetailPanel({
  counterparty,
  onClose,
  onChanged,
}: {
  counterparty: Counterparty
  onClose: () => void
  onChanged: () => void
}) {
  const [name, setName] = useState(counterparty['название'])
  const [inn, setInn] = useState(counterparty['ИНН'])
  const [kpp, setKpp] = useState(counterparty['КПП'])
  const [ogrn, setOgrn] = useState(counterparty['ОГРН'])
  const [legalAddress, setLegalAddress] = useState(counterparty['юр.адрес'])
  const [phone, setPhone] = useState(counterparty['телефон'])
  const [contactPerson, setContactPerson] = useState(counterparty['контактное лицо'])
  const [comment, setComment] = useState(counterparty['комментарий'])
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSave(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await apiFetch(`/counterparties/${counterparty.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name,
          inn,
          kpp,
          ogrn,
          legal_address: legalAddress,
          phone,
          contact_person: contactPerson,
          comment,
        }),
      })
      onChanged()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось сохранить.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <div className="flex h-full w-full max-w-md flex-col bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between border-b border-ink/10 px-6 py-5">
          <div className="text-lg font-semibold text-ink">{counterparty['название']}</div>
          <button onClick={onClose} className="text-ink/40 hover:text-ink text-xl leading-none">
            ×
          </button>
        </div>

        <form onSubmit={handleSave} className="px-6 py-4 space-y-3 overflow-y-auto">
          <div>
            <label className="block text-xs text-ink/60 mb-1">Наименование</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-ink/10 px-3 py-2 text-sm outline-none focus:border-terracotta"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-ink/60 mb-1">ИНН</label>
              <input
                inputMode="numeric"
                maxLength={12}
                value={inn}
                onChange={(e) => setInn(sanitizeDigits(e.target.value))}
                className="w-full rounded-lg border border-ink/10 px-3 py-2 text-sm outline-none focus:border-terracotta"
              />
            </div>
            <div>
              <label className="block text-xs text-ink/60 mb-1">КПП</label>
              <input
                inputMode="numeric"
                maxLength={9}
                value={kpp}
                onChange={(e) => setKpp(sanitizeDigits(e.target.value))}
                className="w-full rounded-lg border border-ink/10 px-3 py-2 text-sm outline-none focus:border-terracotta"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-ink/60 mb-1">ОГРН</label>
            <input
              inputMode="numeric"
              maxLength={15}
              value={ogrn}
              onChange={(e) => setOgrn(sanitizeDigits(e.target.value))}
              className="w-full rounded-lg border border-ink/10 px-3 py-2 text-sm outline-none focus:border-terracotta"
            />
          </div>

          <div>
            <label className="block text-xs text-ink/60 mb-1">Юридический адрес</label>
            <input
              value={legalAddress}
              onChange={(e) => setLegalAddress(e.target.value)}
              className="w-full rounded-lg border border-ink/10 px-3 py-2 text-sm outline-none focus:border-terracotta"
            />
          </div>

          <div>
            <label className="block text-xs text-ink/60 mb-1">Телефон</label>
            <input
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(sanitizePhone(e.target.value))}
              className="w-full rounded-lg border border-ink/10 px-3 py-2 text-sm outline-none focus:border-terracotta"
            />
          </div>

          <div>
            <label className="block text-xs text-ink/60 mb-1">Контактное лицо</label>
            <input
              value={contactPerson}
              onChange={(e) => setContactPerson(e.target.value)}
              className="w-full rounded-lg border border-ink/10 px-3 py-2 text-sm outline-none focus:border-terracotta"
            />
          </div>

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
      </div>
    </div>
  )
}
