"""Секреты и настройки backend. Источник по умолчанию — тот же .streamlit/secrets.toml,
что использует Streamlit-приложение (не плодим второе хранилище ключей на локалке).
На проде (Railway/Render) переопределяется через env — см. .env.example."""

import os
import sys
import tomllib
from functools import lru_cache
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
SECRETS_PATH = PROJECT_ROOT / ".streamlit" / "secrets.toml"

JWT_SECRET = os.environ.get("JWT_SECRET", "dev-insecure-secret-change-me")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_MINUTES = int(os.environ.get("JWT_EXPIRE_MINUTES", str(24 * 60)))

CORS_ORIGINS = os.environ.get("CORS_ORIGINS", "http://localhost:5173,http://localhost:3000").split(",")

DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql+psycopg://localhost:5432/oinarri")


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
