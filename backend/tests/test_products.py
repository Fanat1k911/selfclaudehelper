from app.constants import FOUNDER
from app.models import Material, Product, Recipe, RecipeItem
from tests.conftest import auth_headers, default_company_id, make_user


def test_create_product_rejects_archived_recipe(client, db_session):
    founder = make_user(db_session, login="pf1", role=FOUNDER)
    recipe = Recipe(
        company_id=founder.company_id, name="Архивный", category="мыло", produces="мыло",
        batch_yield=10.0, archived=True,
    )
    db_session.add(recipe)
    db_session.commit()

    resp = client.post(
        "/api/products",
        json={"name": "Мыло", "category": "мыло", "gtin": "123", "recipe_id": recipe.id},
        headers=auth_headers(founder),
    )
    assert resp.status_code == 400
    assert "архиве" in resp.json()["detail"]


def test_create_product_with_active_recipe_ok(client, db_session):
    founder = make_user(db_session, login="pf2", role=FOUNDER)
    recipe = Recipe(company_id=founder.company_id, name="Активный", category="мыло", produces="мыло", batch_yield=10.0)
    db_session.add(recipe)
    db_session.commit()

    resp = client.post(
        "/api/products",
        json={"name": "Мыло", "category": "мыло", "gtin": "124", "recipe_id": recipe.id},
        headers=auth_headers(founder),
    )
    assert resp.status_code == 200


def test_update_product_attaches_recipe(client, db_session):
    """Регрессия 2026-07-19: продукт без recipe_id (созданный вручную без рецепта или
    Excel-импортом) раньше нельзя было исправить — «готово к отгрузке» оставалось
    навсегда None, и продажа никогда не проверяла остаток. PATCH — единственный способ
    прикрепить рецепт к уже существующему продукту."""
    founder = make_user(db_session, login="pu1", role=FOUNDER)
    recipe = Recipe(company_id=founder.company_id, name="Крем", category="крем", produces="крем", batch_yield=10.0)
    db_session.add(recipe)
    db_session.commit()

    product = Product(company_id=founder.company_id, name="Крем без рецепта", category="крем", gtin="200")
    db_session.add(product)
    db_session.commit()

    list_resp = client.get("/api/products", headers=auth_headers(founder))
    before = next(p for p in list_resp.json() if p["id"] == product.id)
    assert before["готово к отгрузке"] is None

    resp = client.patch(
        f"/api/products/{product.id}", json={"recipe_id": recipe.id}, headers=auth_headers(founder)
    )
    assert resp.status_code == 200

    list_resp = client.get("/api/products", headers=auth_headers(founder))
    after = next(p for p in list_resp.json() if p["id"] == product.id)
    assert after["готово к отгрузке"] == 0.0


def test_update_product_rejects_archived_recipe(client, db_session):
    founder = make_user(db_session, login="pu2", role=FOUNDER)
    recipe = Recipe(
        company_id=founder.company_id, name="Архивный", category="крем", produces="крем",
        batch_yield=10.0, archived=True,
    )
    product = Product(company_id=founder.company_id, name="Крем", category="крем", gtin="201")
    db_session.add_all([recipe, product])
    db_session.commit()

    resp = client.patch(
        f"/api/products/{product.id}", json={"recipe_id": recipe.id}, headers=auth_headers(founder)
    )
    assert resp.status_code == 400
    assert "архиве" in resp.json()["detail"]


def test_update_product_rejects_clearing_required_field(client, db_session):
    founder = make_user(db_session, login="pu3", role=FOUNDER)
    product = Product(company_id=founder.company_id, name="Крем", category="крем", gtin="202")
    db_session.add(product)
    db_session.commit()

    resp = client.patch(f"/api/products/{product.id}", json={"gtin": ""}, headers=auth_headers(founder))
    assert resp.status_code == 400


def test_update_product_cross_company_404(client, db_session):
    founder = make_user(db_session, login="pu4", role=FOUNDER)
    from tests.conftest import make_company

    other = make_company(db_session, name="Other Co")
    product = Product(company_id=other.id, name="Чужой крем", category="крем", gtin="203")
    db_session.add(product)
    db_session.commit()

    resp = client.patch(f"/api/products/{product.id}", json={"category": "мыло"}, headers=auth_headers(founder))
    assert resp.status_code == 404


def test_import_commit_attaches_chosen_recipe(client, db_session):
    """Регрессия 2026-07-19: импорт из Excel раньше никогда не заполнял recipe_id —
    все импортированные продукты навсегда оставались без проверки остатка при продаже."""
    founder = make_user(db_session, login="pu5", role=FOUNDER)
    recipe = Recipe(company_id=founder.company_id, name="Скраб", category="скраб", produces="скраб", batch_yield=5.0)
    db_session.add(recipe)
    db_session.commit()

    resp = client.post(
        "/api/products/import/commit",
        json={"rows": [{"name": "Скраб тест", "category": "скраб", "gtin": "300", "recipe_id": recipe.id}]},
        headers=auth_headers(founder),
    )
    assert resp.status_code == 200
    assert resp.json()["applied"] == 1

    product = db_session.query(Product).filter_by(gtin="300", company_id=founder.company_id).one()
    assert product.recipe_id == recipe.id


def test_import_commit_ignores_recipe_from_other_company(client, db_session):
    founder = make_user(db_session, login="pu6", role=FOUNDER)
    from tests.conftest import make_company

    other = make_company(db_session, name="Other Co 2")
    foreign_recipe = Recipe(company_id=other.id, name="Чужой", category="скраб", produces="скраб", batch_yield=5.0)
    db_session.add(foreign_recipe)
    db_session.commit()

    resp = client.post(
        "/api/products/import/commit",
        json={"rows": [{"name": "Скраб", "category": "скраб", "gtin": "301", "recipe_id": foreign_recipe.id}]},
        headers=auth_headers(founder),
    )
    assert resp.status_code == 200

    product = db_session.query(Product).filter_by(gtin="301", company_id=founder.company_id).one()
    assert product.recipe_id is None


def test_inci_composition_ordered_by_qty_desc_and_skips_missing(client, db_session):
    company_id = default_company_id(db_session)
    heavy = Material(company_id=company_id, name="Вода", category="жидкое", unit="кг", inci="Aqua")
    light = Material(company_id=company_id, name="Отдушка", category="жидкое", unit="кг", inci="Parfum")
    no_inci = Material(company_id=company_id, name="Без INCI", category="жидкое", unit="кг")
    recipe = Recipe(company_id=company_id, name="Рецепт INCI", category="мыло", produces="мыло", batch_yield=10.0)
    db_session.add_all([heavy, light, no_inci, recipe])
    db_session.flush()
    db_session.add_all(
        [
            RecipeItem(recipe_id=recipe.id, material_id=light.id, qty_per_batch=1.0),
            RecipeItem(recipe_id=recipe.id, material_id=heavy.id, qty_per_batch=50.0),
            RecipeItem(recipe_id=recipe.id, material_id=no_inci.id, qty_per_batch=5.0),
        ]
    )
    product = Product(company_id=company_id, name="Продукт INCI", category="мыло", gtin="inci-1", recipe_id=recipe.id)
    db_session.add(product)
    db_session.commit()

    founder = make_user(db_session, login="pinci1", role=FOUNDER, company_id=company_id)
    resp = client.get("/api/products", headers=auth_headers(founder))
    row = next(r for r in resp.json() if r["id"] == product.id)
    assert row["состав по INCI"] == "Aqua, Parfum"


def test_inci_composition_none_without_recipe(client, db_session):
    founder = make_user(db_session, login="pinci2", role=FOUNDER)
    product = Product(company_id=founder.company_id, name="Без рецепта", category="мыло", gtin="inci-2")
    db_session.add(product)
    db_session.commit()

    resp = client.get("/api/products", headers=auth_headers(founder))
    row = next(r for r in resp.json() if r["id"] == product.id)
    assert row["состав по INCI"] is None


def test_inci_composition_none_when_no_material_has_inci(client, db_session):
    company_id = default_company_id(db_session)
    material = Material(company_id=company_id, name="Без INCI вообще", category="жидкое", unit="кг")
    recipe = Recipe(company_id=company_id, name="Рецепт без INCI", category="мыло", produces="мыло", batch_yield=10.0)
    db_session.add_all([material, recipe])
    db_session.flush()
    db_session.add(RecipeItem(recipe_id=recipe.id, material_id=material.id, qty_per_batch=1.0))
    product = Product(company_id=company_id, name="Продукт без INCI", category="мыло", gtin="inci-3", recipe_id=recipe.id)
    db_session.add(product)
    db_session.commit()

    founder = make_user(db_session, login="pinci3", role=FOUNDER, company_id=company_id)
    resp = client.get("/api/products", headers=auth_headers(founder))
    row = next(r for r in resp.json() if r["id"] == product.id)
    assert row["состав по INCI"] is None
