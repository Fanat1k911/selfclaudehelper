import type { KeyboardEvent } from 'react'

// <input type="number"> формально разрешает e/E (научная нотация) и +/- даже с
// min="0" — браузер лишь помечает поле :invalid, но ввести "5e3" (= 5000, незаметно)
// или "-5" ничего не мешает. Для полей остатков/цен/количеств это всегда мусор —
// 2026-07-26, запрос Александра "разреши ввод только цифр" по всему приложению.
// Вставка (paste) браузер и так фильтрует сам для type="number" — только keydown.
const BLOCKED_DECIMAL_KEYS = new Set(['e', 'E', '+', '-'])
const BLOCKED_INTEGER_KEYS = new Set(['e', 'E', '+', '-', '.', ','])

export function blockNonNumericKeys(e: KeyboardEvent<HTMLInputElement>) {
  if (BLOCKED_DECIMAL_KEYS.has(e.key)) e.preventDefault()
}

// Для полей, где значение всегда целое (шт, кол-во брака) — дополнительно блокирует
// разделитель дробной части, а не только e/+/-.
export function blockNonIntegerKeys(e: KeyboardEvent<HTMLInputElement>) {
  if (BLOCKED_INTEGER_KEYS.has(e.key)) e.preventDefault()
}

// Верхний потолок на числовые поля остатков/кол-ва/сумм (2026-07-26, запрос
// Александра) — 7+ цифр для этих величин всегда опечатка, не настоящее значение.
// Отрицательное тоже обрезаем тут (не только keydown выше) — paste вставляет
// синтаксически валидное "-5" мимо keydown-блокировки, onChange её всё равно ловит.
export const MAX_NUMERIC_INPUT = 1_000_000

export function clampNumericInput(raw: string): string {
  if (raw === '' || raw === '-') return ''
  const num = Number(raw)
  if (Number.isNaN(num)) return raw
  if (num < 0) return '0'
  if (num > MAX_NUMERIC_INPUT) return String(MAX_NUMERIC_INPUT)
  return raw
}
