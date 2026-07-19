from datetime import datetime, timezone

from app.timezone_utils import is_valid_tz_name, next_midnight_utc


def test_next_midnight_utc_moscow_from_afternoon():
    # 2026-07-18 15:00 UTC = 18:00 в Москве (UTC+3) — следующая полночь по Москве
    # это 2026-07-19 00:00 МСК = 2026-07-18 21:00 UTC.
    now = datetime(2026, 7, 18, 15, 0, tzinfo=timezone.utc)
    result = next_midnight_utc("Europe/Moscow", now=now)
    assert result == datetime(2026, 7, 18, 21, 0, tzinfo=timezone.utc)


def test_next_midnight_utc_never_returns_past_or_present():
    # Ровно полночь по Москве сейчас — берём СЛЕДУЮЩУЮ полночь, не эту же (иначе
    # токен истекал бы мгновенно/уже истёкшим).
    now = datetime(2026, 7, 18, 21, 0, tzinfo=timezone.utc)  # 2026-07-19 00:00 МСК ровно
    result = next_midnight_utc("Europe/Moscow", now=now)
    assert result > now
    assert result == datetime(2026, 7, 19, 21, 0, tzinfo=timezone.utc)


def test_next_midnight_utc_different_timezone():
    # Владивосток UTC+10 — независимая проверка, не совпадающая с Москвой.
    now = datetime(2026, 7, 18, 1, 0, tzinfo=timezone.utc)  # 11:00 во Владивостоке
    result = next_midnight_utc("Asia/Vladivostok", now=now)
    assert result == datetime(2026, 7, 18, 14, 0, tzinfo=timezone.utc)  # 2026-07-19 00:00 +10


def test_next_midnight_utc_unknown_tz_falls_back_to_utc():
    now = datetime(2026, 7, 18, 15, 0, tzinfo=timezone.utc)
    result = next_midnight_utc("Not/A_Real_Zone", now=now)
    assert result == datetime(2026, 7, 19, 0, 0, tzinfo=timezone.utc)


def test_is_valid_tz_name():
    assert is_valid_tz_name("Europe/Moscow") is True
    assert is_valid_tz_name("Asia/Vladivostok") is True
    assert is_valid_tz_name("Not/A_Real_Zone") is False
    assert is_valid_tz_name("") is False
