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
    <div className="flex h-screen overflow-hidden">
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
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
