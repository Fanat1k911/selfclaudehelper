"""Роли и константы, общие для роутеров. Заменяет удалённый core/config.py
(тот жил в Streamlit-эпохе и был снесён коммитом c11f084, но backend от него зависел)."""

FOUNDER = "founder"
DEVELOPER = "developer"

TRANSACTION_INCOME = "приход"
TRANSACTION_EXPENSE = "расход"
TRANSACTION_ADJUSTMENT = "корректировка"

PRODUCT_REQUIRED_FIELDS = ["название", "категория", "GTIN"]
