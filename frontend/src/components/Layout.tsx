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
        {/* Общий для ВСЕХ 11 страниц (Outlet ниже) — только Sidebar/Dashboard мигрировали
            на тёмную тему (см. DESIGN.md), поэтому этот хедер остаётся светлым, чтобы не
            ломать 8 нетронутых светлых страниц на мобильных viewport-ах. */}
        <header className="flex items-center gap-3 border-b border-ink/10 bg-white px-4 py-3 md:hidden">
          <button
            onClick={() => setMobileOpen(true)}
            className="rounded-lg p-1.5 text-ink hover:bg-ink/5"
            aria-label="Открыть меню"
          >
            <Menu className="h-5 w-5" />
          </button>
          <Brand user={user} className="text-ink" />
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
