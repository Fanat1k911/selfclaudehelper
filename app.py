import streamlit as st

from core.auth import current_user, logout, try_login

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


def main_page(user: dict) -> None:
    st.title("🧼 Мыловарня")
    st.write(f"Привет, **{user['fio']}**! Роль: `{user['role']}`.")
    st.info("Разделы (Сырьё, Производство, Продажи и т.д.) появятся в левом меню по мере готовности.")

    if st.button("Выйти"):
        logout()
        st.rerun()


user = current_user()
if user is None:
    login_form()
else:
    main_page(user)
