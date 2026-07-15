"""Состав рецептов читают все роли (см. CLAUDE.md — «эти товары видят все»), а вот
редактировать состав/создавать рецепты может только founder/developer, чтобы рядовой
сотрудник случайно не добавил в рецепт левый ингредиент. Название рецепта/материала
в RecipeItem больше не хранится в БД (денормализация убрана) — join при чтении."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from core.config import DEVELOPER, FOUNDER

from app.db import get_db
from app.models import Material, Recipe, RecipeItem
from app.schemas import NewRecipeItemRequest, NewRecipeRequest
from app.security import get_current_user, require_roles

router = APIRouter(prefix="/api/recipes", tags=["recipes"], dependencies=[Depends(get_current_user)])


def _recipe_dict(recipe: Recipe) -> dict:
    return {
        "id": recipe.id,
        "название": recipe.name,
        "что производим": recipe.produces,
        "выход партии": float(recipe.batch_yield),
        "технология": recipe.technology or "",
    }


@router.get("")
def list_recipes(db: Session = Depends(get_db)) -> list[dict]:
    return [_recipe_dict(r) for r in db.scalars(select(Recipe))]


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
    recipe = Recipe(
        name=body.name, produces=body.produces, batch_yield=body.batch_yield, technology=body.technology or None
    )
    db.add(recipe)
    db.commit()
    return {"id": recipe.id}


@router.post("/{recipe_id}/items", dependencies=[Depends(require_roles(FOUNDER, DEVELOPER))])
def add_recipe_item(recipe_id: str, body: NewRecipeItemRequest, db: Session = Depends(get_db)) -> dict:
    if db.get(Recipe, recipe_id) is None:
        raise HTTPException(404, "Рецепт не найден.")
    if db.get(Material, body.material_id) is None:
        raise HTTPException(404, "Ингредиент не найден.")

    existing = db.scalar(
        select(RecipeItem).where(RecipeItem.recipe_id == recipe_id, RecipeItem.material_id == body.material_id)
    )
    if existing:
        existing.qty_per_batch = body.qty_per_batch
    else:
        db.add(RecipeItem(recipe_id=recipe_id, material_id=body.material_id, qty_per_batch=body.qty_per_batch))
    db.commit()
    return {"ok": True}
