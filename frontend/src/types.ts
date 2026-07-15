export interface User {
  id: string
  fio: string
  login: string
  role: 'founder' | 'worker' | 'developer'
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
  'всего_ингредиентов': number
  'ниже_минимума': DashboardLowStockItem[]
  'последние_движения': DashboardTransaction[]
  'топ_расход': DashboardTopExpenseItem[]
}

export interface Recipe {
  id: string
  'название': string
  'что производим': string
  'выход партии': number | string
  'технология': string
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
}

export interface Sale {
  id: string
  'дата': string
  product_id: string
  'название': string
  'кол-во': number
  'цена': number | string
  'комментарий': string
}
