import { X } from 'lucide-react'

export function SearchInput({
  value,
  onChange,
  placeholder = 'Поиск по названию…',
  className = '',
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}) {
  return (
    <div className={`relative w-full max-w-sm ${className}`}>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-premium-border bg-premium-surface px-3 py-2 pr-8 text-sm text-premium-text outline-none placeholder:text-premium-text/40 focus:border-premium-gold"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Очистить"
          className="absolute right-2 top-1/2 -translate-y-1/2 text-premium-text/40 hover:text-premium-text"
        >
          <X size={14} />
        </button>
      )}
    </div>
  )
}
