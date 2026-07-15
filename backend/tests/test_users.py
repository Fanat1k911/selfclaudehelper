from app.constants import FOUNDER, USER_STATUS_FIRED, WORKER
from tests.conftest import auth_headers, make_user


def test_create_user(client, db_session):
    founder = make_user(db_session, login="uf1", role=FOUNDER)
    resp = client.post(
        "/api/users",
        json={"fio": "Иван Иванов", "login": "ivan", "password": "pass1234", "role": WORKER},
        headers=auth_headers(founder),
    )
    assert resp.status_code == 200


def test_create_user_rejects_duplicate_login(client, db_session):
    founder = make_user(db_session, login="uf2", role=FOUNDER)
    make_user(db_session, login="taken", role=WORKER)
    resp = client.post(
        "/api/users",
        json={"fio": "Иван Иванов", "login": "taken", "password": "pass1234", "role": WORKER},
        headers=auth_headers(founder),
    )
    assert resp.status_code == 400


def test_create_user_rejects_invalid_role(client, db_session):
    founder = make_user(db_session, login="uf3", role=FOUNDER)
    resp = client.post(
        "/api/users",
        json={"fio": "Иван Иванов", "login": "ivan2", "password": "pass1234", "role": "admin"},
        headers=auth_headers(founder),
    )
    assert resp.status_code == 400


def test_create_user_rejects_bad_phone(client, db_session):
    founder = make_user(db_session, login="uf4", role=FOUNDER)
    resp = client.post(
        "/api/users",
        json={"fio": "Иван Иванов", "login": "ivan3", "password": "pass1234", "role": WORKER, "phone": "abc"},
        headers=auth_headers(founder),
    )
    assert resp.status_code == 422


def test_fire_user_revokes_access_immediately(client, db_session):
    founder = make_user(db_session, login="uf5", role=FOUNDER)
    worker = make_user(db_session, login="uf5w", role=WORKER)

    resp = client.get("/api/auth/me", headers=auth_headers(worker))
    assert resp.status_code == 200

    resp = client.patch(
        f"/api/users/{worker.id}", json={"status": USER_STATUS_FIRED}, headers=auth_headers(founder)
    )
    assert resp.status_code == 200

    resp = client.get("/api/auth/me", headers=auth_headers(worker))
    assert resp.status_code == 401


def test_worker_cannot_manage_users(client, db_session):
    worker = make_user(db_session, login="uw1", role=WORKER)
    resp = client.get("/api/users", headers=auth_headers(worker))
    assert resp.status_code == 403
