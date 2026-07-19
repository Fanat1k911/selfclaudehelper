"""Контрагенты (юрлица-покупатели) — доступно только founder/developer (см. таблицу
ролей в CLAUDE.md), т.к. это реквизиты для документов/отгрузки, не рядовая операция.

Мультитенантность: каждый запрос фильтруется по user["company_id"]."""

import logging

import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import DADATA_API_KEY
from app.constants import DEVELOPER, FOUNDER

from app.db import get_db
from app.models import Counterparty
from app.schemas import NewCounterpartyRequest, UpdateCounterpartyRequest
from app.security import get_current_user, get_owned_or_404, require_roles

router = APIRouter(
    prefix="/api/counterparties", tags=["counterparties"], dependencies=[Depends(require_roles(FOUNDER, DEVELOPER))]
)

_logger = logging.getLogger(__name__)
_DADATA_URL = "https://suggestions.dadata.ru/suggestions/api/4_1/rs/findById/party"


@router.get("/lookup")
def lookup_by_inn(inn: str, user: dict = Depends(get_current_user)) -> dict:
    """Автоподстановка реквизитов по ИНН (см. app/config.py::DADATA_API_KEY). ИП — 12
    цифр, юрлицо — 10, иначе DaData всё равно вернёт пусто, но проверяем сами — не тратим
    запрос из бесплатного лимита на заведомо некорректный ввод."""
    if not DADATA_API_KEY:
        raise HTTPException(501, "Поиск по ИНН не настроен.")
    if not inn.isdigit() or len(inn) not in (10, 12):
        raise HTTPException(400, "ИНН должен содержать 10 или 12 цифр.")

    try:
        resp = httpx.post(
            _DADATA_URL,
            json={"query": inn},
            headers={"Authorization": f"Token {DADATA_API_KEY}", "Content-Type": "application/json"},
            timeout=5.0,
        )
        resp.raise_for_status()
    except httpx.HTTPStatusError as exc:
        # Видно в Техпанели (developer) и в логах Render — статус/тело от DaData сюда,
        # не пользователю (не палим детали внешнего API в ответе фронту).
        _logger.warning("DaData lookup HTTP %s for ИНН %s: %s", exc.response.status_code, inn, exc.response.text[:300])
        raise HTTPException(502, "Не удалось выполнить поиск по ИНН, попробуйте позже.")
    except httpx.HTTPError as exc:
        _logger.warning("DaData lookup request failed for ИНН %s: %s", inn, exc)
        raise HTTPException(502, "Не удалось выполнить поиск по ИНН, попробуйте позже.")

    suggestions = resp.json().get("suggestions") or []
    if not suggestions:
        raise HTTPException(404, "Компания с таким ИНН не найдена.")

    data = suggestions[0]["data"]
    address = data.get("address") or {}
    return {
        "название": (data.get("name") or {}).get("short_with_opf") or suggestions[0].get("value") or "",
        "ИНН": data.get("inn") or inn,
        "КПП": data.get("kpp") or "",
        "ОГРН": data.get("ogrn") or "",
        "юр.адрес": address.get("value") or "",
    }


def _counterparty_dict(cp: Counterparty) -> dict:
    return {
        "id": cp.id,
        "название": cp.name,
        "ИНН": cp.inn or "",
        "КПП": cp.kpp or "",
        "ОГРН": cp.ogrn or "",
        "юр.адрес": cp.legal_address or "",
        "телефон": cp.phone or "",
        "контактное лицо": cp.contact_person or "",
        "комментарий": cp.comment or "",
    }


@router.get("")
def list_counterparties(user: dict = Depends(get_current_user), db: Session = Depends(get_db)) -> list[dict]:
    stmt = select(Counterparty).where(Counterparty.company_id == user["company_id"]).order_by(Counterparty.name)
    return [_counterparty_dict(c) for c in db.scalars(stmt)]


@router.post("")
def create_counterparty(
    body: NewCounterpartyRequest, user: dict = Depends(get_current_user), db: Session = Depends(get_db)
) -> dict:
    if not body.name.strip():
        raise HTTPException(400, "Наименование обязательно.")

    cp = Counterparty(
        company_id=user["company_id"],
        name=body.name.strip(),
        inn=body.inn or None,
        kpp=body.kpp or None,
        ogrn=body.ogrn or None,
        legal_address=body.legal_address or None,
        phone=body.phone or None,
        contact_person=body.contact_person or None,
        comment=body.comment or None,
    )
    db.add(cp)
    db.commit()
    return {"id": cp.id}


@router.patch("/{counterparty_id}")
def update_counterparty(
    counterparty_id: str, body: UpdateCounterpartyRequest,
    user: dict = Depends(get_current_user), db: Session = Depends(get_db),
) -> dict:
    cp = get_owned_or_404(db, Counterparty, counterparty_id, user["company_id"], "Контрагент не найден.")

    if body.name is not None:
        if not body.name.strip():
            raise HTTPException(400, "Наименование обязательно.")
        cp.name = body.name.strip()
    if body.inn is not None:
        cp.inn = body.inn or None
    if body.kpp is not None:
        cp.kpp = body.kpp or None
    if body.ogrn is not None:
        cp.ogrn = body.ogrn or None
    if body.legal_address is not None:
        cp.legal_address = body.legal_address or None
    if body.phone is not None:
        cp.phone = body.phone or None
    if body.contact_person is not None:
        cp.contact_person = body.contact_person or None
    if body.comment is not None:
        cp.comment = body.comment or None

    db.commit()
    return _counterparty_dict(cp)
