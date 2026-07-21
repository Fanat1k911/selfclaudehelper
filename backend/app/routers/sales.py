"""Отгрузка готовых изделий — доступно только founder/developer (см. таблицу ролей в CLAUDE.md).
Каждая запись списывает кол-во из «готово к отгрузке» у Product (см. products.py).
Название продукта в Sale не хранится в БД — join при чтении.

Мультитенантность: каждый запрос фильтруется по user["company_id"]."""

from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.constants import DEVELOPER, FOUNDER

from app.db import get_db
from app.models import Counterparty, Product, Recipe, Sale
from app.routers.products import _ready_to_ship_by_recipe, _sold_by_product
from app.schemas import SaleRequest, SaleUpdateRequest
from app.security import get_current_user, get_owned_or_404, require_roles

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
        "коробки": float(sale.box_count) if sale.box_count is not None else None,
        "скотч_см": float(sale.tape_cm) if sale.tape_cm is not None else None,
        "наклейки": float(sale.sticker_count) if sale.sticker_count is not None else None,
        "трата_курьер": float(sale.courier_cost) if sale.courier_cost is not None else None,
        "трата_логист": float(sale.logist_cost) if sale.logist_cost is not None else None,
    }


@router.get("")
def list_sales(user: dict = Depends(get_current_user), db: Session = Depends(get_db)) -> list[dict]:
    stmt = select(Sale).where(Sale.company_id == user["company_id"]).order_by(Sale.date.desc())
    return [_sale_dict(s) for s in db.scalars(stmt)]


@router.get("/top")
def top_products(limit: int = 3, user: dict = Depends(get_current_user), db: Session = Depends(get_db)) -> list[dict]:
    totals: dict[str, float] = defaultdict(float)
    names: dict[str, str] = {}
    for s in db.scalars(select(Sale).where(Sale.company_id == user["company_id"])):
        totals[s.product_id] += float(s.qty)
        if s.product:
            names[s.product_id] = s.product.name
    top = sorted(totals.items(), key=lambda kv: kv[1], reverse=True)[:limit]
    return [{"product_id": pid, "название": names.get(pid, pid), "кол-во": qty} for pid, qty in top]


@router.post("")
def create_sale(body: SaleRequest, user: dict = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    if body.qty <= 0:
        raise HTTPException(400, "Количество должно быть больше нуля.")
    product = get_owned_or_404(db, Product, body.product_id, user["company_id"], "Продукт не найден.")
    if body.counterparty_id:
        get_owned_or_404(db, Counterparty, body.counterparty_id, user["company_id"], "Контрагент не найден.")

    if product.recipe_id:
        # Блокируем строку рецепта на время проверки+записи — без этого два одновременных
        # POST на один product могут оба увидеть один и тот же "остаток" до того, как
        # первый закоммитится, и вместе продать больше, чем реально готово (гонка, найдена
        # на code-review 2026-07-21). Держится до db.commit() ниже.
        db.execute(select(Recipe.id).where(Recipe.id == product.recipe_id).with_for_update())
        ready = _ready_to_ship_by_recipe(db, user["company_id"]).get(product.recipe_id, 0.0) - _sold_by_product(
            db, user["company_id"]
        ).get(product.id, 0.0)
        if body.qty > ready:
            raise HTTPException(400, f"Недостаточно готового товара: доступно {ready:g}, запрошено {body.qty:g}.")

    sale = Sale(
        company_id=user["company_id"],
        product_id=body.product_id,
        counterparty_id=body.counterparty_id or None,
        qty=body.qty,
        price=body.price,
        comment=body.comment,
        box_count=body.box_count,
        tape_cm=body.tape_cm,
        sticker_count=body.sticker_count,
        courier_cost=body.courier_cost,
        logist_cost=body.logist_cost,
    )
    db.add(sale)
    db.commit()
    return {"id": sale.id}


@router.patch("/{sale_id}")
def update_sale(
    sale_id: str, body: SaleUpdateRequest, user: dict = Depends(get_current_user), db: Session = Depends(get_db)
) -> dict:
    sale = get_owned_or_404(db, Sale, sale_id, user["company_id"], "Отгрузка не найдена.")
    updates = body.model_dump(exclude_unset=True)

    target_product_id = updates.get("product_id", sale.product_id)
    target_qty = updates.get("qty", float(sale.qty))
    if target_qty <= 0:
        raise HTTPException(400, "Количество должно быть больше нуля.")

    product = get_owned_or_404(db, Product, target_product_id, user["company_id"], "Продукт не найден.")
    if "counterparty_id" in updates and updates["counterparty_id"]:
        get_owned_or_404(db, Counterparty, updates["counterparty_id"], user["company_id"], "Контрагент не найден.")

    if product.recipe_id and (target_product_id != sale.product_id or target_qty != float(sale.qty)):
        # Та же блокировка строки рецепта, что и в create_sale — см. комментарий там.
        db.execute(select(Recipe.id).where(Recipe.id == product.recipe_id).with_for_update())
        # "Готово к отгрузке" минус уже проданное ДРУГИМИ отгрузками (не этой — эту сейчас правим).
        sold_excluding_self: dict[str, float] = defaultdict(float)
        for s in db.scalars(select(Sale).where(Sale.company_id == user["company_id"], Sale.id != sale_id)):
            sold_excluding_self[s.product_id] += float(s.qty)
        ready = _ready_to_ship_by_recipe(db, user["company_id"]).get(product.recipe_id, 0.0) - sold_excluding_self.get(
            target_product_id, 0.0
        )
        if target_qty > ready:
            raise HTTPException(400, f"Недостаточно готового товара: доступно {ready:g}, запрошено {target_qty:g}.")

    for field, value in updates.items():
        setattr(sale, field, value if field != "counterparty_id" else (value or None))
    db.commit()
    return {"ok": True}
