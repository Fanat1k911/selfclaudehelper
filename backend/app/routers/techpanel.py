"""Техпанель разработчика (роадмап-шаг 8): статус API, логи, сброс кэша.
Только DEVELOPER — см. таблицу ролей в CLAUDE.md."""

import time
from importlib.metadata import version as pkg_version

from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from sqlalchemy.orm import Session

from app import config, techlog
from app.constants import DEVELOPER
from app.db import get_db
from app.security import require_roles

router = APIRouter(
    prefix="/api/techpanel", tags=["techpanel"], dependencies=[Depends(require_roles(DEVELOPER))]
)

_STARTED_AT = time.time()


@router.get("/status")
def get_status(db: Session = Depends(get_db)) -> dict:
    try:
        db.execute(text("SELECT 1"))
        db_status = "ok"
    except Exception:
        db_status = "error"

    return {
        "api": "ok",
        "db": db_status,
        "uptime_seconds": round(time.time() - _STARTED_AT),
        "fastapi_version": pkg_version("fastapi"),
    }


@router.get("/logs")
def get_logs(limit: int = Query(100, ge=1, le=200)) -> list[dict]:
    return techlog.recent(limit)


@router.post("/cache/clear")
def clear_cache() -> dict:
    config._secrets.cache_clear()
    return {"cleared": True}
