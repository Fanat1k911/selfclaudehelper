from datetime import datetime, timedelta, timezone

import jwt

from app.config import JWT_ALGORITHM, JWT_EXPIRE_MINUTES, JWT_SECRET
from app.constants import USER_STATUS_FIRED, WORKER
from tests.conftest import auth_headers, make_company, make_user


def test_login_success(client, db_session):
    make_user(db_session, login="worker1", role=WORKER, password="pass1234")
    resp = client.post("/api/auth/login", json={"login": "worker1", "password": "pass1234"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["user"]["login"] == "worker1"
    assert body["access_token"]


def test_login_returns_company_name_for_whitelabel(client, db_session):
    company = make_company(db_session, name="3D Print Co")
    make_user(db_session, login="worker1b", role=WORKER, password="pass1234", company_id=company.id)
    resp = client.post("/api/auth/login", json={"login": "worker1b", "password": "pass1234"})
    body = resp.json()
    assert body["user"]["company_name"] == "3D Print Co"

    resp = client.get("/api/auth/me", headers={"Authorization": f"Bearer {body['access_token']}"})
    assert resp.json()["company_name"] == "3D Print Co"


def test_stale_token_missing_company_name_forces_relogin(client, db_session):
    """Регрессия: до фикса компания_name молча дефолтилась на "" вместо форса релогина,
    из-за чего фронт мог показать чужой бренд (см. code-review белого лейбла).
    Токен, выданный до этого деплоя, имеет company_id, но не company_name — симулируем
    напрямую, а не через auth_headers (та уже несёт оба поля)."""
    worker = make_user(db_session, login="worker_stale", role=WORKER)
    stale_payload = {
        "id": worker.id, "fio": worker.fio, "login": worker.login, "role": worker.role,
        "company_id": worker.company_id,
        # company_name отсутствует намеренно
        "exp": datetime.now(timezone.utc) + timedelta(minutes=JWT_EXPIRE_MINUTES),
    }
    token = jwt.encode(stale_payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
    resp = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 401


def test_login_rejects_wildcard_pattern_login(client, db_session):
    """Регрессия: ilike() трактовал "%"/"_" в логине как SQL-wildcard, а не буквальные
    символы — "worker4%" мог найти "worker4x" по паттерну вместо точного совпадения."""
    make_user(db_session, login="worker4x", role=WORKER, password="pass1234")
    resp = client.post("/api/auth/login", json={"login": "worker4%", "password": "pass1234"})
    assert resp.status_code == 401


def test_login_wrong_password(client, db_session):
    make_user(db_session, login="worker2", role=WORKER, password="pass1234")
    resp = client.post("/api/auth/login", json={"login": "worker2", "password": "wrong"})
    assert resp.status_code == 401


def test_login_rate_limited_after_threshold(client, db_session):
    """Регрессия: /login раньше не был лимитирован вообще (нашлось на security-review) —
    брутфорс/credential stuffing по паролю не встречал никакого сопротивления."""
    make_user(db_session, login="worker5", role=WORKER, password="pass1234")
    for _ in range(10):
        resp = client.post("/api/auth/login", json={"login": "worker5", "password": "wrong"})
        assert resp.status_code == 401
    over_limit = client.post("/api/auth/login", json={"login": "worker5", "password": "wrong"})
    assert over_limit.status_code == 429


def test_login_creates_log_entry(client, db_session):
    make_user(db_session, login="worker3", role=WORKER, password="pass1234")
    client.post("/api/auth/login", json={"login": "worker3", "password": "pass1234"})
    founder = make_user(db_session, login="founder1", role="founder", password="pass1234")
    resp = client.get("/api/auth/log", headers=auth_headers(founder))
    assert resp.status_code == 200
    logins = [entry["логин"] for entry in resp.json()]
    assert "worker3" in logins


def test_fired_user_loses_access(client, db_session):
    user = make_user(db_session, login="worker4", role=WORKER, password="pass1234", status=USER_STATUS_FIRED)
    resp = client.post("/api/auth/login", json={"login": "worker4", "password": "pass1234"})
    assert resp.status_code == 401

    # Токен, выданный до увольнения, тоже теряет силу — get_current_user
    # перепроверяет статус в БД на каждый запрос.
    resp = client.get("/api/auth/me", headers=auth_headers(user))
    assert resp.status_code == 401


def test_worker_cannot_see_login_log(client, db_session):
    worker = make_user(db_session, login="worker5", role=WORKER, password="pass1234")
    resp = client.get("/api/auth/log", headers=auth_headers(worker))
    assert resp.status_code == 403


def test_worker_login_unrestricted_when_network_not_enabled(client, db_session):
    make_user(db_session, login="netw1", role=WORKER, password="pass1234")
    resp = client.post(
        "/api/auth/login", json={"login": "netw1", "password": "pass1234"},
        headers={"X-Forwarded-For": "10.0.0.99"},
    )
    assert resp.status_code == 200


def test_worker_login_allowed_after_workshop_ping(client, db_session):
    founder = make_user(db_session, login="netw_f1", role="founder", password="pass1234")
    resp = client.put("/api/users/network-settings", json={"enabled": True}, headers=auth_headers(founder))
    assert resp.status_code == 200
    token = resp.json()["token"]
    assert token

    ping = client.post(f"/api/public/workshop-ping/{token}", headers={"X-Forwarded-For": "91.107.23.45"})
    assert ping.status_code == 200

    make_user(db_session, login="netw2", role=WORKER, password="pass1234")
    resp = client.post(
        "/api/auth/login", json={"login": "netw2", "password": "pass1234"},
        headers={"X-Forwarded-For": "91.107.23.45"},
    )
    assert resp.status_code == 200


def test_worker_login_rejected_from_other_network(client, db_session):
    founder = make_user(db_session, login="netw_f2", role="founder", password="pass1234")
    resp = client.put("/api/users/network-settings", json={"enabled": True}, headers=auth_headers(founder))
    token = resp.json()["token"]
    client.post(f"/api/public/workshop-ping/{token}", headers={"X-Forwarded-For": "91.107.23.45"})

    make_user(db_session, login="netw3", role=WORKER, password="pass1234")
    resp = client.post(
        "/api/auth/login", json={"login": "netw3", "password": "pass1234"},
        headers={"X-Forwarded-For": "203.0.113.5"},
    )
    assert resp.status_code == 403
    assert "мастерской" in resp.json()["detail"]


def test_founder_login_unrestricted_even_with_network_enabled(client, db_session):
    founder = make_user(db_session, login="netw_f3", role="founder", password="pass1234")
    resp = client.put("/api/users/network-settings", json={"enabled": True}, headers=auth_headers(founder))
    token = resp.json()["token"]
    client.post(f"/api/public/workshop-ping/{token}", headers={"X-Forwarded-For": "91.107.23.45"})

    resp = client.post(
        "/api/auth/login", json={"login": "netw_f3", "password": "pass1234"},
        headers={"X-Forwarded-For": "203.0.113.5"},
    )
    assert resp.status_code == 200


def test_worker_login_rejected_when_never_pinged(client, db_session):
    founder = make_user(db_session, login="netw_f4", role="founder", password="pass1234")
    client.put("/api/users/network-settings", json={"enabled": True}, headers=auth_headers(founder))

    make_user(db_session, login="netw4", role=WORKER, password="pass1234")
    resp = client.post(
        "/api/auth/login", json={"login": "netw4", "password": "pass1234"},
        headers={"X-Forwarded-For": "91.107.23.45"},
    )
    assert resp.status_code == 403


def test_worker_login_rejected_when_ping_stale(client, db_session):
    from app.models import Company

    founder = make_user(db_session, login="netw_f6", role="founder", password="pass1234")
    resp = client.put("/api/users/network-settings", json={"enabled": True}, headers=auth_headers(founder))
    token = resp.json()["token"]
    client.post(f"/api/public/workshop-ping/{token}", headers={"X-Forwarded-For": "91.107.23.45"})

    # Пинг был, но давно — роутер мог упасть/сеть лечь, не доверяем старому IP.
    company = db_session.query(Company).filter(Company.worker_network_token == token).one()
    company.worker_network_ip_updated_at = datetime.now(timezone.utc) - timedelta(minutes=30)
    db_session.commit()

    make_user(db_session, login="netw6", role=WORKER, password="pass1234")
    resp = client.post(
        "/api/auth/login", json={"login": "netw6", "password": "pass1234"},
        headers={"X-Forwarded-For": "91.107.23.45"},
    )
    assert resp.status_code == 403


def test_workshop_ping_invalid_token_404(client, db_session):
    resp = client.post("/api/public/workshop-ping/not-a-real-token")
    assert resp.status_code == 404


def test_network_settings_forbidden_for_worker(client, db_session):
    worker = make_user(db_session, login="netw5", role=WORKER, password="pass1234")
    resp = client.get("/api/users/network-settings", headers=auth_headers(worker))
    assert resp.status_code == 403


def test_network_settings_disable_clears_restriction(client, db_session):
    founder = make_user(db_session, login="netw_f5", role="founder", password="pass1234")
    headers = auth_headers(founder)
    resp = client.put("/api/users/network-settings", json={"enabled": True}, headers=headers)
    token = resp.json()["token"]
    client.post(f"/api/public/workshop-ping/{token}", headers={"X-Forwarded-For": "91.107.23.45"})

    resp = client.put("/api/users/network-settings", json={"enabled": False}, headers=headers)
    assert resp.json()["enabled"] is False

    make_user(db_session, login="netw7", role=WORKER, password="pass1234")
    resp = client.post(
        "/api/auth/login", json={"login": "netw7", "password": "pass1234"},
        headers={"X-Forwarded-For": "203.0.113.5"},  # заведомо не совпадает с записанным IP
    )
    assert resp.status_code == 200


def test_enabling_twice_keeps_same_token(client, db_session):
    founder = make_user(db_session, login="netw_f7", role="founder", password="pass1234")
    headers = auth_headers(founder)
    first = client.put("/api/users/network-settings", json={"enabled": True}, headers=headers)
    second = client.put("/api/users/network-settings", json={"enabled": True}, headers=headers)
    assert first.json()["token"] == second.json()["token"]
