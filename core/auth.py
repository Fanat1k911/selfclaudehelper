"""Логин на bcrypt + st.session_state. Никакого plaintext-пароля нигде."""

import time

import bcrypt
import streamlit as st

from core.config import SHEET_USERS, USER_STATUS_ACTIVE
from core.sheets import read_sheet

SESSION_KEY = "user"
ATTEMPTS_KEY = "_login_attempts"

REQUIRED_USER_COLUMNS = ("id", "ФИО", "логин", "хэш пароля", "роль", "статус")

# После скольки неудачных попыток подряд начинаем притормаживать перебор паролей.
_ATTEMPTS_BEFORE_DELAY = 3
_MAX_DELAY_SECONDS = 8


def _find_user(login: str):
    users = read_sheet(SHEET_USERS, access=True)
    if users.empty:
        return None

    missing = [c for c in REQUIRED_USER_COLUMNS if c not in users.columns]
    if missing:
        st.error(f"В листе Users не хватает колонок: {', '.join(missing)}. Проверь шапку таблицы.")
        st.stop()

    login_norm = login.strip().casefold()
    login_col = users["логин"].astype(str).str.strip().str.casefold()
    match = users[login_col == login_norm]
    if match.empty:
        return None
    return match.iloc[0]


def _throttle_if_needed() -> None:
    """Растущая задержка после нескольких неудачных попыток — тормозит перебор пароля."""
    attempts = st.session_state.get(ATTEMPTS_KEY, 0)
    if attempts >= _ATTEMPTS_BEFORE_DELAY:
        time.sleep(min(attempts, _MAX_DELAY_SECONDS))


def try_login(login: str, password: str) -> bool:
    """Проверяет логин/пароль, при успехе кладёт пользователя в session_state."""
    _throttle_if_needed()

    user = _find_user(login)
    ok = user is not None and str(user["статус"]).strip() == USER_STATUS_ACTIVE
    if ok:
        stored_hash = str(user["хэш пароля"]).strip().encode("utf-8")
        try:
            ok = bcrypt.checkpw(password.encode("utf-8"), stored_hash)
        except ValueError:
            ok = False

    if not ok:
        st.session_state[ATTEMPTS_KEY] = st.session_state.get(ATTEMPTS_KEY, 0) + 1
        return False

    st.session_state.pop(ATTEMPTS_KEY, None)
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
    """Отдаёт залогиненного пользователя, но каждый раз перепроверяет статус по листу Users —
    уволенный/заблокированный сотрудник теряет доступ, как только сбросится кэш read_sheet."""
    session_user = st.session_state.get(SESSION_KEY)
    if session_user is None:
        return None

    fresh = _find_user(session_user["login"])
    if fresh is None or str(fresh["статус"]).strip() != USER_STATUS_ACTIVE:
        st.session_state.pop(SESSION_KEY, None)
        return None
    return session_user


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
