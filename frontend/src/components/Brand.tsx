import type { User } from '../types'

// White-label: до загрузки картинок-лого в приложении нет инфраструктуры (нет file
// storage), поэтому бренд компании — текстовый wordmark по её названию, не картинка.
// "Мастерская" — НЕЙТРАЛЬНЫЙ запасной вариант (не название конкретной компании!) — бэкенд
// (security.py::get_current_user) форсирует релогин, если токен не несёт company_name,
// так что этот фоллбек не должен всплывать у залогиненного пользователя на практике.
export function Brand({
  user,
  collapsed,
  className = 'text-premium-text',
}: {
  user: User | null
  collapsed?: boolean
  className?: string
}) {
  const name = user?.company_name || 'Мастерская'
  if (collapsed) {
    return (
      <span className={`font-display text-2xl font-semibold italic tracking-wide ${className}`}>
        {name.charAt(0).toUpperCase()}
      </span>
    )
  }
  return (
    <span className={`font-display min-w-0 truncate text-xl font-semibold italic tracking-wide ${className}`}>
      {name}
    </span>
  )
}
