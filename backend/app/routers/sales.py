"""Отгрузка готовых изделий — доступно только founder/developer (см. таблицу ролей в CLAUDE.md).
Каждая запись списывает кол-во из «готово к отгрузке» у Product (см. products.py).
Название продукта в Sale не хранится в БД — join при чтении."""

from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.constants import DEVELOPER, FOUNDER

from app.db import get_db
from app.models import Counterparty, Product, Sale
from app.routers.products import _ready_to_ship_by_recipe, _sold_by_product
from app.schemas import SaleRequest
from app.security import require_roles

router = APIRouter(prefix="/api/sales", tags=["sales"], dependencies=[Depends(require_roles(FOUNDER, DEVELOPER))])


def _sale_dict(sale: Sale) -> dict:
    return {
        "id": sale.id,
        "дата": sale.date.isoformat(),
        "product_id": sale.product_id,
        "название": sale.product.name if sale.product else "",
        "counterparty_id": sale.counterparty_id or "",
        "контрагент": sale.counterparty.name if sale.counterparty else "",
        "кол-во": float(sale.qty),
        "цена": float(sale.price) if sale.price is not None else "",
        "комментарий": sale.comment or "",
    }


@router.get("")
def list_sales(db: Session = Depends(get_db)) -> list[dict]:
    rows = db.scalars(select(Sale).order_by(Sale.date.desc()))
    return [_sale_dict(s) for s in rows]


@router.get("/top")
def top_products(limit: int = 3, db: Session = Depends(get_db)) -> list[dict]:
    totals: dict[str, float] = defaultdict(float)
    names: dict[str, str] = {}
    for s in db.scalars(select(Sale)):
        totals[s.product_id] += float(s.qty)
        if s.product:
            names[s.product_id] = s.product.name
    top = sorted(totals.items(), key=lambda kv: kv[1], reverse=True)[:limit]
    return [{"product_id": pid, "название": names.get(pid, pid), "кол-во": qty} for pid, qty in top]


@router.post("")
def create_sale(body: SaleRequest, db: Session = Depends(get_db)) -> dict:
    if body.qty <= 0:
        raise HTTPException(400, "Количество должно быть больше нуля.")
    product = db.get(Product, body.product_id)
    if product is None:
        raise HTTPException(404, "Продукт не найден.")
    if body.counterparty_id and db.get(Counterparty, body.counterparty_id) is None:
        raise HTTPException(404, "Контрагент не найден.")

    if product.recipe_id:
        ready = _ready_to_ship_by_recipe(db).get(product.recipe_id, 0.0) - _sold_by_product(db).get(product.id, 0.0)
        if body.qty > ready:
            raise HTTPException(400, f"Недостаточно готового товара: доступно {ready:g}, запрошено {body.qty:g}.")

    sale = Sale(
        product_id=body.product_id,
        counterparty_id=body.counterparty_id or None,
        qty=body.qty,
        price=body.price,
        comment=body.comment,
    )
    db.add(sale)
    db.commit()
    return {"id": sale.id}
