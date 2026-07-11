"""Константы проекта: роли, названия листов, ID таблиц."""

FOUNDER = "founder"
WORKER = "worker"
DEVELOPER = "developer"

ROLES = (FOUNDER, WORKER, DEVELOPER)

# Роли, которым доступна аналитика/финансы/КПД всех сотрудников
MANAGEMENT_ROLES = (FOUNDER, DEVELOPER)

# --- Файл 1: "Мыловарня: Учёт" ---
DATA_SPREADSHEET_KEY = "data_spreadsheet_id"

SHEET_MATERIALS = "Materials"
SHEET_TRANSACTIONS = "Transactions"
SHEET_RECIPES = "Recipes"
SHEET_RECIPE_ITEMS = "RecipeItems"
SHEET_PRODUCTS = "Products"
SHEET_SALES = "Sales"
SHEET_PRODUCTION_LOG = "ProductionLog"
SHEET_FEEDBACK = "Feedback"

MATERIALS_HEADERS = ("id", "название", "категория", "ед.измерения", "мин.остаток", "текущий остаток")
TRANSACTIONS_HEADERS = ("id", "дата", "material_id", "тип", "кол-во", "цена", "recipe_id", "комментарий")

MATERIAL_CATEGORY_BULK = "сыпучее"
MATERIAL_CATEGORY_LIQUID = "жидкое"
MATERIAL_CATEGORY_PACKAGING = "тара"
MATERIAL_CATEGORIES = (MATERIAL_CATEGORY_BULK, MATERIAL_CATEGORY_LIQUID, MATERIAL_CATEGORY_PACKAGING)

TRANSACTION_INCOME = "приход"
TRANSACTION_EXPENSE = "расход"
TRANSACTION_ADJUSTMENT = "корректировка"
TRANSACTION_TYPES = (TRANSACTION_INCOME, TRANSACTION_EXPENSE, TRANSACTION_ADJUSTMENT)

RECIPES_HEADERS = ("id", "название", "что производим", "выход партии", "технология")
RECIPE_ITEMS_HEADERS = (
    "recipe_id",
    "название рецепта",
    "material_id",
    "название материала",
    "кол-во на 1 партию",
)

# --- Файл 2: "Мыловарня: Доступы" (отдельный закрытый файл) ---
ACCESS_SPREADSHEET_KEY = "access_spreadsheet_id"

SHEET_USERS = "Users"

USER_STATUS_ACTIVE = "активен"
USER_STATUS_FIRED = "уволен"
