"""Раздел «Производство»: смены, списание сырья по рецепту, КПД сотрудников."""

import streamlit as st

from core import production, recipes
from core.auth import require_login
from core.config import MANAGEMENT_ROLES

_LOG_DISPLAY_COLUMNS = [
    "дата",
    "ФИО сотрудника",
    "название рецепта",
    "кол-во партий",
    "время начала",
    "время окончания",
    "брак",
    "комментарий",
]


def _recipe_options(recipes_df) -> dict[str, str]:
    if recipes_df.empty:
        return {}
    return dict(zip(recipes_df["название"], recipes_df["id"].astype(str)))


def page() -> None:
    user = require_login()
    st.title("🏭 Производство")
    st.caption("Смены производства: списание сырья по рецепту и учёт КПД.")

    recipes_df = recipes.read_recipes()
    recipe_items_df = recipes.read_recipe_items()
    options = _recipe_options(recipes_df)

    if not options:
        st.warning("Рецептов пока нет — сначала добавь их в разделе управления рецептами.")
    else:
        with st.container(border=True):
            st.caption("Запись смены — сырьё спишется по составу рецепта автоматически.")
            with st.form("production_form", clear_on_submit=True):
                name = st.selectbox("Рецепт", list(options))
                batches = st.number_input("Количество партий", min_value=0.0, step=1.0, value=1.0)
                col_start, col_end = st.columns(2)
                started_at = col_start.time_input("Начало")
                finished_at = col_end.time_input("Окончание")
                defects = st.number_input("Брак (кол-во)", min_value=0.0, step=1.0)
                comment = st.text_input("Комментарий")
                submitted = st.form_submit_button("Записать смену", type="primary", width="stretch")

                if submitted and batches > 0:
                    recipe_id = options[name]
                    has_items = (recipe_items_df["recipe_id"].astype(str) == recipe_id).any()
                    if not has_items:
                        st.error(
                            "У этого рецепта не заполнен состав (RecipeItems) — списывать нечего. "
                            "Обратись к founder или разработчику."
                        )
                    else:
                        production.produce_batch(
                            recipe_id,
                            name,
                            user["id"],
                            user["fio"],
                            batches,
                            started_at.strftime("%H:%M"),
                            finished_at.strftime("%H:%M"),
                            defects=defects,
                            comment=comment,
                        )
                        st.success("Смена записана, сырьё списано.")
                        st.rerun()

    st.divider()
    st.subheader("КПД")

    log = production.read_production_log()
    if log.empty:
        st.info("Пока нет записей о производстве.")
        return

    if user["role"] in MANAGEMENT_ROLES:
        show = log
        st.caption("Все сотрудники.")
    else:
        # Worker не видит чужой КПД (см. таблицу прав в CLAUDE.md) — фильтр программный,
        # не полагаемся на то, что лист сам по себе скрыт.
        show = log[log["worker_id"].astype(str) == str(user["id"])]
        st.caption("Только твои смены.")

    if show.empty:
        st.info("Записей пока нет.")
        return

    display = show[_LOG_DISPLAY_COLUMNS].sort_values("дата", ascending=False)
    st.dataframe(display, hide_index=True, width="stretch")
