"""Раздел «Видеонаблюдение» — Phase 1 (2026-07-23, запрос Александра): только живой
просмотр, без записи/ретеншна. Единственный способ сохранить кадр — ручной скриншот
(кнопка в плеере), сохраняется в SurveillanceScreenshot. Доступно только Founder/Developer,
как и остальные разделы с чувствительными данными мастерской.

stream_url настраивается за компанию (CameraSettings) — фронт сам решает, как его
проигрывать (HLS через hls.js для .m3u8, иначе <img>/<video> напрямую для MJPEG/прямого
потока), бэкенд URL не проксирует и не валидирует его формат — просто хранит.

Мультитенантность: каждый запрос фильтруется по user["company_id"]."""

from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.constants import DEVELOPER, FOUNDER
from app.db import get_db
from app.models import CameraSettings, SurveillanceScreenshot
from app.schemas import CameraSettingsRequest, NewScreenshotRequest
from app.security import get_current_user, require_roles

router = APIRouter(
    prefix="/api/surveillance", tags=["surveillance"], dependencies=[Depends(require_roles(FOUNDER, DEVELOPER))]
)


@router.get("/settings")
def get_settings(user: dict = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    settings = db.get(CameraSettings, user["company_id"])
    return {"stream_url": settings.stream_url if settings else None}


@router.put("/settings")
def update_settings(
    body: CameraSettingsRequest, user: dict = Depends(get_current_user), db: Session = Depends(get_db)
) -> dict:
    settings = db.get(CameraSettings, user["company_id"])
    if not settings:
        settings = CameraSettings(company_id=user["company_id"])
        db.add(settings)
    settings.stream_url = body.stream_url or None
    db.commit()
    return {"stream_url": settings.stream_url}


def _screenshot_dict(shot: SurveillanceScreenshot) -> dict:
    return {
        "id": shot.id,
        "дата": shot.taken_at.isoformat(),
        "ФИО сотрудника": shot.user.fio,
        "изображение": shot.image_base64,
        "комментарий": shot.comment or "",
    }


@router.get("/screenshots")
def list_screenshots(user: dict = Depends(get_current_user), db: Session = Depends(get_db)) -> list[dict]:
    stmt = (
        select(SurveillanceScreenshot)
        .where(SurveillanceScreenshot.company_id == user["company_id"])
        .order_by(SurveillanceScreenshot.taken_at.desc())
    )
    return [_screenshot_dict(s) for s in db.scalars(stmt)]


@router.post("/screenshots")
def create_screenshot(
    body: NewScreenshotRequest, user: dict = Depends(get_current_user), db: Session = Depends(get_db)
) -> dict:
    shot = SurveillanceScreenshot(
        company_id=user["company_id"],
        user_id=user["id"],
        taken_at=datetime.utcnow(),
        image_base64=body.image_base64,
        comment=body.comment,
    )
    db.add(shot)
    db.commit()
    return {"id": shot.id}
