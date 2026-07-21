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
