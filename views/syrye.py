"""Раздел «Сырьё»: остатки, приход/расход, месячная инвентаризация."""

import streamlit as st

from core import inventory
from core.auth import require_login
from core.config import (
    MANAGEMENT_ROLES,
    MATERIAL_CATEGORIES,
    TRANSACTION_ADJUSTMENT,
    TRANSACTION_EXPENSE,
    TRANSACTION_INCOME,
)


def _material_options(materials) -> dict[str, str]:
    if materials.empty:
        return {}
    return dict(zip(materials["название"], materials["id"].astype(str)))


def page() -> None:
    user = require_login()
    st.title("🧴 Сырьё")

    materials = inventory.read_materials()
    transactions = inventory.read_transactions()
    balances = inventory.with_balances(materials, transactions)

    if balances.empty:
        st.info("Сырья пока нет в справочнике. Добавь первое ниже.")
    else:
        show = balances[["название", "категория", "ед.измерения", "остаток", "мин.остаток"]].copy()
        show.insert(0, "⚠️", balances["ниже минимума"].map({True: "⚠️", False: ""}))
        st.dataframe(show, hide_index=True, use_container_width=True)

    options = _material_options(materials)
    tab_income, tab_expense, tab_count = st.tabs(["➕ Приход", "➖ Расход", "📋 Инвентаризация"])

    with tab_income:
        if not options:
            st.warning("Сначала добавь сырьё в справочник (ниже).")
        else:
            with st.form("income_form", clear_on_submit=True):
                name = st.selectbox("Сырьё", list(options), key="income_material")
                qty = st.number_input("Количество", min_value=0.0, step=0.1)
                price = st.number_input("Цена (опционально)", min_value=0.0, step=0.1)
                comment = st.text_input("Комментарий", key="income_comment")
                if st.form_submit_button("Записать приход") and qty > 0:
                    inventory.add_transaction(
                        options[name], TRANSACTION_INCOME, qty, price=price or "", comment=comment
                    )
                    st.success("Приход записан.")
                    st.rerun()

    with tab_expense:
        if not options:
            st.warning("Сначала добавь сырьё в справочник (ниже).")
        else:
            with st.form("expense_form", clear_on_submit=True):
                name = st.selectbox("Сырьё", list(options), key="expense_material")
                qty = st.number_input("Количество", min_value=0.0, step=0.1, key="expense_qty")
                comment = st.text_input("Комментарий (например, порча/списание)", key="expense_comment")
                if st.form_submit_button("Записать расход") and qty > 0:
                    inventory.add_transaction(options[name], TRANSACTION_EXPENSE, qty, comment=comment)
                    st.success("Расход записан.")
                    st.rerun()

    with tab_count:
        if not options:
            st.warning("Сначала добавь сырьё в справочник (ниже).")
        else:
            name = st.selectbox("Сырьё", list(options), key="count_material")
            material_id = options[name]
            current = 0.0
            if not balances.empty:
                row = balances.loc[balances["id"] == material_id, "остаток"]
                current = float(row.iloc[0]) if not row.empty else 0.0
            st.write(f"Сейчас по учёту: **{current:g}**")
            with st.form("count_form", clear_on_submit=True):
                actual = st.number_input("Сколько по факту пересчёта", min_value=0.0, step=0.1)
                comment = st.text_input("Комментарий", key="count_comment")
                if st.form_submit_button("Записать инвентаризацию"):
                    delta = actual - current
                    if delta == 0:
                        st.info("Остаток совпадает, ничего не меняю.")
                    else:
                        inventory.add_transaction(
                            material_id, TRANSACTION_ADJUSTMENT, delta, comment=comment or "инвентаризация"
                        )
                        st.success(f"Корректировка {delta:+g} записана.")
                        st.rerun()

    if user["role"] in MANAGEMENT_ROLES:
        with st.expander("➕ Добавить новое сырьё в справочник"):
            with st.form("new_material_form", clear_on_submit=True):
                name = st.text_input("Название")
                category = st.selectbox("Категория", MATERIAL_CATEGORIES)
                unit = st.text_input("Единица измерения (кг, л, шт...)")
                min_stock = st.number_input("Минимальный остаток", min_value=0.0, step=0.1)
                if st.form_submit_button("Добавить") and name and unit:
                    inventory.add_material(name, category, unit, min_stock)
                    st.success("Сырьё добавлено.")
                    st.rerun()
