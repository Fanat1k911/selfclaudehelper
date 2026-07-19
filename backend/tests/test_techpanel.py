import logging
from datetime import datetime, timedelta

from app import techlog
from app.constants import DEVELOPER, FOUNDER, WORKER
from app.models import TechLog
from tests.conftest import auth_headers, make_user


def test_status_ok_for_developer(client, db_session):
    dev = make_user(db_session, login="tp1", role=DEVELOPER)
    resp = client.get("/api/techpanel/status", headers=auth_headers(dev))
    assert resp.status_code == 200
    body = resp.json()
    assert body["api"] == "ok"
    assert body["db"] == "ok"
    assert body["uptime_seconds"] >= 0


def test_logs_capture_and_return_records(client, db_session):
    dev = make_user(db_session, login="tp2", role=DEVELOPER)
    logging.getLogger("test.techpanel").warning("контрольная запись техпанели")

    resp = client.get("/api/techpanel/logs", headers=auth_headers(dev))
    assert resp.status_code == 200
    messages = [row["message"] for row in resp.json()]
    assert "контрольная запись техпанели" in messages


def test_cache_clear_ok(client, db_session):
    dev = make_user(db_session, login="tp3", role=DEVELOPER)
    resp = client.post("/api/techpanel/cache/clear", headers=auth_headers(dev))
    assert resp.status_code == 200
    assert resp.json() == {"cleared": True}


def test_logs_older_than_30_days_are_pruned(client, db_session):
    dev = make_user(db_session, login="tp6", role=DEVELOPER)
    db_session.add(
        TechLog(time=datetime.utcnow() - timedelta(days=31), level="INFO", logger="old", message="протухший лог")
    )
    db_session.commit()

    techlog._last_prune_at = 0.0  # форсируем прогон очистки, минуя часовой троттлинг
    logging.getLogger("test.techpanel").warning("свежая запись")

    resp = client.get("/api/techpanel/logs", headers=auth_headers(dev))
    messages = [row["message"] for row in resp.json()]
    assert "протухший лог" not in messages
    assert "свежая запись" in messages


def test_founder_and_worker_forbidden(client, db_session):
    founder = make_user(db_session, login="tp4", role=FOUNDER)
    worker = make_user(db_session, login="tp5", role=WORKER)
    assert client.get("/api/techpanel/status", headers=auth_headers(founder)).status_code == 403
    assert client.get("/api/techpanel/status", headers=auth_headers(worker)).status_code == 403
