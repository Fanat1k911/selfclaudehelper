import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Package,
  PackageCheck,
  Factory,
  Receipt,
  BookOpen,
  ShoppingBag,
  Building2,
  ChevronDown,
  type LucideIcon,
} from 'lucide-react'
import { useAuth, defaultPathForRole } from '../lib/auth'
import type { User } from '../types'
import { Brand } from './Brand'

const NAV_ITEMS: { to: string; label: string; icon: LucideIcon; enabled: boolean; roles?: User['role'][] }[] = [
  { to: '/dashboard', label: 'Дашборд', icon: LayoutDashboard, enabled: true, roles: ['founder', 'developer'] },
  { to: '/ingredients', label: 'Компоненты', icon: Package, enabled: true },
  { to: '/production', label: 'Производство', icon: Factory, enabled: true },
  { to: '/packaging', label: 'Упаковка', icon: PackageCheck, enabled: true },
  { to: '/sales', label: 'Отгрузка', icon: Receipt, enabled: true, roles: ['founder', 'developer'] },
  { to: '/recipes', label: 'Рецепты', icon: BookOpen, enabled: true },
  { to: '/products', label: 'Продукт', icon: ShoppingBag, enabled: true, roles: ['founder', 'developer'] },
  { to: '/counterparties', label: 'Контрагенты', icon: Building2, enabled: true, roles: ['founder', 'developer'] },
]

const MANAGEMENT_ROLES: User['role'][] = ['founder', 'developer']

// ФИО хранится как "Фамилия Имя Отчество". Воркеру в сайдбаре хватает имени,
// founder/developer — Имя Отчество (обращение более официальное).
function shortDisplayName(fio: string, role: User['role']): string {
  const parts = fio.trim().split(/\s+/).filter(Boolean)
  if (parts.length <= 1) return fio
  return role === 'worker' ? parts[1] : parts.slice(1).join(' ')
}

export function Sidebar({ mobileOpen = false, onCloseMobile }: { mobileOpen?: boolean; onCloseMobile?: () => void }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const items = NAV_ITEMS.filter((item) => !item.roles || (user && item.roles.includes(user.role)))
  const canManageStaff = !!user && MANAGEMENT_ROLES.includes(user.role)
  const isDeveloper = user?.role === 'developer'

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

  const initial = user ? shortDisplayName(user.fio, user.role).trim()[0]?.toUpperCase() : ''

  return (
    <>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/30 md:hidden" onClick={onCloseMobile} />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-screen w-64 flex-col bg-sidebar text-cream/90 shrink-0 transition-transform duration-200 ease-out md:static md:z-auto md:w-16 md:translate-x-0 lg:w-64 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <Link
          to={defaultPathForRole(user?.role)}
          onClick={onCloseMobile}
          className="px-6 py-6 flex items-center md:px-0 md:justify-center lg:px-6 lg:justify-start"
        >
          <span className="min-w-0 md:hidden lg:block">
            <Brand user={user} />
          </span>
          <span className="hidden md:inline lg:hidden">
            <Brand user={user} collapsed />
          </span>
        </Link>

        <nav className="flex-1 px-3 space-y-1">
          {items.map((item) => {
            const Icon = item.icon
            return item.enabled ? (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={onCloseMobile}
                title={item.label}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors md:justify-center lg:justify-start ${
                    isActive
                      ? 'bg-terracotta text-white font-medium'
                      : 'text-white/70 hover:bg-sidebar-hover hover:text-white'
                  }`
                }
              >
                <Icon className="h-4.5 w-4.5 shrink-0" size={18} />
                <span className="md:hidden lg:inline">{item.label}</span>
              </NavLink>
            ) : (
              <div
                key={item.to}
                className="flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2 text-sm text-white/30 md:justify-center lg:justify-start"
                title="Скоро"
              >
                <Icon className="h-4.5 w-4.5 shrink-0" size={18} />
                <span className="md:hidden lg:inline">{item.label}</span>
              </div>
            )
          })}
        </nav>

        <div ref={menuRef} className="relative border-t border-white/10 px-3 py-4">
          <div
            className={`absolute bottom-full left-3 right-3 mb-2 origin-bottom overflow-hidden rounded-xl border border-white/10 bg-sidebar shadow-2xl transition-all duration-200 ease-out md:left-full md:right-auto md:bottom-2 md:mb-0 md:ml-2 md:w-56 lg:left-3 lg:right-3 lg:bottom-full lg:w-auto lg:ml-0 lg:mb-2 ${
              menuOpen
                ? 'translate-y-0 scale-100 opacity-100'
                : 'pointer-events-none translate-y-2 scale-95 opacity-0'
            }`}
          >
            {canManageStaff && (
              <NavLink
                to="/staff"
                onClick={() => {
                  setMenuOpen(false)
                  onCloseMobile?.()
                }}
                className={({ isActive }) =>
                  `block px-4 py-2.5 text-sm font-medium transition-colors ${
                    isActive ? 'bg-terracotta text-white' : 'text-white/80 hover:bg-sidebar-hover hover:text-white'
                  }`
                }
              >
                Сотрудники
              </NavLink>
            )}
            {isDeveloper && (
              <NavLink
                to="/techpanel"
                onClick={() => {
                  setMenuOpen(false)
                  onCloseMobile?.()
                }}
                className={({ isActive }) =>
                  `block px-4 py-2.5 text-sm font-medium transition-colors ${
                    isActive ? 'bg-terracotta text-white' : 'text-white/80 hover:bg-sidebar-hover hover:text-white'
                  }`
                }
              >
                Техпанель
              </NavLink>
            )}
            <button
              onClick={() => {
                setMenuOpen(false)
                logout()
                navigate('/login', { replace: true })
              }}
              className="block w-full px-4 py-2.5 text-left text-sm font-medium text-white/80 transition-colors hover:bg-sidebar-hover hover:text-white"
            >
              Выйти
            </button>
          </div>

          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left transition-colors hover:bg-sidebar-hover md:justify-center lg:justify-between"
          >
            <div className="flex min-w-0 items-center gap-2">
              <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-terracotta text-xs font-bold text-white">
                {initial}
              </div>
              <div className="min-w-0 md:hidden lg:block">
                <div className="truncate text-sm font-bold tracking-wide text-white">
                  {user ? shortDisplayName(user.fio, user.role) : ''}
                </div>
                <div className="text-xs text-white/50">{user?.role}</div>
              </div>
            </div>
            <ChevronDown
              className={`h-4 w-4 shrink-0 text-white/50 transition-transform duration-200 ease-out md:hidden lg:block ${
                menuOpen ? 'rotate-180' : ''
              }`}
            />
          </button>
        </div>
      </aside>
    </>
  )
}
