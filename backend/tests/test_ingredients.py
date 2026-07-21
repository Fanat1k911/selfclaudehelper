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


def test_batch_income_splits_freight_by_weight(client, db_session):
    worker = make_user(db_session, login="iw10", role=WORKER)
    headers = auth_headers(worker)

    # Флакон: мин.партия 100 шт весом 5 кг -> 0.05 кг/шт. Масло: мин.партия 10 кг весом 10 кг -> 1 кг/кг.
    r1 = client.post("/api/ingredients", json={"name": "Флакон", "category": "тара", "unit": "шт"}, headers=headers)
    material_a = r1.json()["id"]
    client.patch(
        f"/api/ingredients/{material_a}",
        json={"min_purchase_batch_qty": 100, "min_purchase_batch_weight": 5},
        headers=auth_headers(make_user(db_session, login="iw10f", role=FOUNDER, company_id=worker.company_id)),
    )
    r2 = client.post("/api/ingredients", json={"name": "Масло", "category": "жидкое", "unit": "кг"}, headers=headers)
    material_b = r2.json()["id"]
    client.patch(
        f"/api/ingredients/{material_b}",
        json={"min_purchase_batch_qty": 10, "min_purchase_batch_weight": 10},
        headers=auth_headers(make_user(db_session, login="iw10f2", role=FOUNDER, company_id=worker.company_id)),
    )

    # Поставка: 100 флаконов (100*0.05=5кг) + 5кг масла (5*1=5кг) -> вес поровну -> доставка 100 делится 50/50.
    resp = client.post(
        "/api/ingredients/income/batch",
        json={
            "items": [
                {"material_id": material_a, "qty": 100, "price": 2},
                {"material_id": material_b, "qty": 5, "price": 20},
            ],
            "transport_cost": 100,
        },
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json() == {"ok": True, "created": 2}

    txs_a = client.get(f"/api/ingredients/{material_a}/transactions", headers=headers).json()
    txs_b = client.get(f"/api/ingredients/{material_b}/transactions", headers=headers).json()
    assert txs_a[0]["транспортные расходы"] == 50.0
    assert txs_b[0]["транспортные расходы"] == 50.0


def test_batch_income_rejects_duplicate_material(client, db_session):
    worker = make_user(db_session, login="iw11", role=WORKER)
    headers = auth_headers(worker)
    resp = client.post("/api/ingredients", json={"name": "Сода", "category": "сыпучее", "unit": "кг"}, headers=headers)
    material_id = resp.json()["id"]

    resp = client.post(
        "/api/ingredients/income/batch",
        json={"items": [{"material_id": material_id, "qty": 1}, {"material_id": material_id, "qty": 2}]},
        headers=headers,
    )
    assert resp.status_code == 400


def test_batch_income_rejects_empty_items(client, db_session):
    worker = make_user(db_session, login="iw12", role=WORKER)
    resp = client.post("/api/ingredients/income/batch", json={"items": []}, headers=auth_headers(worker))
    assert resp.status_code == 400


def test_recalc_min_stock_sets_half_of_batch_qty(client, db_session):
    founder = make_user(db_session, login="iw13", role=FOUNDER)
    headers = auth_headers(founder)
    resp = client.post("/api/ingredients", json={"name": "Флакон", "category": "тара", "unit": "шт"}, headers=headers)
    material_id = resp.json()["id"]
    client.patch(f"/api/ingredients/{material_id}", json={"min_purchase_batch_qty": 100}, headers=headers)
    # Без мин.партии — не трогаем, остаётся как было.
    resp2 = client.post("/api/ingredients", json={"name": "Без партии", "category": "тара", "unit": "шт"}, headers=headers)
    other_id = resp2.json()["id"]

    resp = client.post("/api/ingredients/recalc-min-stock", headers=headers)
    assert resp.status_code == 200
    assert resp.json() == {"updated": 1}

    rows = {r["id"]: r for r in client.get("/api/ingredients", headers=headers).json()}
    assert rows[material_id]["мин.остаток"] == 50.0
    assert rows[other_id]["мин.остаток"] == 0.0


def test_recalc_min_stock_forbidden_for_worker(client, db_session):
    worker = make_user(db_session, login="iw14", role=WORKER)
    resp = client.post("/api/ingredients/recalc-min-stock", headers=auth_headers(worker))
    assert resp.status_code == 403


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
