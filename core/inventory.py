"""Сырьё: справочник материалов + журнал движений (приход/расход/корректировка).
Остаток нигде не хранится статично — всегда считается на лету из Transactions (см. CLAUDE.md)."""

import uuid
from datetime import date

import pandas as pd

from core.config import (
    MATERIALS_HEADERS,
    SHEET_MATERIALS,
    SHEET_TRANSACTIONS,
    TRANSACTION_ADJUSTMENT,
    TRANSACTION_EXPENSE,
    TRANSACTION_INCOME,
    TRANSACTIONS_HEADERS,
)
from core.sheets import append_row, read_sheet

_SIGN_BY_TYPE = {TRANSACTION_INCOME: 1, TRANSACTION_EXPENSE: -1, TRANSACTION_ADJUSTMENT: 1}


def read_materials() -> pd.DataFrame:
    return read_sheet(SHEET_MATERIALS, headers=MATERIALS_HEADERS)


def read_transactions() -> pd.DataFrame:
    return read_sheet(SHEET_TRANSACTIONS, headers=TRANSACTIONS_HEADERS)


def with_balances(materials: pd.DataFrame, transactions: pd.DataFrame) -> pd.DataFrame:
    """Материалы + столбцы 'остаток' и 'ниже минимума', посчитанные из Transactions."""
    if materials.empty:
        return materials

    result = materials.copy()
    result["id"] = result["id"].astype(str)
    result["мин.остаток"] = pd.to_numeric(result["мин.остаток"], errors="coerce").fillna(0.0)

    if transactions.empty:
        result["остаток"] = 0.0
    else:
        signed = transactions.copy()
        signed["material_id"] = signed["material_id"].astype(str)
        qty = pd.to_numeric(signed["кол-во"], errors="coerce").fillna(0.0)
        sign = signed["тип"].map(_SIGN_BY_TYPE).fillna(0)
        signed["signed_qty"] = qty * sign
        totals = signed.groupby("material_id")["signed_qty"].sum()
        result["остаток"] = result["id"].map(totals).fillna(0.0)

    result["ниже минимума"] = result["остаток"] < result["мин.остаток"]
    return result


def add_material(name: str, category: str, unit: str, min_stock: float) -> str:
    """Возвращает id созданного материала — не нужно перечитывать весь лист, чтобы его узнать."""
    material_id = uuid.uuid4().hex[:8]
    row = [material_id, name, category, unit, min_stock, ""]
    append_row(SHEET_MATERIALS, row, headers=MATERIALS_HEADERS)
    return material_id


def add_transaction(
    material_id: str,
    transaction_type: str,
    qty: float,
    *,
    price: float | str = "",
    recipe_id: str = "",
    comment: str = "",
) -> None:
    row = [uuid.uuid4().hex[:8], date.today().isoformat(), material_id, transaction_type, qty, price, recipe_id, comment]
    append_row(SHEET_TRANSACTIONS, row, headers=TRANSACTIONS_HEADERS)
