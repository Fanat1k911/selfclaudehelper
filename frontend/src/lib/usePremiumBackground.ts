import { useEffect } from 'react'

// Тот же 100vh/rubber-band баг, что чинили на логине — body по умолчанию светлый
// (--color-cream, см. index.css), пока не все страницы переведены на тёмную тему.
// При овербаунсе на iOS/Brave снизу/сверху страницы мелькает светлый body вместо
// тёмного фона страницы (Дашборд был первым, кто это ловил; 2026-07-22 — тот же
// эффект замечен на остальных переводимых страницах, вынесено в общий хук вместо
// копипасты одного и того же useEffect на каждой странице).
export function usePremiumBackground() {
  useEffect(() => {
    const prevHtml = document.documentElement.style.background
    const prevBody = document.body.style.background
    document.documentElement.style.background = 'var(--color-premium-bg)'
    document.body.style.background = 'var(--color-premium-bg)'
    return () => {
      document.documentElement.style.background = prevHtml
      document.body.style.background = prevBody
    }
  }, [])
}
