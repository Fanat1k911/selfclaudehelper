from app.constants import DEVELOPER, FOUNDER, WORKER
from tests.conftest import auth_headers, make_company, make_user


def test_settings_default_to_none(client, db_session):
    founder = make_user(db_session, login="sv1", role=FOUNDER)
    resp = client.get("/api/surveillance/settings", headers=auth_headers(founder))
    assert resp.status_code == 200
    assert resp.json()["stream_url"] is None


def test_settings_roundtrip(client, db_session):
    founder = make_user(db_session, login="sv2", role=FOUNDER)
    headers = auth_headers(founder)

    resp = client.put("/api/surveillance/settings", json={"stream_url": "https://cam.ts.net/stream.m3u8"}, headers=headers)
    assert resp.status_code == 200
    assert resp.json()["stream_url"] == "https://cam.ts.net/stream.m3u8"

    resp = client.get("/api/surveillance/settings", headers=headers)
    assert resp.json()["stream_url"] == "https://cam.ts.net/stream.m3u8"

    # Повторный PUT перезаписывает, не создаёт вторую запись.
    resp = client.put("/api/surveillance/settings", json={"stream_url": "https://cam.ts.net/other.m3u8"}, headers=headers)
    assert resp.json()["stream_url"] == "https://cam.ts.net/other.m3u8"


def test_settings_clear_with_null(client, db_session):
    founder = make_user(db_session, login="sv3", role=FOUNDER)
    headers = auth_headers(founder)
    client.put("/api/surveillance/settings", json={"stream_url": "https://cam.ts.net/stream.m3u8"}, headers=headers)
    resp = client.put("/api/surveillance/settings", json={"stream_url": None}, headers=headers)
    assert resp.json()["stream_url"] is None


def test_settings_forbidden_for_worker(client, db_session):
    worker = make_user(db_session, login="sv4", role=WORKER)
    resp = client.get("/api/surveillance/settings", headers=auth_headers(worker))
    assert resp.status_code == 403


def test_screenshot_create_and_list(client, db_session):
    founder = make_user(db_session, login="sv5", role=FOUNDER, fio="Люба Основатель")
    headers = auth_headers(founder)

    resp = client.post(
        "/api/surveillance/screenshots",
        json={"image_base64": "data:image/png;base64,iVBORw0KGgo=", "comment": "проверка склада"},
        headers=headers,
    )
    assert resp.status_code == 200

    resp = client.get("/api/surveillance/screenshots", headers=headers)
    assert resp.status_code == 200
    rows = resp.json()
    assert len(rows) == 1
    assert rows[0]["комментарий"] == "проверка склада"
    assert rows[0]["ФИО сотрудника"] == "Люба Основатель"
    assert rows[0]["изображение"] == "data:image/png;base64,iVBORw0KGgo="


def test_screenshots_forbidden_for_worker(client, db_session):
    worker = make_user(db_session, login="sv6", role=WORKER)
    resp = client.post(
        "/api/surveillance/screenshots", json={"image_base64": "x", "comment": ""}, headers=auth_headers(worker)
    )
    assert resp.status_code == 403


def test_screenshots_isolated_between_companies(client, db_session):
    founder1 = make_user(db_session, login="sv7", role=FOUNDER)
    client.post(
        "/api/surveillance/screenshots", json={"image_base64": "x", "comment": ""}, headers=auth_headers(founder1)
    )

    other_company = make_company(db_session, name="Другая мастерская 5")
    founder2 = make_user(db_session, login="sv8", role=FOUNDER, company_id=other_company.id)
    resp = client.get("/api/surveillance/screenshots", headers=auth_headers(founder2))
    assert resp.json() == []


def test_settings_isolated_between_companies(client, db_session):
    founder1 = make_user(db_session, login="sv9", role=FOUNDER)
    client.put("/api/surveillance/settings", json={"stream_url": "https://cam.ts.net/a.m3u8"}, headers=auth_headers(founder1))

    other_company = make_company(db_session, name="Другая мастерская 6")
    founder2 = make_user(db_session, login="sv10", role=FOUNDER, company_id=other_company.id)
    resp = client.get("/api/surveillance/settings", headers=auth_headers(founder2))
    assert resp.json()["stream_url"] is None


def test_developer_can_manage_settings(client, db_session):
    developer = make_user(db_session, login="sv11", role=DEVELOPER)
    resp = client.put(
        "/api/surveillance/settings", json={"stream_url": "https://cam.ts.net/b.m3u8"}, headers=auth_headers(developer)
    )
    assert resp.status_code == 200
