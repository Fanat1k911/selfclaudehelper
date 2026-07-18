"""Мульти-компанийные пользователи (2026-07-18) — вход при нескольких членствах,
второй шаг выбора компании, переключение компании уже залогиненным пользователем.
См. CLAUDE.md → "Мульти-компанийные пользователи", app/security.py."""

import jwt
from sqlalchemy import select

from app.config import JWT_ALGORITHM, JWT_SECRET
from app.constants import DEVELOPER, FOUNDER
from app.models import LoginLog
from tests.conftest import add_membership, auth_headers, make_company, make_user


def test_single_company_login_unchanged(client, db_session):
    """99% пользователей — одна компания, вход как раньше, без лишнего шага."""
    make_user(db_session, login="single1", role=DEVELOPER, password="pass1234")
    resp = client.post("/api/auth/login", json={"login": "single1", "password": "pass1234"})
    assert resp.status_code == 200
    body = resp.json()
    assert "needs_company_choice" not in body
    assert body["access_token"]
    assert body["user"]["companies"] == [
        {"id": body["user"]["company_id"], "name": body["user"]["company_name"], "role": "developer"}
    ]


def test_multi_company_login_requires_choice(client, db_session):
    company_b = make_company(db_session, name="Вторая мастерская")
    dev = make_user(db_session, login="multi1", role=DEVELOPER, password="pass1234")
    add_membership(db_session, dev, company_id=company_b.id, role=FOUNDER)

    resp = client.post("/api/auth/login", json={"login": "multi1", "password": "pass1234"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["needs_company_choice"] is True
    assert "access_token" not in body
    assert len(body["companies"]) == 2
    roles = {c["role"] for c in body["companies"]}
    assert roles == {"developer", "founder"}


def test_select_company_finalizes_login_with_correct_role(client, db_session):
    company_b = make_company(db_session, name="Вторая мастерская 2")
    dev = make_user(db_session, login="multi2", role=DEVELOPER, password="pass1234")
    add_membership(db_session, dev, company_id=company_b.id, role=FOUNDER)

    choice = client.post("/api/auth/login", json={"login": "multi2", "password": "pass1234"}).json()
    resp = client.post(
        "/api/auth/select-company",
        json={"pending_token": choice["pending_token"], "company_id": company_b.id},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["user"]["role"] == "founder"
    assert body["user"]["company_id"] == company_b.id
    assert body["access_token"]


def test_select_company_rejects_company_not_a_member_of(client, db_session):
    other_company = make_company(db_session, name="Чужая компания")
    company_b = make_company(db_session, name="Своя вторая")
    dev = make_user(db_session, login="multi3", role=DEVELOPER, password="pass1234")
    add_membership(db_session, dev, company_id=company_b.id, role=DEVELOPER)

    choice = client.post("/api/auth/login", json={"login": "multi3", "password": "pass1234"}).json()
    resp = client.post(
        "/api/auth/select-company",
        json={"pending_token": choice["pending_token"], "company_id": other_company.id},
    )
    assert resp.status_code == 404


def test_select_company_rejects_garbage_token(client, db_session):
    resp = client.post(
        "/api/auth/select-company", json={"pending_token": "garbage", "company_id": "whatever"}
    )
    assert resp.status_code == 401


def test_select_company_rejects_normal_access_token_as_pending(client, db_session):
    """Обычный access-токен (не pending) не должен прокатывать на этом эндпоинте —
    иначе любой залогиненный мог бы дёшево "довыбрать" чужую компанию."""
    dev = make_user(db_session, login="multi4", role=DEVELOPER, password="pass1234")
    normal_token = jwt.encode(
        {"id": dev.id, "fio": dev.fio, "login": dev.login, "role": "developer", "company_id": dev.company_id},
        JWT_SECRET,
        algorithm=JWT_ALGORITHM,
    )
    resp = client.post(
        "/api/auth/select-company", json={"pending_token": normal_token, "company_id": dev.company_id}
    )
    assert resp.status_code == 401


def test_switch_company_reissues_token_without_password(client, db_session):
    company_b = make_company(db_session, name="Переключение Б")
    dev = make_user(db_session, login="multi5", role=DEVELOPER, password="pass1234")
    add_membership(db_session, dev, company_id=company_b.id, role=FOUNDER)

    resp = client.post(
        "/api/auth/switch-company", headers=auth_headers(dev), json={"company_id": company_b.id}
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["user"]["company_id"] == company_b.id
    assert body["user"]["role"] == "founder"


def test_switch_company_rejects_non_member_company(client, db_session):
    other_company = make_company(db_session, name="Не моя компания")
    dev = make_user(db_session, login="multi6", role=DEVELOPER, password="pass1234")

    resp = client.post(
        "/api/auth/switch-company", headers=auth_headers(dev), json={"company_id": other_company.id}
    )
    assert resp.status_code == 404


def test_switch_company_writes_login_log_for_target_company(client, db_session):
    """Регрессия (2026-07-18, code-review) — переключение раньше не писало LoginLog,
    аудит-трейл целевой компании молчал о доступе через переключалку."""
    company_b = make_company(db_session, name="Аудит компании Б")
    dev = make_user(db_session, login="multi7", role=DEVELOPER, password="pass1234")
    add_membership(db_session, dev, company_id=company_b.id, role=FOUNDER)

    client.post("/api/auth/switch-company", headers=auth_headers(dev), json={"company_id": company_b.id})

    entries = db_session.scalars(select(LoginLog).where(LoginLog.company_id == company_b.id)).all()
    assert len(entries) == 1
    assert entries[0].user_id == dev.id


def test_pending_token_rejected_by_get_current_user(client, db_session):
    """Регрессия (2026-07-18, code-review) — pending_token, подписанный тем же JWT_SECRET,
    раньше проходил get_current_user() как обычный токен и падал KeyError->500 на
    payload["login"] вместо чистого 401."""
    company_b = make_company(db_session, name="Pending vs real")
    dev = make_user(db_session, login="multi8", role=DEVELOPER, password="pass1234")
    add_membership(db_session, dev, company_id=company_b.id, role=FOUNDER)

    choice = client.post("/api/auth/login", json={"login": "multi8", "password": "pass1234"}).json()
    resp = client.get(
        "/api/auth/me", headers={"Authorization": f"Bearer {choice['pending_token']}"}
    )
    assert resp.status_code == 401
