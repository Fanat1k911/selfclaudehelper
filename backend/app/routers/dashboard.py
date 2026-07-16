"""Дашборд: остатки/движения/топ расхода по Materials+Transactions. Доступ — только
founder/developer (см. таблицу ролей в CLAUDE.md), как и в Streamlit-версии."""

from collections import defaultdict
from datetime import date as date_

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.constants import DEVELOPER, FOUNDER, TRANSACTION_ADJUSTMENT, TRANSACTION_EXPENSE, TRANSACTION_INCOME
from app.dashboard_widgets import WIDGET_BY_KEY, WIDGET_CATALOG

from app.db import get_db
from app.models import DashboardWidgetLayout, Material, ProductionLog, Transaction
from app.schemas import DashboardLayoutItem
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
        "всего_компонентов": len(materials),
        "ниже_минимума": below_min,
        "последние_движения": recent,
        "топ_расход": top_expense_out,
    }


@router.get("/spend")
def get_spend(
    date_from: date_ | None = Query(None),
    date_to: date_ | None = Query(None),
    db: Session = Depends(get_db),
) -> dict:
    """Траты = приход сырья (qty*price). Расход/корректировка остатков — не траты денег."""
    stmt = select(Transaction).where(Transaction.type == TRANSACTION_INCOME, Transaction.price.is_not(None))
    if date_from:
        stmt = stmt.where(Transaction.date >= date_from)
    if date_to:
        stmt = stmt.where(Transaction.date <= date_to)
    transactions = db.scalars(stmt).all()

    name_by_id = {m.id: m.name for m in db.scalars(select(Material))}

    by_month: dict[str, float] = defaultdict(float)
    by_material: dict[str, float] = defaultdict(float)
    for tx in transactions:
        amount = float(tx.qty) * float(tx.price)
        by_month[tx.date.strftime("%Y-%m")] += amount
        by_material[tx.material_id] += amount

    by_month_out = [{"месяц": month, "сумма": round(sum_, 2)} for month, sum_ in sorted(by_month.items())]
    top_materials = sorted(by_material.items(), key=lambda kv: kv[1], reverse=True)[:5]
    top_materials_out = [
        {"material_id": mid, "название": name_by_id.get(mid, mid), "сумма": round(sum_, 2)}
        for mid, sum_ in top_materials
    ]

    return {
        "всего": round(sum(by_month.values()), 2),
        "по_месяцам": by_month_out,
        "топ_материалов": top_materials_out,
    }


@router.get("/kpi")
def get_kpi(db: Session = Depends(get_db)) -> list[dict]:
    """Выработка по кол-ву произведённого (партии*выход − брак), помесячно на сотрудника."""
    entries = db.scalars(select(ProductionLog)).all()

    totals: dict[tuple[str, str], dict] = {}
    for entry in entries:
        month = entry.date.strftime("%Y-%m")
        key = (month, entry.worker_id)
        row = totals.setdefault(
            key, {"месяц": month, "worker_id": entry.worker_id, "ФИО": entry.worker.fio,
                  "партий": 0.0, "брак": 0.0, "произведено": 0.0}
        )
        batches = float(entry.batches)
        defects = float(entry.defects)
        row["партий"] += batches
        row["брак"] += defects
        row["произведено"] += batches * float(entry.recipe.batch_yield) - defects

    result = list(totals.values())
    result.sort(key=lambda r: (r["месяц"], r["ФИО"]))
    return result


@router.get("/widgets/catalog")
def get_widget_catalog() -> list[dict]:
    """Виджет-конструктор (роадмап): доступные типы виджетов + метаданные сетки.
    Раскладка (что показано и где) — отдельно, см. /widgets/layout."""
    return [
        {
            "key": w["key"], "title": w["title"], "kind": w["kind"],
            "w": w["w"], "h": w["h"], "min_w": w["min_w"], "min_h": w["min_h"],
        }
        for w in WIDGET_CATALOG
    ]


@router.get("/widgets/layout")
def get_widget_layout(db: Session = Depends(get_db)) -> list[dict]:
    rows = db.scalars(select(DashboardWidgetLayout)).all()
    return [{"widget_key": r.widget_key, "x": r.x, "y": r.y, "w": r.w, "h": r.h} for r in rows]


@router.put("/widgets/layout")
def save_widget_layout(items: list[DashboardLayoutItem], db: Session = Depends(get_db)) -> dict:
    """Раскладка общая на всю мастерскую — сохраняет одна роль, видят обе (founder и
    developer), поэтому это полная замена, а не per-user upsert."""
    unknown = [i.widget_key for i in items if i.widget_key not in WIDGET_BY_KEY]
    if unknown:
        raise HTTPException(400, f"Неизвестные виджеты: {', '.join(unknown)}")

    db.query(DashboardWidgetLayout).delete()
    for i in items:
        db.add(DashboardWidgetLayout(widget_key=i.widget_key, x=i.x, y=i.y, w=i.w, h=i.h))
    db.commit()
    return {"saved": len(items)}


@router.get("/widgets/{key}/data")
def get_widget_data(key: str, db: Session = Depends(get_db)):
    widget = WIDGET_BY_KEY.get(key)
    if widget is None:
        raise HTTPException(404, "Виджет не найден.")
    return widget["compute"](db)
