import streamlit as st

from core.auth import current_user, logout, try_login
from views.syrye import page as syrye_page

st.set_page_config(page_title="Мыловарня: Учёт", page_icon="🧼", initial_sidebar_state="collapsed")


def login_form() -> None:
    # До входа никакого меню/сайдбара быть не должно — только форма логина (см. CLAUDE.md:
    # ни один пункт интерфейса не должен намекать на структуру приложения раньше времени).
    st.markdown(
        """
        <style>
        [data-testid="stSidebar"], [data-testid="collapsedControl"] { display: none; }
        .block-container { max-width: 420px; padding-top: 12vh; }
        [data-testid="stForm"] {
            background: #FFFFFF;
            border-radius: 16px;
            padding: 2rem 2rem 1rem 2rem;
            box-shadow: 0 8px 24px rgba(74, 59, 51, 0.08);
        }
        </style>
        """,
        unsafe_allow_html=True,
    )
    st.markdown("<h1 style='text-align:center'>🧼</h1>", unsafe_allow_html=True)
    st.markdown("<h3 style='text-align:center; margin-top:-0.5rem;'>Мыловарня</h3>", unsafe_allow_html=True)

    with st.form("login_form"):
        login = st.text_input("Логин")
        password = st.text_input("Пароль", type="password")
        submitted = st.form_submit_button("Войти", use_container_width=True)

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
