"""Секреты и настройки backend. Источник по умолчанию — тот же .streamlit/secrets.toml,
что использует Streamlit-приложение (не плодим второе хранилище ключей на локалке).
На проде (Railway/Render) переопределяется через env — см. .env.example."""

import os
import sys
import tomllib
import uuid
from functools import lru_cache
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
SECRETS_PATH = PROJECT_ROOT / ".streamlit" / "secrets.toml"

_JWT_SECRET_ENV = os.environ.get("JWT_SECRET")
if _JWT_SECRET_ENV is None and os.environ.get("RENDER"):
    # На Render JWT_SECRET обязателен — Render сам прописывает RENDER=true в env каждого
    # сервиса, так что это надёжный признак "не локалка". Без этой проверки отсутствие
    # переменной (снятая/забытая при редеплое) молча откатывалось бы на публично известную
    # строку — любой мог бы подделать токен с любой ролью/company_id (найдено на
    # code-review 2026-07-21, см. CLAUDE.md "Архитектурные принципы" п.4).
    print("JWT_SECRET не задан в env — обязателен на Render.", file=sys.stderr)
    raise SystemExit(1)
JWT_SECRET = _JWT_SECRET_ENV or "dev-insecure-secret-change-me"
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_MINUTES = int(os.environ.get("JWT_EXPIRE_MINUTES", str(24 * 60)))

# "Обновление доступно" баннер на фронте (2026-07-18, см. CLAUDE.md) — фронт поллит
# /api/version и сравнивает со значением при загрузке страницы. RENDER_GIT_COMMIT —
# переменная, которую Render сам прописывает в env при деплое (не нужно ничего
# добавлять в Dockerfile). Локально/на других хостингах её нет — берём случайный
# токен на старт процесса, тогда каждый локальный рестарт тоже считается "новой
# версией", это ожидаемо и не мешает (dev-режим, не прод).
APP_VERSION = os.environ.get("RENDER_GIT_COMMIT", uuid.uuid4().hex[:12])

CORS_ORIGINS = os.environ.get("CORS_ORIGINS", "http://localhost:5173,http://localhost:3000").split(",")

# Автоподстановка реквизитов контрагента по ИНН (2026-07-19) — suggestions.dadata.ru,
# бесплатный тариф. Пусто по умолчанию — /api/counterparties/lookup отдаёт 501, не 500,
# фронт показывает "поиск не настроен" и оставляет поля обычным ручным вводом.
DADATA_API_KEY = os.environ.get("DADATA_API_KEY", "")


def _normalize_db_url(url: str) -> str:
    """Render/Neon отдают DATABASE_URL как postgres:// или postgresql:// (без драйвера) —
    SQLAlchemy 2.0 с одним psycopg (v3, не psycopg2) в зависимостях требует явный +psycopg."""
    if url.startswith("postgres://"):
        url = "postgresql://" + url[len("postgres://"):]
    if url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+psycopg://", 1)
    return url


DATABASE_URL = _normalize_db_url(os.environ.get("DATABASE_URL", "postgresql+psycopg://localhost:5432/oinarri"))


@lru_cache
def _secrets() -> dict:
    if SECRETS_PATH.exists():
        with SECRETS_PATH.open("rb") as f:
            return tomllib.load(f)
    if "GCP_SERVICE_ACCOUNT_JSON" in os.environ:
        import json

        return {
            "gcp_service_account": json.loads(os.environ["GCP_SERVICE_ACCOUNT_JSON"]),
            "sheets": {
                "data_spreadsheet_id": os.environ["DATA_SPREADSHEET_ID"],
                "access_spreadsheet_id": os.environ["ACCESS_SPREADSHEET_ID"],
            },
        }
    print(f"Секреты не найдены: нет {SECRETS_PATH} и нет GCP_SERVICE_ACCOUNT_JSON в env.", file=sys.stderr)
    raise SystemExit(1)


def gcp_service_account() -> dict:
    return dict(_secrets()["gcp_service_account"])


def spreadsheet_id(key: str) -> str:
    return _secrets()["sheets"][key]
