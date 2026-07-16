import type { User } from '../types'

// White-label: до загрузки картинок-лого в приложении нет инфраструктуры (нет file
// storage), поэтому бренд компании — текстовый wordmark по её названию, не картинка.
// "oinarri" — запасной вариант, пока company_name не пришёл (старый кэш в localStorage
// без этого поля, или доля секунды до первого рендера).
export function Brand({
  user,
  collapsed,
  className = 'text-white',
}: {
  user: User | null
  collapsed?: boolean
  className?: string
}) {
  const name = user?.company_name || 'oinarri'
  if (collapsed) {
    return <span className={`text-2xl font-bold italic tracking-wide ${className}`}>{name.charAt(0).toUpperCase()}</span>
  }
  return <span className={`truncate text-xl font-bold italic tracking-wide ${className}`}>{name}</span>
}
