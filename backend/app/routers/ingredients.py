"""Раздел «Ингредиенты» — Materials/Transactions в Postgres (было: Sheets/pandas,
см. core/inventory.py). Остаток по-прежнему нигде не хранится статично — считается
на лету из Transaction по каждому material_id (см. CLAUDE.md)."""

from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.constants import TRANSACTION_ADJUSTMENT, TRANSACTION_EXPENSE, TRANSACTION_INCOME

from app.db import get_db
from app.models import Material, Transaction
from app.schemas import AdjustmentRequest, NewMaterialRequest, TransactionRequest
from app.security import get_current_user

router = APIRouter(prefix="/api/ingredients", tags=["ingredients"], dependencies=[Depends(get_current_user)])

_SIGN_BY_TYPE = {TRANSACTION_INCOME: 1, TRANSACTION_EXPENSE: -1, TRANSACTION_ADJUSTMENT: 1}
_YELLOW_MULTIPLIER = 1.2


def _color(balance: float, min_stock: float) -> str:
    """Жёлтая зона существует только при min_stock > 0 — иначе интервал пуст."""
    if balance < min_stock:
        return "красный"
    if min_stock > 0 and balance <= min_stock * _YELLOW_MULTIPLIER:
        return "жёлтый"
    return "зелёный"


def _material_dict(material: Material, balance: float, last_movement: date | None) -> dict:
    min_stock = float(material.min_stock)
    return {
        "id": material.id,
        "название": material.name,
        "категория": material.category,
        "ед.измерения": material.unit,
        "мин.остаток": min_stock,
        "остаток": balance,
        "ниже минимума": balance < min_stock,
        "цвет": _color(balance, min_stock),
        "последнее движение": last_movement.isoformat() if last_movement else None,
    }


def _transaction_dict(tx: Transaction) -> dict:
    return {
        "id": tx.id,
        "дата": tx.date.isoformat(),
        "material_id": tx.material_id,
        "тип": tx.type,
        "кол-во": float(tx.qty),
        "цена": float(tx.price) if tx.price is not None else "",
        "recipe_id": tx.recipe_id or "",
        "комментарий": tx.comment or "",
    }


def _balances_and_last_movement(db: Session) -> tuple[dict[str, float], dict[str, date]]:
    balances: dict[str, float] = {}
    last_movement: dict[str, date] = {}
    for tx in db.scalars(select(Transaction)):
        sign = _SIGN_BY_TYPE.get(tx.type, 0)
        balances[tx.material_id] = balances.get(tx.material_id, 0.0) + float(tx.qty) * sign
        if tx.material_id not in last_movement or tx.date > last_movement[tx.material_id]:
            last_movement[tx.material_id] = tx.date
    return balances, last_movement


@router.get("")
def list_ingredients(db: Session = Depends(get_db)) -> list[dict]:
    materials = db.scalars(select(Material)).all()
    balances, last_movement = _balances_and_last_movement(db)
    return [_material_dict(m, balances.get(m.id, 0.0), last_movement.get(m.id)) for m in materials]


@router.get("/{material_id}/transactions")
def list_transactions(material_id: str, db: Session = Depends(get_db)) -> list[dict]:
    rows = db.scalars(
        select(Transaction).where(Transaction.material_id == material_id).order_by(Transaction.date.desc())
    )
    return [_transaction_dict(tx) for tx in rows]


@router.post("")
def create_ingredient(body: NewMaterialRequest, db: Session = Depends(get_db)) -> dict:
    material = Material(name=body.name, category=body.category, unit=body.unit, min_stock=body.min_stock)
    db.add(material)
    db.flush()
    if body.initial_qty > 0:
        db.add(Transaction(material_id=material.id, type=TRANSACTION_INCOME, qty=body.initial_qty, comment="начальный остаток"))
    db.commit()
    return {"id": material.id}


def _require_positive(qty: float) -> None:
    if qty <= 0:
        raise HTTPException(400, "Количество должно быть больше нуля.")


@router.post("/{material_id}/income")
def add_income(material_id: str, body: TransactionRequest, db: Session = Depends(get_db)) -> dict:
    _require_positive(body.qty)
    db.add(Transaction(material_id=material_id, type=TRANSACTION_INCOME, qty=body.qty, price=body.price, comment=body.comment))
    db.commit()
    return {"ok": True}


@router.post("/{material_id}/expense")
def add_expense(material_id: str, body: TransactionRequest, db: Session = Depends(get_db)) -> dict:
    _require_positive(body.qty)
    db.add(Transaction(material_id=material_id, type=TRANSACTION_EXPENSE, qty=body.qty, comment=body.comment))
    db.commit()
    return {"ok": True}


@router.post("/{material_id}/adjustment")
def add_adjustment(material_id: str, body: AdjustmentRequest, db: Session = Depends(get_db)) -> dict:
    material = db.get(Material, material_id)
    if material is None:
        raise HTTPException(404, "Ингредиент не найден.")
    balances, _ = _balances_and_last_movement(db)
    current = balances.get(material_id, 0.0)
    delta = body.actual_qty - current
    if delta == 0:
        return {"ok": True, "delta": 0}
    db.add(
        Transaction(
            material_id=material_id, type=TRANSACTION_ADJUSTMENT, qty=delta, comment=body.comment or "инвентаризация"
        )
    )
    db.commit()
    return {"ok": True, "delta": delta}
