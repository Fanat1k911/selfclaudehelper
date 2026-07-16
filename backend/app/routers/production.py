"""Раздел «Производство»: список рецептов, журнал смен (КПД), списание сырья по рецепту.
Worker видит только свои записи журнала, founder/developer — все (см. таблицу ролей в CLAUDE.md).
ФИО сотрудника/название рецепта в ProductionLog больше не хранятся в БД — join при чтении."""

from datetime import date as date_
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.constants import DEVELOPER, FOUNDER, TRANSACTION_ADJUSTMENT, TRANSACTION_EXPENSE, TRANSACTION_INCOME

from app.db import get_db
from app.models import Product, ProductionLog, Recipe, RecipeItem, Transaction
from app.schemas import ProductionRequest
from app.security import get_current_user

router = APIRouter(prefix="/api/production", tags=["production"], dependencies=[Depends(get_current_user)])

_SIGN_BY_TYPE = {TRANSACTION_INCOME: 1, TRANSACTION_EXPENSE: -1, TRANSACTION_ADJUSTMENT: 1}


def _balance(db: Session, material_id: str) -> float:
    balance = 0.0
    for tx in db.scalars(select(Transaction).where(Transaction.material_id == material_id)):
        balance += float(tx.qty) * _SIGN_BY_TYPE.get(tx.type, 0)
    return balance


def _recipe_dict(recipe: Recipe) -> dict:
    return {
        "id": recipe.id,
        "название": recipe.name,
        "что производим": recipe.produces,
        "выход партии": float(recipe.batch_yield),
        "технология": recipe.technology or "",
    }


@router.get("/recipes")
def list_recipes(db: Session = Depends(get_db)) -> list[dict]:
    return [_recipe_dict(r) for r in db.scalars(select(Recipe).where(Recipe.archived.is_(False)))]


@router.get("/products")
def list_producible_products(db: Session = Depends(get_db)) -> list[dict]:
    """Продукты, для которых можно внести производство — привязан рецепт, и он не в архиве."""
    stmt = (
        select(Product)
        .join(Recipe, Product.recipe_id == Recipe.id)
        .where(Recipe.archived.is_(False))
    )
    return [
        {"id": p.id, "название": p.name, "recipe_id": p.recipe_id}
        for p in db.scalars(stmt)
    ]


def _log_dict(entry: ProductionLog) -> dict:
    return {
        "id": entry.id,
        "дата": entry.date.isoformat(),
        "worker_id": entry.worker_id,
        "ФИО сотрудника": entry.worker.fio,
        "recipe_id": entry.recipe_id,
        "название рецепта": entry.recipe.name,
        "кол-во партий": float(entry.batches),
        "время начала": entry.started_at.isoformat(),
        "время окончания": entry.finished_at.isoformat(),
        "брак": float(entry.defects),
        "комментарий": entry.comment or "",
    }


@router.get("")
def list_production(user: dict = Depends(get_current_user), db: Session = Depends(get_db)) -> list[dict]:
    stmt = select(ProductionLog).order_by(ProductionLog.date.desc())
    if user["role"] not in (FOUNDER, DEVELOPER):
        stmt = stmt.where(ProductionLog.worker_id == user["id"])
    return [_log_dict(entry) for entry in db.scalars(stmt)]


@router.get("/leaderboard")
def get_leaderboard(db: Session = Depends(get_db)) -> list[dict]:
    """Кол-во произведённого сегодня и с начала месяца по сотруднику — видно всем ролям
    (мотивация), в отличие от dashboard/kpi (только founder/developer, вся история).
    Только количество — цен/выручки в ProductionLog нет вообще, не только скрыто на фронте."""
    today = date_.today()
    month_start = today.replace(day=1)
    entries = db.scalars(select(ProductionLog).where(ProductionLog.date >= month_start))

    totals: dict[str, dict] = {}
    for entry in entries:
        row = totals.setdefault(
            entry.worker_id,
            {"worker_id": entry.worker_id, "ФИО": entry.worker.fio, "сегодня": 0.0, "месяц": 0.0},
        )
        qty = float(entry.batches) * float(entry.recipe.batch_yield) - float(entry.defects)
        row["месяц"] += qty
        if entry.date == today:
            row["сегодня"] += qty

    result = list(totals.values())
    result.sort(key=lambda r: r["месяц"], reverse=True)
    return result


@router.post("")
def create_production(
    body: ProductionRequest, user: dict = Depends(get_current_user), db: Session = Depends(get_db)
) -> dict:
    if body.batches <= 0:
        raise HTTPException(400, "Количество партий должно быть больше нуля.")

    recipe = db.get(Recipe, body.recipe_id)
    if recipe is None:
        raise HTTPException(404, "Рецепт не найден.")
    if recipe.archived:
        raise HTTPException(400, "Рецепт в архиве, производство по нему недоступно.")

    recipe_items = db.scalars(select(RecipeItem).where(RecipeItem.recipe_id == body.recipe_id)).all()

    shortages = []
    for item in recipe_items:
        need = float(item.qty_per_batch) * body.batches
        available = _balance(db, item.material_id)
        if available < need:
            shortages.append(f"{item.material.name}: нужно {need:g}, в наличии {available:g}")
    if shortages:
        raise HTTPException(400, "Недостаточно сырья на складе: " + "; ".join(shortages))

    for item in recipe_items:
        db.add(
            Transaction(
                material_id=item.material_id,
                type=TRANSACTION_EXPENSE,
                qty=float(item.qty_per_batch) * body.batches,
                recipe_id=body.recipe_id,
                comment=f"списание по производству: {recipe.name}",
            )
        )

    log = ProductionLog(
        worker_id=user["id"],
        recipe_id=body.recipe_id,
        batches=body.batches,
        started_at=datetime.fromisoformat(body.started_at),
        finished_at=datetime.fromisoformat(body.finished_at),
        defects=body.defects,
        comment=body.comment,
    )
    db.add(log)
    db.commit()
    return {"id": log.id}
