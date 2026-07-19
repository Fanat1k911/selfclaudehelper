import { useEffect, useRef, useState, type FormEvent } from 'react'
import { apiFetch, ApiError } from '../lib/api'
import { sanitizeDigits, sanitizePhone } from '../lib/validators'

interface InnLookupResult {
  'название': string
  'ИНН': string
  'КПП': string
  'ОГРН': string
  'юр.адрес': string
}

export function NewCounterpartyModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('')
  const [inn, setInn] = useState('')
  const [kpp, setKpp] = useState('')
  const [ogrn, setOgrn] = useState('')
  const [legalAddress, setLegalAddress] = useState('')
  const [phone, setPhone] = useState('')
  const [contactPerson, setContactPerson] = useState('')
  const [comment, setComment] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Автоподстановка по ИНН (2026-07-19) — при вводе полного ИНН (10 юрлицо / 12 ИП)
  // дёргаем /counterparties/lookup, на успехе блокируем найденные поля от ручного
  // редактирования (просьба Founder — исключить случайные опечатки при заведении
  // контрагента). "Ввести вручную" снимает блокировку, если DaData ошиблась/устарела.
  const [lookupState, setLookupState] = useState<'idle' | 'loading' | 'found' | 'not_found' | 'unavailable'>('idle')
  const lookupSeq = useRef(0)

  useEffect(() => {
    if (inn.length !== 10 && inn.length !== 12) {
      setLookupState('idle')
      return
    }
    const seq = ++lookupSeq.current
    setLookupState('loading')
    const timer = setTimeout(async () => {
      try {
        const result = await apiFetch<InnLookupResult>(`/counterparties/lookup?inn=${inn}`)
        if (lookupSeq.current !== seq) return
        setName(result['название'])
        setKpp(result['КПП'])
        setOgrn(result['ОГРН'])
        setLegalAddress(result['юр.адрес'])
        setLookupState('found')
      } catch (err) {
        if (lookupSeq.current !== seq) return
        if (err instanceof ApiError && err.status === 501) {
          setLookupState('unavailable')
        } else {
          setLookupState('not_found')
        }
      }
    }, 400)
    return () => clearTimeout(timer)
  }, [inn])

  const locked = lookupState === 'found'

  function editManually() {
    setLookupState('idle')
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await apiFetch('/counterparties', {
        method: 'POST',
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
      onCreated()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось создать контрагента.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl space-y-3 max-h-[90vh] overflow-y-auto"
      >
        <div className="text-lg font-semibold text-ink mb-2">Новый контрагент</div>

        <div>
          <label className="block text-xs text-ink/60 mb-1">Наименование</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            readOnly={locked}
            className={`w-full rounded-lg border border-ink/10 px-3 py-2 text-sm outline-none focus:border-terracotta ${locked ? 'bg-cream text-ink/70' : ''}`}
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-ink/60 mb-1">
              ИНН
              {lookupState === 'loading' && <span className="ml-1 text-ink/40">ищем…</span>}
            </label>
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
              readOnly={locked}
              className={`w-full rounded-lg border border-ink/10 px-3 py-2 text-sm outline-none focus:border-terracotta ${locked ? 'bg-cream text-ink/70' : ''}`}
            />
          </div>
        </div>

        {lookupState === 'found' && (
          <div className="flex items-center justify-between rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
            <span>Данные найдены по ИНН, поля заблокированы от опечаток.</span>
            <button type="button" onClick={editManually} className="shrink-0 font-medium underline">
              Ввести вручную
            </button>
          </div>
        )}
        {lookupState === 'not_found' && (
          <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
            Компания с таким ИНН не найдена — заполните поля вручную.
          </div>
        )}

        <div>
          <label className="block text-xs text-ink/60 mb-1">ОГРН</label>
          <input
            inputMode="numeric"
            maxLength={15}
            value={ogrn}
            onChange={(e) => setOgrn(sanitizeDigits(e.target.value))}
            readOnly={locked}
            className={`w-full rounded-lg border border-ink/10 px-3 py-2 text-sm outline-none focus:border-terracotta ${locked ? 'bg-cream text-ink/70' : ''}`}
          />
        </div>

        <div>
          <label className="block text-xs text-ink/60 mb-1">Юридический адрес</label>
          <input
            value={legalAddress}
            onChange={(e) => setLegalAddress(e.target.value)}
            readOnly={locked}
            className={`w-full rounded-lg border border-ink/10 px-3 py-2 text-sm outline-none focus:border-terracotta ${locked ? 'bg-cream text-ink/70' : ''}`}
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
            className="flex-1 rounded-lg bg-accent-add py-2 text-sm font-medium text-white hover:bg-accent-add-dark disabled:opacity-60"
          >
            {submitting ? 'Создаём…' : 'Создать'}
          </button>
        </div>
      </form>
    </div>
  )
}
