"""Обратная связь разработчику (2026-07-26, запрос Александра) — таблица существовала в
схеме без роутера/фронта (см. историю решения в CLAUDE.md). Отправить может любая
авторизованная роль (worker включительно) — форма открыта всем, кто залогинен. Видит
список и меняет статус только developer, не founder — сообщение адресовано конкретно
разработчику, не общий баг-трекер компании.

Мультитенантность: список фильтруется по user["company_id"] как везде — developer
всё равно оперирует в контексте одной активной компании за раз (см. CLAUDE.md →
"Мульти-компанийные пользователи"), исключений тут не требуется.

Вложения — до 3 картинок, PNG в Postgres (тот же паттерн, что у SurveillanceScreenshot),
не общий object storage — видео и полноценное файловое хранилище отложены до платного
сервера, см. CLAUDE.md → "Отложенные темы"."""

import base64
import io

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from PIL import Image
from PIL import UnidentifiedImageError
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.constants import (
    DEVELOPER,
    FEEDBACK_MAX_ATTACHMENT_BYTES,
    FEEDBACK_MAX_ATTACHMENTS,
    FEEDBACK_MAX_DIMENSION,
    FEEDBACK_STATUS_NEW,
    FEEDBACK_STATUSES,
)
from app.db import get_db
from app.models import Feedback, FeedbackAttachment
from app.rate_limit import check_rate_limit
from app.schemas import UpdateFeedbackStatusRequest
from app.security import get_current_user, get_owned_or_404, require_roles

router = APIRouter(prefix="/api/feedback", tags=["feedback"], dependencies=[Depends(get_current_user)])

_MAX_MESSAGE_LENGTH = 5000


def _attachment_dict(a: FeedbackAttachment) -> dict:
    return {
        "id": a.id,
        "изображение": f"data:image/png;base64,{a.image_base64}",
        "имя файла": a.filename,
    }


def _feedback_dict(f: Feedback) -> dict:
    return {
        "id": f.id,
        "дата": f.date.isoformat(),
        "автор": f.author.fio,
        "роль автора": f.author_role,
        "сообщение": f.message,
        "статус": f.status,
        "вложения": [_attachment_dict(a) for a in f.attachments],
    }


_MAX_PIXELS = 30_000_000  # ~8К — с большим запасом выше любого реального скрина


def _normalize_to_png(content: bytes, original_filename: str | None) -> str:
    """Декодирует, проверяет, ужимает при необходимости и перекодирует в чистый PNG —
    отказ от исходных байт снимает подавляющее большинство способов встроить в файл что-то
    кроме картинки (полиглоты, встроенные скрипты/макросы под видом изображения, битый
    EXIF-парсинг). Decompression bomb — ОТДЕЛЬНАЯ проверка по разрешению ДО .load() своя, не
    полагаемся на дефолтный Image.MAX_IMAGE_PIXELS: между 1x и 2x этого порога Pillow по
    умолчанию не кидает исключение, только UserWarning и декодирует дальше — классический
    PNG-бомб (однотонная картинка гигантского разрешения) весит в байтах копейки и легко
    прошёл бы наш лимит размера файла, если бы мы не проверяли разрешение сами. Image.open()
    читает только заголовок (не декодирует пиксели) — .size доступен раньше .load()."""
    try:
        img = Image.open(io.BytesIO(content))
    except (UnidentifiedImageError, OSError):
        raise HTTPException(400, f"Файл {original_filename or ''} не является изображением или повреждён.")

    width, height = img.size
    if width * height > _MAX_PIXELS:
        raise HTTPException(400, f"Изображение {original_filename or ''} слишком велико по разрешению.")

    try:
        img.load()
    except (Image.DecompressionBombError, OSError):
        raise HTTPException(400, f"Файл {original_filename or ''} не является изображением или повреждён.")

    if img.mode in ("RGBA", "LA", "P"):
        img = img.convert("RGBA")
    else:
        img = img.convert("RGB")

    # thumbnail() только уменьшает (никогда не увеличивает) и сохраняет пропорции — раз
    # FEEDBACK_MAX_DIMENSION заведомо больше FEEDBACK_MIN_DIMENSION, результат никогда не
    # уйдёт ниже нижней планки читаемости, отдельная проверка не нужна.
    img.thumbnail(FEEDBACK_MAX_DIMENSION, Image.LANCZOS)

    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    return base64.b64encode(buffer.getvalue()).decode("ascii")


@router.post("")
async def create_feedback(
    message: str = Form(...),
    files: list[UploadFile] = File(default=[]),
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    message = message.strip()
    if not message:
        raise HTTPException(400, "Сообщение не может быть пустым.")
    if len(message) > _MAX_MESSAGE_LENGTH:
        raise HTTPException(400, f"Сообщение длиннее {_MAX_MESSAGE_LENGTH} символов.")
    if len(files) > FEEDBACK_MAX_ATTACHMENTS:
        raise HTTPException(400, f"Не больше {FEEDBACK_MAX_ATTACHMENTS} картинок за раз.")

    # 20/час на пользователя — не блокирует нормальное использование, но не даёт залить
    # базу спамом вложений (in-memory лимитер, см. app/rate_limit.py — тот же, что у
    # публичной регистрации компаний).
    check_rate_limit(f"feedback:{user['id']}", max_requests=20, window_seconds=3600)

    normalized: list[tuple[str, str | None]] = []
    for file in files:
        content = await file.read()
        if len(content) > FEEDBACK_MAX_ATTACHMENT_BYTES:
            raise HTTPException(
                400, f"Файл {file.filename or ''} больше {FEEDBACK_MAX_ATTACHMENT_BYTES // (1024 * 1024)} МБ."
            )
        # Обрезаем до предела колонки (String(255)) — иначе длинное имя файла от клиента
        # роняет INSERT 500-кой (Postgres не обрезает VARCHAR молча) вместо чистого приёма.
        safe_filename = file.filename[:255] if file.filename else None
        normalized.append((_normalize_to_png(content, file.filename), safe_filename))

    feedback = Feedback(
        company_id=user["company_id"],
        author_id=user["id"],
        author_role=user["role"],
        message=message,
    )
    db.add(feedback)
    db.flush()
    for image_base64, filename in normalized:
        db.add(FeedbackAttachment(feedback_id=feedback.id, image_base64=image_base64, filename=filename))
    db.commit()
    return {"id": feedback.id}


@router.get("/unread-count")
def unread_feedback_count(
    user: dict = Depends(require_roles(DEVELOPER)), db: Session = Depends(get_db)
) -> dict:
    """Счётчик для точки-индикатора в сайдбаре (2026-07-27, запрос Александра) — только
    статус "новое", не общее число обращений, иначе индикатор горел бы вечно даже после
    того, как всё уже просмотрено/решено. Отдельный лёгкий эндпоинт, не переиспользуем
    list_feedback — тот тянет вложения (base64-картинки) на каждое обращение, дорого
    гонять только ради значка."""
    count = db.scalar(
        select(func.count(Feedback.id)).where(
            Feedback.company_id == user["company_id"], Feedback.status == FEEDBACK_STATUS_NEW
        )
    )
    return {"count": count or 0}


@router.get("")
def list_feedback(
    user: dict = Depends(require_roles(DEVELOPER)), db: Session = Depends(get_db)
) -> list[dict]:
    stmt = (
        select(Feedback)
        .where(Feedback.company_id == user["company_id"])
        .order_by(Feedback.date.desc())
    )
    return [_feedback_dict(f) for f in db.scalars(stmt)]


# Уведомление для автора (2026-07-26, запрос Александра) — своего push/websocket в
# приложении нет, поэтому "уведомление" реализовано как дружелюбный текст-статус,
# который автор видит на /feedback при следующем визите ("Спасибо за обращение, оно в
# работе" после просмотра разработчиком, аналогично при решении) — не отдельный канал.
_AUTHOR_STATUS_MESSAGE = {
    "новое": "Отправлено, ожидает рассмотрения.",
    "просмотрено": "Спасибо за Ваше обращение, оно в работе.",
    "решено": "Спасибо за Ваше обращение, оно решено!",
}


@router.get("/mine")
def list_my_feedback(
    user: dict = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[dict]:
    stmt = (
        select(Feedback)
        .where(Feedback.company_id == user["company_id"], Feedback.author_id == user["id"])
        .order_by(Feedback.date.desc())
    )
    result = []
    for f in db.scalars(stmt):
        entry = _feedback_dict(f)
        entry["статус для автора"] = _AUTHOR_STATUS_MESSAGE.get(f.status, "")
        result.append(entry)
    return result


@router.patch("/{feedback_id}")
def update_feedback_status(
    feedback_id: str,
    body: UpdateFeedbackStatusRequest,
    user: dict = Depends(require_roles(DEVELOPER)),
    db: Session = Depends(get_db),
) -> dict:
    if body.status not in FEEDBACK_STATUSES:
        raise HTTPException(400, "Неизвестный статус.")
    feedback = get_owned_or_404(db, Feedback, feedback_id, user["company_id"], "Сообщение не найдено.")
    feedback.status = body.status
    db.commit()
    return {"id": feedback.id, "статус": feedback.status}
