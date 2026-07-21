from app.constants import FOUNDER, WORKER
from app.models import Material, Recipe, RecipeItem
from tests.conftest import auth_headers, make_user


def test_recipe_without_items_rejected(client, db_session):
    founder = make_user(db_session, login="rf1", role=FOUNDER)
    resp = client.post(
        "/api/recipes",
        json={"name": "Пустой рецепт", "category": "мыло", "produces": "мыло", "batch_yield": 10, "items": []},
        headers=auth_headers(founder),
    )
    assert resp.status_code == 422


def test_recipe_with_items_created(client, db_session):
    founder = make_user(db_session, login="rf2", role=FOUNDER)
    material = Material(company_id=founder.company_id, name="Глицерин", category="жидкое", unit="кг")
    db_session.add(material)
    db_session.commit()
    resp = client.post(
        "/api/recipes",
        json={
            "name": "Мыло глицериновое",
            "category": "мыло",
            "produces": "мыло",
            "batch_yield": 10,
            "items": [{"material_id": material.id, "qty_per_batch": 2}],
        },
        headers=auth_headers(founder),
    )
    assert resp.status_code == 200


def test_recipe_create_rejects_out_of_range_loss_percent(client, db_session):
    founder = make_user(db_session, login="rf_loss1", role=FOUNDER)
    material = Material(company_id=founder.company_id, name="Глицерин", category="жидкое", unit="кг")
    db_session.add(material)
    db_session.commit()
    base = {
        "name": "Рецепт", "category": "мыло", "produces": "мыло", "batch_yield": 10,
        "items": [{"material_id": material.id, "qty_per_batch": 2}],
    }

    resp = client.post("/api/recipes", json={**base, "loss_percent": -1}, headers=auth_headers(founder))
    assert resp.status_code == 422

    resp = client.post("/api/recipes", json={**base, "loss_percent": 51}, headers=auth_headers(founder))
    assert resp.status_code == 422


def test_recipe_patch_rejects_out_of_range_loss_percent(client, db_session):
    founder = make_user(db_session, login="rf_loss2", role=FOUNDER)
    recipe = Recipe(company_id=founder.company_id, name="Рецепт", category="мыло", produces="мыло", batch_yield=10.0)
    db_session.add(recipe)
    db_session.commit()

    resp = client.patch(f"/api/recipes/{recipe.id}", json={"loss_percent": -50}, headers=auth_headers(founder))
    assert resp.status_code == 422

    # Отрицательный процент делает партию "бесплатной" и может даже произвести сырьё из
    # ничего (loss_factor < 0) — регрессия, которую эта валидация закрывает.
    resp = client.patch(f"/api/recipes/{recipe.id}", json={"loss_percent": -150}, headers=auth_headers(founder))
    assert resp.status_code == 422


def test_recipe_with_duplicate_material_rows_dedupes_to_last(client, db_session):
    founder = make_user(db_session, login="rf6", role=FOUNDER)
    material = Material(company_id=founder.company_id, name="Глицерин", category="жидкое", unit="кг")
    db_session.add(material)
    db_session.commit()
    resp = client.post(
        "/api/recipes",
        json={
            "name": "Мыло глицериновое",
            "category": "мыло",
            "produces": "мыло",
            "batch_yield": 10,
            "items": [
                {"material_id": material.id, "qty_per_batch": 2},
                {"material_id": material.id, "qty_per_batch": 5},
            ],
        },
        headers=auth_headers(founder),
    )
    assert resp.status_code == 200
    recipe_id = resp.json()["id"]
    items = db_session.query(RecipeItem).filter_by(recipe_id=recipe_id).all()
    assert len(items) == 1
    assert float(items[0].qty_per_batch) == 5


def test_worker_cannot_create_recipe(client, db_session):
    worker = make_user(db_session, login="rw1", role=WORKER)
    resp = client.post(
        "/api/recipes",
        json={
            "name": "Мыло",
            "category": "мыло",
            "produces": "мыло",
            "batch_yield": 10,
            "items": [{"material_id": "x", "qty_per_batch": 1}],
        },
        headers=auth_headers(worker),
    )
    assert resp.status_code == 403


def test_recipe_list_excludes_archived_by_default(client, db_session):
    founder = make_user(db_session, login="rf3", role=FOUNDER)
    active = Recipe(company_id=founder.company_id, name="Активный", category="мыло", produces="мыло", batch_yield=10.0)
    archived = Recipe(
        company_id=founder.company_id, name="Архивный", category="мыло", produces="мыло",
        batch_yield=10.0, archived=True,
    )
    db_session.add_all([active, archived])
    db_session.commit()

    resp = client.get("/api/recipes", headers=auth_headers(founder))
    names = [r["название"] for r in resp.json()]
    assert "Активный" in names
    assert "Архивный" not in names

    resp = client.get("/api/recipes", params={"archived": "true"}, headers=auth_headers(founder))
    names = [r["название"] for r in resp.json()]
    assert names == ["Архивный"]


def test_archive_recipe_toggles_and_is_role_gated(client, db_session):
    founder = make_user(db_session, login="rf4", role=FOUNDER)
    worker = make_user(db_session, login="rw2", role=WORKER)
    recipe = Recipe(company_id=founder.company_id, name="Мыло", category="мыло", produces="мыло", batch_yield=10.0)
    db_session.add(recipe)
    db_session.commit()

    resp = client.patch(
        f"/api/recipes/{recipe.id}", json={"archived": True}, headers=auth_headers(worker)
    )
    assert resp.status_code == 403

    resp = client.patch(
        f"/api/recipes/{recipe.id}", json={"archived": True}, headers=auth_headers(founder)
    )
    assert resp.status_code == 200
    db_session.refresh(recipe)
    assert recipe.archived is True

    resp = client.patch(
        f"/api/recipes/{recipe.id}", json={"archived": False}, headers=auth_headers(founder)
    )
    assert resp.status_code == 200
    db_session.refresh(recipe)
    assert recipe.archived is False


def test_archived_recipe_items_still_resolvable(client, db_session):
    founder = make_user(db_session, login="rf5", role=FOUNDER)
    material = Material(company_id=founder.company_id, name="Глицерин", category="жидкое", unit="кг")
    db_session.add(material)
    db_session.flush()
    recipe = Recipe(
        company_id=founder.company_id, name="Архивное мыло", category="мыло", produces="мыло",
        batch_yield=10.0, archived=True,
    )
    db_session.add(recipe)
    db_session.flush()
    db_session.add(RecipeItem(recipe_id=recipe.id, material_id=material.id, qty_per_batch=2.0))
    db_session.commit()

    resp = client.get(f"/api/recipes/{recipe.id}/items", headers=auth_headers(founder))
    assert resp.status_code == 200
    assert resp.json()[0]["material_id"] == material.id
