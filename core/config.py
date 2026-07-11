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

# --- Файл 2: "Мыловарня: Доступы" (отдельный закрытый файл) ---
ACCESS_SPREADSHEET_KEY = "access_spreadsheet_id"

SHEET_USERS = "Users"

USER_STATUS_ACTIVE = "активен"
USER_STATUS_FIRED = "уволен"
