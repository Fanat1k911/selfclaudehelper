"""Производство: списание сырья по рецепту на смену + журнал для КПД сотрудников."""

import uuid
from datetime import date

import pandas as pd

from core.config import PRODUCTION_LOG_HEADERS, SHEET_PRODUCTION_LOG, TRANSACTION_EXPENSE
from core.inventory import add_transactions, build_transaction_row
from core.recipes import read_recipe_items
from core.sheets import append_row, read_sheet


def read_production_log() -> pd.DataFrame:
    return read_sheet(SHEET_PRODUCTION_LOG, headers=PRODUCTION_LOG_HEADERS)


def produce_batch(
    recipe_id: str,
    recipe_name: str,
    worker_id: str,
    worker_name: str,
    batches: float,
    started_at: str,
    finished_at: str,
    *,
    defects: float = 0,
    comment: str = "",
) -> str:
    """Списывает сырьё по составу рецепта на batches партий и пишет запись в ProductionLog.
    Списание — одним батчем (см. core.sheets.append_rows), а не по материалу за раз: рецепт
    может содержать десяток позиций сырья+тары, и цикл из N отдельных append_row быстро
    выбивает квоту Google Sheets API при активном производстве."""
    items = read_recipe_items()
    recipe_items = items[items["recipe_id"].astype(str) == str(recipe_id)]

    rows = []
    for _, item in recipe_items.iterrows():
        qty = pd.to_numeric(item["кол-во на 1 партию"], errors="coerce")
        qty = 0.0 if pd.isna(qty) else float(qty)
        rows.append(
            build_transaction_row(
                item["material_id"],
                TRANSACTION_EXPENSE,
                qty * batches,
                recipe_id=recipe_id,
                comment=f"списание по производству: {recipe_name}",
            )
        )
    if rows:
        add_transactions(rows)

    log_id = uuid.uuid4().hex[:8]
    row = [
        log_id,
        date.today().isoformat(),
        worker_id,
        worker_name,
        recipe_id,
        recipe_name,
        batches,
        started_at,
        finished_at,
        defects,
        comment,
    ]
    append_row(SHEET_PRODUCTION_LOG, row, headers=PRODUCTION_LOG_HEADERS)
    return log_id
