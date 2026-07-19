from datetime import datetime, timezone

import jwt
import pytest

from app.config import JWT_ALGORITHM, JWT_SECRET
from app.rate_limit import _hits
from app.timezone_utils import next_midnight_utc
from tests.conftest import make_user

REGISTER_URL = "/api/auth/register"


@pytest.fixture(autouse=True)
def _reset_rate_limit():
    """TestClient шлёт все запросы с одного фейкового IP ("testclient") — без сброса
    между тестами они бы делили один rate-limit счётчик и тесты цеплялись бы друг за
    друга."""
    _hits.clear()
    yield
    _hits.clear()


def _payload(**overrides):
    payload = {
        "company_name": "Новая мастерская",
        "fio": "Тест Тестов",
        "login": "new_founder",
        "password": "pass1234",
        "phone": "+79001234567",
    }
    payload.update(overrides)
    return payload


def test_register_creates_company_and_founder(client):
    resp = client.post(REGISTER_URL, json=_payload())
    assert resp.status_code == 200
    body = resp.json()
    assert body["access_token"]
    assert body["user"]["role"] == "founder"
    assert body["user"]["login"] == "new_founder"
    assert body["user"]["company_name"] == "Новая мастерская"


def test_register_missing_company_name_rejected(client):
    resp = client.post(REGISTER_URL, json=_payload(company_name="   "))
    assert resp.status_code == 400


def test_register_invalid_phone_rejected(client):
    resp = client.post(REGISTER_URL, json=_payload(phone="not-a-phone"))
    assert resp.status_code == 422


def test_register_empty_phone_rejected(client):
    resp = client.post(REGISTER_URL, json=_payload(phone=""))
    assert resp.status_code == 422


def test_register_existing_login_wrong_password_rejected(client, db_session):
    make_user(db_session, login="existing_person", role="worker", password="realpass")
    resp = client.post(REGISTER_URL, json=_payload(login="existing_person", password="wrongpass"))
    assert resp.status_code == 400


def test_register_wrong_password_and_fired_account_give_same_message(client, db_session):
    """Публичный анонимный эндпоинт не должен быть оракулом "существует ли такой логин,
    уволен ли он" — оба случая обязаны отдавать одно и то же сообщение (security-review
    2026-07-18), иначе перебор логинов различал бы существующие/уволенные аккаунты по тексту
    ошибки."""
    make_user(db_session, login="wrong_pw_person", role="worker", password="realpass")
    make_user(db_session, login="fired_person_msg", role="worker", password="realpass", status="уволен")

    wrong_pw_resp = client.post(REGISTER_URL, json=_payload(login="wrong_pw_person", password="wrongpass"))
    fired_resp = client.post(REGISTER_URL, json=_payload(login="fired_person_msg", password="realpass"))

    assert wrong_pw_resp.status_code == fired_resp.status_code == 400
    assert wrong_pw_resp.json()["detail"] == fired_resp.json()["detail"]


def test_register_oversized_login_rejected(client):
    resp = client.post(REGISTER_URL, json=_payload(login="a" * 101))
    assert resp.status_code == 422


def test_register_oversized_company_name_rejected(client):
    resp = client.post(REGISTER_URL, json=_payload(company_name="a" * 256))
    assert resp.status_code == 422


def test_register_oversized_fio_rejected(client):
    resp = client.post(REGISTER_URL, json=_payload(fio="a" * 256))
    assert resp.status_code == 422


def test_register_password_over_72_bytes_rejected(client):
    """bcrypt>=4.2 кидает ValueError на пароле длиннее 72 БАЙТ (не символов) — без валидации
    на уровне схемы это был бы неперехваченный 500, не чистый 422 (security-review 2026-07-18)."""
    resp = client.post(REGISTER_URL, json=_payload(password="a" * 73))
    assert resp.status_code == 422


def test_register_password_over_72_bytes_cyrillic_rejected(client):
    """Кириллица — 2 байта на символ в UTF-8, так что чисто символьный лимит пропустил бы
    36-символьный кириллический пароль (72 байта) как "короткий", хотя он уже на грани."""
    resp = client.post(REGISTER_URL, json=_payload(password="а" * 40))
    assert resp.status_code == 422


def test_register_existing_login_correct_password_attaches_as_founder(client, db_session):
    make_user(db_session, login="existing_person", role="worker", password="realpass")
    resp = client.post(REGISTER_URL, json=_payload(login="existing_person", password="realpass"))
    assert resp.status_code == 200
    body = resp.json()
    assert body["user"]["role"] == "founder"
    # Membership старой компании тоже должно остаться — переключалка в сайдбаре её увидит.
    assert len(body["user"]["companies"]) == 2


def test_register_fired_existing_account_rejected(client, db_session):
    make_user(db_session, login="fired_person", role="worker", password="realpass", status="уволен")
    resp = client.post(REGISTER_URL, json=_payload(login="fired_person", password="realpass"))
    assert resp.status_code == 400


def test_register_rate_limited_after_threshold(client):
    for i in range(5):
        resp = client.post(REGISTER_URL, json=_payload(login=f"founder{i}"))
        assert resp.status_code == 200
    resp = client.post(REGISTER_URL, json=_payload(login="founder_over_limit"))
    assert resp.status_code == 429


def test_register_rate_limit_scoped_by_forwarded_ip(client):
    """Render проксирует запросы — без чтения X-Forwarded-For все посетители схлопнулись
    бы в один rate-limit бакет (security-review 2026-07-18). Разные X-Forwarded-For должны
    получать независимые счётчики, даже когда TestClient шлёт их с одного сокета."""
    headers_a = {"X-Forwarded-For": "1.2.3.4"}
    headers_b = {"X-Forwarded-For": "5.6.7.8"}

    for i in range(5):
        resp = client.post(REGISTER_URL, json=_payload(login=f"ip_a_{i}"), headers=headers_a)
        assert resp.status_code == 200

    over_limit_a = client.post(REGISTER_URL, json=_payload(login="ip_a_over"), headers=headers_a)
    assert over_limit_a.status_code == 429

    # Другой IP — свежий бакет, не задет исчерпанным лимитом первого.
    resp_b = client.post(REGISTER_URL, json=_payload(login="ip_b_first"), headers=headers_b)
    assert resp_b.status_code == 200


def test_registered_company_data_isolated_from_other_companies(client):
    """Архитектурный принцип №5 (CLAUDE.md) — утечка данных между компаниями критический
    баг. Отдельная регрессия именно для саморегистрации, не полагаемся только на общий
    механизм в test_multitenancy.py — эта компания заведена НОВЫМ публичным путём."""
    resp_a = client.post(REGISTER_URL, json=_payload(company_name="Мастерская А", login="owner_a"))
    resp_b = client.post(REGISTER_URL, json=_payload(company_name="Мастерская Б", login="owner_b"))
    token_a = resp_a.json()["access_token"]
    token_b = resp_b.json()["access_token"]

    create_resp = client.post(
        "/api/ingredients",
        json={"name": "Секретное сырьё А", "category": "сыпучее", "unit": "г"},
        headers={"Authorization": f"Bearer {token_a}"},
    )
    assert create_resp.status_code == 200
    material_id = create_resp.json()["id"]

    list_b = client.get("/api/ingredients", headers={"Authorization": f"Bearer {token_b}"})
    assert all(m["id"] != material_id for m in list_b.json())

    direct_b = client.get(f"/api/ingredients/{material_id}/transactions", headers={"Authorization": f"Bearer {token_b}"})
    assert direct_b.status_code == 404


def test_register_stores_submitted_timezone(client, db_session):
    resp = client.post(REGISTER_URL, json=_payload(timezone="Asia/Vladivostok"))
    assert resp.status_code == 200
    from app.models import Company

    company = db_session.query(Company).filter_by(name="Новая мастерская").one()
    assert company.timezone == "Asia/Vladivostok"


def test_register_invalid_timezone_rejected(client):
    resp = client.post(REGISTER_URL, json=_payload(timezone="Not/A_Real_Zone"))
    assert resp.status_code == 400


def test_register_defaults_to_moscow_timezone_when_omitted(client, db_session):
    resp = client.post(REGISTER_URL, json=_payload())
    assert resp.status_code == 200
    from app.models import Company

    company = db_session.query(Company).filter_by(name="Новая мастерская").one()
    assert company.timezone == "Europe/Moscow"


def test_register_jwt_exp_matches_next_midnight_in_company_timezone(client):
    """Разлогин ровно в полночь (2026-07-18, решение Founder) — JWT exp должен быть
    следующей полночью в часовом поясе КОМПАНИИ, не фиксированной длительностью."""
    resp = client.post(REGISTER_URL, json=_payload(timezone="Asia/Vladivostok"))
    assert resp.status_code == 200
    token = resp.json()["access_token"]

    decoded = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    actual_exp = datetime.fromtimestamp(decoded["exp"], tz=timezone.utc)

    # next_midnight_utc(now=None) внутри create_access_token берёт "текущий момент
    # выполнения" — сверяем с допуском в несколько секунд (сеть/тест не мгновенны).
    expected_exp = next_midnight_utc("Asia/Vladivostok")
    assert abs((actual_exp - expected_exp).total_seconds()) < 10
