"""Разлогин ровно в полночь по часовому поясу компании (2026-07-18, решение Founder) —
JWT exp вместо фиксированной длительности (JWT_EXPIRE_MINUTES) считается как "следующая
полночь в этом IANA-поясе", переведённая в UTC. zoneinfo — стандартная библиотека,
без внешней зависимости."""

from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError


def is_valid_tz_name(tz_name: str) -> bool:
    # ZoneInfo кидает ZoneInfoNotFoundError на несуществующее, НО КАК И РАЗ голый
    # ValueError на пустую строку/не-нормализованный путь (напр. "") — ловим оба,
    # без ValueError падало бы неперехваченным 500 вместо чистого "неверный пояс"
    # (найдено собственным тестом на пустую строку, не ревью).
    try:
        ZoneInfo(tz_name)
        return True
    except (ZoneInfoNotFoundError, ValueError):
        return False


def next_midnight_utc(tz_name: str, now: datetime | None = None) -> datetime:
    """Следующая полночь (00:00 следующих суток) в tz_name, в виде aware UTC datetime.
    Если сейчас уже ровно полночь — берём СЛЕДУЮЩУЮ, не текущий момент (иначе токен
    протухал бы мгновенно). Неизвестное/некорректное имя пояса — fallback на UTC, не 500."""
    try:
        zone = ZoneInfo(tz_name)
    except (ZoneInfoNotFoundError, ValueError):
        zone = ZoneInfo("UTC")

    now = now or datetime.now(timezone.utc)
    local_now = now.astimezone(zone)
    next_day = (local_now + timedelta(days=1)).date()
    local_midnight = datetime(next_day.year, next_day.month, next_day.day, tzinfo=zone)
    return local_midnight.astimezone(timezone.utc)
