import streamlit as st

from core.auth import current_user, logout, try_login
from views.syrye import page as syrye_page

st.set_page_config(page_title="Мыловарня: Учёт", page_icon="🧼", initial_sidebar_state="collapsed")

# Кнопки открыть/закрыть боковое меню — на всех страницах, не только на логине.
st.markdown(
    """
    <style>
    [data-testid="stExpandSidebarButton"], [data-testid="stSidebarCollapseButton"] {
        background: #C97B63;
        border-radius: 10px;
        box-shadow: 0 2px 8px rgba(74, 59, 51, 0.18);
        transition: transform 0.15s ease;
    }
    [data-testid="stExpandSidebarButton"] svg, [data-testid="stSidebarCollapseButton"] svg {
        color: #FFFFFF;
        fill: #FFFFFF;
    }
    [data-testid="stExpandSidebarButton"]:hover, [data-testid="stSidebarCollapseButton"]:hover {
        transform: scale(1.08);
    }
    </style>
    """,
    unsafe_allow_html=True,
)


def login_form() -> None:
    # До входа никакого меню/сайдбара быть не должно — только форма логина (см. CLAUDE.md:
    # ни один пункт интерфейса не должен намекать на структуру приложения раньше времени).
    st.markdown(
        """
        <style>
        [data-testid="stSidebar"], [data-testid="stExpandSidebarButton"] { display: none; }
        .block-container { max-width: 680px; padding-top: 8vh; }
        [data-testid="stForm"] {
            background: #FFFFFF;
            border-radius: 24px;
            padding: 3.5rem 3.5rem 2rem 3.5rem;
            box-shadow: 0 8px 24px rgba(74, 59, 51, 0.08);
        }
        [data-testid="stForm"] input {
            font-size: 1.5rem;
            padding: 0.9rem 1.1rem;
        }
        [data-testid="stForm"] label p {
            font-size: 1.15rem;
            font-style: italic;
        }
        [data-testid="InputInstructions"] { display: none; }
        </style>
        """,
        unsafe_allow_html=True,
    )
    st.markdown("<h1 style='text-align:center; font-size:4.5rem;'>🧼</h1>", unsafe_allow_html=True)
    st.markdown(
        "<h1 style='text-align:center; margin-top:-0.5rem; font-style:italic;'>Мыловарня</h1>",
        unsafe_allow_html=True,
    )

    with st.form("login_form"):
        login = st.text_input("Логин")
        password = st.text_input("Пароль", type="password")
        submitted = st.form_submit_button("Войти", type="primary", width="stretch")

    if submitted:
        if try_login(login, password):
            st.rerun()
        else:
            st.error("Неверный логин или пароль.")


def home_page() -> None:
    user = current_user()
    st.title("🧼 Мыловарня")
    st.caption(f"{user['fio']} · роль: {user['role']}")
    st.info("Разделы (Производство, Продажи и т.д.) появятся в меню слева по мере готовности.")

    if st.button("Выйти", type="secondary"):
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
