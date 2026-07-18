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
    <div className="fixed inset-x-0 bottom-0 z-[200] flex flex-col items-center justify-between gap-2 border-t border-ink/10 bg-ink px-4 py-3 text-sm text-white shadow-2xl sm:flex-row">
      <span>Доступно обновление интерфейса.</span>
      <button
        onClick={() => window.location.reload()}
        className="whitespace-nowrap rounded-lg bg-terracotta px-4 py-2 text-sm font-medium hover:bg-terracotta-dark"
      >
        Применить обновление
      </button>
    </div>
  )
}
