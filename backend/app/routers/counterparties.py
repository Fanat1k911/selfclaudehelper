"""Контрагенты (юрлица-покупатели) — доступно только founder/developer (см. таблицу
ролей в CLAUDE.md), т.к. это реквизиты для документов/отгрузки, не рядовая операция.

Мультитенантность: каждый запрос фильтруется по user["company_id"]."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.constants import DEVELOPER, FOUNDER

from app.db import get_db
from app.models import Counterparty
from app.schemas import NewCounterpartyRequest, UpdateCounterpartyRequest
from app.security import get_current_user, require_roles

router = APIRouter(
    prefix="/api/counterparties", tags=["counterparties"], dependencies=[Depends(require_roles(FOUNDER, DEVELOPER))]
)


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
    cp = db.get(Counterparty, counterparty_id)
    if cp is None or cp.company_id != user["company_id"]:
        raise HTTPException(404, "Контрагент не найден.")

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
