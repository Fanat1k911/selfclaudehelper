import { useEffect, useState, type RefObject } from 'react'
import { ArrowUp } from 'lucide-react'

const SHOW_AFTER_PX = 400

export function ScrollToTopButton({ containerRef }: { containerRef: RefObject<HTMLElement | null> }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    function onScroll() {
      setVisible((el?.scrollTop ?? 0) > SHOW_AFTER_PX)
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [containerRef])

  if (!visible) return null

  return (
    <button
      onClick={() => containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label="Наверх"
      className="fixed bottom-6 right-4 z-40 flex h-10 w-10 items-center justify-center rounded-full border border-premium-border bg-premium-surface/70 text-premium-text/70 shadow-lg backdrop-blur transition-colors hover:bg-premium-surface hover:text-premium-gold-hi sm:bottom-8 sm:right-8"
    >
      <ArrowUp size={18} />
    </button>
  )
}
