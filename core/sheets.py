"""Подключение к Google Sheets через service account (gspread)."""

import time

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


@st.cache_resource(show_spinner=False)
def get_worksheet(sheet_name: str, *, access: bool = False, headers: tuple[str, ...] | None = None) -> gspread.Worksheet:
    """access=True — лист из закрытого файла "Доступы", иначе из "Учёт".
    headers — если лист не существует, создать его самим с этой шапкой (для рабочих
    каталогов вроде Materials/Transactions). Без headers отсутствие листа — ошибка:
    так и должно быть для Users — этот файл ведётся вручную осознанно.

    Закэшировано через cache_resource: .worksheet(name) сам по себе — сетевой запрос
    (fetch_sheet_metadata), без кэша он бьёт по гугловской квоте на чтение при частых
    вызовах (append_row дёргает get_worksheet на каждую строку)."""
    key = ACCESS_SPREADSHEET_KEY if access else DATA_SPREADSHEET_KEY
    spreadsheet = _spreadsheet(key)
    try:
        return spreadsheet.worksheet(sheet_name)
    except gspread.exceptions.WorksheetNotFound:
        if headers is None:
            st.error(f"В таблице нет листа «{sheet_name}». Создай его вручную в Google Sheets.")
            st.stop()
        ws = spreadsheet.add_worksheet(title=sheet_name, rows=1000, cols=max(len(headers), 10))
        ws.append_row(list(headers), value_input_option="RAW")
        return ws


@st.cache_data(ttl=300, show_spinner=False)
def read_sheet(sheet_name: str, *, access: bool = False, headers: tuple[str, ...] | None = None) -> pd.DataFrame:
    """Лист целиком как DataFrame. Кэш 5 мин — сбрасывать вручную через clear_sheet_cache.

    value_render_option=UNFORMATTED_VALUE обязателен: без него gspread читает число таким,
    каким оно отображается (по локали таблицы — с запятой вместо точки, "0,5"), и его
    собственный numericise() ломает такие строки (например "-0,5" превращается в -5)."""
    worksheet = get_worksheet(sheet_name, access=access, headers=headers)
    records = _with_retry(
        worksheet.get_all_records, value_render_option=gspread.utils.ValueRenderOption.unformatted
    )
    return pd.DataFrame(records)


def _is_quota_error(exc: gspread.exceptions.APIError) -> bool:
    response = getattr(exc, "response", None)
    return response is not None and response.status_code == 429


def _with_retry(func, *args, max_attempts: int = 5, **kwargs):
    """Google Sheets API квоты (запросы/минуту) легко выбить массовой записью — гасим
    ретраем с растущей паузой вместо падения посреди операции."""
    for attempt in range(max_attempts):
        try:
            return func(*args, **kwargs)
        except gspread.exceptions.APIError as exc:
            if not _is_quota_error(exc) or attempt == max_attempts - 1:
                raise
            time.sleep(2**attempt)


def _sanitize_for_sheets(value):
    """Гасит formula injection: ячейка, начинающаяся с =+-@, не должна выполняться как формула."""
    if isinstance(value, str) and value[:1] in _FORMULA_TRIGGER_CHARS:
        return "'" + value
    return value


def append_row(sheet_name: str, row: list, *, access: bool = False, headers: tuple[str, ...] | None = None) -> None:
    safe_row = [_sanitize_for_sheets(v) for v in row]
    worksheet = get_worksheet(sheet_name, access=access, headers=headers)
    _with_retry(worksheet.append_row, safe_row, value_input_option="USER_ENTERED")
    read_sheet.clear(sheet_name, access=access, headers=headers)


def clear_sheet_cache(sheet_name: str | None = None, *, access: bool = False) -> None:
    """Вызывать после ручных изменений строк (не только append) — например при увольнении сотрудника.
    Без sheet_name сбрасывает кэш всех листов."""
    if sheet_name is None:
        read_sheet.clear()
    else:
        read_sheet.clear(sheet_name, access=access)
