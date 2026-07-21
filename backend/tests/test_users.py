from app.constants import DEVELOPER, FOUNDER, USER_STATUS_FIRED, WORKER
from tests.conftest import add_membership, auth_headers, make_company, make_user


def test_create_user(client, db_session):
    founder = make_user(db_session, login="uf1", role=FOUNDER)
    resp = client.post(
        "/api/users",
        json={"fio": "Иван Иванов", "login": "ivan", "password": "pass1234", "role": WORKER},
        headers=auth_headers(founder),
    )
    assert resp.status_code == 200


def test_create_user_rejects_duplicate_login(client, db_session):
    founder = make_user(db_session, login="uf2", role=FOUNDER)
    make_user(db_session, login="taken", role=WORKER)
    resp = client.post(
        "/api/users",
        json={"fio": "Иван Иванов", "login": "taken", "password": "pass1234", "role": WORKER},
        headers=auth_headers(founder),
    )
    assert resp.status_code == 400


def test_create_user_with_existing_login_from_other_company_attaches_membership(client, db_session):
    """Мульти-компанийные пользователи (2026-07-18, вариант А) — существующий в ДРУГОЙ
    компании логин не отклоняется, а приглашается в текущую компанию с ролью из формы,
    без создания второго аккаунта, если пароль верный (ФИО из формы игнорируется)."""
    other_company = make_company(db_session, name="Другая мастерская")
    existing = make_user(db_session, login="crossco", role=DEVELOPER, password="realpass1", company_id=other_company.id)
    founder = make_user(db_session, login="uf2b", role=FOUNDER)

    resp = client.post(
        "/api/users",
        json={"fio": "Игнорируется", "login": "crossco", "password": "realpass1", "role": WORKER},
        headers=auth_headers(founder),
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["attached_existing"] is True
    assert body["id"] == existing.id

    # Теперь виден в списке сотрудников founder-а с ролью WORKER (из формы), не DEVELOPER.
    listing = client.get("/api/users", headers=auth_headers(founder)).json()
    entry = next(u for u in listing if u["id"] == existing.id)
    assert entry["role"] == WORKER

    # Пароль исходного аккаунта не поменялся.
    assert client.post(
        "/api/auth/login", json={"login": "crossco", "password": "realpass1"}
    ).status_code == 200


def test_create_user_existing_login_wrong_password_rejected(client, db_session):
    """Security-critical (2026-07-18) — без проверки пароля любой Founder мог бы привязать
    ЧУЖОЙ аккаунт из другой компании к своей, зная только логин, и потом сбросить его
    глобальный пароль. Неверный пароль в форме — отклонить, membership не создавать."""
    other_company = make_company(db_session, name="Другая мастерская 2")
    victim = make_user(db_session, login="victim2", role=DEVELOPER, password="realsecret", company_id=other_company.id)
    founder = make_user(db_session, login="uf2c", role=FOUNDER)

    resp = client.post(
        "/api/users",
        json={"fio": "X", "login": "victim2", "password": "guessed-wrong", "role": WORKER},
        headers=auth_headers(founder),
    )
    assert resp.status_code == 400

    listing = client.get("/api/users", headers=auth_headers(founder)).json()
    assert not any(u["id"] == victim.id for u in listing)


def test_create_user_existing_fired_account_rejected(client, db_session):
    other_company = make_company(db_session, name="Другая мастерская 3")
    fired = make_user(
        db_session, login="fired2", role=WORKER, password="pass1234", status=USER_STATUS_FIRED, company_id=other_company.id
    )
    founder = make_user(db_session, login="uf2d", role=FOUNDER)

    resp = client.post(
        "/api/users",
        json={"fio": "X", "login": "fired2", "password": "pass1234", "role": WORKER},
        headers=auth_headers(founder),
    )
    assert resp.status_code == 400


def test_founder_cannot_create_developer_account(client, db_session):
    founder = make_user(db_session, login="uf_priv1", role=FOUNDER)
    resp = client.post(
        "/api/users",
        json={"fio": "Новый Девелопер", "login": "sneaky_dev", "password": "pass1234", "role": DEVELOPER},
        headers=auth_headers(founder),
    )
    assert resp.status_code == 403


def test_founder_cannot_promote_worker_to_developer(client, db_session):
    founder = make_user(db_session, login="uf_priv2", role=FOUNDER)
    worker = make_user(db_session, login="uf_priv2_w", role=WORKER, company_id=founder.company_id)
    resp = client.patch(
        f"/api/users/{worker.id}", json={"role": DEVELOPER}, headers=auth_headers(founder)
    )
    assert resp.status_code == 403


def test_developer_can_create_developer_account(client, db_session):
    developer = make_user(db_session, login="uf_priv3", role=DEVELOPER)
    resp = client.post(
        "/api/users",
        json={"fio": "Второй Девелопер", "login": "dev2", "password": "pass1234", "role": DEVELOPER},
        headers=auth_headers(developer),
    )
    assert resp.status_code == 200


def test_create_user_rejects_invalid_role(client, db_session):
    founder = make_user(db_session, login="uf3", role=FOUNDER)
    resp = client.post(
        "/api/users",
        json={"fio": "Иван Иванов", "login": "ivan2", "password": "pass1234", "role": "admin"},
        headers=auth_headers(founder),
    )
    assert resp.status_code == 400


def test_create_user_rejects_bad_phone(client, db_session):
    founder = make_user(db_session, login="uf4", role=FOUNDER)
    resp = client.post(
        "/api/users",
        json={"fio": "Иван Иванов", "login": "ivan3", "password": "pass1234", "role": WORKER, "phone": "abc"},
        headers=auth_headers(founder),
    )
    assert resp.status_code == 422


def test_update_user_rejects_bad_phone(client, db_session):
    """Регрессия: UpdateUserRequest потерял _check_phone при добавлении поля timezone
    (2026-07-18) — PATCH принимал любую строку в phone, обходя валидацию, что есть
    на создании. Поймано code-review 2026-07-19."""
    founder = make_user(db_session, login="uf5", role=FOUNDER)
    target = make_user(db_session, login="ivan4", role=WORKER)
    resp = client.patch(
        f"/api/users/{target.id}", json={"phone": "abc"}, headers=auth_headers(founder)
    )
    assert resp.status_code == 422


def test_fire_user_revokes_access_immediately(client, db_session):
    founder = make_user(db_session, login="uf5", role=FOUNDER)
    worker = make_user(db_session, login="uf5w", role=WORKER)

    resp = client.get("/api/auth/me", headers=auth_headers(worker))
    assert resp.status_code == 200

    resp = client.patch(
        f"/api/users/{worker.id}", json={"status": USER_STATUS_FIRED}, headers=auth_headers(founder)
    )
    assert resp.status_code == 200

    resp = client.get("/api/auth/me", headers=auth_headers(worker))
    assert resp.status_code == 401


def test_worker_cannot_manage_users(client, db_session):
    worker = make_user(db_session, login="uw1", role=WORKER)
    resp = client.get("/api/users", headers=auth_headers(worker))
    assert resp.status_code == 403


def test_user_companies_visible_only_to_developer(client, db_session):
    """StaffDetailPanel (2026-07-18) — список всех компаний сотрудника, но только
    Developer видит это, не Founder (не должен узнавать о чужих тенантах через
    своего же мульти-компанийного сотрудника)."""
    other_company = make_company(db_session, name="Другая мастерская 4")
    dev = make_user(db_session, login="uf6dev", role=DEVELOPER)
    add_membership(db_session, dev, company_id=other_company.id, role=DEVELOPER)
    # founder без явного company_id — попадает в ТУ ЖЕ дефолтную компанию, что и dev
    # (make_user создаёт "Test Company" один раз на тест), так что founder законно
    # видит dev как своего сотрудника без лишнего add_membership.
    founder = make_user(db_session, login="uf6f", role=FOUNDER)

    resp_dev = client.get(f"/api/users/{dev.id}/companies", headers=auth_headers(dev))
    assert resp_dev.status_code == 200
    assert len(resp_dev.json()) == 2

    resp_founder = client.get(f"/api/users/{dev.id}/companies", headers=auth_headers(founder))
    assert resp_founder.status_code == 403


def test_user_companies_rejects_probing_unrelated_user(client, db_session):
    """Developer не может подглядеть компании человека, который даже не в его СВОЕЙ
    компании — иначе можно было бы перебирать произвольные user_id вслепую."""
    dev = make_user(db_session, login="uf7dev", role=DEVELOPER)
    unrelated_company = make_company(db_session, name="Совсем чужая")
    stranger = make_user(db_session, login="uf7stranger", role=WORKER, company_id=unrelated_company.id)

    resp = client.get(f"/api/users/{stranger.id}/companies", headers=auth_headers(dev))
    assert resp.status_code == 404


def test_update_user_sets_personal_timezone_override(client, db_session):
    founder = make_user(db_session, login="tzf1", role=FOUNDER)
    worker = make_user(db_session, login="tzw1", role=WORKER)

    resp = client.patch(
        f"/api/users/{worker.id}", json={"timezone": "Asia/Yekaterinburg"}, headers=auth_headers(founder)
    )
    assert resp.status_code == 200
    assert resp.json()["timezone"] == "Asia/Yekaterinburg"


def test_update_user_invalid_timezone_rejected(client, db_session):
    founder = make_user(db_session, login="tzf2", role=FOUNDER)
    worker = make_user(db_session, login="tzw2", role=WORKER)

    resp = client.patch(f"/api/users/{worker.id}", json={"timezone": "Not/Real"}, headers=auth_headers(founder))
    assert resp.status_code == 400


def test_update_user_clears_timezone_override_with_empty_string(client, db_session):
    founder = make_user(db_session, login="tzf3", role=FOUNDER)
    worker = make_user(db_session, login="tzw3", role=WORKER)
    client.patch(f"/api/users/{worker.id}", json={"timezone": "Asia/Yekaterinburg"}, headers=auth_headers(founder))

    resp = client.patch(f"/api/users/{worker.id}", json={"timezone": ""}, headers=auth_headers(founder))
    assert resp.status_code == 200
    assert resp.json()["timezone"] == ""
