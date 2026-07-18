"""Раздел «Производство»: список рецептов, журнал смен (КПД), списание сырья по рецепту.
Worker видит только свои записи журнала, founder/developer — все (см. таблицу ролей в CLAUDE.md).
ФИО сотрудника/название рецепта в ProductionLog больше не хранятся в БД — join при чтении.

Мультитенантность: каждый запрос фильтруется по user["company_id"]."""

from datetime import date as date_
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.constants import DEVELOPER, FOUNDER, TRANSACTION_ADJUSTMENT, TRANSACTION_EXPENSE, TRANSACTION_INCOME

from app.db import get_db
from app.models import LoginLog, Product, ProductionLog, Recipe, RecipeItem, Transaction
from app.schemas import ProductionRequest
from app.security import get_current_user, get_owned_or_404

router = APIRouter(prefix="/api/production", tags=["production"], dependencies=[Depends(get_current_user)])

_SIGN_BY_TYPE = {TRANSACTION_INCOME: 1, TRANSACTION_EXPENSE: -1, TRANSACTION_ADJUSTMENT: 1}


def _balance(db: Session, material_id: str, company_id: str) -> float:
    balance = 0.0
    stmt = select(Transaction).where(Transaction.material_id == material_id, Transaction.company_id == company_id)
    for tx in db.scalars(stmt):
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
def list_recipes(user: dict = Depends(get_current_user), db: Session = Depends(get_db)) -> list[dict]:
    stmt = select(Recipe).where(Recipe.company_id == user["company_id"], Recipe.archived.is_(False))
    return [_recipe_dict(r) for r in db.scalars(stmt)]


@router.get("/products")
def list_producible_products(user: dict = Depends(get_current_user), db: Session = Depends(get_db)) -> list[dict]:
    """Продукты, для которых можно внести производство — привязан рецепт, и он не в архиве."""
    stmt = (
        select(Product)
        .join(Recipe, Product.recipe_id == Recipe.id)
        .where(
            Product.company_id == user["company_id"],
            Recipe.company_id == user["company_id"],
            Recipe.archived.is_(False),
        )
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
        # qty хранится отдельно от batches (2026-07-18) — не реконструируем из
        # batches×yield, это теряло точность на некратных соотношениях (code-review
        # 2026-07-18: qty=10 при yield=3 показывало бы 9.999 вместо 10).
        "кол-во продукта": float(entry.qty),
        "брак": float(entry.defects),
        "комментарий": entry.comment or "",
    }


@router.get("")
def list_production(user: dict = Depends(get_current_user), db: Session = Depends(get_db)) -> list[dict]:
    stmt = select(ProductionLog).where(ProductionLog.company_id == user["company_id"]).order_by(ProductionLog.date.desc())
    if user["role"] not in (FOUNDER, DEVELOPER):
        stmt = stmt.where(ProductionLog.worker_id == user["id"])
    return [_log_dict(entry) for entry in db.scalars(stmt)]


@router.get("/leaderboard")
def get_leaderboard(user: dict = Depends(get_current_user), db: Session = Depends(get_db)) -> list[dict]:
    """Кол-во произведённого сегодня и с начала месяца по сотруднику — видно всем ролям
    (мотивация), в отличие от dashboard/kpi (только founder/developer, вся история).
    Только количество — цен/выручки в ProductionLog нет вообще, не только скрыто на фронте."""
    today = date_.today()
    month_start = today.replace(day=1)
    stmt = select(ProductionLog).where(
        ProductionLog.company_id == user["company_id"], ProductionLog.date >= month_start
    )
    entries = db.scalars(stmt)

    totals: dict[str, dict] = {}
    for entry in entries:
        row = totals.setdefault(
            entry.worker_id,
            {"worker_id": entry.worker_id, "ФИО": entry.worker.fio, "сегодня": 0.0, "месяц": 0.0},
        )
        qty = float(entry.qty) - float(entry.defects)
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
    if body.qty <= 0:
        raise HTTPException(400, "Количество продукта должно быть больше нуля.")

    recipe = get_owned_or_404(db, Recipe, body.recipe_id, user["company_id"], "Рецепт не найден.")
    if recipe.archived:
        raise HTTPException(400, "Рецепт в архиве, производство по нему недоступно.")
    if float(recipe.batch_yield) <= 0:
        raise HTTPException(400, "У рецепта не указан выход партии — невозможно посчитать списание сырья.")

    # Списание считается партиями, ввод теперь — готовым продуктом (2026-07-18): переводим
    # обратно делением на выход партии рецепта, дальше логика та же, что и раньше.
    batches = body.qty / float(recipe.batch_yield)

    recipe_items = db.scalars(select(RecipeItem).where(RecipeItem.recipe_id == body.recipe_id)).all()

    shortages = []
    for item in recipe_items:
        need = float(item.qty_per_batch) * batches
        available = _balance(db, item.material_id, user["company_id"])
        if available < need:
            shortages.append(f"{item.material.name}: нужно {need:g}, в наличии {available:g}")
    if shortages:
        raise HTTPException(400, "Недостаточно компонентов на складе: " + "; ".join(shortages))

    for item in recipe_items:
        db.add(
            Transaction(
                company_id=user["company_id"],
                material_id=item.material_id,
                type=TRANSACTION_EXPENSE,
                qty=float(item.qty_per_batch) * batches,
                recipe_id=body.recipe_id,
                comment=f"списание по производству: {recipe.name}",
            )
        )

    # started_at/finished_at убраны из ручного ввода (2026-07-18, решение Founder), но не из
    # колонок БД — вместо голого "оба = сейчас" (нулевая длительность) started_at теперь берём
    # с первого входа сотрудника СЕГОДНЯ (LoginLog), finished_at — момент внесения записи. Это
    # даёт грубую оценку "сколько прошло с начала смены", не требуя ручного секундомера.
    # Фоллбек на now(), если сегодняшнего входа почему-то нет (токен пережил полночь без
    # повторного логина) — тогда длительность просто 0, как и было, не 500/ошибка.
    now = datetime.utcnow()
    today_start = datetime.combine(now.date(), datetime.min.time())
    first_login_today = db.scalar(
        select(LoginLog)
        .where(
            LoginLog.user_id == user["id"],
            LoginLog.company_id == user["company_id"],
            LoginLog.logged_in_at >= today_start,
        )
        .order_by(LoginLog.logged_in_at)
        .limit(1)
    )
    started_at = first_login_today.logged_in_at if first_login_today else now

    log = ProductionLog(
        company_id=user["company_id"],
        worker_id=user["id"],
        recipe_id=body.recipe_id,
        qty=body.qty,
        batches=batches,
        started_at=started_at,
        finished_at=now,
        defects=body.defects,
        comment=body.comment,
    )
    db.add(log)
    db.commit()
    return {"id": log.id}
