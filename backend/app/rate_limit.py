"""Простой in-memory rate-limit по ключу (2026-07-18, публичная саморегистрация компаний,
см. CLAUDE.md → "Публичная self-serve регистрация"). Не Redis/внешний сервис — тот же
компромисс, что и app/techlog.py: не переживает рестарт процесса, не шарится между
несколькими воркерами, если Render когда-нибудь запустит больше одного. Для одного
публичного эндпоинта на раннем этапе этого достаточно; капча — отдельная задолженность
(см. CLAUDE.md), не блокирует первый заход."""

import time

from fastapi import HTTPException, Request, status

_hits: dict[str, list[float]] = {}


def client_ip(request: Request) -> str:
    """Render (и большинство PaaS) держат приложение за собственным edge-прокси — uvicorn
    поднят без --proxy-headers, так что request.client.host отдаёт IP ЭТОГО прокси, не
    реального посетителя (все внешние запросы схлопнулись бы в один rate-limit бакет,
    security-review 2026-07-18 поймал до пуша). Render сам проставляет X-Forwarded-For с
    реальным IP клиента на единственном хопе перед контейнером — доверяем первому значению
    в списке. Fallback на request.client.host только для локальной разработки (там
    заголовка нет вообще)."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def check_rate_limit(key: str, max_requests: int, window_seconds: int) -> None:
    now = time.monotonic()
    cutoff = now - window_seconds
    # Не defaultdict/in-place мутация — .get + переприсвоение гарантирует, что ключ
    # никогда не остаётся в _hits с "осиротевшим" списком (была найдена реальная логическая
    # ошибка на ревью самого этого файла: del ключа с последующим append в тот же объект
    # списка тихо ломал лимит для этого IP навсегда, т.к. следующий вызов создавал уже
    # новый пустой список через тот же ключ).
    hits = [t for t in _hits.get(key, []) if t >= cutoff]
    if len(hits) >= max_requests:
        _hits[key] = hits
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Слишком много попыток. Попробуйте позже.")
    hits.append(now)
    _hits[key] = hits
