import pandas as pd

from core.config import RECIPE_ITEMS_HEADERS, TRANSACTION_EXPENSE
from core import production


def _recipe_items(rows):
    return pd.DataFrame(rows, columns=RECIPE_ITEMS_HEADERS)


def test_produce_batch_writes_one_expense_transaction_per_ingredient(monkeypatch):
    items = _recipe_items(
        [
            ["r1", "Мыло лавандовое", "m1", "Масло кокосовое", 2.0],
            ["r1", "Мыло лавандовое", "m2", "Щёлочь", 0.5],
        ]
    )
    monkeypatch.setattr(production, "read_recipe_items", lambda: items)

    written_batches = []
    monkeypatch.setattr(production, "add_transactions", lambda rows: written_batches.append(rows))

    logged_rows = []
    monkeypatch.setattr(production, "append_row", lambda sheet, row, headers=None: logged_rows.append(row))

    production.produce_batch("r1", "Мыло лавандовое", "w1", "Иванова И.И.", 3, "09:00", "11:30", defects=1, comment="ок")

    assert len(written_batches) == 1
    rows = written_batches[0]
    assert len(rows) == 2

    by_material = {row[2]: row for row in rows}
    assert by_material["m1"][3] == TRANSACTION_EXPENSE
    assert by_material["m1"][4] == 6.0  # 2.0 * 3 партии
    assert by_material["m1"][6] == "r1"
    assert by_material["m2"][4] == 1.5  # 0.5 * 3 партии

    assert len(logged_rows) == 1
    log_row = logged_rows[0]
    assert log_row[2] == "w1"
    assert log_row[3] == "Иванова И.И."
    assert log_row[4] == "r1"
    assert log_row[6] == 3
    assert log_row[9] == 1


def test_produce_batch_skips_batch_write_when_recipe_has_no_items(monkeypatch):
    monkeypatch.setattr(production, "read_recipe_items", lambda: _recipe_items([]))

    written_batches = []
    monkeypatch.setattr(production, "add_transactions", lambda rows: written_batches.append(rows))
    monkeypatch.setattr(production, "append_row", lambda sheet, row, headers=None: None)

    production.produce_batch("r-empty", "Пустой рецепт", "w1", "Иванова И.И.", 1, "09:00", "09:30")

    assert written_batches == []
