"""Себестоимость по принципу "дешёвый лот первым" (2026-07-21, запрос Александра, см.
CLAUDE.md). Не хранится отдельной таблицей лотов — считается на лету по истории
Transaction того же материала, как остаток (см. ingredients.py). Приход создаёт лот
(закупочная цена + доля транспортных расходов на приход, см. app/schemas.py
BatchIncomeRequest), расход съедает лоты по возрастанию цены. Корректировки остатков
в лоты не лезут — только двигают остаток, не себестоимость (осознанное упрощение,
см. обсуждение с Александром 2026-07-21)."""

from collections import defaultdict

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.constants import TRANSACTION_EXPENSE, TRANSACTION_INCOME
from app.models import Product, RecipeItem, Transaction


def compute_active_lot_unit_costs(db: Session, company_id: str) -> dict[str, float]:
    """material_id -> себестоимость единицы из самого дешёвого ещё не израсходованного
    лота. Материал отсутствует в результате, если по нему вообще нет прихода с ценой
    или весь приход уже расходован."""
    txs_by_material: dict[str, list[Transaction]] = defaultdict(list)
    stmt = (
        select(Transaction)
        .where(Transaction.company_id == company_id, Transaction.type.in_([TRANSACTION_INCOME, TRANSACTION_EXPENSE]))
        .order_by(Transaction.date, Transaction.created_at)
    )
    for tx in db.scalars(stmt):
        txs_by_material[tx.material_id].append(tx)

    result: dict[str, float] = {}
    for material_id, txs in txs_by_material.items():
        lots: list[list[float]] = []  # [remaining_qty, unit_cost], порядок вставки = FIFO при равной цене
        for tx in txs:
            if tx.type == TRANSACTION_INCOME:
                price = float(tx.price) if tx.price is not None else 0.0
                qty = float(tx.qty)
                freight_per_unit = float(tx.freight_cost) / qty if tx.freight_cost and qty > 0 else 0.0
                lots.append([qty, price + freight_per_unit])
            else:  # расход — съедаем дешёвые лоты первыми
                to_consume = float(tx.qty)
                for lot in sorted((l for l in lots if l[0] > 0), key=lambda l: l[1]):
                    if to_consume <= 0:
                        break
                    draw = min(lot[0], to_consume)
                    lot[0] -= draw
                    to_consume -= draw

        active = [l for l in lots if l[0] > 1e-9]
        if active:
            result[material_id] = min(active, key=lambda l: l[1])[1]
    return result


def compute_product_costs(
    db: Session, company_id: str, product: Product, lot_unit_costs: dict[str, float]
) -> tuple[float | None, float | None]:
    """(себестоимость партии, себестоимость единицы) — None/None, если продукт не
    привязан к рецепту, у рецепта нет состава, или хотя бы по одному материалу
    рецепта нет ни лота, ни ручной "себестоимости 1 шт" на карточке компонента
    (осознанно не показываем частично посчитанную цифру, которая ввела бы в заблуждение)."""
    if not product.recipe_id or not product.recipe:
        return None, None

    items = db.scalars(select(RecipeItem).where(RecipeItem.recipe_id == product.recipe_id)).all()
    if not items:
        return None, None

    total = 0.0
    for item in items:
        unit_cost = lot_unit_costs.get(item.material_id)
        if unit_cost is None and item.material.unit_cost is not None:
            unit_cost = float(item.material.unit_cost)
        if unit_cost is None:
            return None, None
        total += unit_cost * float(item.qty_per_batch)

    batch_yield = float(product.recipe.batch_yield) if product.recipe.batch_yield else None
    per_unit = total / batch_yield if batch_yield else None
    return total, per_unit
