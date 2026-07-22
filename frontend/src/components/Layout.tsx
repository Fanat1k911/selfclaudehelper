import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Menu } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { Brand } from './Brand'
import { Sidebar } from './Sidebar'

export function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const { user } = useAuth()

  useEffect(() => {
    document.title = user?.company_name || 'Мастерская'
  }, [user])

  return (
    <div className="flex h-dvh overflow-hidden">
      <Sidebar mobileOpen={mobileOpen} onCloseMobile={() => setMobileOpen(false)} />
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Общий для ВСЕХ 11 страниц (Outlet ниже) — переведён на тёмную тему 2026-07-22
            вместе с общим переносом остальных страниц на Refined Industrial (см. DESIGN.md).
            Страницы, ещё не переведённые в рамках этой же партии работ, временно контрастируют
            с этим хедером на мобильном — тот же переходный компромисс, что раньше был в
            обратную сторону (тёмный Dashboard под светлым хедером), сам собой исчезнет по
            завершении рассылки остальных страниц. */}
        <header className="flex items-center gap-3 border-b border-premium-border bg-premium-bg px-4 py-3 md:hidden">
          <button
            onClick={() => setMobileOpen(true)}
            className="rounded-lg p-1.5 text-premium-text hover:bg-premium-surface-2"
            aria-label="Открыть меню"
          >
            <Menu className="h-5 w-5" />
          </button>
          <Brand user={user} className="text-premium-text" />
        </header>
        {/* overflow переключается на hidden, пока открыт мобильный сайдбар (2026-07-18,
            репорт Founder: "скрол при открытом сайдбаре работает" + "закрытие по тапу вне
            меню не очень хорошо работает"). document.body здесь НЕ скроллится вообще —
            вся страница уже h-dvh overflow-hidden, реальный скролл живёт только в этом
            <main>. Пока он остаётся overflow-y-auto под fixed-бэкдропом сайдбара, тач по
            бэкдропу на WebKit может уйти в scroll этого элемента вместо click (лёгкое
            движение пальца браузер трактует как начало скролла, не синтезирует click) —
            поэтому закрытие по тапу срабатывало через раз. Лочим именно этот элемент, не
            body/window — первая попытка (лочить body) была бы no-op, т.к. body и так не
            скроллящийся контейнер в этой раскладке. */}
        <main className={`flex-1 ${mobileOpen ? 'overflow-hidden' : 'overflow-y-auto'}`}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
