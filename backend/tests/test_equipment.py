from app.constants import DEVELOPER, FOUNDER, WORKER
from tests.conftest import auth_headers, make_user


def test_balance_reflects_income_broken_lost_adjustment(client, db_session):
    founder = make_user(db_session, login="eq1", role=FOUNDER)
    headers = auth_headers(founder)

    resp = client.post("/api/equipment", json={"name": "Миксер электрический"}, headers=headers)
    item_id = resp.json()["id"]

    client.post(f"/api/equipment/{item_id}/income", json={"qty": 5, "cost": 900}, headers=headers)
    client.post(f"/api/equipment/{item_id}/broken", json={"qty": 1, "cost": 300}, headers=headers)
    client.post(f"/api/equipment/{item_id}/lost", json={"qty": 1}, headers=headers)
    client.post(f"/api/equipment/{item_id}/adjustment", json={"actual_qty": 2}, headers=headers)

    resp = client.get("/api/equipment", headers=headers)
    row = next(r for r in resp.json() if r["id"] == item_id)
    assert row["остаток"] == 2.0


def test_broken_and_lost_reject_non_positive_qty(client, db_session):
    founder = make_user(db_session, login="eq2", role=FOUNDER)
    headers = auth_headers(founder)
    resp = client.post("/api/equipment", json={"name": "Весы"}, headers=headers)
    item_id = resp.json()["id"]

    assert client.post(f"/api/equipment/{item_id}/broken", json={"qty": 0}, headers=headers).status_code == 400
    assert client.post(f"/api/equipment/{item_id}/lost", json={"qty": -1}, headers=headers).status_code == 400


def test_transactions_record_cost(client, db_session):
    founder = make_user(db_session, login="eq3", role=FOUNDER)
    headers = auth_headers(founder)
    resp = client.post("/api/equipment", json={"name": "Термометр"}, headers=headers)
    item_id = resp.json()["id"]
    client.post(f"/api/equipment/{item_id}/income", json={"qty": 2, "cost": 500}, headers=headers)
    client.post(f"/api/equipment/{item_id}/broken", json={"qty": 1, "cost": 150, "comment": "разбит"}, headers=headers)

    resp = client.get(f"/api/equipment/{item_id}/transactions", headers=headers)
    rows = resp.json()
    broken = next(r for r in rows if r["тип"] == "поломка")
    assert broken["трата"] == 150.0
    assert broken["комментарий"] == "разбит"


def test_worker_forbidden(client, db_session):
    worker = make_user(db_session, login="eq4", role=WORKER)
    headers = auth_headers(worker)
    assert client.get("/api/equipment", headers=headers).status_code == 403
    assert client.post("/api/equipment", json={"name": "X"}, headers=headers).status_code == 403


def test_developer_allowed(client, db_session):
    dev = make_user(db_session, login="eq5", role=DEVELOPER)
    headers = auth_headers(dev)
    resp = client.post("/api/equipment", json={"name": "Пипетки"}, headers=headers)
    assert resp.status_code == 200


def test_cross_company_item_is_404(client, db_session):
    from tests.conftest import make_company

    founder1 = make_user(db_session, login="eq6", role=FOUNDER)
    resp = client.post("/api/equipment", json={"name": "Формы для мыла"}, headers=auth_headers(founder1))
    item_id = resp.json()["id"]

    other_company = make_company(db_session, name="Другая мастерская 2")
    founder2 = make_user(db_session, login="eq7", role=FOUNDER, company_id=other_company.id)
    resp = client.post(f"/api/equipment/{item_id}/income", json={"qty": 1}, headers=auth_headers(founder2))
    assert resp.status_code == 404
