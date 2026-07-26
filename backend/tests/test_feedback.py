import io

from PIL import Image

from app.constants import DEVELOPER, FOUNDER, WORKER
from app.models import Feedback, FeedbackAttachment
from tests.conftest import auth_headers, default_company_id, make_company, make_user


def _png_bytes(size=(200, 100)) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", size, color=(255, 0, 0)).save(buf, format="PNG")
    return buf.getvalue()


def test_worker_can_submit_feedback(client, db_session):
    worker = make_user(db_session, login="fb_worker", role=WORKER)
    resp = client.post(
        "/api/feedback",
        data={"message": "нашёл баг в отгрузке"},
        headers=auth_headers(worker),
    )
    assert resp.status_code == 200

    entry = db_session.query(Feedback).filter(Feedback.author_id == worker.id).one()
    assert entry.message == "нашёл баг в отгрузке"
    assert entry.author_role == WORKER
    assert entry.status == "новое"


def test_feedback_empty_message_rejected(client, db_session):
    worker = make_user(db_session, login="fb_empty", role=WORKER)
    resp = client.post("/api/feedback", data={"message": "   "}, headers=auth_headers(worker))
    assert resp.status_code == 400


def test_feedback_with_image_attachment_normalizes_to_png(client, db_session):
    worker = make_user(db_session, login="fb_img", role=WORKER)
    resp = client.post(
        "/api/feedback",
        data={"message": "скрин вложен"},
        files=[("files", ("screenshot.png", _png_bytes(), "image/png"))],
        headers=auth_headers(worker),
    )
    assert resp.status_code == 200

    entry = db_session.query(Feedback).filter(Feedback.author_id == worker.id).one()
    attachments = db_session.query(FeedbackAttachment).filter(FeedbackAttachment.feedback_id == entry.id).all()
    assert len(attachments) == 1
    assert attachments[0].filename == "screenshot.png"
    # Реально валидный base64 PNG (заголовок PNG-магии после декода), не просто копия входа.
    import base64

    decoded = base64.b64decode(attachments[0].image_base64)
    assert decoded[:8] == b"\x89PNG\r\n\x1a\n"


def test_feedback_rejects_more_than_3_attachments(client, db_session):
    worker = make_user(db_session, login="fb_too_many", role=WORKER)
    files = [("files", (f"s{i}.png", _png_bytes(), "image/png")) for i in range(4)]
    resp = client.post(
        "/api/feedback", data={"message": "четыре картинки"}, files=files, headers=auth_headers(worker)
    )
    assert resp.status_code == 400
    assert db_session.query(Feedback).filter(Feedback.author_id == worker.id).count() == 0


def test_feedback_rejects_non_image_file(client, db_session):
    worker = make_user(db_session, login="fb_not_image", role=WORKER)
    resp = client.post(
        "/api/feedback",
        data={"message": "это не картинка"},
        files=[("files", ("evil.png", b"#!/bin/sh\necho pwned", "image/png"))],
        headers=auth_headers(worker),
    )
    assert resp.status_code == 400
    assert db_session.query(Feedback).count() == 0


def test_feedback_rejects_decompression_bomb(client, db_session):
    """Однотонная картинка гигантского разрешения весит копейки в байтах (zlib/PNG сжимает
    повторяющиеся пиксели почти до нуля) — легко проходит лимит FEEDBACK_MAX_ATTACHMENT_BYTES,
    но раздувается до сотен МБ в памяти при декодировании. Проверка по разрешению (_MAX_PIXELS
    в feedback.py) должна отклонить это ДО полного декода, не полагаясь на дефолтный порог
    Pillow (тот между 1x-2x лимита только предупреждает, не блокирует)."""
    worker = make_user(db_session, login="fb_bomb", role=WORKER)
    bomb = _png_bytes(size=(8000, 8000))  # 64М пикселей, но всего ~200КБ на диске
    assert len(bomb) < 1024 * 1024  # сам файл маленький — именно это делает его "бомбой"
    resp = client.post(
        "/api/feedback",
        data={"message": "подозрительно маленький, но огромный файл"},
        files=[("files", ("bomb.png", bomb, "image/png"))],
        headers=auth_headers(worker),
    )
    assert resp.status_code == 400
    assert db_session.query(Feedback).count() == 0


def test_feedback_rejects_oversized_file(client, db_session):
    worker = make_user(db_session, login="fb_oversized", role=WORKER)
    huge = b"\x00" * (9 * 1024 * 1024)
    resp = client.post(
        "/api/feedback",
        data={"message": "слишком большой файл"},
        files=[("files", ("huge.png", huge, "image/png"))],
        headers=auth_headers(worker),
    )
    assert resp.status_code == 400
    assert db_session.query(Feedback).count() == 0


def test_feedback_shrinks_oversized_image_but_not_below_floor(client, db_session):
    worker = make_user(db_session, login="fb_shrink", role=WORKER)
    resp = client.post(
        "/api/feedback",
        data={"message": "огромное разрешение"},
        files=[("files", ("big.png", _png_bytes(size=(4000, 3000)), "image/png"))],
        headers=auth_headers(worker),
    )
    assert resp.status_code == 200

    entry = db_session.query(Feedback).filter(Feedback.author_id == worker.id).one()
    attachment = db_session.query(FeedbackAttachment).filter(FeedbackAttachment.feedback_id == entry.id).one()
    import base64

    decoded = base64.b64decode(attachment.image_base64)
    img = Image.open(io.BytesIO(decoded))
    assert img.width <= 2560 and img.height <= 1440
    assert img.width >= 1280 or img.height >= 768  # не ушли ниже читаемого


def test_feedback_truncates_oversized_filename(client, db_session):
    """Имя файла от клиента не доверенное — длиннее колонки String(255) роняло бы INSERT
    500-кой в Postgres (та не обрезает VARCHAR молча, в отличие от SQLite в тестах — тут
    проверяем именно то, что МЫ обрезаем на бэке, не полагаемся на БД)."""
    worker = make_user(db_session, login="fb_long_name", role=WORKER)
    long_name = "x" * 400 + ".png"
    resp = client.post(
        "/api/feedback",
        data={"message": "длинное имя файла"},
        files=[("files", (long_name, _png_bytes(), "image/png"))],
        headers=auth_headers(worker),
    )
    assert resp.status_code == 200
    entry = db_session.query(Feedback).filter(Feedback.author_id == worker.id).one()
    attachment = db_session.query(FeedbackAttachment).filter(FeedbackAttachment.feedback_id == entry.id).one()
    assert len(attachment.filename) <= 255


def test_worker_cannot_list_feedback(client, db_session):
    worker = make_user(db_session, login="fb_list_worker", role=WORKER)
    resp = client.get("/api/feedback", headers=auth_headers(worker))
    assert resp.status_code == 403


def test_founder_cannot_list_feedback(client, db_session):
    """Сообщение адресовано конкретно разработчику — не общий баг-трекер компании,
    founder доступа не имеет (см. CLAUDE.md)."""
    founder = make_user(db_session, login="fb_list_founder", role=FOUNDER)
    resp = client.get("/api/feedback", headers=auth_headers(founder))
    assert resp.status_code == 403


def test_developer_can_list_feedback(client, db_session):
    worker = make_user(db_session, login="fb_list_target", role=WORKER)
    client.post("/api/feedback", data={"message": "видно разработчику"}, headers=auth_headers(worker))

    developer = make_user(db_session, login="fb_dev", role=DEVELOPER)
    resp = client.get("/api/feedback", headers=auth_headers(developer))
    assert resp.status_code == 200
    messages = [f["сообщение"] for f in resp.json()]
    assert "видно разработчику" in messages


def test_feedback_isolated_between_companies(client, db_session):
    other_company = make_company(db_session, name="Другая компания")
    other_worker = make_user(db_session, login="fb_other_co", role=WORKER, company_id=other_company.id)
    client.post("/api/feedback", data={"message": "чужая компания"}, headers=auth_headers(other_worker))

    developer = make_user(db_session, login="fb_dev_iso", role=DEVELOPER)
    resp = client.get("/api/feedback", headers=auth_headers(developer))
    assert resp.status_code == 200
    messages = [f["сообщение"] for f in resp.json()]
    assert "чужая компания" not in messages


def test_developer_can_update_feedback_status(client, db_session):
    worker = make_user(db_session, login="fb_status_worker", role=WORKER)
    create_resp = client.post(
        "/api/feedback", data={"message": "проверка статуса"}, headers=auth_headers(worker)
    )
    feedback_id = create_resp.json()["id"]

    developer = make_user(db_session, login="fb_status_dev", role=DEVELOPER)
    resp = client.patch(
        f"/api/feedback/{feedback_id}", json={"status": "решено"}, headers=auth_headers(developer)
    )
    assert resp.status_code == 200

    entry = db_session.get(Feedback, feedback_id)
    assert entry.status == "решено"


def test_update_feedback_status_rejects_unknown_value(client, db_session):
    worker = make_user(db_session, login="fb_status_bad_worker", role=WORKER)
    create_resp = client.post(
        "/api/feedback", data={"message": "плохой статус"}, headers=auth_headers(worker)
    )
    feedback_id = create_resp.json()["id"]

    developer = make_user(db_session, login="fb_status_bad_dev", role=DEVELOPER)
    resp = client.patch(
        f"/api/feedback/{feedback_id}", json={"status": "мусор"}, headers=auth_headers(developer)
    )
    assert resp.status_code == 400


def test_worker_sees_own_feedback_with_friendly_status(client, db_session):
    worker = make_user(db_session, login="fb_mine_worker", role=WORKER)
    other_worker = make_user(db_session, login="fb_mine_other", role=WORKER)
    create_resp = client.post(
        "/api/feedback", data={"message": "моё обращение"}, headers=auth_headers(worker)
    )
    feedback_id = create_resp.json()["id"]
    client.post("/api/feedback", data={"message": "чужое"}, headers=auth_headers(other_worker))

    resp = client.get("/api/feedback/mine", headers=auth_headers(worker))
    assert resp.status_code == 200
    entries = resp.json()
    assert len(entries) == 1
    assert entries[0]["сообщение"] == "моё обращение"
    assert entries[0]["статус для автора"] == "Отправлено, ожидает рассмотрения."

    developer = make_user(db_session, login="fb_mine_dev", role=DEVELOPER)
    client.patch(f"/api/feedback/{feedback_id}", json={"status": "просмотрено"}, headers=auth_headers(developer))
    resp = client.get("/api/feedback/mine", headers=auth_headers(worker))
    assert resp.json()[0]["статус для автора"] == "Спасибо за Ваше обращение, оно в работе."

    client.patch(f"/api/feedback/{feedback_id}", json={"status": "решено"}, headers=auth_headers(developer))
    resp = client.get("/api/feedback/mine", headers=auth_headers(worker))
    assert resp.json()[0]["статус для автора"] == "Спасибо за Ваше обращение, оно решено!"


def test_developer_cannot_update_foreign_feedback(client, db_session):
    other_company = make_company(db_session, name="Другая компания")
    other_worker = make_user(db_session, login="fb_foreign_worker", role=WORKER, company_id=other_company.id)
    create_resp = client.post(
        "/api/feedback", data={"message": "чужой фидбек"}, headers=auth_headers(other_worker)
    )
    feedback_id = create_resp.json()["id"]

    developer = make_user(db_session, login="fb_foreign_dev", role=DEVELOPER)
    resp = client.patch(
        f"/api/feedback/{feedback_id}", json={"status": "решено"}, headers=auth_headers(developer)
    )
    assert resp.status_code == 404
