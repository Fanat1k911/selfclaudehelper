import { useEffect, useRef, useState } from 'react'

// Анимирует число от предыдущего значения к target (ease-out-cubic). Уважает
// prefers-reduced-motion — сразу выставляет target без тика rAF.
export function useCountUp(target: number, duration = 500) {
  const [value, setValue] = useState(target)
  const prevTarget = useRef(target)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setValue(target)
      prevTarget.current = target
      return
    }

    const from = prevTarget.current
    if (from === target) return
    const start = performance.now()
    let raf: number

    function tick(now: number) {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      setValue(Math.round(from + (target - from) * eased))
      if (t < 1) {
        raf = requestAnimationFrame(tick)
      } else {
        prevTarget.current = target
      }
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])

  return value
}
