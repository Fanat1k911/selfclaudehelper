from app.constants import FOUNDER, WORKER
from tests.conftest import auth_headers, make_user


def test_create_counterparty(client, db_session):
    founder = make_user(db_session, login="cf1", role=FOUNDER)
    resp = client.post(
        "/api/counterparties",
        json={"name": "ООО Ромашка", "inn": "7701234567", "phone": "+7 (999) 123-45-67"},
        headers=auth_headers(founder),
    )
    assert resp.status_code == 200


def test_counterparty_rejects_letters_in_inn(client, db_session):
    founder = make_user(db_session, login="cf2", role=FOUNDER)
    resp = client.post(
        "/api/counterparties",
        json={"name": "ООО Ромашка", "inn": "77ABC1234"},
        headers=auth_headers(founder),
    )
    assert resp.status_code == 422


def test_counterparty_rejects_letters_in_phone(client, db_session):
    founder = make_user(db_session, login="cf3", role=FOUNDER)
    resp = client.post(
        "/api/counterparties",
        json={"name": "ООО Ромашка", "phone": "не телефон"},
        headers=auth_headers(founder),
    )
    assert resp.status_code == 422


def test_worker_cannot_access_counterparties(client, db_session):
    worker = make_user(db_session, login="cw1", role=WORKER)
    resp = client.get("/api/counterparties", headers=auth_headers(worker))
    assert resp.status_code == 403
