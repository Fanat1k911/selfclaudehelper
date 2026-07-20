"""Раздел «Рабочий инвентарь» (2026-07-19, запрос Александра) — многоразовое
оборудование мастерской (миксеры, мерные стаканы и т.п.), отдельно от сырья
(Компоненты/Materials). Остаток считается на лету из EquipmentTransaction, тот же
паттерн, что у Materials (см. CLAUDE.md). Видно только Founder/Developer — рядовой
инвентарь мастерской не входит в рабочие задачи Worker.

Мультитенантность: каждый запрос фильтруется по user["company_id"] — см. CLAUDE.md
"Архитектурные принципы"."""

from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.constants import DEVELOPER, EQUIPMENT_BROKEN, EQUIPMENT_LOST, FOUNDER, TRANSACTION_ADJUSTMENT, TRANSACTION_INCOME
from app.db import get_db
from app.models import EquipmentItem, EquipmentTransaction
from app.schemas import EquipmentAdjustmentRequest, EquipmentTransactionRequest, NewEquipmentRequest
from app.security import get_current_user, get_owned_or_404, require_roles

router = APIRouter(
    prefix="/api/equipment", tags=["equipment"], dependencies=[Depends(require_roles(FOUNDER, DEVELOPER))]
)

_SIGN_BY_TYPE = {TRANSACTION_INCOME: 1, EQUIPMENT_BROKEN: -1, EQUIPMENT_LOST: -1, TRANSACTION_ADJUSTMENT: 1}


def _color(balance: float, min_stock: float) -> str:
    if balance < min_stock:
        return "красный"
    if min_stock > 0 and balance <= min_stock * 1.2:
        return "жёлтый"
    return "зелёный"


def _balances_and_last_movement(db: Session, company_id: str) -> tuple[dict[str, float], dict[str, date]]:
    balances: dict[str, float] = {}
    last_movement: dict[str, date] = {}
    for tx in db.scalars(select(EquipmentTransaction).where(EquipmentTransaction.company_id == company_id)):
        sign = _SIGN_BY_TYPE.get(tx.type, 0)
        balances[tx.item_id] = balances.get(tx.item_id, 0.0) + float(tx.qty) * sign
        if tx.item_id not in last_movement or tx.date > last_movement[tx.item_id]:
            last_movement[tx.item_id] = tx.date
    return balances, last_movement


def _item_dict(item: EquipmentItem, balance: float, last_movement: date | None) -> dict:
    min_stock = float(item.min_stock)
    return {
        "id": item.id,
        "название": item.name,
        "ед.измерения": item.unit,
        "мин.остаток": min_stock,
        "остаток": balance,
        "ниже минимума": balance < min_stock,
        "цвет": _color(balance, min_stock),
        "последнее движение": last_movement.isoformat() if last_movement else None,
    }


def _transaction_dict(tx: EquipmentTransaction) -> dict:
    return {
        "id": tx.id,
        "дата": tx.date.isoformat(),
        "item_id": tx.item_id,
        "тип": tx.type,
        "кол-во": float(tx.qty),
        "трата": float(tx.cost) if tx.cost is not None else "",
        "комментарий": tx.comment or "",
    }


def _get_own_item(db: Session, item_id: str, company_id: str) -> EquipmentItem:
    return get_owned_or_404(db, EquipmentItem, item_id, company_id, "Инвентарь не найден.")


@router.get("")
def list_equipment(user: dict = Depends(get_current_user), db: Session = Depends(get_db)) -> list[dict]:
    items = db.scalars(select(EquipmentItem).where(EquipmentItem.company_id == user["company_id"])).all()
    balances, last_movement = _balances_and_last_movement(db, user["company_id"])
    return [_item_dict(i, balances.get(i.id, 0.0), last_movement.get(i.id)) for i in items]


@router.get("/{item_id}/transactions")
def list_transactions(
    item_id: str, user: dict = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[dict]:
    _get_own_item(db, item_id, user["company_id"])
    rows = db.scalars(
        select(EquipmentTransaction)
        .where(EquipmentTransaction.item_id == item_id, EquipmentTransaction.company_id == user["company_id"])
        .order_by(EquipmentTransaction.date.desc())
    )
    return [_transaction_dict(tx) for tx in rows]


@router.post("")
def create_equipment(
    body: NewEquipmentRequest, user: dict = Depends(get_current_user), db: Session = Depends(get_db)
) -> dict:
    item = EquipmentItem(company_id=user["company_id"], name=body.name, unit=body.unit, min_stock=body.min_stock)
    db.add(item)
    db.flush()
    if body.initial_qty > 0:
        db.add(
            EquipmentTransaction(
                company_id=user["company_id"], item_id=item.id, type=TRANSACTION_INCOME,
                qty=body.initial_qty, comment="начальный остаток",
            )
        )
    db.commit()
    return {"id": item.id}


def _require_positive(qty: float) -> None:
    if qty <= 0:
        raise HTTPException(400, "Количество должно быть больше нуля.")


@router.post("/{item_id}/income")
def add_income(
    item_id: str, body: EquipmentTransactionRequest, user: dict = Depends(get_current_user), db: Session = Depends(get_db)
) -> dict:
    _require_positive(body.qty)
    _get_own_item(db, item_id, user["company_id"])
    db.add(
        EquipmentTransaction(
            company_id=user["company_id"], item_id=item_id, type=TRANSACTION_INCOME,
            qty=body.qty, cost=body.cost, comment=body.comment,
        )
    )
    db.commit()
    return {"ok": True}


@router.post("/{item_id}/broken")
def add_broken(
    item_id: str, body: EquipmentTransactionRequest, user: dict = Depends(get_current_user), db: Session = Depends(get_db)
) -> dict:
    """Поломка — списывает кол-во, cost — трата на ремонт/замену, если известна."""
    _require_positive(body.qty)
    _get_own_item(db, item_id, user["company_id"])
    db.add(
        EquipmentTransaction(
            company_id=user["company_id"], item_id=item_id, type=EQUIPMENT_BROKEN,
            qty=body.qty, cost=body.cost, comment=body.comment,
        )
    )
    db.commit()
    return {"ok": True}


@router.post("/{item_id}/lost")
def add_lost(
    item_id: str, body: EquipmentTransactionRequest, user: dict = Depends(get_current_user), db: Session = Depends(get_db)
) -> dict:
    """Пропажа — списывает кол-во, cost — трата на замену, если известна."""
    _require_positive(body.qty)
    _get_own_item(db, item_id, user["company_id"])
    db.add(
        EquipmentTransaction(
            company_id=user["company_id"], item_id=item_id, type=EQUIPMENT_LOST,
            qty=body.qty, cost=body.cost, comment=body.comment,
        )
    )
    db.commit()
    return {"ok": True}


@router.post("/{item_id}/adjustment")
def add_adjustment(
    item_id: str, body: EquipmentAdjustmentRequest, user: dict = Depends(get_current_user), db: Session = Depends(get_db)
) -> dict:
    """Инвентаризация — фактический пересчёт, delta = actual - текущий остаток."""
    _get_own_item(db, item_id, user["company_id"])
    balances, _ = _balances_and_last_movement(db, user["company_id"])
    current = balances.get(item_id, 0.0)
    delta = body.actual_qty - current
    if delta == 0:
        return {"ok": True, "delta": 0}
    db.add(
        EquipmentTransaction(
            company_id=user["company_id"], item_id=item_id, type=TRANSACTION_ADJUSTMENT,
            qty=delta, comment=body.comment or "инвентаризация",
        )
    )
    db.commit()
    return {"ok": True, "delta": delta}
