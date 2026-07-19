"""Персистентный лог для техпанели (роадмап-шаг 8, персистентность добавлена
2026-07-19 по запросу Founder — раньше был in-memory deque, не переживавший рестарт
процесса). Пишет в TechLog (глобальная таблица, не company-scoped — см. модель).
Ретеншн 30 дней: очистка старых строк происходит прямо при записи, не чаще раза в
час (in-memory таймер) — не даёт таблице расти бесконечно и не требует отдельного
cron/scheduler, которого в проекте нет.

`SessionLocal` импортирован по имени модуля (не через `app.db.SessionLocal()`
напрямую) специально — тесты подменяют `app.techlog.SessionLocal` на фабрику к
тестовой SQLite (см. tests/conftest.py), иначе запись логов в тестах била бы в
настоящий Postgres из DATABASE_URL."""

import logging
import time
from datetime import datetime, timedelta, timezone

from sqlalchemy import delete, select

from app.db import SessionLocal
from app.models import TechLog

_RETENTION_DAYS = 30
_PRUNE_INTERVAL_SECONDS = 3600
_last_prune_at = 0.0


class _DBHandler(logging.Handler):
    def emit(self, record: logging.LogRecord) -> None:
        global _last_prune_at
        try:
            db = SessionLocal()
            try:
                db.add(
                    TechLog(
                        time=datetime.fromtimestamp(record.created, tz=timezone.utc).replace(tzinfo=None),
                        level=record.levelname,
                        logger=record.name,
                        message=record.getMessage(),
                    )
                )
                now = time.monotonic()
                if now - _last_prune_at > _PRUNE_INTERVAL_SECONDS:
                    cutoff = datetime.utcnow() - timedelta(days=_RETENTION_DAYS)
                    db.execute(delete(TechLog).where(TechLog.time < cutoff))
                    _last_prune_at = now
                db.commit()
            finally:
                db.close()
        except Exception:
            # Логирование не должно ронять вызывающий код при недоступной БД.
            pass


def install() -> None:
    root = logging.getLogger()
    if any(isinstance(h, _DBHandler) for h in root.handlers):
        return
    handler = _DBHandler()
    handler.setLevel(logging.INFO)
    root.addHandler(handler)


def recent(limit: int = 100) -> list[dict]:
    db = SessionLocal()
    try:
        stmt = select(TechLog).order_by(TechLog.time.desc()).limit(limit)
        return [
            {
                "time": row.time.replace(tzinfo=timezone.utc).isoformat(),
                "level": row.level,
                "logger": row.logger,
                "message": row.message,
            }
            for row in db.scalars(stmt)
        ]
    finally:
        db.close()
