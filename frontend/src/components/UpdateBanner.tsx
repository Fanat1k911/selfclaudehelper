import { useEffect, useRef, useState } from 'react'
import { apiFetch } from '../lib/api'

const POLL_INTERVAL_MS = 60_000

// "Обновилось, нажми применить" (2026-07-18, запрос Founder) — вместо резкого разлогина
// всех после каждого деплоя. Бэк отдаёт версию (Render git commit, см. app/config.py),
// сверяем с той, что была при открытии страницы; при расхождении — плашка внизу,
// обновление строго по клику, не само по себе (не сбивает с середины заполнения формы).
export function UpdateBanner() {
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const initialVersionRef = useRef<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function check() {
      try {
        const { version } = await apiFetch<{ version: string }>('/version')
        if (cancelled) return
        if (initialVersionRef.current === null) {
          initialVersionRef.current = version
        } else if (version !== initialVersionRef.current) {
          setUpdateAvailable(true)
        }
      } catch {
        // Временная сетевая ошибка/деплой в процессе — тихо пропускаем, не мешаем работе.
      }
    }

    check()
    const id = setInterval(check, POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [])

  if (!updateAvailable) return null

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[200] flex justify-center px-4 pb-4 sm:pb-5">
      <div className="update-banner-card pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl border px-4 py-3 sm:gap-4 sm:px-5">
        <span className="update-banner-dot shrink-0" aria-hidden="true" />
        <span className="flex-1 text-sm leading-snug text-[color:var(--color-premium-text)]">
          Доступно обновление интерфейса
        </span>
        <button
          onClick={() => window.location.reload()}
          className="update-banner-btn shrink-0 whitespace-nowrap rounded-xl px-3.5 py-2 text-sm font-medium"
        >
          Обновить
        </button>
      </div>
    </div>
  )
}
