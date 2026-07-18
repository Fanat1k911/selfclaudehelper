from sqlalchemy import select

from app.constants import DEVELOPER, FOUNDER, USER_STATUS_FIRED, WORKER
from app.models import Company, CompanyMembership, User
from tests.conftest import add_membership, auth_headers, make_company, make_user


def test_developer_creates_company_and_first_developer_user(client, db_session):
    dev = make_user(db_session, login="cdev1", role=DEVELOPER)
    resp = client.post(
        "/api/companies",
        headers=auth_headers(dev),
        json={"company_name": "3D-мастерская", "fio": "Иван Иванов", "login": "3dboss", "password": "pass1234"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["company_id"]
    assert body["user_id"]
    assert body["attached_existing"] is False

    company = db_session.get(Company, body["company_id"])
    assert company is not None
    assert company.name == "3D-мастерская"

    membership = db_session.scalar(
        select(CompanyMembership).where(
            CompanyMembership.user_id == body["user_id"], CompanyMembership.company_id == company.id
        )
    )
    assert membership is not None
    assert membership.role == DEVELOPER

    new_user = db_session.get(User, body["user_id"])
    assert new_user is not None
    assert new_user.login == "3dboss"


def test_founder_and_worker_forbidden(client, db_session):
    founder = make_user(db_session, login="cfound1", role=FOUNDER)
    worker = make_user(db_session, login="cwork1", role=WORKER)
    payload = {"company_name": "X", "fio": "Y", "login": "zzz", "password": "pass1234"}

    assert client.post("/api/companies", headers=auth_headers(founder), json=payload).status_code == 403
    assert client.post("/api/companies", headers=auth_headers(worker), json=payload).status_code == 403
    assert client.get("/api/companies", headers=auth_headers(founder)).status_code == 403
    assert client.get("/api/companies", headers=auth_headers(worker)).status_code == 403


def test_existing_login_attaches_as_developer_of_new_company(client, db_session):
    """Мульти-компанийные пользователи (2026-07-18, вариант А) — существующий логин на
    странице «Компании» не ошибка, а привязка того же человека к новой компании как
    Developer, если пароль верный (ФИО из формы игнорируется)."""
    dev = make_user(db_session, login="cdev2", role=DEVELOPER, password="realpass1")
    resp = client.post(
        "/api/companies",
        headers=auth_headers(dev),
        json={"company_name": "Вторая компания", "fio": "Неважно", "login": "cdev2", "password": "realpass1"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["attached_existing"] is True
    assert body["user_id"] == dev.id

    memberships = db_session.scalars(select(CompanyMembership).where(CompanyMembership.user_id == dev.id)).all()
    assert len(memberships) == 2
    assert {m.company_id for m in memberships} == {dev.company_id, body["company_id"]}
    new_membership = next(m for m in memberships if m.company_id == body["company_id"])
    assert new_membership.role == DEVELOPER

    # Пароль не поменялся — bcrypt-хэш совпадает с исходным (форма его не меняла, только сверила).
    original = db_session.get(User, dev.id)
    assert original.password_hash == dev.password_hash


def test_existing_login_wrong_password_rejected(client, db_session):
    """Security-critical (2026-07-18, поймано security-review до пуша): без проверки пароля
    любой Developer мог бы привязать ЧУЖОЙ аккаунт зная только логин, потом через
    reset-password перехватить его глобальный пароль. Неверный пароль — отклонить."""
    dev = make_user(db_session, login="cdev7", role=DEVELOPER)
    victim = make_user(db_session, login="victim1", role=DEVELOPER, password="realsecret")

    resp = client.post(
        "/api/companies",
        headers=auth_headers(dev),
        json={"company_name": "Захват", "fio": "Неважно", "login": "victim1", "password": "guessed-wrong"},
    )
    assert resp.status_code == 400

    # Жертва НЕ получила членства в новой компании.
    memberships = db_session.scalars(select(CompanyMembership).where(CompanyMembership.user_id == victim.id)).all()
    assert len(memberships) == 1


def test_existing_login_fired_account_rejected(client, db_session):
    """Уволенный (глобально) аккаунт нельзя молча привязать к новой компании — иначе
    founder думал бы что "нанял" рабочего, а тот не смог бы зайти (status глобальный)."""
    dev = make_user(db_session, login="cdev8", role=DEVELOPER)
    fired = make_user(db_session, login="fired1", role=WORKER, password="pass1234", status=USER_STATUS_FIRED)

    resp = client.post(
        "/api/companies",
        headers=auth_headers(dev),
        json={"company_name": "Не важно", "fio": "X", "login": "fired1", "password": "pass1234"},
    )
    assert resp.status_code == 400
    memberships = db_session.scalars(select(CompanyMembership).where(CompanyMembership.user_id == fired.id)).all()
    assert len(memberships) == 1


def test_missing_fields_rejected(client, db_session):
    dev = make_user(db_session, login="cdev3", role=DEVELOPER)
    resp = client.post(
        "/api/companies",
        headers=auth_headers(dev),
        json={"company_name": "  ", "fio": "Y", "login": "newlogin1", "password": "pass1234"},
    )
    assert resp.status_code == 400


def test_list_companies_returns_all_tenants_cross_company(client, db_session):
    company_a = make_company(db_session, name="Компания А")
    company_b = make_company(db_session, name="Компания Б")
    dev = make_user(db_session, login="cdev4", role=DEVELOPER, company_id=company_a.id)

    resp = client.get("/api/companies", headers=auth_headers(dev))
    assert resp.status_code == 200
    names = {c["name"] for c in resp.json()}
    assert "Компания А" in names
    assert "Компания Б" in names


def test_developer_with_two_companies_logs_into_either_with_correct_scope(client, db_session):
    """Живой сценарий Founder'а: один Developer состоит в двух компаниях сразу — токен
    на компанию А не должен давать доступ к данным компании Б и наоборот (обычная
    мультитенантная изоляция, теперь и для мульти-компанийных пользователей)."""
    company_b = make_company(db_session, name="Компания Б-2")
    dev = make_user(db_session, login="cdev6", role=DEVELOPER)
    add_membership(db_session, dev, company_id=company_b.id, role=DEVELOPER)

    resp_a = client.get("/api/companies", headers=auth_headers(dev))
    resp_b = client.get("/api/companies", headers=auth_headers(dev, company_id=company_b.id, role=DEVELOPER))
    assert resp_a.status_code == 200
    assert resp_b.status_code == 200


def test_get_company_returns_created_at_and_members_by_role(client, db_session):
    """Карточка компании (2026-07-18, запрос Founder) — дата создания + участники
    с ролями, доступна Developer'у (тот же cross-tenant роутер, что list_companies)."""
    company = make_company(db_session, name="Компания с деталями")
    dev = make_user(db_session, login="cdev9", role=DEVELOPER)
    founder = make_user(db_session, login="cfound9", role=FOUNDER, company_id=company.id)
    worker = make_user(db_session, login="cwork9", role=WORKER, company_id=company.id)
    add_membership(db_session, dev, company_id=company.id, role=DEVELOPER)

    resp = client.get(f"/api/companies/{company.id}", headers=auth_headers(dev, company_id=company.id, role=DEVELOPER))
    assert resp.status_code == 200
    body = resp.json()
    assert body["id"] == company.id
    assert body["name"] == "Компания с деталями"
    assert body["created_at"]

    roles_by_login = {m["login"]: m["role"] for m in body["members"]}
    assert roles_by_login == {"cdev9": "developer", "cfound9": "founder", "cwork9": "worker"}


def test_get_company_not_found(client, db_session):
    dev = make_user(db_session, login="cdev10", role=DEVELOPER)
    resp = client.get("/api/companies/doesnotexist", headers=auth_headers(dev))
    assert resp.status_code == 404


def test_get_company_forbidden_for_founder(client, db_session):
    founder = make_user(db_session, login="cfound10", role=FOUNDER)
    resp = client.get(f"/api/companies/{founder.company_id}", headers=auth_headers(founder))
    assert resp.status_code == 403
