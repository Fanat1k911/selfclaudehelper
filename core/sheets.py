"""Подключение к Google Sheets через service account (gspread)."""

import gspread
import pandas as pd
import streamlit as st

from core.config import ACCESS_SPREADSHEET_KEY, DATA_SPREADSHEET_KEY

SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive",
]


@st.cache_resource(show_spinner=False)
def _client() -> gspread.Client:
    return gspread.service_account_from_dict(
        dict(st.secrets["gcp_service_account"]), scopes=SCOPES
    )


@st.cache_resource(show_spinner=False)
def _data_spreadsheet() -> gspread.Spreadsheet:
    return _client().open_by_key(st.secrets["sheets"][DATA_SPREADSHEET_KEY])


@st.cache_resource(show_spinner=False)
def _access_spreadsheet() -> gspread.Spreadsheet:
    return _client().open_by_key(st.secrets["sheets"][ACCESS_SPREADSHEET_KEY])


def get_worksheet(sheet_name: str, *, access: bool = False) -> gspread.Worksheet:
    """access=True — лист из закрытого файла "Доступы", иначе из "Учёт"."""
    spreadsheet = _access_spreadsheet() if access else _data_spreadsheet()
    return spreadsheet.worksheet(sheet_name)


@st.cache_data(ttl=300, show_spinner=False)
def read_sheet(sheet_name: str, *, access: bool = False) -> pd.DataFrame:
    """Лист целиком как DataFrame. Кэш 5 мин — сбрасывать вручную через clear_sheet_cache."""
    records = get_worksheet(sheet_name, access=access).get_all_records()
    return pd.DataFrame(records)


def append_row(sheet_name: str, row: list, *, access: bool = False) -> None:
    get_worksheet(sheet_name, access=access).append_row(row, value_input_option="USER_ENTERED")
    read_sheet.clear()


def clear_sheet_cache() -> None:
    """Вызывать после ручных изменений строк (не только append) — например при увольнении сотрудника."""
    read_sheet.clear()
