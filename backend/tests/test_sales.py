from datetime import datetime

from app.constants import FOUNDER
from app.models import Product, ProductionLog, Recipe, Sale
from tests.conftest import auth_headers, default_company_id, make_user


def _make_product_with_stock(db_session, *, batches=2.0, batch_yield=10.0, defects=0.0):
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

    worker = make_user(db_session, login="prodworker", role="worker")
    db_session.add(
        ProductionLog(
            company_id=company_id,
            worker_id=worker.id,
            recipe_id=recipe.id,
            batches=batches,
            started_at=datetime(2026, 7, 15, 9, 0),
            finished_at=datetime(2026, 7, 15, 10, 0),
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
