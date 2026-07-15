from app.constants import WORKER
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


def test_expense_rejects_non_positive_qty(client, db_session):
    worker = make_user(db_session, login="iw2", role=WORKER)
    headers = auth_headers(worker)
    resp = client.post("/api/ingredients", json={"name": "Сода", "category": "сыпучее", "unit": "кг"}, headers=headers)
    material_id = resp.json()["id"]

    resp = client.post(f"/api/ingredients/{material_id}/expense", json={"qty": 0}, headers=headers)
    assert resp.status_code == 400
