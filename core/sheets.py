"""Подключение к Google Sheets через service account (gspread)."""

import gspread
import pandas as pd
import streamlit as st

from core.config import ACCESS_SPREADSHEET_KEY, DATA_SPREADSHEET_KEY

SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive",
]

# Символы, с которых Google Sheets начинает трактовать ячейку как формулу.
_FORMULA_TRIGGER_CHARS = ("=", "+", "-", "@")


def _secret(*path: str):
    """Достаёт вложенный ключ из st.secrets с понятной ошибкой вместо голого KeyError."""
    node = st.secrets
    try:
        for key in path:
            node = node[key]
        return node
    except KeyError:
        st.error(f"В secrets.toml не найден ключ: {'.'.join(path)}. Проверь .streamlit/secrets.toml.")
        st.stop()


@st.cache_resource(show_spinner=False)
def _client() -> gspread.Client:
    return gspread.service_account_from_dict(dict(_secret("gcp_service_account")), scopes=SCOPES)


@st.cache_resource(show_spinner=False)
def _spreadsheet(secret_key: str) -> gspread.Spreadsheet:
    return _client().open_by_key(_secret("sheets", secret_key))


def get_worksheet(sheet_name: str, *, access: bool = False) -> gspread.Worksheet:
    """access=True — лист из закрытого файла "Доступы", иначе из "Учёт"."""
    key = ACCESS_SPREADSHEET_KEY if access else DATA_SPREADSHEET_KEY
    spreadsheet = _spreadsheet(key)
    try:
        return spreadsheet.worksheet(sheet_name)
    except gspread.exceptions.WorksheetNotFound:
        st.error(f"В таблице нет листа «{sheet_name}». Создай его вручную в Google Sheets.")
        st.stop()


@st.cache_data(ttl=300, show_spinner=False)
def read_sheet(sheet_name: str, *, access: bool = False) -> pd.DataFrame:
    """Лист целиком как DataFrame. Кэш 5 мин — сбрасывать вручную через clear_sheet_cache."""
    records = get_worksheet(sheet_name, access=access).get_all_records()
    return pd.DataFrame(records)


def _sanitize_for_sheets(value):
    """Гасит formula injection: ячейка, начинающаяся с =+-@, не должна выполняться как формула."""
    if isinstance(value, str) and value[:1] in _FORMULA_TRIGGER_CHARS:
        return "'" + value
    return value


def append_row(sheet_name: str, row: list, *, access: bool = False) -> None:
    safe_row = [_sanitize_for_sheets(v) for v in row]
    get_worksheet(sheet_name, access=access).append_row(safe_row, value_input_option="USER_ENTERED")
    read_sheet.clear(sheet_name, access=access)


def clear_sheet_cache(sheet_name: str | None = None, *, access: bool = False) -> None:
    """Вызывать после ручных изменений строк (не только append) — например при увольнении сотрудника.
    Без sheet_name сбрасывает кэш всех листов."""
    if sheet_name is None:
        read_sheet.clear()
    else:
        read_sheet.clear(sheet_name, access=access)
