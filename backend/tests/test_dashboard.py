from datetime import date, datetime

from app.constants import FOUNDER, TRANSACTION_EXPENSE, TRANSACTION_INCOME, WORKER
from app.models import Material, ProductionLog, Recipe, Transaction
from tests.conftest import auth_headers, default_company_id, make_user


def test_spend_counts_only_priced_income(client, db_session):
    company_id = default_company_id(db_session)
    m1 = Material(company_id=company_id, name="Масло", category="жидкое", unit="кг")
    m2 = Material(company_id=company_id, name="Сода", category="сыпучее", unit="кг")
    db_session.add_all([m1, m2])
    db_session.flush()
    db_session.add_all(
        [
            Transaction(company_id=company_id, material_id=m1.id, type=TRANSACTION_INCOME, qty=10, price=100, date=date(2026, 6, 1)),
            Transaction(company_id=company_id, material_id=m1.id, type=TRANSACTION_INCOME, qty=5, price=120, date=date(2026, 7, 1)),
            Transaction(company_id=company_id, material_id=m2.id, type=TRANSACTION_INCOME, qty=2, price=50, date=date(2026, 7, 1)),
            # не должны попасть в траты:
            Transaction(company_id=company_id, material_id=m1.id, type=TRANSACTION_EXPENSE, qty=1, price=100, date=date(2026, 7, 2)),
            Transaction(company_id=company_id, material_id=m1.id, type=TRANSACTION_INCOME, qty=1, price=None, date=date(2026, 7, 3)),
        ]
    )
    db_session.commit()

    founder = make_user(db_session, login="df1", role=FOUNDER)
    resp = client.get("/api/dashboard/spend", headers=auth_headers(founder))
    assert resp.status_code == 200
    body = resp.json()

    assert body["всего"] == 1000.0 + 600.0 + 100.0
    by_month = {row["месяц"]: row["сумма"] for row in body["по_месяцам"]}
    assert by_month == {"2026-06": 1000.0, "2026-07": 700.0}
    assert body["топ_материалов"][0]["material_id"] == m1.id
    assert body["топ_материалов"][0]["сумма"] == 1600.0


def test_spend_respects_date_range(client, db_session):
    company_id = default_company_id(db_session)
    m1 = Material(company_id=company_id, name="Масло", category="жидкое", unit="кг")
    db_session.add(m1)
    db_session.flush()
    db_session.add_all(
        [
            Transaction(company_id=company_id, material_id=m1.id, type=TRANSACTION_INCOME, qty=10, price=100, date=date(2026, 6, 1)),
            Transaction(company_id=company_id, material_id=m1.id, type=TRANSACTION_INCOME, qty=5, price=120, date=date(2026, 7, 1)),
        ]
    )
    db_session.commit()

    founder = make_user(db_session, login="df2", role=FOUNDER)
    resp = client.get(
        "/api/dashboard/spend",
        params={"date_from": "2026-07-01", "date_to": "2026-07-31"},
        headers=auth_headers(founder),
    )
    assert resp.json()["всего"] == 600.0


def test_kpi_grouped_by_month_and_worker(client, db_session):
    worker = make_user(db_session, login="dk1", role=WORKER)
    recipe = Recipe(company_id=worker.company_id, name="Мыло", category="мыло", produces="мыло", batch_yield=10.0)
    db_session.add(recipe)
    db_session.flush()
    db_session.add_all(
        [
            ProductionLog(
                company_id=worker.company_id, worker_id=worker.id, recipe_id=recipe.id, qty=20, batches=2, defects=1,
                date=date(2026, 6, 10),
                started_at=datetime(2026, 6, 10, 9), finished_at=datetime(2026, 6, 10, 11),
            ),
            ProductionLog(
                company_id=worker.company_id, worker_id=worker.id, recipe_id=recipe.id, qty=10, batches=1, defects=0,
                date=date(2026, 7, 5),
                started_at=datetime(2026, 7, 5, 9), finished_at=datetime(2026, 7, 5, 10),
            ),
        ]
    )
    db_session.commit()

    founder = make_user(db_session, login="df3", role=FOUNDER)
    resp = client.get("/api/dashboard/kpi", headers=auth_headers(founder))
    assert resp.status_code == 200
    rows = {row["месяц"]: row for row in resp.json()}

    assert rows["2026-06"]["произведено"] == 19.0  # 2*10 - 1
    assert rows["2026-06"]["партий"] == 2.0
    assert rows["2026-07"]["произведено"] == 10.0


def test_worker_cannot_access_dashboard(client, db_session):
    worker = make_user(db_session, login="dw1", role=WORKER)
    assert client.get("/api/dashboard/spend", headers=auth_headers(worker)).status_code == 403
    assert client.get("/api/dashboard/kpi", headers=auth_headers(worker)).status_code == 403
