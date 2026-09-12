// Реальные данные материалов пришли из импорта "oinarri рецептуры" с сокращёнными
// категориями (косм/свеч/тара) — здесь только отображение полного названия, само
// значение в базе не трогаем (см. CLAUDE.md → Materials).
const MATERIAL_CATEGORY_LABELS: Record<string, string> = {
  'тара': 'Тара',
  'косм': 'Косметика',
  'свеч': 'Свечи',
  'сыпучее': 'Сыпучее',
  'жидкое': 'Жидкое',
}

export function materialCategoryLabel(raw: string): string {
  if (!raw) return raw
  return MATERIAL_CATEGORY_LABELS[raw] ?? raw
}

// Единица измерения хранится в БД сокращённо (г/шт/кг/мл/л) — здесь только отображение,
// само значение не трогаем.
const UNIT_LABELS: Record<string, string> = {
  'г': 'гр.',
  'кг': 'кг',
  'шт': 'шт',
  'мл': 'мл',
  'л': 'л',
}

export function unitLabel(raw: string): string {
  if (!raw) return raw
  return UNIT_LABELS[raw] ?? raw
}
