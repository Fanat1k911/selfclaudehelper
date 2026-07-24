import { useState } from 'react'
import { Search } from 'lucide-react'
import type { Ingredient } from '../types'

// Настоящий выпадающий список вместо <input list>+<datalist> — на iOS/Android
// datalist рендерится как QuickType-бар над клавиатурой, а не как список под полем
// (2026-07-23, репорт Александра со скрином). Фильтрует с первого символа.
// Общий компонент — раньше жил только в BatchIncomeModal, теперь переиспользуется
// и в RecipeDetailPanel.
export function MaterialCombobox({
  ingredients,
  value,
  onChange,
  placeholder = 'Введите название материала…',
}: {
  ingredients: Ingredient[]
  value: string
  onChange: (id: string) => void
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const selected = ingredients.find((i) => i.id === value)
  const filtered = query.trim()
    ? ingredients.filter((i) => i['название'].toLowerCase().includes(query.trim().toLowerCase()))
    : ingredients

  return (
    <div className="relative min-w-0 flex-1">
      <div className="relative">
        <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-premium-text-muted" />
        <input
          value={open ? query : (selected?.['название'] ?? '')}
          onFocus={() => {
            setOpen(true)
            setQuery('')
          }}
          onChange={(e) => setQuery(e.target.value)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={placeholder}
          className="w-full rounded-lg border border-premium-border bg-premium-bg py-2 pl-8 pr-3 text-sm font-medium text-premium-text outline-none focus:border-premium-gold"
        />
      </div>
      {open && (
        <div className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-premium-border bg-premium-surface shadow-lg">
          {filtered.length === 0 && <div className="px-3 py-2 text-sm text-premium-text/40">Ничего не найдено</div>}
          {filtered.map((ing) => (
            <button
              type="button"
              key={ing.id}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange(ing.id)
                setOpen(false)
              }}
              className={`block w-full px-3 py-2 text-left text-sm hover:bg-premium-surface-2 ${
                ing.id === value ? 'bg-premium-gold/15 font-medium text-premium-gold-hi' : 'text-premium-text'
              }`}
            >
              {ing['название']}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
