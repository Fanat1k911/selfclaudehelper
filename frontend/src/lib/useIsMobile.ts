import { useEffect, useState } from 'react'

// Тот же порог, что Tailwind `md:` (768px) — используется по всему приложению
// для переключения карточка/таблица. matchMedia, не resize-листенер на window —
// меньше лишних ре-рендеров при обычном скролле/тач-жестах.
export function useIsMobile(breakpointPx = 768) {
  const query = `(max-width: ${breakpointPx - 1}px)`
  const [isMobile, setIsMobile] = useState(() => window.matchMedia(query).matches)

  useEffect(() => {
    const mq = window.matchMedia(query)
    const onChange = () => setIsMobile(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [breakpointPx])

  return isMobile
}
