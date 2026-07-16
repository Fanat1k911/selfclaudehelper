from app.constants import FOUNDER
from app.models import Recipe
from tests.conftest import auth_headers, make_user


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
