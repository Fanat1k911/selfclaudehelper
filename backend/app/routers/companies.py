"""Заведение новых компаний (тенантов) — только DEVELOPER, не FOUNDER (Founder привязан
к своей компании и не должен плодить чужие, см. CLAUDE.md → "Мультитенантность").

Единственный роутер, который намеренно НЕ фильтрует по user["company_id"] — вся его
задача cross-tenant: список существующих компаний и создание новой. Это осознанное
исключение из архитектурного принципа №5 (CLAUDE.md), не забытый фильтр.

Заменяет часть сценария `scripts/create_founder.py` (CLI-скрипт остаётся для бутстрапа
первой компании на чистой БД, где ещё некому зайти в интерфейс) — теперь Developer может
завести новую компанию прямо из приложения. При создании компании сразу заводится первый
Developer-аккаунт этой компании (не Founder — Founder разработчик заводит потом отдельно,
через тот же `create_founder.py --company-id`, или это станет отдельной кнопкой позже)."""

import bcrypt
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.constants import DEVELOPER, USER_STATUS_ACTIVE
from app.db import get_db
from app.models import Company, User
from app.schemas import NewCompanyRequest
from app.security import require_roles

router = APIRouter(prefix="/api/companies", tags=["companies"], dependencies=[Depends(require_roles(DEVELOPER))])


def _company_dict(company: Company) -> dict:
    return {
        "id": company.id,
        "name": company.name,
        "created_at": company.created_at.isoformat(),
    }


@router.get("")
def list_companies(db: Session = Depends(get_db)) -> list[dict]:
    stmt = select(Company).order_by(Company.name)
    return [_company_dict(c) for c in db.scalars(stmt)]


@router.post("")
def create_company(body: NewCompanyRequest, db: Session = Depends(get_db)) -> dict:
    if not body.company_name.strip() or not body.fio.strip() or not body.login.strip() or not body.password:
        raise HTTPException(400, "Название компании, ФИО, логин и пароль обязательны.")

    # Логин глобально уникален (не per-company) — та же проверка, что в users.py::create_user.
    existing = db.scalar(select(User).where(User.login.ilike(body.login.strip())))
    if existing:
        raise HTTPException(400, "Такой логин уже занят.")

    company = Company(name=body.company_name.strip())
    db.add(company)
    db.flush()

    user = User(
        company_id=company.id,
        fio=body.fio.strip(),
        login=body.login.strip(),
        password_hash=bcrypt.hashpw(body.password.encode("utf-8"), bcrypt.gensalt()).decode(),
        role=DEVELOPER,
        status=USER_STATUS_ACTIVE,
    )
    db.add(user)
    db.commit()
    return {"company_id": company.id, "user_id": user.id}
