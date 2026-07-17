// Валидированная категориальная палитра (см. skill dataviz/references/palette.md) —
// порядок фиксирован намеренно, это часть CVD-защиты, не менять порядок слотов.
export const CATEGORICAL = [
  '#2a78d6', // blue
  '#008300', // green
  '#e87ba4', // magenta
  '#eda100', // yellow
  '#1baf7a', // aqua
  '#eb6834', // orange
  '#4a3aa7', // violet
  '#e34948', // red
]

export const SEQUENTIAL_BLUE = '#2a78d6'

export const STATUS = {
  good: '#0ca30c',
  warning: '#fab219',
  serious: '#ec835a',
  critical: '#d03b3b',
}

export const CHROME = {
  surface: '#fcfcfb',
  textPrimary: '#0b0b0b',
  textSecondary: '#52514e',
  muted: '#898781',
  gridline: '#e1e0d9',
  baseline: '#c3c2b7',
}

// Chrome (axis/gridline/tooltip/surface) for charts on the dark "Refined Industrial"
// dashboard surface (2026-07-17, see DESIGN.md). CATEGORICAL/STATUS above are the
// CVD-validated data colors and stay unchanged on any background — only the
// non-data chrome needs a dark counterpart so gridlines/axis labels stay legible
// instead of rendering near-white-on-dark or dark-gray-on-dark.
export const CHROME_DARK = {
  surface: '#1d1a16',
  textPrimary: '#f3eee4',
  textSecondary: '#c9bfae',
  muted: '#a99c89',
  gridline: '#332d24',
  baseline: '#443c2e',
}
