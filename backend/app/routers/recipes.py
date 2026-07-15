"""Состав рецептов читают все роли (см. CLAUDE.md — «эти продукты видят все»), а вот
редактировать состав/создавать рецепты может только founder/developer, чтобы рядовой
сотрудник случайно не добавил в рецепт левый компонент. Название рецепта/материала
в RecipeItem больше не хранится в БД (денормализация убрана) — join при чтении.

Архив рецептов — без урезания данных (см. CLAUDE.md): архивный рецепт просто не
попадает в список по умолчанию и не всплывает в выборках Производства/Продуктов,
но сама запись, её состав и вся историческая привязка (ProductionLog, Product)
остаются нетронутыми — фильтруется только видимость в активном обращении."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.constants import DEVELOPER, FOUNDER

from app.db import get_db
from app.models import Material, Recipe, RecipeItem
from app.schemas import NewRecipeItemRequest, NewRecipeRequest, UpdateRecipeArchivedRequest
from app.security import get_current_user, require_roles

router = APIRouter(prefix="/api/recipes", tags=["recipes"], dependencies=[Depends(get_current_user)])


def _recipe_dict(recipe: Recipe) -> dict:
    return {
        "id": recipe.id,
        "название": recipe.name,
        "категория": recipe.category,
        "что производим": recipe.produces,
        "выход партии": float(recipe.batch_yield),
        "технология": recipe.technology or "",
        "архив": recipe.archived,
    }


@router.get("")
def list_recipes(archived: bool = Query(False), db: Session = Depends(get_db)) -> list[dict]:
    stmt = select(Recipe).where(Recipe.archived == archived)
    return [_recipe_dict(r) for r in db.scalars(stmt)]


@router.get("/{recipe_id}/items")
def list_recipe_items(recipe_id: str, db: Session = Depends(get_db)) -> list[dict]:
    rows = db.scalars(select(RecipeItem).where(RecipeItem.recipe_id == recipe_id))
    return [
        {
            "recipe_id": item.recipe_id,
            "название рецепта": item.recipe.name,
            "material_id": item.material_id,
            "название материала": item.material.name,
            "кол-во на 1 партию": float(item.qty_per_batch),
        }
        for item in rows
    ]


@router.post("", dependencies=[Depends(require_roles(FOUNDER, DEVELOPER))])
def create_recipe(body: NewRecipeRequest, db: Session = Depends(get_db)) -> dict:
    valid_items = [item for item in body.items if item.material_id and item.qty_per_batch > 0]
    if not valid_items:
        raise HTTPException(422, "Состав рецепта обязателен.")
    # Один и тот же компонент могли выбрать в двух строках формы (см. NewRecipeModal —
    # свободный ввод названия без блокировки повторов) — последняя строка побеждает,
    # иначе упрёмся в uq_recipe_item и отдадим 500 вместо внятной ошибки.
    valid_items = list({item.material_id: item for item in valid_items}.values())

    recipe = Recipe(
        name=body.name,
        category=body.category,
        produces=body.produces,
        batch_yield=body.batch_yield,
        technology=body.technology or None,
    )
    db.add(recipe)
    db.flush()

    for item in valid_items:
        if db.get(Material, item.material_id) is None:
            raise HTTPException(404, "Компонент не найден.")
        db.add(RecipeItem(recipe_id=recipe.id, material_id=item.material_id, qty_per_batch=item.qty_per_batch))

    db.commit()
    return {"id": recipe.id}


@router.post("/{recipe_id}/items", dependencies=[Depends(require_roles(FOUNDER, DEVELOPER))])
def add_recipe_item(recipe_id: str, body: NewRecipeItemRequest, db: Session = Depends(get_db)) -> dict:
    if db.get(Recipe, recipe_id) is None:
        raise HTTPException(404, "Рецепт не найден.")
    if db.get(Material, body.material_id) is None:
        raise HTTPException(404, "Компонент не найден.")

    existing = db.scalar(
        select(RecipeItem).where(RecipeItem.recipe_id == recipe_id, RecipeItem.material_id == body.material_id)
    )
    if existing:
        existing.qty_per_batch = body.qty_per_batch
    else:
        db.add(RecipeItem(recipe_id=recipe_id, material_id=body.material_id, qty_per_batch=body.qty_per_batch))
    db.commit()
    return {"ok": True}


@router.patch("/{recipe_id}", dependencies=[Depends(require_roles(FOUNDER, DEVELOPER))])
def set_recipe_archived(recipe_id: str, body: UpdateRecipeArchivedRequest, db: Session = Depends(get_db)) -> dict:
    recipe = db.get(Recipe, recipe_id)
    if recipe is None:
        raise HTTPException(404, "Рецепт не найден.")
    recipe.archived = body.archived
    db.commit()
    return {"ok": True}
