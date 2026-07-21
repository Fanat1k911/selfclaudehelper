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
        # [remaining_qty, unit_cost] — unit_cost is None когда у прихода нет цены (не 0.0:
        # "не знаем цену" ≠ "бесплатно", иначе съедает ручную "себестоимость 1 шт" ниже и
        # красит остаток нулевой ценой). Порядок вставки = FIFO при равной цене.
        lots: list[list] = []
        for tx in txs:
            if tx.type == TRANSACTION_INCOME:
                qty = float(tx.qty)
                if tx.price is None:
                    unit_cost = None
                else:
                    freight_per_unit = float(tx.freight_cost) / qty if tx.freight_cost and qty > 0 else 0.0
                    unit_cost = float(tx.price) + freight_per_unit
                lots.append([qty, unit_cost])
            else:  # расход — съедаем дешёвые ЦЕНОВАННЫЕ лоты первыми, безценовые — в последнюю очередь
                to_consume = float(tx.qty)
                ordered = sorted(
                    (l for l in lots if l[0] > 0), key=lambda l: (l[1] is None, l[1] if l[1] is not None else 0.0)
                )
                for lot in ordered:
                    if to_consume <= 0:
                        break
                    draw = min(lot[0], to_consume)
                    lot[0] -= draw
                    to_consume -= draw

        priced_active = [l for l in lots if l[0] > 1e-9 and l[1] is not None]
        if priced_active:
            result[material_id] = min(priced_active, key=lambda l: l[1])[1]
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

    # Себестоимость учитывает потери сырья при производстве (2026-07-21) — то же loss_percent,
    # что применяется к фактическому списанию в production.py, иначе цифра тут занижена
    # относительно того, что реально уходит со склада на партию.
    loss_factor = 1 + float(product.recipe.loss_percent) / 100
    total = 0.0
    for item in items:
        unit_cost = lot_unit_costs.get(item.material_id)
        if unit_cost is None and item.material.unit_cost is not None:
            unit_cost = float(item.material.unit_cost)
        if unit_cost is None:
            return None, None
        total += unit_cost * float(item.qty_per_batch) * loss_factor

    batch_yield = float(product.recipe.batch_yield) if product.recipe.batch_yield else None
    per_unit = total / batch_yield if batch_yield else None
    return round(total, 2), round(per_unit, 2) if per_unit is not None else None
