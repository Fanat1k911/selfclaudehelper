from app.constants import FOUNDER, WORKER
from app.models import Product
from tests.conftest import auth_headers, make_user


def test_packaging_create_and_worker_scoping(client, db_session):
    product = Product(name="Мыло розовое", category="мыло", gtin="4600000000003")
    db_session.add(product)
    db_session.commit()

    w1 = make_user(db_session, login="pw1", role=WORKER)
    w2 = make_user(db_session, login="pw2", role=WORKER)
    founder = make_user(db_session, login="pf1", role=FOUNDER)

    resp = client.post("/api/packaging", json={"product_id": product.id, "qty": 5}, headers=auth_headers(w1))
    assert resp.status_code == 200
    client.post("/api/packaging", json={"product_id": product.id, "qty": 3}, headers=auth_headers(w2))

    resp = client.get("/api/packaging", headers=auth_headers(w1))
    assert all(entry["worker_id"] == w1.id for entry in resp.json())

    resp = client.get("/api/packaging", headers=auth_headers(founder))
    assert len(resp.json()) == 2


def test_packaging_rejects_zero_qty(client, db_session):
    product = Product(name="Мыло синее", category="мыло", gtin="4600000000004")
    db_session.add(product)
    db_session.commit()
    worker = make_user(db_session, login="pw3", role=WORKER)

    resp = client.post("/api/packaging", json={"product_id": product.id, "qty": 0}, headers=auth_headers(worker))
    assert resp.status_code == 400


def test_packaging_rejects_unknown_product(client, db_session):
    worker = make_user(db_session, login="pw4", role=WORKER)
    resp = client.post("/api/packaging", json={"product_id": "nope", "qty": 1}, headers=auth_headers(worker))
    assert resp.status_code == 404
