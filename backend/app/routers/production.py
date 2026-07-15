"""Раздел «Производство»: список рецептов, журнал смен (КПД), списание сырья по рецепту.
Worker видит только свои записи журнала, founder/developer — все (см. таблицу ролей в CLAUDE.md).
ФИО сотрудника/название рецепта в ProductionLog больше не хранятся в БД — join при чтении."""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from core.config import DEVELOPER, FOUNDER, TRANSACTION_EXPENSE

from app.db import get_db
from app.models import ProductionLog, Recipe, RecipeItem, Transaction
from app.schemas import ProductionRequest
from app.security import get_current_user

router = APIRouter(prefix="/api/production", tags=["production"], dependencies=[Depends(get_current_user)])


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
    return [_recipe_dict(r) for r in db.scalars(select(Recipe))]


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


@router.post("")
def create_production(
    body: ProductionRequest, user: dict = Depends(get_current_user), db: Session = Depends(get_db)
) -> dict:
    if body.batches <= 0:
        raise HTTPException(400, "Количество партий должно быть больше нуля.")

    recipe = db.get(Recipe, body.recipe_id)
    if recipe is None:
        raise HTTPException(404, "Рецепт не найден.")

    recipe_items = db.scalars(select(RecipeItem).where(RecipeItem.recipe_id == body.recipe_id)).all()
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
