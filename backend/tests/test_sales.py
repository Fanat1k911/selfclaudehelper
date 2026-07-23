from datetime import datetime

from app.constants import FOUNDER
from app.models import PackagingLog, Product, ProductionLog, Recipe, Sale
from tests.conftest import auth_headers, default_company_id, make_user


def _make_product_with_stock(db_session, *, batches=2.0, batch_yield=10.0, defects=0.0, login="prodworker"):
    """"Готово к отгрузке" теперь считается от PackagingLog, не от ProductionLog
    (2026-07-23, переход на "рецепт → производство → упаковка → готово к отгрузке") —
    пишем оба журнала, как реальная форма "Производство" делает при packaged_qty>0."""
    company_id = default_company_id(db_session)
    recipe = Recipe(
        company_id=company_id, name="Свеча ароматическая", category="свечи", produces="свеча", batch_yield=batch_yield
    )
    db_session.add(recipe)
    db_session.flush()

    product = Product(
        company_id=company_id, name="Свеча лаванда", category="свечи", gtin="4600000000001", recipe_id=recipe.id
    )
    db_session.add(product)
    db_session.flush()

    worker = make_user(db_session, login=login, role="worker")
    db_session.add(
        ProductionLog(
            company_id=company_id,
            worker_id=worker.id,
            recipe_id=recipe.id,
            qty=batches * batch_yield,
            batches=batches,
            started_at=datetime(2026, 7, 15, 9, 0),
            finished_at=datetime(2026, 7, 15, 10, 0),
            defects=defects,
        )
    )
    db_session.add(
        PackagingLog(
            company_id=company_id,
            worker_id=worker.id,
            product_id=product.id,
            qty=batches * batch_yield,
            defects=defects,
        )
    )
    db_session.commit()
    return product


def test_sale_rejected_when_not_enough_ready(client, db_session):
    product = _make_product_with_stock(db_session, batches=1.0, batch_yield=5.0)  # ready = 5
    founder = make_user(db_session, login="f2", role=FOUNDER)

    resp = client.post(
        "/api/sales",
        json={"product_id": product.id, "qty": 10},
        headers=auth_headers(founder),
    )
    assert resp.status_code == 400
    assert "Недостаточно готового товара" in resp.json()["detail"]
    assert db_session.query(Sale).count() == 0


def test_sale_succeeds_when_enough_ready(client, db_session):
    product = _make_product_with_stock(db_session, batches=2.0, batch_yield=10.0)  # ready = 20
    founder = make_user(db_session, login="f3", role=FOUNDER)

    resp = client.post(
        "/api/sales",
        json={"product_id": product.id, "qty": 15},
        headers=auth_headers(founder),
    )
    assert resp.status_code == 200
    assert db_session.query(Sale).count() == 1


def test_sale_rejected_when_produced_but_not_packaged(client, db_session):
    """Ядро перехода 2026-07-23: изготовленное, но не упакованное — не «готово к
    отгрузке». Раньше (база = ProductionLog) эта продажа прошла бы."""
    company_id = default_company_id(db_session)
    recipe = Recipe(company_id=company_id, name="Крем", category="крем", produces="крем", batch_yield=10.0)
    db_session.add(recipe)
    db_session.flush()
    product = Product(company_id=company_id, name="Крем без упаковки", category="крем", gtin="500", recipe_id=recipe.id)
    db_session.add(product)
    db_session.flush()
    worker = make_user(db_session, login="unpacked_worker", role="worker")
    db_session.add(
        ProductionLog(
            company_id=company_id, worker_id=worker.id, recipe_id=recipe.id, qty=20, batches=2,
            started_at=datetime(2026, 7, 15, 9, 0), finished_at=datetime(2026, 7, 15, 10, 0),
        )
    )
    db_session.commit()

    founder = make_user(db_session, login="f_unpacked", role=FOUNDER)
    resp = client.post("/api/sales", json={"product_id": product.id, "qty": 1}, headers=auth_headers(founder))
    assert resp.status_code == 400
    assert "Недостаточно готового товара" in resp.json()["detail"]


def test_sale_ready_qty_follows_packaged_not_produced(client, db_session):
    """Изготовлено 20, упаковано только 15 — доступно к продаже 15, не 20."""
    company_id = default_company_id(db_session)
    recipe = Recipe(company_id=company_id, name="Свеча", category="свечи", produces="свеча", batch_yield=10.0)
    db_session.add(recipe)
    db_session.flush()
    product = Product(company_id=company_id, name="Свеча частично упакована", category="свечи", gtin="501", recipe_id=recipe.id)
    db_session.add(product)
    db_session.flush()
    worker = make_user(db_session, login="partial_pack_worker", role="worker")
    db_session.add(
        ProductionLog(
            company_id=company_id, worker_id=worker.id, recipe_id=recipe.id, qty=20, batches=2,
            started_at=datetime(2026, 7, 15, 9, 0), finished_at=datetime(2026, 7, 15, 10, 0),
        )
    )
    db_session.add(PackagingLog(company_id=company_id, worker_id=worker.id, product_id=product.id, qty=15))
    db_session.commit()

    founder = make_user(db_session, login="f_partial_pack", role=FOUNDER)
    resp = client.post("/api/sales", json={"product_id": product.id, "qty": 16}, headers=auth_headers(founder))
    assert resp.status_code == 400

    resp = client.post("/api/sales", json={"product_id": product.id, "qty": 15}, headers=auth_headers(founder))
    assert resp.status_code == 200


def test_sale_without_recipe_link_is_unrestricted(client, db_session):
    founder = make_user(db_session, login="f4", role=FOUNDER)
    product = Product(company_id=founder.company_id, name="Мыло на заказ", category="мыло", gtin="4600000000002")
    db_session.add(product)
    db_session.commit()

    resp = client.post(
        "/api/sales",
        json={"product_id": product.id, "qty": 999},
        headers=auth_headers(founder),
    )
    assert resp.status_code == 200


def test_sale_create_stores_fulfillment_fields(client, db_session):
    product = _make_product_with_stock(db_session, batches=2.0, batch_yield=10.0)  # ready = 20
    founder = make_user(db_session, login="f5", role=FOUNDER)

    resp = client.post(
        "/api/sales",
        json={
            "product_id": product.id, "qty": 5, "box_count": 3, "tape_cm": 150, "sticker_count": 6,
            "courier_cost": 500, "logist_cost": 300,
        },
        headers=auth_headers(founder),
    )
    assert resp.status_code == 200
    sale_id = resp.json()["id"]

    resp = client.get("/api/sales", headers=auth_headers(founder))
    row = next(r for r in resp.json() if r["id"] == sale_id)
    assert row["коробки"] == 3.0
    assert row["скотч_см"] == 150.0
    assert row["наклейки"] == 6.0
    assert row["трата_курьер"] == 500.0
    assert row["трата_логист"] == 300.0


def test_patch_updates_sale_partially(client, db_session):
    product = _make_product_with_stock(db_session, batches=2.0, batch_yield=10.0)  # ready = 20
    founder = make_user(db_session, login="f6", role=FOUNDER)
    resp = client.post("/api/sales", json={"product_id": product.id, "qty": 5}, headers=auth_headers(founder))
    sale_id = resp.json()["id"]

    resp = client.patch(f"/api/sales/{sale_id}", json={"box_count": 4, "comment": "поправил"}, headers=auth_headers(founder))
    assert resp.status_code == 200

    resp = client.get("/api/sales", headers=auth_headers(founder))
    row = next(r for r in resp.json() if r["id"] == sale_id)
    assert row["коробки"] == 4.0
    assert row["комментарий"] == "поправил"
    assert row["кол-во"] == 5.0  # не тронуто


def test_patch_rejects_qty_beyond_ready(client, db_session):
    product = _make_product_with_stock(db_session, batches=1.0, batch_yield=10.0)  # ready = 10
    founder = make_user(db_session, login="f7", role=FOUNDER)
    resp = client.post("/api/sales", json={"product_id": product.id, "qty": 3}, headers=auth_headers(founder))
    sale_id = resp.json()["id"]
    # Другая, не связанная продажа съедает ещё 5 — на редактируемую остаётся 10-5=5, не 10.
    client.post("/api/sales", json={"product_id": product.id, "qty": 5}, headers=auth_headers(founder))

    resp = client.patch(f"/api/sales/{sale_id}", json={"qty": 6}, headers=auth_headers(founder))
    assert resp.status_code == 400

    resp = client.patch(f"/api/sales/{sale_id}", json={"qty": 5}, headers=auth_headers(founder))
    assert resp.status_code == 200


def test_patch_cross_company_sale_is_404(client, db_session):
    from tests.conftest import make_company

    product = _make_product_with_stock(db_session, batches=2.0, batch_yield=10.0)
    founder1 = make_user(db_session, login="f8", role=FOUNDER)
    resp = client.post("/api/sales", json={"product_id": product.id, "qty": 1}, headers=auth_headers(founder1))
    sale_id = resp.json()["id"]

    other_company = make_company(db_session, name="Другая мастерская 3")
    founder2 = make_user(db_session, login="f9", role=FOUNDER, company_id=other_company.id)
    resp = client.patch(f"/api/sales/{sale_id}", json={"box_count": 1}, headers=auth_headers(founder2))
    assert resp.status_code == 404


def test_patch_rejects_repointing_to_foreign_product(client, db_session):
    from tests.conftest import make_company

    product = _make_product_with_stock(db_session, batches=2.0, batch_yield=10.0)
    founder1 = make_user(db_session, login="f10", role=FOUNDER)
    resp = client.post("/api/sales", json={"product_id": product.id, "qty": 1}, headers=auth_headers(founder1))
    sale_id = resp.json()["id"]

    other_company = make_company(db_session, name="Другая мастерская 4")
    foreign_product = Product(company_id=other_company.id, name="Чужой продукт", category="мыло", gtin="999")
    db_session.add(foreign_product)
    db_session.commit()

    resp = client.patch(
        f"/api/sales/{sale_id}", json={"product_id": foreign_product.id}, headers=auth_headers(founder1)
    )
    assert resp.status_code == 404


def test_patch_validates_new_product_stock_on_product_swap(client, db_session):
    low_stock_product = _make_product_with_stock(db_session, batches=1.0, batch_yield=2.0, login="pw_low")  # ready = 2
    high_stock_product = _make_product_with_stock(
        db_session, batches=1.0, batch_yield=50.0, login="pw_high"
    )  # ready = 50
    founder = make_user(db_session, login="f11", role=FOUNDER)
    resp = client.post(
        "/api/sales", json={"product_id": high_stock_product.id, "qty": 10}, headers=auth_headers(founder)
    )
    sale_id = resp.json()["id"]

    # Тот же qty=10, но новый продукт готов только на 2 — должно отклониться.
    resp = client.patch(
        f"/api/sales/{sale_id}", json={"product_id": low_stock_product.id}, headers=auth_headers(founder)
    )
    assert resp.status_code == 400


def test_patch_without_qty_change_skips_stock_revalidation(client, db_session):
    product = _make_product_with_stock(db_session, batches=1.0, batch_yield=5.0)  # ready = 5
    founder = make_user(db_session, login="f12", role=FOUNDER)
    resp = client.post("/api/sales", json={"product_id": product.id, "qty": 5}, headers=auth_headers(founder))
    sale_id = resp.json()["id"]
    # Полностью выбрали остаток второй, не связанной продажей того же продукта.
    client.post("/api/sales", json={"product_id": product.id, "qty": 0.0001}, headers=auth_headers(founder))

    # Не трогаем qty/product_id — правка упаковки не должна упереться в пересчёт остатка.
    resp = client.patch(f"/api/sales/{sale_id}", json={"box_count": 2}, headers=auth_headers(founder))
    assert resp.status_code == 200
