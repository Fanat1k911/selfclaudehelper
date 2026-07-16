import { Moon, Sun, Monitor } from 'lucide-react'
import type { ThemePref } from '../lib/useLoginTheme'

const OPTIONS: { value: ThemePref; icon: typeof Sun; label: string }[] = [
  { value: 'light', icon: Sun, label: 'Светлая тема' },
  { value: 'system', icon: Monitor, label: 'Системная тема' },
  { value: 'dark', icon: Moon, label: 'Тёмная тема' },
]

export function ThemeToggle({ value, onChange }: { value: ThemePref; onChange: (v: ThemePref) => void }) {
  return (
    <div
      className="inline-flex items-center gap-0.5 rounded-full border p-0.5 backdrop-blur-xl transition-colors"
      style={{ background: 'var(--login-toggle-bg)', borderColor: 'var(--login-toggle-border)' }}
    >
      {OPTIONS.map(({ value: v, icon: Icon, label }) => {
        const active = v === value
        return (
          <button
            key={v}
            type="button"
            title={label}
            aria-label={label}
            aria-pressed={active}
            onClick={() => onChange(v)}
            className="rounded-full p-1.5 transition-all duration-200"
            style={{
              background: active ? 'var(--login-toggle-active-bg)' : 'transparent',
              color: active ? 'var(--login-text)' : 'var(--login-text-faint)',
              boxShadow: active ? '0 1px 4px rgba(0,0,0,0.15)' : 'none',
            }}
          >
            <Icon className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
        )
      })}
    </div>
  )
}
