"""Заведение новых компаний (тенантов) — только DEVELOPER, не FOUNDER (Founder привязан
к своей компании и не должен плодить чужие, см. CLAUDE.md → "Мультитенантность").

Единственный роутер, который намеренно НЕ фильтрует по user["company_id"] — вся его
задача cross-tenant: список существующих компаний и создание новой. Это осознанное
исключение из архитектурного принципа №5 (CLAUDE.md), не забытый фильтр.

Мульти-компанийные пользователи (2026-07-18): если логин уже существует — не ошибка,
а привязка ЭТОГО существующего человека как Developer'а новой компании (см.
`attach_or_create_membership` в security.py — требует правильный пароль существующего
аккаунта, иначе это была бы дыра; ФИО из формы игнорируется, только пароль подтверждает
личность). Тот же helper используется в users.py и create_founder.py — не три копии."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.constants import DEVELOPER
from app.db import get_db
from app.models import Company, CompanyMembership
from app.schemas import NewCompanyRequest
from app.security import attach_or_create_membership, require_roles
from app.timezone_utils import is_valid_tz_name

router = APIRouter(prefix="/api/companies", tags=["companies"], dependencies=[Depends(require_roles(DEVELOPER))])


def _company_dict(company: Company) -> dict:
    return {
        "id": company.id,
        "name": company.name,
        "created_at": company.created_at.isoformat(),
        "timezone": company.timezone,
    }


@router.get("")
def list_companies(db: Session = Depends(get_db)) -> list[dict]:
    stmt = select(Company).order_by(Company.name)
    return [_company_dict(c) for c in db.scalars(stmt)]


@router.get("/{company_id}")
def get_company(company_id: str, db: Session = Depends(get_db)) -> dict:
    """Карточка компании — дата создания + участники по ролям (2026-07-18, запрос Founder).
    Developer уже видит ВСЕ компании через list_companies — это тот же cross-tenant
    роутер, не новая утечка (см. модуль docstring)."""
    company = db.get(Company, company_id)
    if company is None:
        raise HTTPException(404, "Компания не найдена.")

    stmt = (
        select(CompanyMembership)
        .where(CompanyMembership.company_id == company_id)
        .options(joinedload(CompanyMembership.user))
    )
    members = [
        {
            "id": m.user.id,
            "fio": m.user.fio,
            "login": m.user.login,
            "role": m.role,
            "status": m.user.status,
        }
        for m in db.scalars(stmt)
    ]
    members.sort(key=lambda m: m["fio"])

    return {**_company_dict(company), "members": members}


@router.post("")
def create_company(body: NewCompanyRequest, db: Session = Depends(get_db)) -> dict:
    if not body.company_name.strip():
        raise HTTPException(400, "Название компании обязательно.")
    if not is_valid_tz_name(body.timezone):
        raise HTTPException(400, "Неизвестный часовой пояс.")

    company = Company(name=body.company_name.strip(), timezone=body.timezone)
    db.add(company)
    db.flush()

    target_user, attached_existing = attach_or_create_membership(
        db, login=body.login, company_id=company.id, role=DEVELOPER, password=body.password, fio=body.fio
    )
    return {"company_id": company.id, "user_id": target_user.id, "attached_existing": attached_existing}
