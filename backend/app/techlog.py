"""In-memory буфер последних записей логгера для техпанели (роадмап-шаг 8).
Не персистентно (переживает только жизнь процесса) — техпанель для разработчика,
не журнал для аудита (тот — LoginLog, см. CLAUDE.md)."""

import logging
from collections import deque
from datetime import datetime, timezone

_MAX_RECORDS = 200
_buffer: deque[dict] = deque(maxlen=_MAX_RECORDS)


class _BufferHandler(logging.Handler):
    def emit(self, record: logging.LogRecord) -> None:
        _buffer.append(
            {
                "time": datetime.fromtimestamp(record.created, tz=timezone.utc).isoformat(),
                "level": record.levelname,
                "logger": record.name,
                "message": record.getMessage(),
            }
        )


def install() -> None:
    root = logging.getLogger()
    if any(isinstance(h, _BufferHandler) for h in root.handlers):
        return
    root.addHandler(_BufferHandler())


def recent(limit: int = 100) -> list[dict]:
    return list(_buffer)[-limit:][::-1]
