import httpx

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


def test_lookup_by_inn_returns_501_when_not_configured(client, db_session, monkeypatch):
    monkeypatch.setattr("app.routers.counterparties.DADATA_API_KEY", "")
    founder = make_user(db_session, login="cf4", role=FOUNDER)
    resp = client.get("/api/counterparties/lookup?inn=7701234567", headers=auth_headers(founder))
    assert resp.status_code == 501


def test_lookup_by_inn_rejects_bad_format(client, db_session, monkeypatch):
    monkeypatch.setattr("app.routers.counterparties.DADATA_API_KEY", "test-key")
    founder = make_user(db_session, login="cf5", role=FOUNDER)
    resp = client.get("/api/counterparties/lookup?inn=abc", headers=auth_headers(founder))
    assert resp.status_code == 400


def test_lookup_by_inn_success(client, db_session, monkeypatch):
    monkeypatch.setattr("app.routers.counterparties.DADATA_API_KEY", "test-key")

    def fake_post(url, json, headers, timeout):
        return httpx.Response(
            200,
            json={
                "suggestions": [
                    {
                        "value": "ООО РОМАШКА",
                        "data": {
                            "inn": "7701234567", "kpp": "770101001", "ogrn": "1027700123456",
                            "name": {"short_with_opf": "ООО «Ромашка»"},
                            "address": {"value": "г Москва, ул Ленина, д 1"},
                        },
                    }
                ]
            },
            request=httpx.Request("POST", url),
        )

    monkeypatch.setattr("app.routers.counterparties.httpx.post", fake_post)
    founder = make_user(db_session, login="cf6", role=FOUNDER)
    resp = client.get("/api/counterparties/lookup?inn=7701234567", headers=auth_headers(founder))
    assert resp.status_code == 200
    body = resp.json()
    assert body["ИНН"] == "7701234567"
    assert body["КПП"] == "770101001"
    assert body["название"] == "ООО «Ромашка»"


def test_lookup_by_inn_not_found(client, db_session, monkeypatch):
    monkeypatch.setattr("app.routers.counterparties.DADATA_API_KEY", "test-key")

    def fake_post(url, json, headers, timeout):
        return httpx.Response(200, json={"suggestions": []}, request=httpx.Request("POST", url))

    monkeypatch.setattr("app.routers.counterparties.httpx.post", fake_post)
    founder = make_user(db_session, login="cf7", role=FOUNDER)
    resp = client.get("/api/counterparties/lookup?inn=7701234567", headers=auth_headers(founder))
    assert resp.status_code == 404


def test_lookup_by_inn_worker_forbidden(client, db_session):
    worker = make_user(db_session, login="cw2", role=WORKER)
    resp = client.get("/api/counterparties/lookup?inn=7701234567", headers=auth_headers(worker))
    assert resp.status_code == 403
