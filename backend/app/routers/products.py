"""Карточки готовых изделий — доступно только founder/developer (см. таблицу ролей в CLAUDE.md).
Обязательные поля при создании — название/категория/GTIN, см. core.config.PRODUCT_REQUIRED_FIELDS.
Название рецепта в Product больше не хранится в БД — join при чтении."""

from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from core.config import DEVELOPER, FOUNDER, PRODUCT_REQUIRED_FIELDS

from app.db import get_db
from app.models import Product, Recipe
from app.schemas import NewProductRequest
from app.security import require_roles

router = APIRouter(prefix="/api/products", tags=["products"], dependencies=[Depends(require_roles(FOUNDER, DEVELOPER))])


def _missing_required_fields(fields: dict[str, str]) -> list[str]:
    return [field for field in PRODUCT_REQUIRED_FIELDS if not fields.get(field, "").strip()]


def _product_dict(product: Product) -> dict:
    return {
        "id": product.id,
        "название": product.name,
        "категория": product.category,
        "GTIN": product.gtin,
        "состав": product.composition or "",
        "recipe_id": product.recipe_id or "",
        "название рецепта": product.recipe.name if product.recipe_id and product.recipe else "",
        "ТН ВЭД": product.tn_ved or "",
        "декларация соответствия": product.declaration or "",
        "срок действия РД": product.declaration_expires.isoformat() if product.declaration_expires else "",
    }


@router.get("")
def list_products(db: Session = Depends(get_db)) -> list[dict]:
    return [_product_dict(p) for p in db.scalars(select(Product))]


@router.post("")
def create_product(body: NewProductRequest, db: Session = Depends(get_db)) -> dict:
    fields = {
        "название": body.name,
        "категория": body.category,
        "GTIN": body.gtin,
        "состав": body.composition,
        "recipe_id": body.recipe_id,
        "ТН ВЭД": body.tn_ved,
        "декларация соответствия": body.declaration,
        "срок действия РД": body.declaration_expires,
    }
    missing = _missing_required_fields(fields)
    if missing:
        raise HTTPException(400, f"Не заполнены обязательные поля: {', '.join(missing)}.")

    if body.recipe_id and db.get(Recipe, body.recipe_id) is None:
        raise HTTPException(404, "Рецепт не найден.")

    product = Product(
        name=body.name,
        category=body.category,
        gtin=body.gtin,
        composition=body.composition or None,
        recipe_id=body.recipe_id or None,
        tn_ved=body.tn_ved or None,
        declaration=body.declaration or None,
        declaration_expires=date.fromisoformat(body.declaration_expires) if body.declaration_expires else None,
    )
    db.add(product)
    db.commit()
    return {"id": product.id}
