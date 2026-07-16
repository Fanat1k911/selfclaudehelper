export interface User {
  id: string
  fio: string
  login: string
  role: 'founder' | 'worker' | 'developer'
}

export interface StaffUser {
  id: string
  fio: string
  login: string
  role: 'founder' | 'worker' | 'developer'
  status: 'активен' | 'уволен'
  created_at: string
  phone: string
  messenger: string
  address: string
  document: string
}

export interface Ingredient {
  id: string
  'название': string
  'категория': string
  'ед.измерения': string
  'мин.остаток': number
  'остаток': number
  'ниже минимума': boolean
  'цвет': 'зелёный' | 'жёлтый' | 'красный'
  'последнее движение': string | null
}

export interface Transaction {
  id: string
  'дата': string
  material_id: string
  'тип': 'приход' | 'расход' | 'корректировка'
  'кол-во': number
  'цена': number | string
  recipe_id: string
  'комментарий': string
}

export interface DashboardTransaction extends Transaction {
  'название': string
}

export interface DashboardLowStockItem {
  id: string
  'название': string
  'остаток': number
  'мин.остаток': number
  'ед.измерения': string
}

export interface DashboardTopExpenseItem {
  material_id: string
  'название': string
  'кол-во': number
  'ед.измерения': string
}

export interface DashboardData {
  'всего_компонентов': number
  'ниже_минимума': DashboardLowStockItem[]
  'последние_движения': DashboardTransaction[]
  'топ_расход': DashboardTopExpenseItem[]
}

export interface DashboardSpendMonth {
  'месяц': string
  'сумма': number
}

export interface DashboardSpendTopMaterial {
  material_id: string
  'название': string
  'сумма': number
}

export interface DashboardSpend {
  'всего': number
  'по_месяцам': DashboardSpendMonth[]
  'топ_материалов': DashboardSpendTopMaterial[]
}

export interface DashboardKpiRow {
  'месяц': string
  worker_id: string
  'ФИО': string
  'партий': number
  'брак': number
  'произведено': number
}

export interface Recipe {
  id: string
  'название': string
  'категория': string
  'что производим': string
  'выход партии': number | string
  'технология': string
  'архив': boolean
}

export interface ProducibleProduct {
  id: string
  'название': string
  recipe_id: string
}

export interface ProductionLogEntry {
  id: string
  'дата': string
  worker_id: string
  'ФИО сотрудника': string
  recipe_id: string
  'название рецепта': string
  'кол-во партий': number
  'время начала': string
  'время окончания': string
  'брак': number
  'комментарий': string
}

export interface LeaderboardRow {
  worker_id: string
  'ФИО': string
  'сегодня': number
  'месяц': number
}

export interface RecipeItem {
  recipe_id: string
  'название рецепта': string
  material_id: string
  'название материала': string
  'кол-во на 1 партию': number
}

export interface Product {
  id: string
  'название': string
  'категория': string
  GTIN: string
  'состав': string
  recipe_id: string
  'название рецепта': string
  'ТН ВЭД': string
  'декларация соответствия': string
  'срок действия РД': string
  'готово к отгрузке': number | null
}

export interface Sale {
  id: string
  'дата': string
  product_id: string
  'название': string
  counterparty_id: string
  'контрагент': string
  'кол-во': number
  'цена': number | string
  'комментарий': string
}

export interface Counterparty {
  id: string
  'название': string
  'ИНН': string
  'КПП': string
  'ОГРН': string
  'юр.адрес': string
  'телефон': string
  'контактное лицо': string
  'комментарий': string
}

export interface PackagingLogEntry {
  id: string
  'дата': string
  worker_id: string
  'ФИО сотрудника': string
  product_id: string
  'название продукта': string
  'кол-во': number
  'брак': number
  'комментарий': string
}

export interface LoginLogEntry {
  id: string
  user_id: string
  'ФИО': string
  'логин': string
  'дата и время': string
}

export interface TopProduct {
  product_id: string
  'название': string
  'кол-во': number
}

export interface TechStatus {
  api: 'ok'
  db: 'ok' | 'error'
  uptime_seconds: number
  fastapi_version: string
}

export interface TechLogEntry {
  time: string
  level: string
  logger: string
  message: string
}
