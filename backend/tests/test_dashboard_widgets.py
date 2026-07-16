from datetime import date, datetime

from app.constants import FOUNDER, WORKER
from app.models import Counterparty, Material, Product, ProductionLog, Recipe, Sale
from tests.conftest import auth_headers, default_company_id, make_user


def test_widget_catalog_lists_all_keys(client, db_session):
    founder = make_user(db_session, login="wc1", role=FOUNDER)
    resp = client.get("/api/dashboard/widgets/catalog", headers=auth_headers(founder))
    assert resp.status_code == 200
    keys = {w["key"] for w in resp.json()}
    assert keys == {
        "low_stock", "recent_transactions", "top_expense_materials", "monthly_spend",
        "kpi_by_worker", "top_products", "production_leaderboard", "monthly_revenue",
        "top_counterparties", "defect_rate", "stock_by_category",
    }


def test_layout_save_and_load_roundtrip(client, db_session):
    founder = make_user(db_session, login="wl1", role=FOUNDER)
    layout = [
        {"widget_key": "low_stock", "x": 0, "y": 0, "w": 4, "h": 5},
        {"widget_key": "monthly_spend", "x": 4, "y": 0, "w": 8, "h": 6},
    ]
    resp = client.put("/api/dashboard/widgets/layout", json=layout, headers=auth_headers(founder))
    assert resp.status_code == 200
    assert resp.json() == {"saved": 2}

    resp = client.get("/api/dashboard/widgets/layout", headers=auth_headers(founder))
    saved = {row["widget_key"]: row for row in resp.json()}
    assert saved["low_stock"]["w"] == 4
    assert saved["monthly_spend"]["x"] == 4


def test_layout_save_replaces_previous(client, db_session):
    founder = make_user(db_session, login="wl2", role=FOUNDER)
    client.put(
        "/api/dashboard/widgets/layout",
        json=[{"widget_key": "low_stock", "x": 0, "y": 0, "w": 4, "h": 5}],
        headers=auth_headers(founder),
    )
    client.put(
        "/api/dashboard/widgets/layout",
        json=[{"widget_key": "monthly_spend", "x": 0, "y": 0, "w": 8, "h": 6}],
        headers=auth_headers(founder),
    )
    resp = client.get("/api/dashboard/widgets/layout", headers=auth_headers(founder))
    keys = [row["widget_key"] for row in resp.json()]
    assert keys == ["monthly_spend"]


def test_layout_rejects_unknown_widget_key(client, db_session):
    founder = make_user(db_session, login="wl3", role=FOUNDER)
    resp = client.put(
        "/api/dashboard/widgets/layout",
        json=[{"widget_key": "not_a_real_widget", "x": 0, "y": 0, "w": 4, "h": 4}],
        headers=auth_headers(founder),
    )
    assert resp.status_code == 400


def test_widget_data_unknown_key_404(client, db_session):
    founder = make_user(db_session, login="wd1", role=FOUNDER)
    resp = client.get("/api/dashboard/widgets/nope/data", headers=auth_headers(founder))
    assert resp.status_code == 404


def test_monthly_revenue_widget(client, db_session):
    company_id = default_company_id(db_session)
    product = Product(company_id=company_id, name="Мыло", category="мыло", gtin="1")
    db_session.add(product)
    db_session.flush()
    db_session.add_all(
        [
            Sale(company_id=company_id, product_id=product.id, qty=10, price=100, date=date(2026, 6, 1)),
            Sale(company_id=company_id, product_id=product.id, qty=5, price=100, date=date(2026, 7, 1)),
            Sale(company_id=company_id, product_id=product.id, qty=3, price=None, date=date(2026, 7, 2)),  # без цены
        ]
    )
    db_session.commit()

    founder = make_user(db_session, login="wd2", role=FOUNDER)
    resp = client.get("/api/dashboard/widgets/monthly_revenue/data", headers=auth_headers(founder))
    by_month = {row["месяц"]: row["выручка"] for row in resp.json()}
    assert by_month == {"2026-06": 1000.0, "2026-07": 500.0}


def test_top_counterparties_widget_excludes_anonymous_sales(client, db_session):
    company_id = default_company_id(db_session)
    product = Product(company_id=company_id, name="Мыло", category="мыло", gtin="1")
    cp1 = Counterparty(company_id=company_id, name="ИП Иванов")
    cp2 = Counterparty(company_id=company_id, name="ООО Ромашка")
    db_session.add_all([product, cp1, cp2])
    db_session.flush()
    db_session.add_all(
        [
            Sale(company_id=company_id, product_id=product.id, counterparty_id=cp1.id, qty=10, price=100),
            Sale(company_id=company_id, product_id=product.id, counterparty_id=cp2.id, qty=1, price=50),
            Sale(company_id=company_id, product_id=product.id, counterparty_id=None, qty=100, price=100),  # анонимная
        ]
    )
    db_session.commit()

    founder = make_user(db_session, login="wd3", role=FOUNDER)
    resp = client.get("/api/dashboard/widgets/top_counterparties/data", headers=auth_headers(founder))
    rows = resp.json()
    assert len(rows) == 2
    assert rows[0]["название"] == "ИП Иванов"
    assert rows[0]["выручка"] == 1000.0


def test_defect_rate_widget(client, db_session):
    worker = make_user(db_session, login="wd4", role=WORKER)
    recipe = Recipe(company_id=worker.company_id, name="Мыло", category="мыло", produces="мыло", batch_yield=10.0)
    db_session.add(recipe)
    db_session.flush()
    db_session.add(
        ProductionLog(
            company_id=worker.company_id, worker_id=worker.id, recipe_id=recipe.id, batches=2, defects=2,
            date=date(2026, 7, 1), started_at=datetime(2026, 7, 1, 9), finished_at=datetime(2026, 7, 1, 10),
        )
    )
    db_session.commit()

    founder = make_user(db_session, login="wd5", role=FOUNDER)
    resp = client.get("/api/dashboard/widgets/defect_rate/data", headers=auth_headers(founder))
    rows = {row["месяц"]: row["брак_процент"] for row in resp.json()}
    assert rows["2026-07"] == 10.0  # 2 брака / (2*10=20 выпущено) = 10%


def test_stock_by_category_widget(client, db_session):
    from app.constants import TRANSACTION_INCOME

    company_id = default_company_id(db_session)
    m1 = Material(company_id=company_id, name="Масло", category="жидкое", unit="кг")
    m2 = Material(company_id=company_id, name="Сода", category="сыпучее", unit="кг")
    db_session.add_all([m1, m2])
    db_session.flush()
    from app.models import Transaction

    db_session.add_all(
        [
            Transaction(company_id=company_id, material_id=m1.id, type=TRANSACTION_INCOME, qty=5),
            Transaction(company_id=company_id, material_id=m2.id, type=TRANSACTION_INCOME, qty=3),
        ]
    )
    db_session.commit()

    founder = make_user(db_session, login="wd6", role=FOUNDER)
    resp = client.get("/api/dashboard/widgets/stock_by_category/data", headers=auth_headers(founder))
    by_cat = {row["категория"]: row["остаток"] for row in resp.json()}
    assert by_cat == {"жидкое": 5.0, "сыпучее": 3.0}


def test_worker_cannot_access_widgets(client, db_session):
    worker = make_user(db_session, login="ww1", role=WORKER)
    assert client.get("/api/dashboard/widgets/catalog", headers=auth_headers(worker)).status_code == 403
    assert client.get("/api/dashboard/widgets/layout", headers=auth_headers(worker)).status_code == 403
    assert client.get("/api/dashboard/widgets/low_stock/data", headers=auth_headers(worker)).status_code == 403
