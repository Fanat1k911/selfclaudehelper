from app.constants import FOUNDER, WORKER
from tests.conftest import auth_headers, make_user


def test_worker_actions_endpoint_requires_management_role(client, db_session):
    worker = make_user(db_session, login="txw1", role=WORKER)
    resp = client.get("/api/ingredients/transactions", headers=auth_headers(worker))
    assert resp.status_code == 403


def test_worker_actions_endpoint_filters_by_worker_id(client, db_session):
    founder = make_user(db_session, login="txw2f", role=FOUNDER)
    w1 = make_user(db_session, login="txw2a", role=WORKER, company_id=founder.company_id)
    w2 = make_user(db_session, login="txw2b", role=WORKER, company_id=founder.company_id)

    resp = client.post("/api/ingredients", json={"name": "М1", "category": "жидкое", "unit": "г"}, headers=auth_headers(w1))
    m1 = resp.json()["id"]
    client.post(f"/api/ingredients/{m1}/income", json={"qty": 5}, headers=auth_headers(w1))

    resp = client.post("/api/ingredients", json={"name": "М2", "category": "жидкое", "unit": "г"}, headers=auth_headers(w2))
    m2 = resp.json()["id"]
    client.post(f"/api/ingredients/{m2}/income", json={"qty": 7}, headers=auth_headers(w2))

    resp = client.get(f"/api/ingredients/transactions?worker_id={w1.id}", headers=auth_headers(founder))
    rows = resp.json()
    assert len(rows) == 1
    assert rows[0]["название"] == "М1"
    assert rows[0]["время"].endswith("Z")


def test_worker_actions_endpoint_covers_income_expense_adjustment_and_batch(client, db_session):
    founder = make_user(db_session, login="txw3f", role=FOUNDER)
    worker = make_user(db_session, login="txw3a", role=WORKER, company_id=founder.company_id)
    headers = auth_headers(worker)

    resp = client.post("/api/ingredients", json={"name": "Ш1", "category": "жидкое", "unit": "г"}, headers=headers)
    m1 = resp.json()["id"]
    resp = client.post("/api/ingredients", json={"name": "Ш2", "category": "жидкое", "unit": "г"}, headers=headers)
    m2 = resp.json()["id"]

    client.post(f"/api/ingredients/{m1}/income", json={"qty": 5}, headers=headers)
    client.post(f"/api/ingredients/{m1}/expense", json={"qty": 1}, headers=headers)
    client.post(f"/api/ingredients/{m1}/adjustment", json={"actual_qty": 2}, headers=headers)
    client.post(
        "/api/ingredients/income/batch",
        json={"items": [{"material_id": m2, "qty": 3}], "transport_cost": 0},
        headers=headers,
    )

    resp = client.get(f"/api/ingredients/transactions?worker_id={worker.id}", headers=auth_headers(founder))
    rows = resp.json()
    # начальный остаток (initial_qty=0 по умолчанию не создаёт транзакцию) + 4 действия выше
    assert len(rows) == 4
    assert {r["тип"] for r in rows} == {"приход", "расход", "корректировка"}


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


def test_archive_hides_material_from_default_list_and_low_stock(client, db_session):
    founder = make_user(db_session, login="iw16", role=FOUNDER)
    headers = auth_headers(founder)
    resp = client.post(
        "/api/ingredients", json={"name": "Старый воск", "category": "тара", "unit": "кг", "min_stock": 10},
        headers=headers,
    )
    material_id = resp.json()["id"]

    resp = client.patch(f"/api/ingredients/{material_id}", json={"archived": True}, headers=headers)
    assert resp.status_code == 200

    active = client.get("/api/ingredients", headers=headers).json()
    assert all(r["id"] != material_id for r in active)

    archived = client.get("/api/ingredients?archived=true", headers=headers).json()
    row = next(r for r in archived if r["id"] == material_id)
    assert row["архив"] is True

    dashboard_low_stock = client.get("/api/dashboard", headers=headers).json()["ниже_минимума"]
    assert all(r["id"] != material_id for r in dashboard_low_stock)


def test_archive_forbidden_for_worker(client, db_session):
    founder = make_user(db_session, login="iw17f", role=FOUNDER)
    resp = client.post("/api/ingredients", json={"name": "Тест", "category": "тара", "unit": "шт"}, headers=auth_headers(founder))
    material_id = resp.json()["id"]

    worker = make_user(db_session, login="iw17w", role=WORKER, company_id=founder.company_id)
    resp = client.patch(f"/api/ingredients/{material_id}", json={"archived": True}, headers=auth_headers(worker))
    assert resp.status_code == 403


def test_categories_returns_defaults_and_custom(client, db_session):
    worker = make_user(db_session, login="iw15", role=WORKER)
    headers = auth_headers(worker)
    client.post("/api/ingredients", json={"name": "Штука", "category": "воск", "unit": "кг"}, headers=headers)

    resp = client.get("/api/ingredients/categories", headers=headers)
    assert resp.status_code == 200
    cats = resp.json()
    assert set(cats) == {"тара", "косм", "свеч", "воск"}


def test_patch_updates_purchase_attrs_partially(client, db_session):
    founder = make_user(db_session, login="iw3", role=FOUNDER)
    headers = auth_headers(founder)
    resp = client.post("/api/ingredients", json={"name": "Глицерин", "category": "жидкое", "unit": "г"}, headers=headers)
    material_id = resp.json()["id"]

    resp = client.patch(
        f"/api/ingredients/{material_id}",
        json={"supplier": "ИП Иванов"},
        headers=headers,
    )
    assert resp.status_code == 200

    resp = client.get("/api/ingredients", headers=headers)
    row = next(r for r in resp.json() if r["id"] == material_id)
    assert row["поставщик"] == "ИП Иванов"
    assert row["INCI"] == ""  # не тронуто — не было в теле запроса

    # второй PATCH меняет только INCI, поставщик должен остаться прежним
    client.patch(f"/api/ingredients/{material_id}", json={"inci": "Glycerin"}, headers=headers)
    resp = client.get("/api/ingredients", headers=headers)
    row = next(r for r in resp.json() if r["id"] == material_id)
    assert row["поставщик"] == "ИП Иванов"
    assert row["INCI"] == "Glycerin"


def test_worker_does_not_see_cost_founder_does(client, db_session):
    """Себестоимость — финансовые данные (CLAUDE.md, "Роли и права"): Worker не должен
    видеть её в списке компонентов, хотя сама запись — общая для всей компании."""
    founder = make_user(db_session, login="iw3c", role=FOUNDER)
    resp = client.post(
        "/api/ingredients", json={"name": "Масло", "category": "жидкое", "unit": "г"}, headers=auth_headers(founder)
    )
    material_id = resp.json()["id"]
    client.post(
        f"/api/ingredients/{material_id}/income", json={"qty": 10, "price": 0.5}, headers=auth_headers(founder)
    )

    worker = make_user(db_session, login="iw3d", role=WORKER, company_id=founder.company_id)
    resp = client.get("/api/ingredients", headers=auth_headers(worker))
    row = next(r for r in resp.json() if r["id"] == material_id)
    assert row["себестоимость 1 шт"] is None

    resp = client.get("/api/ingredients", headers=auth_headers(founder))
    row = next(r for r in resp.json() if r["id"] == material_id)
    assert row["себестоимость 1 шт"] == 0.5


def test_patch_renames_material(client, db_session):
    founder = make_user(db_session, login="iw3b", role=FOUNDER)
    headers = auth_headers(founder)
    resp = client.post("/api/ingredients", json={"name": "Опечатка", "category": "косм", "unit": "г"}, headers=headers)
    material_id = resp.json()["id"]

    resp = client.patch(f"/api/ingredients/{material_id}", json={"name": "Исправлено"}, headers=headers)
    assert resp.status_code == 200

    resp = client.get("/api/ingredients", headers=headers)
    row = next(r for r in resp.json() if r["id"] == material_id)
    assert row["название"] == "Исправлено"


def test_create_and_patch_packaging_fields(client, db_session):
    """2026-07-23: тара (category="тара") получает типовые поля по подкатегории —
    короб/флакон/наклейка/лента, см. PACKAGING_TYPES в constants.py."""
    founder = make_user(db_session, login="iw3c", role=FOUNDER)
    headers = auth_headers(founder)
    resp = client.post(
        "/api/ingredients",
        json={
            "name": "Короб крафт 100х100х60",
            "category": "тара",
            "unit": "шт",
            "packaging_type": "короб",
            "length_mm": 100,
            "width_mm": 100,
            "height_mm": 60,
        },
        headers=headers,
    )
    assert resp.status_code == 200
    material_id = resp.json()["id"]

    resp = client.get("/api/ingredients", headers=headers)
    row = next(r for r in resp.json() if r["id"] == material_id)
    assert row["тип тары"] == "короб"
    assert row["длина, мм"] == 100.0
    assert row["ширина, мм"] == 100.0
    assert row["высота, мм"] == 60.0
    assert row["объём, мл"] is None

    resp = client.patch(f"/api/ingredients/{material_id}", json={"height_mm": 70}, headers=headers)
    assert resp.status_code == 200
    resp = client.get("/api/ingredients", headers=headers)
    row = next(r for r in resp.json() if r["id"] == material_id)
    assert row["высота, мм"] == 70.0
    assert row["длина, мм"] == 100.0  # не тронуто


def test_patch_rejects_foreign_material(client, db_session):
    from tests.conftest import make_company

    founder1 = make_user(db_session, login="iw4", role=FOUNDER)
    resp = client.post(
        "/api/ingredients", json={"name": "Сода2", "category": "сыпучее", "unit": "кг"}, headers=auth_headers(founder1)
    )
    material_id = resp.json()["id"]

    other_company = make_company(db_session, name="Другая мастерская")
    founder2 = make_user(db_session, login="iw5", role=FOUNDER, company_id=other_company.id)
    resp = client.patch(f"/api/ingredients/{material_id}", json={"supplier": "x"}, headers=auth_headers(founder2))
    assert resp.status_code == 404


def test_patch_forbidden_for_worker(client, db_session):
    worker = make_user(db_session, login="iw6", role=WORKER)
    headers = auth_headers(worker)
    resp = client.post("/api/ingredients", json={"name": "Сода3", "category": "сыпучее", "unit": "кг"}, headers=headers)
    material_id = resp.json()["id"]

    resp = client.patch(f"/api/ingredients/{material_id}", json={"supplier": "x"}, headers=headers)
    assert resp.status_code == 403


def test_expense_rejects_non_positive_qty(client, db_session):
    worker = make_user(db_session, login="iw2", role=WORKER)
    headers = auth_headers(worker)
    resp = client.post("/api/ingredients", json={"name": "Сода", "category": "сыпучее", "unit": "кг"}, headers=headers)
    material_id = resp.json()["id"]

    resp = client.post(f"/api/ingredients/{material_id}/expense", json={"qty": 0}, headers=headers)
    assert resp.status_code == 400
