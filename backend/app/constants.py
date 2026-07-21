"""Роли и константы, общие для роутеров. Заменяет удалённый core/config.py
(тот жил в Streamlit-эпохе и был снесён коммитом c11f084, но backend от него зависел)."""

FOUNDER = "founder"
WORKER = "worker"
DEVELOPER = "developer"
USER_ROLES = [FOUNDER, WORKER, DEVELOPER]

USER_STATUS_ACTIVE = "активен"
USER_STATUS_FIRED = "уволен"

TRANSACTION_INCOME = "приход"
TRANSACTION_EXPENSE = "расход"
TRANSACTION_ADJUSTMENT = "корректировка"

# Рабочий инвентарь (2026-07-19) — движения оборудования отдельные от сырья:
# приход/корректировка те же по смыслу (переиспользуем константы выше), но
# поломка/пропажа специфичны для длительно используемых предметов, не сырья.
EQUIPMENT_BROKEN = "поломка"
EQUIPMENT_LOST = "пропажа"

PRODUCT_REQUIRED_FIELDS = ["название", "категория", "GTIN"]

# Категории Material — свободная строка в БД (без CHECK/enum), но эта тройка — базовый
# набор, реально пришедший из импорта «oinarri рецептуры» (2026-07-21, см. CLAUDE.md).
# Всегда предлагается в новом компоненте, даже если ни один материал ещё её не использует.
DEFAULT_MATERIAL_CATEGORIES = ["тара", "косм", "свеч"]
