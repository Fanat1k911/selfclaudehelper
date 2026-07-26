import { useEffect, useRef, useState } from 'react'
import { Check, ChevronsUpDown, Plus } from 'lucide-react'

const VISIBLE_LIMIT = 5

// Выбор категории продукта строго из списка + возможность завести новую —
// свободный ввод убрали (2026-07-26, запрос Александра: не печатать, а выбирать),
// иначе то же расхождение регистра/формулировок, что уже видно в данных
// ("крем" рядом с "Уходовая косметика"). Список обрезан до 5 — остальное
// находится через "Добавить категорию", если нужного варианта нет на виду.
export function CategorySelect({
  value,
  onChange,
  categories,
}: {
  value: string
  onChange: (v: string) => void
  categories: string[]
}) {
  const [open, setOpen] = useState(false)
  const [creatingNew, setCreatingNew] = useState(false)
  const [newCategory, setNewCategory] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
        setCreatingNew(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  function confirmNewCategory() {
    const trimmed = newCategory.trim()
    if (!trimmed) return
    onChange(trimmed)
    setNewCategory('')
    setCreatingNew(false)
    setOpen(false)
  }

  const visible = categories.slice(0, VISIBLE_LIMIT)

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between rounded-lg border border-premium-border bg-premium-bg px-3 py-2 text-sm text-premium-text outline-none focus:border-premium-gold"
      >
        {value || <span className="text-premium-text/40">— категория —</span>}
        <ChevronsUpDown size={14} className="text-premium-text/40" />
      </button>

      {open && (
        <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-premium-border bg-premium-surface shadow-lg">
          {!creatingNew ? (
            <>
              {visible.map((c) => (
                <button
                  type="button"
                  key={c}
                  onClick={() => {
                    onChange(c)
                    setOpen(false)
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-premium-text hover:bg-premium-surface-2"
                >
                  <Check size={14} className={c === value ? 'text-premium-gold-hi' : 'text-transparent'} />
                  {c}
                </button>
              ))}
              <div className="border-t border-premium-border" />
              <button
                type="button"
                onClick={() => setCreatingNew(true)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-premium-gold-hi hover:bg-premium-surface-2"
              >
                <Plus size={14} /> Добавить категорию
              </button>
            </>
          ) : (
            <div className="p-3 space-y-2">
              <div className="text-xs font-medium text-premium-text/60">Добавить категорию</div>
              <input
                autoFocus
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    confirmNewCategory()
                  }
                }}
                placeholder="Название категории"
                className="w-full rounded-lg border border-premium-border bg-premium-bg px-3 py-2 text-sm text-premium-text outline-none focus:border-premium-gold"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setCreatingNew(false)
                    setNewCategory('')
                  }}
                  className="flex-1 rounded-lg bg-premium-surface-2 py-1.5 text-xs font-medium text-premium-text hover:bg-premium-border"
                >
                  Назад
                </button>
                <button
                  type="button"
                  onClick={confirmNewCategory}
                  className="flex-1 rounded-lg bg-premium-gold py-1.5 text-xs font-medium text-premium-bg hover:bg-premium-gold-hi"
                >
                  Добавить
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
