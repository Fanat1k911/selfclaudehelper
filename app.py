import streamlit as st

from core.auth import current_user, logout, try_login
from views.syrye import page as syrye_page

st.set_page_config(page_title="Мыловарня: Учёт", page_icon="🧼")


def login_form() -> None:
    st.title("🧼 Мыловарня — вход")
    with st.form("login_form"):
        login = st.text_input("Логин")
        password = st.text_input("Пароль", type="password")
        submitted = st.form_submit_button("Войти")

    if submitted:
        if try_login(login, password):
            st.rerun()
        else:
            st.error("Неверный логин или пароль.")


def home_page() -> None:
    user = current_user()
    st.title("🧼 Мыловарня")
    st.write(f"Привет, **{user['fio']}**! Роль: `{user['role']}`.")
    st.info("Разделы (Сырьё, Производство, Продажи и т.д.) появятся в меню слева по мере готовности.")

    if st.button("Выйти"):
        logout()
        st.rerun()


def build_pages(role: str) -> list[st.Page]:
    """Список страниц зависит от роли — недоступные разделы физически не попадают в навигацию,
    их нельзя открыть даже прямой ссылкой (см. CLAUDE.md: проверка роли не через скрытие меню)."""
    pages = [st.Page(home_page, title="Главная", icon="🏠", default=True)]
    # Сырьё доступно всем ролям (см. таблицу прав в CLAUDE.md — "Внести производство/остатки").
    pages.append(st.Page(syrye_page, title="Сырьё", icon="🧴"))
    return pages


user = current_user()
if user is None:
    login_form()
else:
    st.navigation(build_pages(user["role"])).run()
