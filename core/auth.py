"""Логин на bcrypt + st.session_state. Никакого plaintext-пароля нигде."""

import bcrypt
import streamlit as st

from core.config import SHEET_USERS, USER_STATUS_ACTIVE
from core.sheets import read_sheet

SESSION_KEY = "user"


def _find_user(login: str):
    users = read_sheet(SHEET_USERS, access=True)
    if users.empty:
        return None
    match = users[users["логин"] == login]
    if match.empty:
        return None
    return match.iloc[0]


def try_login(login: str, password: str) -> bool:
    """Проверяет логин/пароль, при успехе кладёт пользователя в session_state."""
    user = _find_user(login)
    if user is None:
        return False
    if user["статус"] != USER_STATUS_ACTIVE:
        return False

    stored_hash = str(user["хэш пароля"]).encode("utf-8")
    if not bcrypt.checkpw(password.encode("utf-8"), stored_hash):
        return False

    st.session_state[SESSION_KEY] = {
        "id": user["id"],
        "fio": user["ФИО"],
        "login": user["логин"],
        "role": user["роль"],
    }
    return True


def logout() -> None:
    st.session_state.pop(SESSION_KEY, None)


def current_user() -> dict | None:
    return st.session_state.get(SESSION_KEY)


def require_login() -> dict:
    """Останавливает страницу, если пользователь не залогинен. Вызывать первой строкой на каждой странице."""
    user = current_user()
    if user is None:
        st.warning("Нужно войти в систему.")
        st.stop()
    return user


def require_role(*allowed_roles: str) -> dict:
    """Проверка роли программно — не полагаться только на скрытие пункта меню (см. CLAUDE.md)."""
    user = require_login()
    if user["role"] not in allowed_roles:
        st.error("Нет доступа к этому разделу.")
        st.stop()
    return user
