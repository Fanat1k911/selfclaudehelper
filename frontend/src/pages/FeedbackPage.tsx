import { useEffect, useRef, useState } from 'react'
import { ImagePlus, X } from 'lucide-react'
import { apiFetch, apiUploadMultiple, ApiError } from '../lib/api'
import { usePremiumBackground } from '../lib/usePremiumBackground'
import { useAuth } from '../lib/auth'
import { ImageLightbox } from '../components/ImageLightbox'
import type { FeedbackEntry, MyFeedbackEntry } from '../types'

const MAX_ATTACHMENTS = 3

const STATUS_DOT: Record<string, string> = {
  'новое': 'bg-amber-500',
  'просмотрено': 'bg-premium-gold',
  'решено': 'bg-premium-sage-hi',
}

const FEEDBACK_STATUSES = ['новое', 'просмотрено', 'решено']
const FEEDBACK_STATUS_COLOR: Record<string, string> = {
  'новое': 'text-amber-500',
  'просмотрено': 'text-premium-text/60',
  'решено': 'text-premium-sage-hi',
}

export function FeedbackPage() {
  usePremiumBackground()
  const { user } = useAuth()
  const isDeveloper = user?.role === 'developer'
  // Зонирование "Отправленные"/"Полученные" (2026-07-27, запрос Александра) — раньше
  // просмотр/управление входящими обращениями жило отдельно в Техпанели, разработчик
  // путал свою личную историю (эта страница) с панелью разбора чужих сообщений. Вкладка
  // "Полученные" видна только developer — остальные роли получателями не бывают.
  const [tab, setTab] = useState<'sent' | 'received'>('sent')

  const [message, setMessage] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [mine, setMine] = useState<MyFeedbackEntry[]>([])

  async function loadMine() {
    try {
      setMine(await apiFetch<MyFeedbackEntry[]>('/feedback/mine'))
    } catch {
      // Список "моих обращений" — витрина не критичная для отправки формы, тихо
      // пропускаем ошибку загрузки (форма выше всё равно работает).
    }
  }

  useEffect(() => {
    loadMine()
  }, [])

  const previews = files.map((f) => URL.createObjectURL(f))
  useEffect(() => {
    return () => {
      previews.forEach((url) => URL.revokeObjectURL(url))
    }
    // previews пересобирается на каждый рендер из files — отзываем именно текущий
    // набор при следующем ре-рендере/размонтировании, не нужен files в deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files])

  function addFiles(incoming: File[]) {
    const images = incoming.filter((f) => f.type.startsWith('image/'))
    setFiles((prev) => [...prev, ...images].slice(0, MAX_ATTACHMENTS))
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  // Скрин из буфера обмена (2026-07-26, ui-ux-pro-max: самый частый способ донести
  // баг — скопировать область экрана и Ctrl+V, а не сохранять файл на диск и
  // выбирать его через диалог) — работает прямо в поле сообщения.
  function handlePaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const images = Array.from(e.clipboardData.files).filter((f) => f.type.startsWith('image/'))
    if (images.length > 0) addFiles(images)
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragOver(false)
    addFiles(Array.from(e.dataTransfer.files))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!message.trim()) {
      setError('Напиши, что случилось — поле не может быть пустым.')
      return
    }
    setSubmitting(true)
    try {
      await apiUploadMultiple('/feedback', files, { message })
      setMessage('')
      setFiles([])
      setSent(true)
      setTimeout(() => setSent(false), 4000)
      loadMine()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось отправить.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="relative min-h-full overflow-hidden bg-premium-bg px-4 py-4 sm:px-8 sm:py-6">
      <div className="premium-grain" aria-hidden />
      <h1 className="relative mb-2 font-display text-xl font-semibold italic text-premium-text sm:text-2xl">
        Обратная связь
      </h1>

      {isDeveloper && (
        <div className="relative mb-6 flex gap-1 rounded-lg border border-premium-border bg-premium-surface p-1 sm:w-fit">
          <button
            type="button"
            onClick={() => setTab('sent')}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === 'sent' ? 'bg-premium-gold text-premium-bg' : 'text-premium-text/60 hover:text-premium-text'
            }`}
          >
            Отправленные
          </button>
          <button
            type="button"
            onClick={() => setTab('received')}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === 'received' ? 'bg-premium-gold text-premium-bg' : 'text-premium-text/60 hover:text-premium-text'
            }`}
          >
            Полученные
          </button>
        </div>
      )}

      {tab === 'received' && isDeveloper ? (
        <ReceivedFeedback />
      ) : (
        <>
          <p className="relative mb-6 max-w-lg text-sm text-premium-text/50">
            Сообщение уходит прямо разработчику — ошибка, идея, что-то неудобное. Можно приложить
            до {MAX_ATTACHMENTS} скриншотов — вставить из буфера (Ctrl+V в поле сообщения),
            перетащить файл или выбрать вручную.
          </p>

          <form onSubmit={handleSubmit} className="relative max-w-lg space-y-3">
            <div>
              <label className="block text-xs text-premium-text/60 mb-1">Сообщение</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onPaste={handlePaste}
                rows={6}
                placeholder="Опиши, что произошло, или что хотелось бы улучшить…"
                className="w-full rounded-lg border border-premium-border bg-premium-surface px-3 py-2 text-sm text-premium-text outline-none focus:border-premium-gold"
                required
              />
            </div>

            <div>
              <label className="block text-xs text-premium-text/60 mb-1">
                Скриншоты ({files.length}/{MAX_ATTACHMENTS})
              </label>
              {files.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-2">
                  {previews.map((url, i) => (
                    <div key={url} className="relative h-20 w-20 overflow-hidden rounded-lg border border-premium-border">
                      <img src={url} alt="" className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removeFile(i)}
                        className="absolute right-1 top-1 rounded-full bg-premium-bg/80 p-0.5 text-premium-text hover:text-red-400"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {files.length < MAX_ATTACHMENTS && (
                <div
                  onDragOver={(e) => {
                    e.preventDefault()
                    setDragOver(true)
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`flex cursor-pointer items-center gap-2 rounded-lg border border-dashed px-3 py-3 text-sm text-premium-text/50 transition-colors ${
                    dragOver ? 'border-premium-gold bg-premium-gold/5 text-premium-text' : 'border-premium-border hover:bg-premium-surface-2'
                  }`}
                >
                  <ImagePlus size={16} className="shrink-0" />
                  Перетащи скриншот сюда или нажми, чтобы выбрать
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => addFiles(Array.from(e.target.files ?? []))}
                    className="hidden"
                  />
                </div>
              )}
            </div>

            {error && <div className="text-sm text-red-400">{error}</div>}
            {sent && <div className="text-sm text-premium-sage-hi">Отправлено, спасибо!</div>}

            <button
              type="submit"
              disabled={submitting}
              className="btn-shine transition-transform rounded-lg bg-premium-gold px-4 py-2 text-sm font-medium text-premium-bg hover:bg-premium-gold-hi disabled:opacity-60"
            >
              {submitting ? 'Отправляем…' : 'Отправить'}
            </button>
          </form>

          {mine.length > 0 && (
            <div className="relative mt-8 max-w-lg space-y-6">
              <FeedbackGroup title="Актуальные" items={mine.filter((f) => f['статус'] !== 'решено')} />
              <FeedbackGroup title="Решённые" items={mine.filter((f) => f['статус'] === 'решено')} />
            </div>
          )}
        </>
      )}
    </div>
  )
}

function FeedbackGroup({ title, items }: { title: string; items: MyFeedbackEntry[] }) {
  // Карточки были "неоткрывающимися" — текст всегда в одну строку (truncate), вложения
  // не рендерились вообще (репорт Александра, 2026-07-27). Клик по карточке
  // разворачивает полный текст + скриншоты, второй клик сворачивает обратно.
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [viewingImage, setViewingImage] = useState<string | null>(null)

  if (items.length === 0) return null
  return (
    <div>
      <h2 className="mb-2 text-sm font-semibold text-premium-text/70">{title}</h2>
      <div className="space-y-2">
        {items.map((f) => {
          const expanded = expandedId === f.id
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => setExpandedId(expanded ? null : f.id)}
              className="block w-full rounded-xl border border-premium-border bg-premium-surface p-3 text-left transition-colors hover:bg-premium-surface-2"
            >
              <div className="flex items-center justify-between gap-2 text-xs text-premium-text/40">
                <span>{f['дата'].slice(0, 10)}</span>
                <span className="flex items-center gap-1.5">
                  <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[f['статус']] ?? 'bg-premium-text/30'}`} />
                  {f['статус']}
                </span>
              </div>
              <div className={`mt-1 text-sm text-premium-text/80 ${expanded ? '' : 'truncate'}`}>
                {f['сообщение']}
              </div>
              {f['статус для автора'] && (
                <div className="mt-1.5 text-xs text-premium-gold-hi">{f['статус для автора']}</div>
              )}
              {expanded && f['вложения'].length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {f['вложения'].map((a) => (
                    // stopPropagation — картинка внутри карточки-кнопки (сворачивает/разворачивает
                    // по клику), без него клик по превью тоже засчитывался бы как клик по карточке
                    // и мгновенно её сворачивал, не давая посмотреть картинку (репорт Александра,
                    // 2026-07-27). window.open(data:URL) браузеры блокируют как навигацию
                    // (about:blank вместо картинки) — открываем в модалке с ручным зумом вместо этого.
                    <span
                      key={a.id}
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation()
                        setViewingImage(a['изображение'])
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.stopPropagation()
                          setViewingImage(a['изображение'])
                        }
                      }}
                    >
                      <img
                        src={a['изображение']}
                        alt={a['имя файла'] ?? ''}
                        className="h-20 w-20 cursor-zoom-in rounded-lg border border-premium-border object-cover"
                      />
                    </span>
                  ))}
                </div>
              )}
            </button>
          )
        })}
      </div>
      {viewingImage && <ImageLightbox src={viewingImage} onClose={() => setViewingImage(null)} />}
    </div>
  )
}

// Перенесено из TechPanelPage.tsx (2026-07-27, запрос Александра) — панель разбора входящих
// обращений жила отдельно в Техпанели, что путало с личной историей на этой же странице.
// Автор+роль, полная дата-время (не .slice(0,10), как в "мои"), смена статуса — то же самое,
// что было в Техпанели, один в один, просто другое место.
function ReceivedFeedback() {
  const [feedback, setFeedback] = useState<FeedbackEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [viewingImage, setViewingImage] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    try {
      setFeedback(await apiFetch<FeedbackEntry[]>('/feedback'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function updateStatus(id: string, newStatus: string) {
    await apiFetch(`/feedback/${id}`, { method: 'PATCH', body: JSON.stringify({ status: newStatus }) })
    setFeedback((prev) => prev.map((f) => (f.id === id ? { ...f, 'статус': newStatus } : f)))
  }

  return (
    <div className="relative max-w-lg space-y-3">
      {!loading && feedback.length === 0 && (
        <div className="rounded-xl border border-premium-border bg-premium-surface px-4 py-6 text-center text-sm text-premium-text/40">
          Сообщений пока нет.
        </div>
      )}
      {feedback.map((f, i) => (
        <div
          key={f.id}
          style={{ animationDelay: `${Math.min(i, 12) * 35}ms` }}
          className="premium-row-enter rounded-xl border border-premium-border bg-premium-surface p-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm font-medium text-premium-text">
              {f['автор']} <span className="text-premium-text/40">({f['роль автора']})</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-premium-text/40">{f['дата']}</span>
              <select
                value={f['статус']}
                onChange={(e) => updateStatus(f.id, e.target.value)}
                className={`rounded-lg border border-premium-border bg-premium-bg px-2 py-1 text-xs font-medium outline-none focus:border-premium-gold ${
                  FEEDBACK_STATUS_COLOR[f['статус']] ?? 'text-premium-text'
                }`}
              >
                {FEEDBACK_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-2 whitespace-pre-wrap break-words text-sm text-premium-text/80">{f['сообщение']}</div>
          {f['вложения'].length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {f['вложения'].map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setViewingImage(a['изображение'])}
                  className="h-20 w-20 overflow-hidden rounded-lg border border-premium-border"
                >
                  <img src={a['изображение']} alt={a['имя файла'] ?? ''} className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      ))}

      {viewingImage && <ImageLightbox src={viewingImage} onClose={() => setViewingImage(null)} />}
    </div>
  )
}
