from app.constants import FOUNDER, WORKER
from tests.conftest import auth_headers, make_user


def test_balance_reflects_income_expense_adjustment(client, db_session):
    worker = make_user(db_session, login="iw1", role=WORKER)
    headers = auth_headers(worker)

    resp = client.post("/api/ingredients", json={"name": "Воск", "category": "сыпучее", "unit": "кг"}, headers=headers)
    material_id = resp.json()["id"]

    client.post(f"/api/ingredients/{material_id}/income", json={"qty": 10}, headers=headers)
    client.post(f"/api/ingredients/{material_id}/expense", json={"qty": 3}, headers=headers)
    client.post(f"/api/ingredients/{material_id}/adjustment", json={"actual_qty": 8}, headers=headers)

    resp = client.get("/api/ingredients", headers=headers)
    row = next(r for r in resp.json() if r["id"] == material_id)
    assert row["остаток"] == 8.0


def test_patch_updates_purchase_attrs_partially(client, db_session):
    founder = make_user(db_session, login="iw3", role=FOUNDER)
    headers = auth_headers(founder)
    resp = client.post("/api/ingredients", json={"name": "Глицерин", "category": "жидкое", "unit": "г"}, headers=headers)
    material_id = resp.json()["id"]

    resp = client.patch(
        f"/api/ingredients/{material_id}",
        json={"unit_cost": 0.25, "supplier": "ИП Иванов"},
        headers=headers,
    )
    assert resp.status_code == 200

    resp = client.get("/api/ingredients", headers=headers)
    row = next(r for r in resp.json() if r["id"] == material_id)
    assert row["себестоимость 1 шт"] == 0.25
    assert row["поставщик"] == "ИП Иванов"
    assert row["INCI"] == ""  # не тронуто — не было в теле запроса

    # второй PATCH меняет только INCI, unit_cost должен остаться прежним
    client.patch(f"/api/ingredients/{material_id}", json={"inci": "Glycerin"}, headers=headers)
    resp = client.get("/api/ingredients", headers=headers)
    row = next(r for r in resp.json() if r["id"] == material_id)
    assert row["себестоимость 1 шт"] == 0.25
    assert row["INCI"] == "Glycerin"


def test_patch_rejects_foreign_material(client, db_session):
    from tests.conftest import make_company

    founder1 = make_user(db_session, login="iw4", role=FOUNDER)
    resp = client.post(
        "/api/ingredients", json={"name": "Сода2", "category": "сыпучее", "unit": "кг"}, headers=auth_headers(founder1)
    )
    material_id = resp.json()["id"]

    other_company = make_company(db_session, name="Другая мастерская")
    founder2 = make_user(db_session, login="iw5", role=FOUNDER, company_id=other_company.id)
    resp = client.patch(f"/api/ingredients/{material_id}", json={"unit_cost": 1}, headers=auth_headers(founder2))
    assert resp.status_code == 404


def test_patch_forbidden_for_worker(client, db_session):
    worker = make_user(db_session, login="iw6", role=WORKER)
    headers = auth_headers(worker)
    resp = client.post("/api/ingredients", json={"name": "Сода3", "category": "сыпучее", "unit": "кг"}, headers=headers)
    material_id = resp.json()["id"]

    resp = client.patch(f"/api/ingredients/{material_id}", json={"unit_cost": 1}, headers=headers)
    assert resp.status_code == 403


def test_expense_rejects_non_positive_qty(client, db_session):
    worker = make_user(db_session, login="iw2", role=WORKER)
    headers = auth_headers(worker)
    resp = client.post("/api/ingredients", json={"name": "Сода", "category": "сыпучее", "unit": "кг"}, headers=headers)
    material_id = resp.json()["id"]

    resp = client.post(f"/api/ingredients/{material_id}/expense", json={"qty": 0}, headers=headers)
    assert resp.status_code == 400
