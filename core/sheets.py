"""Подключение к Google Sheets через service account (gspread)."""

import re
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

# ISO-дата (2026-07-12) и время (09:00) — с value_input_option="USER_ENTERED" Google Sheets
# сам распознаёт такие строки как дату/время и хранит числом (серийная дата / доля суток),
# а не текстом. При чтении обратно приходит число вместо исходной строки. Экранируем тем же
# способом, что и formula injection — ведущий апостроф форсирует текстовый тип ячейки.
_DATE_OR_TIME_PATTERN = re.compile(r"^\d{4}-\d{2}-\d{2}$|^\d{1,2}:\d{2}$")


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
    собственный numericise() ломает такие строки (например "-0,5" превращается в -5).

    numericise_ignore=["all"] обязателен по той же причине, но для строк, а не чисел:
    gspread сам, на клиенте, пытается float()/int() каждую ячейку — id вида "1e640937"
    (обычный uuid4().hex[:8]) выглядит как научная нотация числа и превращается в
    гигантский float, id вида "12345678" — в int с потерей ведущих нулей. Все id-шники
    в проекте — строки, никогда не должны проходить через это автоопределение; конкретные
    числовые колонки (кол-во, цена и т.д.) каждый вызывающий код сам приводит через
    pd.to_numeric — так безопаснее, чем доверять угадыванию типа."""
    worksheet = get_worksheet(sheet_name, access=access, headers=headers)
    records = _with_retry(
        worksheet.get_all_records,
        value_render_option=gspread.utils.ValueRenderOption.unformatted,
        numericise_ignore=["all"],
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
    """Гасит formula injection (=+-@ в начале ячейки) и авто-распознавание дат/времени —
    в обоих случаях Sheets меняет тип ячейки сама, апостроф форсирует текст."""
    if isinstance(value, str) and (value[:1] in _FORMULA_TRIGGER_CHARS or _DATE_OR_TIME_PATTERN.match(value)):
        return "'" + value
    return value


def append_row(sheet_name: str, row: list, *, access: bool = False, headers: tuple[str, ...] | None = None) -> None:
    safe_row = [_sanitize_for_sheets(v) for v in row]
    worksheet = get_worksheet(sheet_name, access=access, headers=headers)
    _with_retry(worksheet.append_row, safe_row, value_input_option="USER_ENTERED")
    # Полный сброс, а не read_sheet.clear(sheet_name, access=access, headers=headers):
    # Streamlit хэширует кэш-ключ по буквально переданным аргументам, а не по нормализованной
    # сигнатуре — явный access=False здесь не совпадает по ключу с вызовами read_sheet(...),
    # которые полагаются на дефолт access=False неявно. Из-за этого точечный clear() чистил
    # несуществующую запись, а реальный кэш жил до истечения TTL (5 мин).
    read_sheet.clear()


def append_rows(sheet_name: str, rows: list[list], *, access: bool = False, headers: tuple[str, ...] | None = None) -> None:
    """Пакетная запись — один сетевой вызов вместо N append_row подряд. Использовать, когда
    пишешь несколько связанных строк за раз (например списание сырья по рецепту сразу по
    нескольким материалам): экономит квоту API так же, как кэш get_worksheet (см. его докстрing)."""
    if not rows:
        return
    safe_rows = [[_sanitize_for_sheets(v) for v in row] for row in rows]
    worksheet = get_worksheet(sheet_name, access=access, headers=headers)
    _with_retry(worksheet.append_rows, safe_rows, value_input_option="USER_ENTERED")
    read_sheet.clear()


def clear_sheet_cache(sheet_name: str | None = None, *, access: bool = False) -> None:
    """Вызывать после ручных изменений строк (не только append) — например при увольнении сотрудника.

    sheet_name/access принимаются для читаемости на месте вызова, но всегда чистят кэш
    целиком: точечный read_sheet.clear(sheet_name, ...) не работает надёжно — см. комментарий
    в append_row про несовпадение кэш-ключей у Streamlit при неявных дефолтных аргументах."""
    read_sheet.clear()
