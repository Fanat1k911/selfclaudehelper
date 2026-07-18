from sqlalchemy import select

from app.constants import DEVELOPER, FOUNDER, WORKER
from app.models import Company, User
from tests.conftest import auth_headers, make_company, make_user


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

    company = db_session.get(Company, body["company_id"])
    assert company is not None
    assert company.name == "3D-мастерская"

    new_user = db_session.get(User, body["user_id"])
    assert new_user is not None
    assert new_user.role == DEVELOPER
    assert new_user.company_id == company.id
    assert new_user.login == "3dboss"


def test_founder_and_worker_forbidden(client, db_session):
    founder = make_user(db_session, login="cfound1", role=FOUNDER)
    worker = make_user(db_session, login="cwork1", role=WORKER)
    payload = {"company_name": "X", "fio": "Y", "login": "zzz", "password": "pass1234"}

    assert client.post("/api/companies", headers=auth_headers(founder), json=payload).status_code == 403
    assert client.post("/api/companies", headers=auth_headers(worker), json=payload).status_code == 403
    assert client.get("/api/companies", headers=auth_headers(founder)).status_code == 403
    assert client.get("/api/companies", headers=auth_headers(worker)).status_code == 403


def test_duplicate_login_rejected(client, db_session):
    dev = make_user(db_session, login="cdev2", role=DEVELOPER)
    payload = {"company_name": "A", "fio": "Y", "login": "cdev2", "password": "pass1234"}
    resp = client.post("/api/companies", headers=auth_headers(dev), json=payload)
    assert resp.status_code == 400


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


def test_company_creation_does_not_create_founder(client, db_session):
    dev = make_user(db_session, login="cdev5", role=DEVELOPER)
    resp = client.post(
        "/api/companies",
        headers=auth_headers(dev),
        json={"company_name": "Только девелопер", "fio": "Пётр", "login": "onlydev1", "password": "pass1234"},
    )
    assert resp.status_code == 200
    company_id = resp.json()["company_id"]

    users = db_session.scalars(select(User).where(User.company_id == company_id)).all()
    assert len(users) == 1
    assert users[0].role == DEVELOPER
