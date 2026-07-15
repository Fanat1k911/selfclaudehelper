from app.constants import FOUNDER, TRANSACTION_INCOME, WORKER
from app.models import Material, Product, Recipe, RecipeItem, Transaction
from tests.conftest import auth_headers, make_user


def _make_recipe_with_material(db_session, *, qty_per_batch=2.0, batch_yield=10.0):
    material = Material(name="Масло кокосовое", category="жидкое", unit="кг", min_stock=1.0)
    db_session.add(material)
    db_session.flush()

    recipe = Recipe(name="Мыло базовое", category="мыло", produces="мыло", batch_yield=batch_yield)
    db_session.add(recipe)
    db_session.flush()

    db_session.add(RecipeItem(recipe_id=recipe.id, material_id=material.id, qty_per_batch=qty_per_batch))
    db_session.commit()
    return material, recipe


def test_production_rejected_when_stock_insufficient(client, db_session):
    material, recipe = _make_recipe_with_material(db_session, qty_per_batch=5.0)
    db_session.add(Transaction(material_id=material.id, type=TRANSACTION_INCOME, qty=3.0))
    db_session.commit()

    worker = make_user(db_session, login="w1", role=WORKER)
    resp = client.post(
        "/api/production",
        json={
            "recipe_id": recipe.id,
            "batches": 1,
            "started_at": "2026-07-15T09:00:00",
            "finished_at": "2026-07-15T10:00:00",
        },
        headers=auth_headers(worker),
    )
    assert resp.status_code == 400
    assert "Недостаточно сырья" in resp.json()["detail"]

    # Ни одной транзакции списания не должно было создаться.
    assert db_session.query(Transaction).count() == 1


def test_production_succeeds_when_stock_sufficient(client, db_session):
    material, recipe = _make_recipe_with_material(db_session, qty_per_batch=5.0)
    db_session.add(Transaction(material_id=material.id, type=TRANSACTION_INCOME, qty=10.0))
    db_session.commit()

    worker = make_user(db_session, login="w2", role=WORKER)
    resp = client.post(
        "/api/production",
        json={
            "recipe_id": recipe.id,
            "batches": 1,
            "started_at": "2026-07-15T09:00:00",
            "finished_at": "2026-07-15T10:00:00",
        },
        headers=auth_headers(worker),
    )
    assert resp.status_code == 200

    balances = {}
    for tx in db_session.query(Transaction).all():
        sign = 1 if tx.type == TRANSACTION_INCOME else -1
        balances[tx.material_id] = balances.get(tx.material_id, 0.0) + float(tx.qty) * sign
    assert balances[material.id] == 5.0


def test_production_worker_sees_only_own_log(client, db_session):
    _, recipe = _make_recipe_with_material(db_session)
    w1 = make_user(db_session, login="w3", role=WORKER)
    w2 = make_user(db_session, login="w4", role=WORKER)
    founder = make_user(db_session, login="f1", role=FOUNDER)

    for worker, material_qty in ((w1, 100.0), (w2, 100.0)):
        m = Material(name=f"сырьё {worker.id}", category="жидкое", unit="кг")
        db_session.add(m)
        db_session.flush()
        r = Recipe(name=f"рецепт {worker.id}", category="мыло", produces="мыло", batch_yield=1.0)
        db_session.add(r)
        db_session.flush()
        db_session.add(RecipeItem(recipe_id=r.id, material_id=m.id, qty_per_batch=1.0))
        db_session.add(Transaction(material_id=m.id, type=TRANSACTION_INCOME, qty=material_qty))
        db_session.commit()
        client.post(
            "/api/production",
            json={
                "recipe_id": r.id,
                "batches": 1,
                "started_at": "2026-07-15T09:00:00",
                "finished_at": "2026-07-15T10:00:00",
            },
            headers=auth_headers(worker),
        )

    resp = client.get("/api/production", headers=auth_headers(w1))
    assert resp.status_code == 200
    assert all(entry["worker_id"] == w1.id for entry in resp.json())

    resp = client.get("/api/production", headers=auth_headers(founder))
    assert len(resp.json()) == 2


def test_production_rejected_for_archived_recipe(client, db_session):
    material, recipe = _make_recipe_with_material(db_session, qty_per_batch=1.0)
    recipe.archived = True
    db_session.add(Transaction(material_id=material.id, type=TRANSACTION_INCOME, qty=10.0))
    db_session.commit()

    worker = make_user(db_session, login="w5", role=WORKER)
    resp = client.post(
        "/api/production",
        json={
            "recipe_id": recipe.id,
            "batches": 1,
            "started_at": "2026-07-15T09:00:00",
            "finished_at": "2026-07-15T10:00:00",
        },
        headers=auth_headers(worker),
    )
    assert resp.status_code == 400
    assert "архиве" in resp.json()["detail"]


def test_production_recipes_list_excludes_archived(client, db_session):
    _, recipe = _make_recipe_with_material(db_session)
    recipe.archived = True
    db_session.commit()

    worker = make_user(db_session, login="w6", role=WORKER)
    resp = client.get("/api/production/recipes", headers=auth_headers(worker))
    assert resp.json() == []


def test_production_products_list_only_producible(client, db_session):
    material, recipe = _make_recipe_with_material(db_session)
    archived_material, archived_recipe = _make_recipe_with_material(db_session)
    archived_recipe.archived = True
    db_session.commit()

    ready_product = Product(name="Мыло готовое", category="мыло", gtin="1", recipe_id=recipe.id)
    archived_product = Product(name="Мыло архивное", category="мыло", gtin="2", recipe_id=archived_recipe.id)
    no_recipe_product = Product(name="Без рецепта", category="мыло", gtin="3")
    db_session.add_all([ready_product, archived_product, no_recipe_product])
    db_session.commit()

    worker = make_user(db_session, login="w7", role=WORKER)
    resp = client.get("/api/production/products", headers=auth_headers(worker))
    names = [p["название"] for p in resp.json()]
    assert names == ["Мыло готовое"]
