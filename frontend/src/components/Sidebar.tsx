import { Link, NavLink } from 'react-router-dom'
import { useAuth, defaultPathForRole } from '../lib/auth'
import type { User } from '../types'

const NAV_ITEMS: { to: string; label: string; enabled: boolean; roles?: User['role'][] }[] = [
  { to: '/dashboard', label: 'Дашборд', enabled: true, roles: ['founder', 'developer'] },
  { to: '/ingredients', label: 'Ингредиенты', enabled: true },
  { to: '/production', label: 'Производство', enabled: true },
  { to: '/sales', label: 'Продажи', enabled: true, roles: ['founder', 'developer'] },
  { to: '/recipes', label: 'Рецепты', enabled: true },
  { to: '/products', label: 'Товары', enabled: true, roles: ['founder', 'developer'] },
  { to: '/staff', label: 'Сотрудники', enabled: true, roles: ['founder', 'developer'] },
]

export function Sidebar() {
  const { user, logout } = useAuth()
  const items = NAV_ITEMS.filter((item) => !item.roles || (user && item.roles.includes(user.role)))

  return (
    <aside className="flex h-screen w-64 flex-col bg-sidebar text-cream/90 shrink-0">
      <Link
        to={defaultPathForRole(user?.role)}
        className="px-6 py-6 text-2xl font-bold italic tracking-wide text-white hover:text-terracotta transition-colors"
      >
        oinarri
      </Link>

      <nav className="flex-1 px-3 space-y-1">
        {items.map((item) =>
          item.enabled ? (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `block rounded-lg px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? 'bg-terracotta text-white font-medium'
                    : 'text-white/70 hover:bg-sidebar-hover hover:text-white'
                }`
              }
            >
              {item.label}
            </NavLink>
          ) : (
            <div
              key={item.to}
              className="block cursor-not-allowed rounded-lg px-3 py-2 text-sm text-white/30"
              title="Скоро"
            >
              {item.label}
            </div>
          ),
        )}
      </nav>

      <div className="border-t border-white/10 px-6 py-4">
        <div className="text-sm text-white">{user?.fio}</div>
        <div className="text-xs text-white/50 mb-3">{user?.role}</div>
        <button
          onClick={logout}
          className="w-full rounded-lg border border-white/15 py-2 text-sm font-medium text-white hover:bg-terracotta hover:border-terracotta transition-colors"
        >
          Выйти
        </button>
      </div>
    </aside>
  )
}
