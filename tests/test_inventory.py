import pandas as pd

from core.config import MATERIALS_HEADERS, TRANSACTIONS_HEADERS, TRANSACTION_EXPENSE, TRANSACTION_INCOME
from core.inventory import with_balances


def test_with_balances_computes_balance_from_transactions():
    materials = pd.DataFrame(
        [["m1", "Масло кокосовое", "жидкое", "кг", 5.0, ""]],
        columns=MATERIALS_HEADERS,
    )
    transactions = pd.DataFrame(
        [
            ["t1", "2026-01-01", "m1", TRANSACTION_INCOME, 10.5, "", "", ""],
            ["t2", "2026-01-02", "m1", TRANSACTION_EXPENSE, 3.25, "", "", ""],
        ],
        columns=TRANSACTIONS_HEADERS,
    )

    result = with_balances(materials, transactions)

    assert result.loc[0, "остаток"] == 7.25
    assert result.loc[0, "ниже минимума"] == False


def test_with_balances_flags_below_minimum():
    materials = pd.DataFrame(
        [["m1", "Сода каустическая", "сыпучее", "кг", 5.0, ""]],
        columns=MATERIALS_HEADERS,
    )
    transactions = pd.DataFrame(
        [["t1", "2026-01-01", "m1", TRANSACTION_EXPENSE, 2.0, "", "", ""]],
        columns=TRANSACTIONS_HEADERS,
    )

    result = with_balances(materials, transactions)

    assert result.loc[0, "остаток"] == -2.0
    assert result.loc[0, "ниже минимума"] == True


def test_with_balances_no_transactions_gives_zero_balance():
    materials = pd.DataFrame(
        [["m1", "Ароматизатор", "жидкое", "мл", 100.0, ""]],
        columns=MATERIALS_HEADERS,
    )
    transactions = pd.DataFrame(columns=TRANSACTIONS_HEADERS)

    result = with_balances(materials, transactions)

    assert result.loc[0, "остаток"] == 0.0
    assert result.loc[0, "ниже минимума"] == True
