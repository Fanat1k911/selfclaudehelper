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
  const [lookupState, setLookupState] = useState<'idle' | 'loading' | 'found' | 'not_found' | 'unavailable' | 'error'>('idle')
  // 404 ("не найдена") — единственный статус, где реально стоит предлагать ручной ввод.
  // Любая другая ошибка (502 недоступности DaData, 400 битый формат и т.п.) раньше тоже
  // схлопывалась в "не найдена" — вводило в заблуждение при реальном сбое (2026-07-19,
  // поймано на живом ИНН, который DaData прекрасно находит напрямую). Показываем
  // фактический текст ошибки с бэка вместо угадывания причины.
  const [lookupErrorMessage, setLookupErrorMessage] = useState('')
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
        } else if (err instanceof ApiError && err.status === 404) {
          setLookupState('not_found')
        } else {
          setLookupErrorMessage(err instanceof ApiError ? err.message : 'Не удалось выполнить поиск по ИНН.')
          setLookupState('error')
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
        className="w-full max-w-sm rounded-2xl bg-premium-surface p-6 shadow-2xl space-y-3 max-h-[90vh] touch-pan-y overflow-y-auto overflow-x-hidden"
      >
        <div className="text-lg font-semibold text-premium-text mb-2">Новый контрагент</div>

        <div>
          <label className="block text-xs text-premium-text/60 mb-1">Наименование</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            readOnly={locked}
            className={`w-full rounded-lg border border-premium-border bg-premium-bg px-3 py-2 text-sm text-premium-text outline-none focus:border-premium-gold ${locked ? 'bg-premium-surface-2 text-premium-text/70' : ''}`}
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-premium-text/60 mb-1">
              ИНН
              {lookupState === 'loading' && <span className="ml-1 text-premium-text/40">ищем…</span>}
            </label>
            <input
              inputMode="numeric"
              maxLength={12}
              value={inn}
              onChange={(e) => setInn(sanitizeDigits(e.target.value))}
              className="w-full rounded-lg border border-premium-border bg-premium-bg px-3 py-2 text-sm text-premium-text outline-none focus:border-premium-gold"
            />
          </div>
          <div>
            <label className="block text-xs text-premium-text/60 mb-1">КПП</label>
            <input
              inputMode="numeric"
              maxLength={9}
              value={kpp}
              onChange={(e) => setKpp(sanitizeDigits(e.target.value))}
              readOnly={locked}
              className={`w-full rounded-lg border border-premium-border bg-premium-bg px-3 py-2 text-sm text-premium-text outline-none focus:border-premium-gold ${locked ? 'bg-premium-surface-2 text-premium-text/70' : ''}`}
            />
          </div>
        </div>

        {lookupState === 'idle' && (
          <div className="rounded-lg bg-premium-surface-2 px-3 py-2 text-xs text-premium-text/50">
            Введите ИНН — если компания найдётся в реестре, остальные поля подтянутся автоматически.
          </div>
        )}
        {lookupState === 'found' && (
          <div className="flex items-center justify-between rounded-lg bg-premium-sage/15 px-3 py-2 text-xs text-premium-sage-hi">
            <span>Данные найдены по ИНН, поля заблокированы от опечаток.</span>
            <button type="button" onClick={editManually} className="shrink-0 font-medium underline">
              Ввести вручную
            </button>
          </div>
        )}
        {lookupState === 'not_found' && (
          <div className="rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-500">
            Компания с таким ИНН не найдена — заполните поля вручную.
          </div>
        )}
        {lookupState === 'error' && (
          <div className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">
            {lookupErrorMessage} Заполните поля вручную.
          </div>
        )}

        <div>
          <label className="block text-xs text-premium-text/60 mb-1">ОГРН</label>
          <input
            inputMode="numeric"
            maxLength={15}
            value={ogrn}
            onChange={(e) => setOgrn(sanitizeDigits(e.target.value))}
            readOnly={locked}
            className={`w-full rounded-lg border border-premium-border bg-premium-bg px-3 py-2 text-sm text-premium-text outline-none focus:border-premium-gold ${locked ? 'bg-premium-surface-2 text-premium-text/70' : ''}`}
          />
        </div>

        <div>
          <label className="block text-xs text-premium-text/60 mb-1">Юридический адрес</label>
          <input
            value={legalAddress}
            onChange={(e) => setLegalAddress(e.target.value)}
            readOnly={locked}
            className={`w-full rounded-lg border border-premium-border bg-premium-bg px-3 py-2 text-sm text-premium-text outline-none focus:border-premium-gold ${locked ? 'bg-premium-surface-2 text-premium-text/70' : ''}`}
          />
        </div>

        <div>
          <label className="block text-xs text-premium-text/60 mb-1">Телефон</label>
          <input
            type="tel"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(sanitizePhone(e.target.value))}
            className="w-full rounded-lg border border-premium-border bg-premium-bg px-3 py-2 text-sm text-premium-text outline-none focus:border-premium-gold"
          />
        </div>

        <div>
          <label className="block text-xs text-premium-text/60 mb-1">Контактное лицо</label>
          <input
            value={contactPerson}
            onChange={(e) => setContactPerson(e.target.value)}
            className="w-full rounded-lg border border-premium-border bg-premium-bg px-3 py-2 text-sm text-premium-text outline-none focus:border-premium-gold"
          />
        </div>

        <div>
          <label className="block text-xs text-premium-text/60 mb-1">Комментарий</label>
          <input
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="w-full rounded-lg border border-premium-border bg-premium-bg px-3 py-2 text-sm text-premium-text outline-none focus:border-premium-gold"
          />
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
