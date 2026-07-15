"""Дашборд: остатки/движения/топ расхода по Materials+Transactions. Доступ — только
founder/developer (см. таблицу ролей в CLAUDE.md), как и в Streamlit-версии."""

from collections import defaultdict

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from core.config import DEVELOPER, FOUNDER, TRANSACTION_ADJUSTMENT, TRANSACTION_EXPENSE, TRANSACTION_INCOME

from app.db import get_db
from app.models import Material, Transaction
from app.security import require_roles

router = APIRouter(
    prefix="/api/dashboard", tags=["dashboard"], dependencies=[Depends(require_roles(FOUNDER, DEVELOPER))]
)

_SIGN_BY_TYPE = {TRANSACTION_INCOME: 1, TRANSACTION_EXPENSE: -1, TRANSACTION_ADJUSTMENT: 1}


@router.get("")
def get_dashboard(db: Session = Depends(get_db)) -> dict:
    materials = db.scalars(select(Material)).all()
    transactions = db.scalars(select(Transaction).order_by(Transaction.date.desc())).all()

    name_by_id = {m.id: m.name for m in materials}
    unit_by_id = {m.id: m.unit for m in materials}

    balances: dict[str, float] = defaultdict(float)
    for tx in transactions:
        balances[tx.material_id] += float(tx.qty) * _SIGN_BY_TYPE.get(tx.type, 0)

    below_min = [
        {
            "id": m.id,
            "название": m.name,
            "остаток": balances.get(m.id, 0.0),
            "мин.остаток": float(m.min_stock),
            "ед.измерения": m.unit,
        }
        for m in materials
        if balances.get(m.id, 0.0) < float(m.min_stock)
    ]
    below_min.sort(key=lambda r: r["остаток"])

    recent = [
        {
            "id": tx.id,
            "дата": tx.date.isoformat(),
            "material_id": tx.material_id,
            "название": name_by_id.get(tx.material_id, tx.material_id),
            "тип": tx.type,
            "кол-во": float(tx.qty),
            "цена": float(tx.price) if tx.price is not None else "",
            "recipe_id": tx.recipe_id or "",
            "комментарий": tx.comment or "",
        }
        for tx in transactions[:10]
    ]

    expense_totals: dict[str, float] = defaultdict(float)
    for tx in transactions:
        if tx.type == TRANSACTION_EXPENSE:
            expense_totals[tx.material_id] += float(tx.qty)
    top_expense = sorted(expense_totals.items(), key=lambda kv: kv[1], reverse=True)[:5]
    top_expense_out = [
        {
            "material_id": mid,
            "название": name_by_id.get(mid, mid),
            "кол-во": qty,
            "ед.измерения": unit_by_id.get(mid, ""),
        }
        for mid, qty in top_expense
    ]

    return {
        "всего_ингредиентов": len(materials),
        "ниже_минимума": below_min,
        "последние_движения": recent,
        "топ_расход": top_expense_out,
    }
