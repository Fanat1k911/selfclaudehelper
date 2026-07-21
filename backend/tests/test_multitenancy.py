"""Изоляция данных между компаниями (мультитенантность, см. CLAUDE.md). Утечка
данных между компаниями через забытый фильтр company_id — критический баг, эти
тесты покрывают каждый тип ресурса отдельно."""

from datetime import datetime

from app.constants import FOUNDER, WORKER
from app.models import Counterparty, EquipmentItem, Material, PackagingLog, Product, ProductionLog, Recipe
from tests.conftest import auth_headers, make_company, make_user


def _two_companies(db_session):
    company_a = make_company(db_session, name="Мастерская А")
    company_b = make_company(db_session, name="Мастерская Б")
    founder_a = make_user(db_session, login="mtf_a", role=FOUNDER, company_id=company_a.id)
    founder_b = make_user(db_session, login="mtf_b", role=FOUNDER, company_id=company_b.id)
    return company_a, company_b, founder_a, founder_b


def test_materials_isolated_between_companies(client, db_session):
    company_a, company_b, founder_a, founder_b = _two_companies(db_session)
    material_a = Material(company_id=company_a.id, name="Сырьё А", category="жидкое", unit="кг")
    db_session.add(material_a)
    db_session.commit()

    resp_b = client.get("/api/ingredients", headers=auth_headers(founder_b))
    assert all(m["id"] != material_a.id for m in resp_b.json())

    resp_a = client.get("/api/ingredients", headers=auth_headers(founder_a))
    assert any(m["id"] == material_a.id for m in resp_a.json())

    # Прямой доступ по id чужого материала — 404, не 403 (не подтверждаем существование).
    resp = client.post(
        f"/api/ingredients/{material_a.id}/income", json={"qty": 5}, headers=auth_headers(founder_b)
    )
    assert resp.status_code == 404

    # Групповой приход — та же проверка на каждую строку, чужой материал в списке тоже 404.
    resp = client.post(
        "/api/ingredients/income/batch",
        json={"items": [{"material_id": material_a.id, "qty": 5}], "transport_cost": 10},
        headers=auth_headers(founder_b),
    )
    assert resp.status_code == 404


def test_recalc_min_stock_only_touches_own_company(client, db_session):
    company_a, company_b, founder_a, founder_b = _two_companies(db_session)
    material_a = Material(
        company_id=company_a.id, name="Сырьё А", category="жидкое", unit="кг", min_purchase_batch_qty=10
    )
    db_session.add(material_a)
    db_session.commit()

    resp = client.post("/api/ingredients/recalc-min-stock", headers=auth_headers(founder_b))
    assert resp.json() == {"updated": 0}

    db_session.refresh(material_a)
    assert float(material_a.min_stock) == 0  # компания B не должна была задеть чужой материал


def test_equipment_isolated_between_companies(client, db_session):
    company_a, company_b, founder_a, founder_b = _two_companies(db_session)
    item_a = EquipmentItem(company_id=company_a.id, name="Миксер А", unit="шт")
    db_session.add(item_a)
    db_session.commit()

    resp_b = client.get("/api/equipment", headers=auth_headers(founder_b))
    assert all(i["id"] != item_a.id for i in resp_b.json())

    resp_a = client.get("/api/equipment", headers=auth_headers(founder_a))
    assert any(i["id"] == item_a.id for i in resp_a.json())

    # Прямой доступ по id чужого инвентаря — 404, не 403.
    resp = client.post(f"/api/equipment/{item_a.id}/income", json={"qty": 1}, headers=auth_headers(founder_b))
    assert resp.status_code == 404
    resp = client.post(f"/api/equipment/{item_a.id}/broken", json={"qty": 1}, headers=auth_headers(founder_b))
    assert resp.status_code == 404
    resp = client.post(f"/api/equipment/{item_a.id}/lost", json={"qty": 1}, headers=auth_headers(founder_b))
    assert resp.status_code == 404
    resp = client.post(
        f"/api/equipment/{item_a.id}/adjustment", json={"actual_qty": 5}, headers=auth_headers(founder_b)
    )
    assert resp.status_code == 404
    resp = client.get(f"/api/equipment/{item_a.id}/transactions", headers=auth_headers(founder_b))
    assert resp.status_code == 404


def test_recipes_isolated_between_companies(client, db_session):
    company_a, company_b, founder_a, founder_b = _two_companies(db_session)
    recipe_a = Recipe(company_id=company_a.id, name="Рецепт А", category="мыло", produces="мыло", batch_yield=10.0)
    db_session.add(recipe_a)
    db_session.commit()

    resp_b = client.get("/api/recipes", headers=auth_headers(founder_b))
    assert all(r["id"] != recipe_a.id for r in resp_b.json())

    resp = client.get(f"/api/recipes/{recipe_a.id}/items", headers=auth_headers(founder_b))
    assert resp.status_code == 404

    resp = client.patch(f"/api/recipes/{recipe_a.id}", json={"archived": True}, headers=auth_headers(founder_b))
    assert resp.status_code == 404


def test_products_isolated_between_companies(client, db_session):
    company_a, company_b, founder_a, founder_b = _two_companies(db_session)
    product_a = Product(company_id=company_a.id, name="Продукт А", category="мыло", gtin="111")
    db_session.add(product_a)
    db_session.commit()

    resp_b = client.get("/api/products", headers=auth_headers(founder_b))
    assert all(p["id"] != product_a.id for p in resp_b.json())


def test_sales_rejects_other_companys_product(client, db_session):
    company_a, company_b, founder_a, founder_b = _two_companies(db_session)
    product_a = Product(company_id=company_a.id, name="Продукт А", category="мыло", gtin="222")
    db_session.add(product_a)
    db_session.commit()

    resp = client.post(
        "/api/sales", json={"product_id": product_a.id, "qty": 1}, headers=auth_headers(founder_b)
    )
    assert resp.status_code == 404


def test_sales_patch_rejects_other_companys_sale(client, db_session):
    from app.models import Sale

    company_a, company_b, founder_a, founder_b = _two_companies(db_session)
    product_a = Product(company_id=company_a.id, name="Продукт А2", category="мыло", gtin="223")
    db_session.add(product_a)
    db_session.flush()
    sale_a = Sale(company_id=company_a.id, product_id=product_a.id, qty=1)
    db_session.add(sale_a)
    db_session.commit()

    resp = client.patch(f"/api/sales/{sale_a.id}", json={"box_count": 1}, headers=auth_headers(founder_b))
    assert resp.status_code == 404


def test_counterparties_isolated_between_companies(client, db_session):
    company_a, company_b, founder_a, founder_b = _two_companies(db_session)
    cp_a = Counterparty(company_id=company_a.id, name="Контрагент А")
    db_session.add(cp_a)
    db_session.commit()

    resp_b = client.get("/api/counterparties", headers=auth_headers(founder_b))
    assert all(c["id"] != cp_a.id for c in resp_b.json())

    resp = client.patch(f"/api/counterparties/{cp_a.id}", json={"name": "Хакнуто"}, headers=auth_headers(founder_b))
    assert resp.status_code == 404


def test_users_isolated_between_companies(client, db_session):
    company_a, company_b, founder_a, founder_b = _two_companies(db_session)
    worker_a = make_user(db_session, login="mtw_a", role=WORKER, company_id=company_a.id)

    resp_b = client.get("/api/users", headers=auth_headers(founder_b))
    logins_b = [u["login"] for u in resp_b.json()]
    assert worker_a.login not in logins_b
    assert founder_a.login not in logins_b

    resp = client.post(
        f"/api/users/{worker_a.id}/reset-password", json={"new_password": "hacked123"},
        headers=auth_headers(founder_b),
    )
    assert resp.status_code == 404

    resp = client.patch(f"/api/users/{worker_a.id}", json={"fio": "Хакнуто"}, headers=auth_headers(founder_b))
    assert resp.status_code == 404


def test_login_log_isolated_between_companies(client, db_session):
    company_a, company_b, founder_a, founder_b = _two_companies(db_session)
    client.post("/api/auth/login", json={"login": founder_a.login, "password": "pass1234"})

    resp_b = client.get("/api/auth/log", headers=auth_headers(founder_b))
    logins_b = [entry["логин"] for entry in resp_b.json()]
    assert founder_a.login not in logins_b


def test_dashboard_widget_layout_isolated_between_companies(client, db_session):
    """Регрессия на конкретный баг: сохранение раскладки компании Б раньше стирало
    ВСЮ таблицу dashboard_widget_layout (DELETE без company_id), затирая компанию А."""
    company_a, company_b, founder_a, founder_b = _two_companies(db_session)

    client.put(
        "/api/dashboard/widgets/layout",
        json=[{"widget_key": "low_stock", "x": 0, "y": 0, "w": 4, "h": 5}],
        headers=auth_headers(founder_a),
    )
    client.put(
        "/api/dashboard/widgets/layout",
        json=[{"widget_key": "monthly_spend", "x": 0, "y": 0, "w": 8, "h": 6}],
        headers=auth_headers(founder_b),
    )

    resp_a = client.get("/api/dashboard/widgets/layout", headers=auth_headers(founder_a))
    keys_a = [row["widget_key"] for row in resp_a.json()]
    assert keys_a == ["low_stock"]

    resp_b = client.get("/api/dashboard/widgets/layout", headers=auth_headers(founder_b))
    keys_b = [row["widget_key"] for row in resp_b.json()]
    assert keys_b == ["monthly_spend"]


def test_production_log_isolated_between_companies(client, db_session):
    company_a, company_b, founder_a, founder_b = _two_companies(db_session)
    worker_a = make_user(db_session, login="mtpw_a", role=WORKER, company_id=company_a.id)
    recipe_a = Recipe(company_id=company_a.id, name="Рецепт А", category="мыло", produces="мыло", batch_yield=10.0)
    db_session.add(recipe_a)
    db_session.flush()
    db_session.add(
        ProductionLog(
            company_id=company_a.id, worker_id=worker_a.id, recipe_id=recipe_a.id, qty=10, batches=1,
            started_at=datetime(2026, 7, 1, 9), finished_at=datetime(2026, 7, 1, 10),
        )
    )
    db_session.commit()

    resp_b = client.get("/api/production", headers=auth_headers(founder_b))
    assert resp_b.json() == []

    resp = client.post(
        "/api/production",
        json={"recipe_id": recipe_a.id, "qty": 10},
        headers=auth_headers(founder_b),
    )
    assert resp.status_code == 404


def test_packaging_log_isolated_between_companies(client, db_session):
    company_a, company_b, founder_a, founder_b = _two_companies(db_session)
    worker_a = make_user(db_session, login="mtpkw_a", role=WORKER, company_id=company_a.id)
    product_a = Product(company_id=company_a.id, name="Продукт А", category="мыло", gtin="333")
    db_session.add(product_a)
    db_session.flush()
    db_session.add(PackagingLog(company_id=company_a.id, worker_id=worker_a.id, product_id=product_a.id, qty=1))
    db_session.commit()

    resp_b = client.get("/api/packaging", headers=auth_headers(founder_b))
    assert resp_b.json() == []

    resp = client.post(
        "/api/packaging", json={"product_id": product_a.id, "qty": 1}, headers=auth_headers(founder_b)
    )
    assert resp.status_code == 404


def test_dashboard_widget_data_isolated_between_companies(client, db_session):
    company_a, company_b, founder_a, founder_b = _two_companies(db_session)
    material_a = Material(company_id=company_a.id, name="Только А", category="жидкое", unit="кг", min_stock=100)
    db_session.add(material_a)
    db_session.commit()

    resp_a = client.get("/api/dashboard/widgets/low_stock/data", headers=auth_headers(founder_a))
    assert any(row["название"] == "Только А" for row in resp_a.json())

    resp_b = client.get("/api/dashboard/widgets/low_stock/data", headers=auth_headers(founder_b))
    assert all(row["название"] != "Только А" for row in resp_b.json())
