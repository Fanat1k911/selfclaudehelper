from app.constants import FOUNDER, TRANSACTION_EXPENSE, TRANSACTION_INCOME
from app.costing import compute_active_lot_unit_costs, compute_product_costs
from app.models import Material, Product, Recipe, RecipeItem, Transaction
from tests.conftest import auth_headers, default_company_id, make_user


def test_cheapest_lot_used_first(db_session):
    company_id = default_company_id(db_session)
    material = Material(company_id=company_id, name="Масло", category="жидкое", unit="кг")
    db_session.add(material)
    db_session.flush()
    db_session.add_all(
        [
            Transaction(company_id=company_id, material_id=material.id, type=TRANSACTION_INCOME, qty=1, price=100),
            Transaction(company_id=company_id, material_id=material.id, type=TRANSACTION_INCOME, qty=2, price=150),
        ]
    )
    db_session.commit()

    costs = compute_active_lot_unit_costs(db_session, company_id)
    assert costs[material.id] == 100.0  # дешёвый лот ещё не тронут

    db_session.add(Transaction(company_id=company_id, material_id=material.id, type=TRANSACTION_EXPENSE, qty=1))
    db_session.commit()

    costs = compute_active_lot_unit_costs(db_session, company_id)
    assert costs[material.id] == 150.0  # дешёвый лот исчерпан, перешли на следующий


def test_freight_cost_included_in_lot_price(db_session):
    company_id = default_company_id(db_session)
    material = Material(company_id=company_id, name="Флакон", category="тара", unit="шт")
    db_session.add(material)
    db_session.flush()
    db_session.add(
        Transaction(
            company_id=company_id, material_id=material.id, type=TRANSACTION_INCOME, qty=100, price=2, freight_cost=50
        )
    )
    db_session.commit()

    costs = compute_active_lot_unit_costs(db_session, company_id)
    assert costs[material.id] == 2.5  # 2 + 50/100


def test_adjustment_does_not_affect_lots(db_session):
    from app.constants import TRANSACTION_ADJUSTMENT

    company_id = default_company_id(db_session)
    material = Material(company_id=company_id, name="Сода", category="сыпучее", unit="кг")
    db_session.add(material)
    db_session.flush()
    db_session.add_all(
        [
            Transaction(company_id=company_id, material_id=material.id, type=TRANSACTION_INCOME, qty=5, price=10),
            Transaction(company_id=company_id, material_id=material.id, type=TRANSACTION_ADJUSTMENT, qty=100),
        ]
    )
    db_session.commit()

    costs = compute_active_lot_unit_costs(db_session, company_id)
    assert costs[material.id] == 10.0  # корректировка не создала новый лот и не сбила цену


def test_product_cost_missing_when_material_has_no_price_data(db_session):
    company_id = default_company_id(db_session)
    material = Material(company_id=company_id, name="Масло без цены", category="жидкое", unit="кг")
    recipe = Recipe(company_id=company_id, name="Рецепт", category="мыло", produces="мыло", batch_yield=10.0)
    db_session.add_all([material, recipe])
    db_session.flush()
    db_session.add(RecipeItem(recipe_id=recipe.id, material_id=material.id, qty_per_batch=1.0))
    product = Product(company_id=company_id, name="Мыло", category="мыло", gtin="1", recipe_id=recipe.id)
    db_session.add(product)
    db_session.commit()

    lot_costs = compute_active_lot_unit_costs(db_session, company_id)
    batch_cost, unit_cost = compute_product_costs(db_session, company_id, product, lot_costs)
    assert batch_cost is None
    assert unit_cost is None


def test_product_cost_endpoint_reflects_recipe_and_lots(client, db_session):
    company_id = default_company_id(db_session)
    material = Material(company_id=company_id, name="Масло какао", category="жидкое", unit="кг")
    recipe = Recipe(
        company_id=company_id, name="Мыльный рецепт", category="мыло", produces="мыло", batch_yield=10.0,
        loss_percent=0,
    )
    db_session.add_all([material, recipe])
    db_session.flush()
    db_session.add(RecipeItem(recipe_id=recipe.id, material_id=material.id, qty_per_batch=2.0))
    db_session.add(
        Transaction(company_id=company_id, material_id=material.id, type=TRANSACTION_INCOME, qty=10, price=50)
    )
    product = Product(company_id=company_id, name="Мыло лаванда", category="мыло", gtin="55", recipe_id=recipe.id)
    db_session.add(product)
    db_session.commit()

    founder = make_user(db_session, login="pc1", role=FOUNDER, company_id=company_id)
    resp = client.get("/api/products", headers=auth_headers(founder))
    row = next(r for r in resp.json() if r["id"] == product.id)
    assert row["себестоимость партии"] == 100.0  # 2кг * 50₽
    assert row["себестоимость единицы"] == 10.0  # 100 / выход партии 10
