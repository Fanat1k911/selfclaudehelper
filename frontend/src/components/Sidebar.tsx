import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth, defaultPathForRole } from '../lib/auth'
import type { User } from '../types'

const NAV_ITEMS: { to: string; label: string; enabled: boolean; roles?: User['role'][] }[] = [
  { to: '/dashboard', label: 'Дашборд', enabled: true, roles: ['founder', 'developer'] },
  { to: '/ingredients', label: 'Ингредиенты', enabled: true },
  { to: '/production', label: 'Производство', enabled: true },
  { to: '/sales', label: 'Продажи', enabled: true, roles: ['founder', 'developer'] },
  { to: '/recipes', label: 'Рецепты', enabled: true },
  { to: '/products', label: 'Товары', enabled: true, roles: ['founder', 'developer'] },
]

const MANAGEMENT_ROLES: User['role'][] = ['founder', 'developer']

export function Sidebar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const items = NAV_ITEMS.filter((item) => !item.roles || (user && item.roles.includes(user.role)))
  const canManageStaff = !!user && MANAGEMENT_ROLES.includes(user.role)

  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [menuOpen])

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

      <div ref={menuRef} className="relative border-t border-white/10 px-3 py-4">
        {menuOpen && (
          <div className="absolute bottom-full left-3 right-3 mb-2 overflow-hidden rounded-lg border border-white/10 bg-sidebar shadow-2xl">
            {canManageStaff && (
              <NavLink
                to="/staff"
                onClick={() => setMenuOpen(false)}
                className={({ isActive }) =>
                  `block px-4 py-2.5 text-sm transition-colors ${
                    isActive ? 'bg-terracotta text-white font-medium' : 'text-white/80 hover:bg-sidebar-hover hover:text-white'
                  }`
                }
              >
                Сотрудники
              </NavLink>
            )}
            <button
              onClick={() => {
                setMenuOpen(false)
                logout()
                navigate('/login', { replace: true })
              }}
              className="block w-full px-4 py-2.5 text-left text-sm text-white/80 hover:bg-sidebar-hover hover:text-white"
            >
              Выйти
            </button>
          </div>
        )}

        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="w-full rounded-lg px-3 py-2 text-left transition-colors hover:bg-sidebar-hover"
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-white">{user?.fio}</div>
              <div className="text-xs text-white/50">{user?.role}</div>
            </div>
            <span className={`text-white/40 transition-transform ${menuOpen ? 'rotate-180' : ''}`}>▲</span>
          </div>
        </button>
      </div>
    </aside>
  )
}
